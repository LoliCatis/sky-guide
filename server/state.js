// Общее состояние, обновление профиля и лента изменений
import { rankFor } from './rank.js';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { config } from './config.js';
import { resolveUuid, getProfiles, getGarden, getMuseum } from './hypixel.js';
import { pickProfile, parseMember, parseGarden } from './parse/profile.js';
import { analyzeAccessories, analyzeGear } from './parse/gear.js';
import { advise, diffRoadmaps } from './analysis/roadmap.js';
import { moneyMethods, setMoneyOwner } from './analysis/money.js';
import { SKILLS, SLAYERS } from './i18n/ru.js';
import { pricesReady, priceOf, prices } from './prices.js';
import { petScoreSummary } from './analysis/pet-score.js';
import { chocolateAdvice } from './analysis/chocolate.js';
import { listByCategory } from './items-ru/index.js';
import { neu, itemName } from './neu.js';
import { museumSummary } from './museum/index.js';
import { pushSnapshot, compactHistory } from './history.js';

export const bus = new EventEmitter();
bus.setMaxListeners(100);

export const state = {
  status: 'starting',
  error: null,
  player: null,
  member: null,
  analysis: null,
  profiles: [],
  updatedAt: 0,
  feed: [],          // лента изменений
  history: [],       // почасовые снимки ключевых показателей
};

const HIST = () => path.join(config.dataDir, 'profile-history.json');
const FIXTURE = () => path.join(config.dataDir, 'fixture-profiles.json');

// История прореживается при загрузке: файл, записанный до прореживания (60 дней по часу), сразу ужимается
// lastSnap — последний снимок (не только часовой): после перезапуска сервера (автообновление с main) лента сравнивает
// с ним, а не с часовой точкой истории, иначе прирост с прошлого часа попадает в ленту ещё раз после каждого рестарта
let savedSnap = null;
try { const h = JSON.parse(fs.readFileSync(HIST(), 'utf8')); state.history = compactHistory(h.history || []); state.feed = h.feed || []; savedSnap = h.lastSnap || null; } catch {}

const r3 = x => +(Number(x) || 0).toFixed(3);
const lvl = l => r3((l?.level || 0) + (l && l.progress < 1 ? l.progress : 0));
const sum = o => Object.values(o || {}).reduce((s, v) => s + (Number(v) || 0), 0);

/**
 * Почасовой снимок для графиков истории. Поля t, sb, nw, coins, mp, cata, skills, slayers — как и раньше
 * (старые снимки остаются совместимыми), остальное добавлено для графиков «по всем показателям».
 */
export function snapshot(m, gear) {
  const s = {
    t: Date.now(),
    sb: m.sbLevel,
    nw: Math.round(gear.networth.total),
    coins: Math.round(gear.networth.coins),
    mp: m.magicalPower,
    cata: +(m.dungeons.catacombs.level + m.dungeons.catacombs.progress).toFixed(3),
    skills: Object.fromEntries(Object.entries(m.skills).map(([k, s]) => [k, Math.round(s.xp)])),
    slayers: Object.fromEntries(Object.entries(m.slayers).map(([k, s]) => [k, s.xp])),
  };
  const extra = {
    items: Math.round(gear.networth.items || 0),
    bank: Math.round(m.bank || 0),
    purse: Math.round(m.purse || 0),
    classes: m.dungeons?.classes ? Object.fromEntries(Object.entries(m.dungeons.classes).map(([k, c]) => [k, lvl(c)])) : null,
    secrets: m.dungeons?.secrets,
    floors: sum(m.dungeons?.floors) + sum(m.dungeons?.masterFloors),
    hotm: lvl(m.mining?.hotm),
    powder: m.mining?.powder ? { mithril: m.mining.powder.mithril || 0, gemstone: m.mining.powder.gemstone || 0, glacite: m.mining.powder.glacite || 0 } : null,
    hotfXp: m.hotfXp,
    garden: m.garden?.experience,
    visitors: m.garden?.visitorsServed,
    kuudra: sum(m.crimson?.kuudra),
    rep: Math.max(m.crimson?.barbarianRep || 0, m.crimson?.mageRep || 0),
    trophy: m.crimson?.trophyFish?.total_caught || sum(m.crimson?.trophyFish && Object.fromEntries(Object.entries(m.crimson.trophyFish).filter(([k, v]) => /_(bronze|silver|gold|diamond)$/.test(k) && typeof v === 'number'))),
    petScore: m.leveling?.petScore,
    pets: m.pets?.length,
    souls: m.fairySouls?.collected,
    museum: m.museum?.status === 'ok' ? m.museum.count : null,
    bestiary: m.bestiaryMilestone,
    tasks: m.leveling?.tasksDone,
  };
  // Нет данных (API выключен, поля нет у профиля) — поле не пишем, и на графике будет «нет данных», а не ноль
  for (const [k, v] of Object.entries(extra)) if (v != null && !Number.isNaN(v)) s[k] = v;
  return s;
}

