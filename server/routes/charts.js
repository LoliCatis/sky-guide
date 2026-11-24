// Биржевые графики раздела «Рынок»: сбор свечей Bazaar и API для графика.
//   GET /api/market/candles/:id?tf=1h&to=<сек>&limit=1000 — свечи товара (см. server/market/candles.js)
//   GET /api/market/charts — сколько накоплено (для страницы «Сервер»)
import path from 'node:path';
import { createChartStore } from '../market/chart-store.js';
import { TIMEFRAMES, BASES, compact, coflToCandles, hourlyToCandles, openCandle, aggregate } from '../market/candles.js';
import { backfillCandles } from '../market/backfill.js';

// Пояснения под графиком. Идут через «подсказки по тексту» (refs), как и весь текст сайта
export const MARKET_HELP = [
  'Цена покупки — за сколько ты сразу купишь товар на Bazaar (самый дешёвый ордер на продажу). Цена продажи — за сколько сразу продашь (самый дорогой ордер на покупку). Разница между ними — спред: на нём зарабатывают перекупщики, выставляя ордера.',
  'Свеча показывает цену за период: открытие, максимум, минимум и закрытие. Зелёная — за период цена выросла, красная — упала.',
  'Hypixel отдаёт только текущие цены, поэтому историю копит сам сайт: цены записываются каждые 20 секунд. Минутные свечи хранятся 3 дня, пятиминутные — месяц, часовые — год, дневные — всё время. Самые ходовые товары дозаполнены прошлым месяцем.',
  'Объём — оценка по недельным счётчикам Hypixel: отдельные сделки игра не показывает, поэтому это примерное число купленных и проданных штук.',
  'Управление: колесо мыши или щипок двумя пальцами — масштаб, перетаскивание — прокрутка, перетаскивание шкалы цены — растянуть по высоте, двойной клик по шкале — сброс. Esc отменяет рисование и выходит из полного экрана.',
  'Время на графике — твоё местное. Дневные, недельные и месячные свечи начинаются в полночь по всемирному времени (UTC).',
];

/**
 * @param {{ dataDir: string, prices: any, itemName: (id:string)=>string, textRefs?: (text:string)=>any, log?: Function }} deps
 */
