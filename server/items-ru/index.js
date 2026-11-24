// Публичный API модуля items-ru: русская база предметов Hypixel SkyBlock.
//
// Два режима:
//  1) готовые данные из data/*.json (собираются scripts/build.js) — работает сразу после импорта;
//  2) loadFromNeu(neu) — пересобрать базу в памяти из уже загруженной ядром NEU-базы
//     (server/neu.js: neu.items + neu.constants), чтобы данные всегда были свежими.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDatabase } from './lib/build-db.js';
import { createSearch } from './lib/search.js';
import { translateLore, translateLoreLine as tLine, stripColor } from './lib/lore.js';
import { translateStat as tStat, fmtCoins } from './lib/glossary.js';

export * as glossary from './lib/glossary.js';
export { translit, skeleton, ALIASES } from './lib/search.js';
export { translateLore, stripColor };

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const readJson = (f, def) => {
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return def; }
};

const state = { items: null, lore: null, search: null, source: 'none', loadedAt: 0, shards: null };

function ensure() {
  if (state.items) return;
  state.items = readJson('items-ru.json', {});
  state.search = createSearch(state.items);
  state.source = 'data';
  state.loadedAt = Date.now();
}

/**
 * Пересобрать базу из NEU-базы ядра (server/neu.js). Вызывайте после loadNeu().
 * @param {{ items: Map<string, object>|object[], constants?: object }} neu
 * @returns {{ items: number, ms: number }}
 */
export function loadFromNeu(neu) {
  const t0 = Date.now();
  const list = neu.items instanceof Map ? neu.items.values() : neu.items;
  const curated = readJson('curated-ru.json', {});
  delete curated.$comment;
  const db = buildDatabase(list, { constants: neu.constants || {}, vanillaRu: readJson('vanilla-ru.json', {}), curated });
  state.items = db.items;
  state.lore = db.lore;
  state.search = createSearch(db.items);
  state.shards = null;
  state.source = 'neu';
  state.loadedAt = Date.now();
  return { items: Object.keys(db.items).length, ms: Date.now() - t0 };
}

/** ID с Bazaar/инвентаря → ID базы: ENCHANTMENT_SHARPNESS_7 → SHARPNESS;7, INK_SACK:3 → INK_SACK-3 и т.п. */
export function normalizeId(id) {
  if (!id) return id;
  ensure();
  if (state.items[id]) return id;
  let m;
  if ((m = /^ENCHANTMENT_(.+)_(\d+)$/.exec(id))) {
    const c = `${m[1]};${m[2]}`;
    if (state.items[c]) return c;
  }
  if (id.includes(':')) {
    const c = id.replace(':', '-');
    if (state.items[c]) return c;
  }
  if (ID_ALIASES[id] && state.items[ID_ALIASES[id]]) return ID_ALIASES[id];
  // Bazaar продаёт осколки по имени моба (SHARD_SEA_EMPEROR), а NEU хранит их по атрибуту (ATTRIBUTE_SHARD_…;1)
  if ((m = /^SHARD_(.+)$/.exec(id))) {
    const c = shardId(m[1]);
    if (c) return c;
  }
  return id;
}

// В API/Bazaar и в базе названия иногда расходятся или моба переименовали
const SHARD_ALIASES = { SEA_EMPEROR: 'LOCH_EMPEROR', BRUISER: 'ZEALOT_BRUISER', PACKRAT_SKULL: 'PACKRAT', ABYSSAL_LANTERN: 'ABYSSAL_LANTERNFISH' };
// Bazaar-ID, которые не совпадают с ID в NEU (старое имя товара)
const ID_ALIASES = { ENCHANTED_CARROT_ON_A_STICK: 'ENCHANTED_CARROT_STICK' };

/**
 * ID осколка в базе по имени моба: "ZEALOT" / "SEA_EMPEROR" → "ATTRIBUTE_SHARD_…;1".
 * @param {string} type имя из API или хвост Bazaar-ID SHARD_…
 * @returns {string|undefined}
 */