// Шаги, которые зависят от цен и меняются без действий игрока — их в ленту не пишем
const PRICE_DRIVEN = /^(money-|mp-cheap|mp-expensive|mp-recomb|museum-cheap|museum-milestone|gear-upgrades)/;

/** Что изменилось в плане после обновления профиля: выполненные шаги и новые важные советы. */
export function adviceFeed(prevRoadmap, roadmap, t = Date.now()) {
  if (!prevRoadmap?.length || !roadmap) return [];
  const { completed, added } = diffRoadmaps(prevRoadmap.filter(s => !PRICE_DRIVEN.test(s.id)), roadmap.filter(s => !PRICE_DRIVEN.test(s.id)));
  return [
    ...completed.map(s => ({ t, kind: 'done', text: `Выполнено: ${s.title}` })),
    ...added.filter(s => s.priority >= 50).map(s => ({ t, kind: 'advice', text: `Новый совет: ${s.title}` })),
  ];
}

export function diffFeed(prev, cur) {
  if (!prev) return [];
  const ev = [];
  for (const [k, xp] of Object.entries(cur.skills)) {
    const d = xp - (prev.skills?.[k] || 0);
    if (d > 0) ev.push({ t: cur.t, kind: 'skill', text: `+${d.toLocaleString('ru-RU')} опыта: ${SKILLS[k]}` });
  }
  for (const [k, xp] of Object.entries(cur.slayers)) {
    const d = xp - (prev.slayers?.[k] || 0);
    if (d > 0) ev.push({ t: cur.t, kind: 'slayer', text: `+${d.toLocaleString('ru-RU')} опыта слеера: ${SLAYERS[k]?.name || k}` });
  }
  if (cur.mp !== prev.mp) ev.push({ t: cur.t, kind: 'mp', text: `Magical Power: ${prev.mp} → ${cur.mp}` });
  if (Math.floor(cur.sb) > Math.floor(prev.sb)) ev.push({ t: cur.t, kind: 'level', text: `Новый уровень SkyBlock: ${Math.floor(cur.sb)}!` });
  if (Math.floor(cur.cata) > Math.floor(prev.cata)) ev.push({ t: cur.t, kind: 'level', text: `Catacombs ${Math.floor(cur.cata)}!` });
  const dc = cur.coins - prev.coins;
  if (Math.abs(dc) > 100_000) ev.push({ t: cur.t, kind: 'coins', text: `${dc > 0 ? '+' : ''}${dc.toLocaleString('ru-RU')} монет` });
  return ev;
}

/** Полный анализ участника (аксессуары, снаряжение, план, заработок). Чистая функция: годится и для чужих профилей. */
export function analyzeMember(m) {
  const acc = analyzeAccessories(m);
  const gear = analyzeGear(m);
  const { roadmap, map, plan, summary } = advise(m, acc, gear);
  const methods = moneyMethods(m, { networth: gear?.networth?.total });
  let museum = null;
  try { museum = museumSummary(m, { constants: neu.constants, price: priceOf, name: itemName }); } catch (e) { console.warn('[музей]', e.message); }
  let petScore = null;
  try { petScore = petScoreSummary(m, { petIds: allPetIds(), price: priceOf, maxedPrice: id => { const b = prices.bin.get(id); return b?.max || 0; }, name: itemName }); } catch (e) { console.warn('[pet score]', e.message); }
  let chocolate = null;
  try { chocolate = chocolateAdvice(m.extras?.chocolate); } catch (e) { console.warn('[шоколад]', e.message); }
  return { acc, gear, roadmap, map, plan, summary, methods, museum, petScore, chocolate };
}

