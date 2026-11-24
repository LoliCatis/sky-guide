// Цены: Bazaar (официальный API), lowest BIN по полному скану аукциона, реальные продажи (auctions_ended),
// почасовая история (14 дней) и тренды. Замена server/prices.js ядра: прежние экспорты сохранены.
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import nbt from 'prismarine-nbt';
import { config } from './config.js';
import { getBazaar, getAuctionPage } from './hypixel.js';
import { getJson } from './http.js';
import { normalizeItem } from './nbt.js';
import { parseBazaar } from './market/bazaar.js';
import { auctionKey, createBinBuilder, createSoldStore, recordSale, pruneSold, soldStats } from './market/auctions.js';
import { pushHourly, trend, trendLabel } from './market/history.js';
import { variantKey } from './market/resale.js';

export const prices = {
  bazaar: new Map(),     // id -> { buy, sell, buyVol, sellVol, buyWeek, sellWeek, buyOrders, sellOrders, buyAvg, sellAvg }
  bin: new Map(),        // id -> { price, count, second, auction, max? }  (max — цена питомца 100 уровня)
  binVar: new Map(),     // 'ID@5r' -> то же для вариантов: звёзды 0/5/10, r — с Recombobulator (флипы улучшений)
  bazaarAt: 0,
  bazaarDemo: false,     // цены из data/fixture-bazaar.json (нет сети) — графики «Рынка» рисуют примерную историю
  binAt: 0,
  binError: null,        // текст последней ошибки скана аукциона (null — всё хорошо)
  soldAt: 0,
  history: {},           // id -> [[часTs, buy, sell]] среднее за час, 14 дней
  binHistory: {},        // id -> [[часTs, price]]
  sold: createSoldStore(), // реальные продажи аукциона
};

/** Цены уже пришли (после перезапуска сервера первые ~20-60 с их нет и предметы стоят «0») */
export function pricesReady() {
  return prices.bazaarAt > 0 && (prices.binAt > 0 || !!prices.binError);
}

const HIST_FILE = () => path.join(config.dataDir, 'price-history.json');
const SAVE_EVERY = 3 * 60_000; // при перезапуске теряется не больше 3 минут (точки почасовые)
const counters = { bz: new Map(), bin: new Map() };
let lastSave = 0;

export function loadHistory() {
  try {
    const d = JSON.parse(fs.readFileSync(HIST_FILE(), 'utf8'));
    prices.history = d.history || {};
    prices.binHistory = d.binHistory || {};
    // Разовая чистка после первой версии дозаполнения (для аукциона брался шумный min продаж Coflnet): убираем точки до запуска сайта на ПК
    if (!d.binClean) {
      const since = Date.UTC(2026, 10, 22, 19, 0);
      for (const id of Object.keys(prices.binHistory)) prices.binHistory[id] = prices.binHistory[id].filter(p => p[0] >= since);
      // и Bazaar: там время Coflnet было прочитано как местное (сдвиг на часовой пояс ПК) — дозаполнится заново
      for (const id of Object.keys(prices.history)) prices.history[id] = prices.history[id].filter(p => p[0] >= since);
    }
    if (d.sold?.samples) prices.sold = d.sold;
  } catch {}
}

/** Сохранить историю на диск (атомарно). force — без ограничения частоты. */
export function saveHistory(force = false) {
  if (!force && Date.now() - lastSave < SAVE_EVERY) return;
  lastSave = Date.now();
  fs.mkdirSync(config.dataDir, { recursive: true });
  const tmp = HIST_FILE() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ v: 2, binClean: true, history: prices.history, binHistory: prices.binHistory, sold: prices.sold }));
  fs.renameSync(tmp, HIST_FILE());
}

export async function refreshBazaar() {
  let d;
  try { d = await getBazaar(); prices.bazaarDemo = false; }
  catch (e) {
    // Демо-режим без сети: примерные цены из data/fixture-bazaar.json
    const fx = path.join(config.dataDir, 'fixture-bazaar.json');
    if (!fs.existsSync(fx)) throw e;
    d = JSON.parse(fs.readFileSync(fx, 'utf8'));
    prices.bazaarDemo = true;
  }
  const now = Date.now();
  const map = parseBazaar(d);
  if (!map.size) throw new Error('Bazaar вернул пустой список товаров');
  for (const [id, rec] of map) pushHourly(prices.history, counters.bz, id, now, [rec.buy, rec.sell]);
  prices.bazaar = map;
  prices.bazaarAt = now;
  saveHistory();
}

// ---------- аукцион ----------
async function decodeRaw(b64) {
  const buf = gunzipSync(Buffer.from(b64, 'base64'));
  const { parsed } = await nbt.parse(buf);
  const raw = (nbt.simplify(parsed).i || [])[0];
  return { item: normalizeItem(raw), ea: raw?.tag?.ExtraAttributes || {} };
}

// Лоты живут долго, поэтому ключ предмета кэшируем по uuid лота и не разбираем NBT повторно
const keyCache = new Map(); // uuid -> { key, count, petMax } | null
/** Сколько лотов аукциона в кэше разобранных ключей (для панели состояния) */
export const auctionCacheSize = () => keyCache.size;