export function createCharts({ dataDir, prices, itemName, textRefs = null, log = console.log }) {
  const store = createChartStore({ dir: path.join(dataDir, 'market'), log });
  const timers = [];

  /** Каждое обновление Bazaar — в свечи. */
  const onBazaar = () => { if (prices.bazaar.size) store.tick(prices.bazaar, prices.bazaarAt || Date.now()); };

  /** Старая почасовая история (14 дней, data/price-history.json) → часовые и дневные свечи до начала своих. */
  async function seedFromHourly() {
    let added = 0;
    for (const [id, pts] of Object.entries(prices.history || {})) {
      if (!pts?.length) continue;
      const first = await store.firstTime(id, '1h');
      if (first != null && first <= Math.floor(pts[0][0] / 1000)) continue;
      added += await store.insertOlder(id, '1h', hourlyToCandles(pts, '1h'));
      added += await store.insertOlder(id, '1d', hourlyToCandles(pts, '1d'));
    }
    if (added) log(`[рынок] перенёс почасовую историю цен в свечи: ${added}`);
    return added;
  }

  /**
   * Демо без сети (цены из data/fixture-bazaar.json): чтобы графики было на чём посмотреть, рисуем случайное блуждание
   * вокруг текущей цены. Только в демо-режиме и только если своей истории нет совсем.
   */
  async function seedDemo() {
    // Только демо без ключа: на боевом сервере с ключом разовый сбой Hypixel не должен дорисовать фейковую историю
    if (!prices.bazaarDemo || process.env.HYPIXEL_API_KEY?.trim() || store.hasData()) return 0;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const now = Math.floor(Date.now() / 1000);
    let added = 0;
    for (const [id, p] of [...prices.bazaar].slice(0, 60)) {
      if (!(p.buy > 0 && p.sell > 0)) continue;
      const make = (sec, count) => {
        const out = [];
        let b = p.buy, s = p.sell;
        const end = Math.floor(now / sec) * sec - sec; // до текущей (её начнёт живой поток)
        for (let i = 0; i < count; i++) {
          const t = end - i * sec;
          const nb = b * (1 + (rnd() - 0.5) * 0.03), ns = Math.min(nb * 0.985, s * (1 + (rnd() - 0.5) * 0.03));
          const c = openCandle(t, nb, ns, rnd() * (p.buyWeek || 1000) / (604800 / sec), rnd() * (p.sellWeek || 1000) / (604800 / sec));
          c[1] = b; c[2] = Math.max(b, nb) * (1 + rnd() * 0.01); c[3] = Math.min(b, nb) * (1 - rnd() * 0.01);
          c[5] = s; c[6] = Math.max(s, ns) * (1 + rnd() * 0.01); c[7] = Math.min(s, ns) * (1 - rnd() * 0.01);
          out.push(c); b = nb; s = ns;
        }
        return out.reverse();
      };
      added += await store.insertOlder(id, '1m', make(60, 600));
      added += await store.insertOlder(id, '5m', make(300, 2000));
      const hours = make(3600, 24 * 120);
      added += await store.insertOlder(id, '1h', hours);
      added += await store.insertOlder(id, '1d', aggregate(hours, '1d'));
    }
    if (added) log(`[рынок] демо: нарисовал примерную историю свечей (${added})`);
    return added;
  }

  function start({ backfill = process.env.PRICE_BACKFILL !== '0' } = {}) {
    const every = (fn, ms) => { const t = setInterval(() => fn().catch(e => log(`[рынок] ${e.message}`)), ms); t.unref?.(); timers.push(t); };
    every(store.flush, 30_000);
    every(store.compact, 3600_000);
    const later = (fn, ms) => { const t = setTimeout(() => fn().catch(e => log(`[рынок] ${e.message}`)), ms); t.unref?.(); timers.push(t); };
    later(async () => { await seedDemo(); await seedFromHourly(); }, 15_000);
    if (backfill) {
      const fill = () => backfillCandles(store, prices, { coflToCandles, log });
      later(fill, 8 * 60_000); // после дозаполнения почасовой истории (4 мин), чтобы не долбить Coflnet одновременно
      every(fill, 24 * 3600_000);
    }
  }

  function mount(app) {
    app.get('/api/market/candles/:id', async (req, res) => {
      const id = String(req.params.id);
      const tf = TIMEFRAMES[req.query.tf] ? String(req.query.tf) : '1h';
      const limit = Math.max(10, Math.min(Number(req.query.limit) || 1000, 3000));
      const to = req.query.to ? Number(req.query.to) : Infinity;
      try {
        const { candles, hasMore } = await store.candles(id, tf, { to, limit });
        const bz = prices.bazaar.get(id);
        res.set('Cache-Control', 'no-store');
        res.json({
          id, name: itemName(id) || id, tf, candles: candles.map(compact), hasMore,
          live: bz ? { buy: bz.buy, sell: bz.sell, buyWeek: bz.buyWeek, sellWeek: bz.sellWeek, buyOrders: bz.buyOrders, sellOrders: bz.sellOrders, buyVol: bz.buyVol, sellVol: bz.sellVol, at: prices.bazaarAt } : null,
          keep: { [TIMEFRAMES[tf].base]: BASES[TIMEFRAMES[tf].base].keep },
        });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.get('/api/market/charts', (req, res) => res.json(status()));
    // Словарь подсказок пересчитываем раз в 10 минут: сразу после запуска база NEU может быть ещё не загружена
    let help = { at: 0, refs: null };
    app.get('/api/market/help', (req, res) => {
      if (Date.now() - help.at > 600_000) { try { help = { at: Date.now(), refs: textRefs ? textRefs(MARKET_HELP.join('\n')) : null }; } catch { /* без подсказок */ } }
      res.json({ texts: MARKET_HELP, refs: help.refs });
    });
  }

  // Обход тысяч файлов — не чаще раза в минуту (панель «Сервер» спрашивает каждые 5 с)
  let disk = { at: 0, v: null };
  const status = () => {
    if (Date.now() - disk.at > 60_000) disk = { at: Date.now(), v: store.diskUsage() };
    return { ...disk.v, products: store.products(), ...store.stats };
  };

  return { store, onBazaar, start, mount, status, seedFromHourly, seedDemo, close: () => store.close(), closeSync: () => store.closeSync(), stop: () => timers.forEach(t => clearInterval(t)) };
}