export function shardId(type) {
  ensure();
  if (!state.shards) {
    state.shards = new Map();
    for (const it of Object.values(state.items)) {
      if (it.category !== 'shard' || !it.id.startsWith('ATTRIBUTE_SHARD_')) continue;
      const n = (it.nameEn || '').replace(/\s+Shard$/i, '');
      if (n) state.shards.set(n.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), it.id);
    }
  }
  const idx = state.shards;
  const t = String(type || '').toUpperCase();
  for (const k of [t, t.replace(/SPECTER/g, 'SPECTRE'), SHARD_ALIASES[t]]) if (k && idx.has(k)) return idx.get(k);
  // В Bazaar-ID слова разделены иначе, чем в названии: CINDER_BAT ↔ «Cinderbat», ENDSTONE_PROTECTOR ↔ «End Stone Protector»
  const flat = k => k.replace(/_/g, '');
  const same = [...idx.keys()].filter(k => flat(k) === flat(t));
  if (same.length === 1) return idx.get(same[0]);
  const tail = [...idx.keys()].filter(k => k.endsWith('_' + t));
  return tail.length === 1 ? idx.get(tail[0]) : undefined;
}

/**
 * Только названия предмета (дёшево, без копирования карточки).
 * @param {string} id любой ID: NEU, Bazaar (ENCHANTMENT_X_N, SHARD_X, INK_SACK:3)
 * @returns {{ id: string, nameEn: string, nameRu: string } | null}
 */
export function getNames(id) {
  ensure();
  const key = normalizeId(id);
  const it = state.items[key];
  return it ? { id: key, nameEn: it.nameEn, nameRu: it.nameRu, category: it.category || null } : null;
}

/**
 * Русская карточка предмета.
 * @param {string} id SkyBlock ID (HYPERION, SHARPNESS;7, ENCHANTMENT_SHARPNESS_7, ENDER_DRAGON;4)
 * @param {{ prices?: { bazaar?: Map<string, any>, bin?: Map<string, any> } }} [opt] цены ядра — добавят строки «Bazaar»/«аукцион»
 * @returns {null | (import('./lib/build-db.js').ItemRu & { whereToGet: import('./lib/build-db.js').WhereToGet[] })}
 */
export function getItemRu(id, opt = {}) {
  ensure();
  const key = normalizeId(id);
  const it = state.items[key];
  if (!it) return null;
  const out = { ...it, whereToGet: it.whereToGet.slice() };
  const p = opt.prices;
  if (p) {
    const bzId = /;\d+$/.test(key) && it.category === 'enchant_book' ? `ENCHANTMENT_${key.replace(';', '_')}` : key;
    const bz = p.bazaar?.get?.(bzId) || p.bazaar?.get?.(key);
    if (bz && bz.buy) out.whereToGet.unshift({ kind: 'shop', source: 'BAZAAR', textRu: `Купить на Bazaar: ${fmtCoins(bz.buy)} монет за шт. (мгновенная покупка)` });
    const bin = p.bin?.get?.(key);
    if (bin && bin.price) out.whereToGet.unshift({ kind: 'shop', source: 'AUCTION', textRu: `Купить на аукционе: от ${fmtCoins(bin.price)} монет, лотов: ${bin.count ?? '?'}` });
  }
  return out;
}

/** Переведённый лор предмета (строки без §-цветов) */
export function getLoreRu(id) {
  ensure();
  const key = normalizeId(id);
  if (!state.lore) state.lore = readJson('lore-ru.json', {});
  return state.lore[key] || null;
}

/**
 * Поиск по русским и английским названиям, транслиту («гиперион»), жаргону («аоте», «терма»)
 * и словам-типам («меч», «аксессуары», «питомец дракон»).
 * @param {string} query
 * @param {{ limit?: number, category?: string, type?: string }} [opt]
 */
export function searchItems(query, opt) {
  ensure();
  return state.search(query, opt);
}

/** Все предметы базы (для карты сайта) */
export function allItems() {
  ensure();
  return Object.values(state.items);
}

/** Все предметы категории (weapon, armor, accessory, pet, enchant_book, ...) */
export function listByCategory(category) {
  ensure();
  return Object.values(state.items).filter(i => i.category === category);
}

/** Перевод названия характеристики: «Crit Damage» / «crit_damage» → «Крит. урон» */
export const translateStat = tStat;

/** Перевод строки лора с сохранением §-цветов (совместимо с server/i18n/ru.js ядра) */
export const translateLoreLine = tLine;

/** Сведения о загруженной базе */
export function info() {
  ensure();
  return { source: state.source, loadedAt: state.loadedAt, items: Object.keys(state.items).length, meta: readJson('meta.json', null) };
}