async function keyOfAuction(a) {
  if (keyCache.has(a.uuid)) return keyCache.get(a.uuid);
  let v = null;
  try {
    const { item, ea } = await decodeRaw(a.item_bytes);
    const k = auctionKey(item, ea);
    if (k) v = { key: k.key, count: item.count || 1, petMax: !!k.petMax, variant: variantKey(item) };
  } catch {}
  keyCache.set(a.uuid, v);
  return v;
}

let scanning = false;
export async function refreshAuctions({ concurrency = 6 } = {}) {
  if (scanning) return;
  scanning = true;
  try {
    const first = await getAuctionPage(0);
    const pages = first.totalPages || 1;
    const builder = createBinBuilder();
    const varBuilder = createBinBuilder();
    const seen = new Set();
    const handle = async auctions => {
      for (const a of auctions || []) {
        if (!a.bin || a.claimed) continue;
        seen.add(a.uuid);
        const k = await keyOfAuction(a);
        if (!k) continue;
        builder.add(k.key, a.starting_bid / k.count, a.uuid, k.petMax);
        if (k.variant) varBuilder.add(k.variant, a.starting_bid / k.count, a.uuid);
      }
    };
    await handle(first.auctions);
    for (let p = 1; p < pages; p += concurrency) {
      const batch = await Promise.all(
        Array.from({ length: concurrency }, (_, i) => p + i).filter(x => x < pages)
          .map(x => getAuctionPage(x).catch(() => ({ auctions: [] }))));
      for (const b of batch) await handle(b.auctions);
    }
    for (const uuid of keyCache.keys()) if (!seen.has(uuid)) keyCache.delete(uuid);
    const lowest = builder.result();
    if (!lowest.size) throw new Error('Аукцион вернул пустой список');
    prices.bin = lowest;
    prices.binVar = varBuilder.result();
    prices.binAt = Date.now();
    for (const [id, v] of lowest) pushHourly(prices.binHistory, counters.bin, id, prices.binAt, [v.price]);
    saveHistory();
    prices.binError = null;
    console.log(`[AH] просканировано страниц: ${pages}, уникальных BIN-предметов: ${lowest.size}`);
  } catch (e) {
    prices.binError = e.message || String(e);
    throw e;
  } finally {
    scanning = false;
  }
}

// Реальные продажи за последнюю минуту. Вызывать раз в 60 секунд.
const seenEnded = new Map(); // auction_id -> ts
export async function refreshEndedAuctions() {
  const d = await getJson('https://api.hypixel.net/v2/skyblock/auctions_ended');
  const now = Date.now();
  let added = 0;
  for (const a of d.auctions || []) {
    if (seenEnded.has(a.auction_id)) continue;
    seenEnded.set(a.auction_id, now);
    if (!a.bin) continue; // ставочные аукционы искажают цену
    try {
      const { item, ea } = await decodeRaw(a.item_bytes);
      const k = auctionKey(item, ea);
      if (!k) continue;
      recordSale(prices.sold, k.key, a.price / (item.count || 1), a.timestamp || now);
      const vk = variantKey(item);
      if (vk) recordSale(prices.sold, vk, a.price / (item.count || 1), a.timestamp || now);
      added++;
    } catch {}
  }
  for (const [id, t] of seenEnded) if (t < now - 10 * 60_000) seenEnded.delete(id);
  pruneSold(prices.sold, now);
  prices.soldAt = now;
  return added;
}

// ---------- оценки ----------
// Оценка стоимости предмета: Bazaar (мгновенная продажа), иначе lowest BIN, иначе медиана продаж
export function priceOf(id) {
  if (!id) return 0;
  const bz = prices.bazaar.get(id);
  if (bz) return bz.sell || bz.buy || 0;
  const b = prices.bin.get(id);
  if (b) return b.price;
  return soldStats(prices.sold, id)?.median || 0;
}

/**
 * Цена питомца с учётом уровня: lowest BIN среди питомцев 100 уровня (для максимальных),
 * иначе самый дешёвый лот (обычно 1 уровень).
 */
export function petPriceOf(id, maxed) {
  const b = prices.bin.get(id);
  if (maxed && b?.max) return b.max;
  return priceOf(id);
}

/**
 * Изменение цены за 24 часа и 7 дней.
 * @returns {{ id, market: 'Bazaar'|'Auction House'|null, now, d1: {from, pct}|null, d7: {from, pct}|null, min7, max7, median7, volatility, label }}
 */
export function priceTrend(id) {
  const bz = prices.bazaar.get(id);
  if (bz) {
    const t = trend(prices.history[id], bz.sell, 2);
    const tb = trend(prices.history[id], bz.buy, 1);
    return { id, market: 'Bazaar', ...t, buy: tb, label: trendLabel(t) };
  }
  const b = prices.bin.get(id);
  if (b) {
    const t = trend(prices.binHistory[id], b.price, 1);
    return { id, market: 'Auction House', ...t, label: trendLabel(t) };
  }
  return { id, market: null, now: 0, d1: null, d7: null, min7: null, max7: null, median7: null, volatility: null, label: 'нет данных' };
}

export function priceInfo(id) {
  return {
    bazaar: prices.bazaar.get(id) || null,
    bin: prices.bin.get(id) || null,
    sold: soldStats(prices.sold, id),
    trend: priceTrend(id),
    history: prices.history[id] || null,
    binHistory: prices.binHistory[id] || null,
  };
}