// Все ID питомцев вида TYPE;N: из базы предметов и из аукциона (там бывают новые питомцы раньше базы)
function allPetIds() {
  const ids = new Set();
  try { for (const it of listByCategory('pet')) if (/;\d$/.test(it.id)) ids.add(it.id); } catch { /* база ещё грузится */ }
  // С аукциона — только редкости известных типов питомцев: у рун (HOT_RUNE;1) и прочего тот же вид id «ТИП;N»
  const types = new Set([...ids].map(id => id.split(';')[0]));
  for (const id of prices.bin.keys()) if (/^[A-Z0-9_]+;\d$/.test(id) && (types.size ? types.has(id.split(';')[0]) : !/RUNE/.test(id))) ids.add(id);
  return [...ids];
}

let lastSnap = savedSnap;
export function reanalyze() {
  const m = state.member;
  if (!m) return;
  state.analysis = analyzeMember(m);
  return state.analysis.gear;
}

// Одно обновление за раз: двойной клик «Обновить», несколько вкладок и фоновый цикл не шлют
// параллельные запросы в Hypixel (каждое обновление — 3 запроса, лимит ключа легко выбить)
let inFlight = null;
export function refreshProfile() {
  if (!inFlight) inFlight = doRefreshProfile().finally(() => { inFlight = null; });
  return inFlight;
}

async function doRefreshProfile() {
  try {
    let resp;
    const useFixture = !config.apiKey && fs.existsSync(FIXTURE());
    if (useFixture) {
      resp = JSON.parse(fs.readFileSync(FIXTURE(), 'utf8'));
      state.demo = true;
      state.player ||= { uuid: Object.keys(resp.profiles[0].members)[0], name: config.player };
    }
    if (!state.player) state.player = await resolveUuid(config.player);
    const uuid = state.player.uuid;
    setMoneyOwner(uuid); // личные настройки «Заработка» (Fortune, Forge, сессии) — только для своего профиля
    if (!useFixture) {
      resp = await getProfiles(uuid);
    }
    state.profiles = (resp.profiles || []).map(p => ({ id: p.profile_id, name: p.cute_name, selected: !!p.selected, mode: p.game_mode || 'normal' }));
    const profile = pickProfile(resp.profiles, uuid, config.profileName);
    if (!profile) throw new Error('У игрока нет профилей SkyBlock');
    const extra = {};
    // Сырые ответы храним: профили друзей по тому же острову (кооп) и другие свои профили берутся отсюда без лишних запросов
    state.raw = { resp, at: Date.now(), garden: null, museum: null, profileId: profile.profile_id };
    if (state.demo) {
      try { extra.garden = state.raw.garden = parseGarden(JSON.parse(fs.readFileSync(path.join(config.dataDir, 'fixture-garden.json'), 'utf8'))); } catch { /* в демо сада может не быть */ }
    } else {
      try { extra.garden = state.raw.garden = parseGarden(await getGarden(profile.profile_id)); } catch {}
      try { state.raw.museum = await getMuseum(profile.profile_id); extra.museum = state.raw.museum?.members?.[uuid] || null; extra.museumFetched = true; } catch {}
    }
    const prevRoadmap = state.analysis?.roadmap;
    state.member = await parseMember(profile, uuid, extra);
    if (!state.demo) state.member.rank = await rankFor(uuid).catch(() => null);
    const gear = reanalyze();
    const snap = snapshot(state.member, gear);
    const prev = lastSnap || state.history[state.history.length - 1];
    const ev = [...diffFeed(prev, snap), ...adviceFeed(prevRoadmap, state.analysis?.roadmap, snap.t)];
    if (ev.length) state.feed = [...ev, ...state.feed].slice(0, 200);
    lastSnap = snap;
    // Пока цены не загрузились (сразу после перезапуска/автообновления), оценка = одни монеты: такую точку
    // в историю не пишем, иначе на графике «Состояние» провал после каждого обновления сайта
    // Раз в час; старые точки прореживаются до дневных (после 30 дней) и недельных (после года) — server/history.js
    if (pricesReady()) state.history = pushSnapshot(state.history, snap).history;
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(HIST(), JSON.stringify({ history: state.history, feed: state.feed, lastSnap }));
    state.status = 'ok';
    state.error = null;
    state.updatedAt = Date.now();
    bus.emit('profile');
  } catch (e) {
    state.status = e.code === 'NO_KEY' ? 'no_key' : 'error';
    state.error = e.message;
    console.error('[профиль]', e.message);
    bus.emit('profile');
  }
}
