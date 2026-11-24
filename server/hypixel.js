// Клиент официального Hypixel API v2 (https://api.hypixel.net)
import { config } from './config.js';
import { getJson } from './http.js';

const BASE = 'https://api.hypixel.net/v2';

// Время запросов с ключом за последние 5 минут: лимит Hypixel — 300 запросов на ключ за 5 минут,
// по этому счётчику профили друзей решают, можно ли сейчас спросить свежие данные
const keyedLog = [];
export function keyedCallsRecent(windowMs = 5 * 60_000, now = Date.now()) {
  while (keyedLog.length && now - keyedLog[0] > windowMs) keyedLog.shift();
  return keyedLog.length;
}

function keyed(path) {
  if (!config.apiKey) {
    const e = new Error('Не задан HYPIXEL_API_KEY в файле .env');
    e.code = 'NO_KEY';
    throw e;
  }
  keyedLog.push(Date.now());
  return getJson(`${BASE}${path}`, { headers: { 'API-Key': config.apiKey } });
}

export async function resolveUuid(name) {
  try {
    const d = await getJson(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`);
    return { uuid: d.id, name: d.name };
  } catch {
    // запасной вариант
    const d = await getJson(`https://api.minecraftservices.com/minecraft/profile/lookup/name/${encodeURIComponent(name)}`);
    return { uuid: d.id, name: d.name };
  }
}

/** Ник по uuid (кооп-соседи в ответе Hypixel записаны только uuid) */
export async function resolveName(uuid) {
  const id = String(uuid).replace(/-/g, '');
  const d = await getJson(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`, { timeout: 8000, retries: 1 });
  return { uuid: d.id || id, name: d.name };
}

export const getProfiles = uuid => keyed(`/skyblock/profiles?uuid=${uuid}`);
export const getGarden = profileId => keyed(`/skyblock/garden?profile=${profileId}`);
export const getMuseum = profileId => keyed(`/skyblock/museum?profile=${profileId}`);
export const getPlayer = uuid => keyed(`/player?uuid=${uuid}`);
// Публичные эндпоинты, ключ не нужен
export const getBazaar = () => getJson(`${BASE}/skyblock/bazaar`);
export const getAuctionPage = page => getJson(`${BASE}/skyblock/auctions?page=${page}`);
export const getItemsResource = () => getJson(`${BASE}/resources/skyblock/items`);
export const getCollectionsResource = () => getJson(`${BASE}/resources/skyblock/collections`);
export const getElection = () => getJson(`${BASE}/resources/skyblock/election`);
