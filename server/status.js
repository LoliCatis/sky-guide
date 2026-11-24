// Состояние сервера: для владельца — подробная панель (#/status), для игроков — одна лампочка «нагрузка».
// Считаем сами, без внешних сервисов: задержка цикла событий Node, запросы в работе и за минуту,
// расход лимита ключа Hypixel (300 запросов за 5 минут), память, CPU, последнее обновление и откат.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';

export const HYPIXEL_LIMIT = 300; // запросов на ключ за 5 минут

/** Уровень нагрузки по метрикам: 'low' | 'medium' | 'high' и причина по-русски. */
export function loadLevel({ lagMs = 0, inFlight = 0, keyed5m = 0, rpm = 0 }) {
  const keyShare = keyed5m / HYPIXEL_LIMIT;
  if (lagMs > 200 || inFlight > 25 || keyShare > 0.85) return { level: 'high', why: lagMs > 200 ? 'сервер отвечает с задержкой' : keyShare > 0.85 ? 'почти исчерпан лимит запросов к Hypixel' : 'много одновременных запросов' };
  if (lagMs > 60 || inFlight > 8 || keyShare > 0.55 || rpm > 600) return { level: 'medium', why: keyShare > 0.55 ? 'много запросов к Hypixel — чужие профили могут обновляться реже' : 'сервер занят' };
  return { level: 'low', why: 'всё спокойно' };
}

export function createStatus({ dataDir, keyedCallsRecent = () => 0, state, prices, buildId = () => 'dev', clock = () => Date.now(), historySize = () => null, marketCharts = () => null, memoryParts = () => [], apis = () => null, apiKey = '', keySince = () => null } = {}) {
  const started = clock();
  const lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  let inFlight = 0;
  const hits = []; // время запросов за последнюю минуту
  let cpuPrev = process.cpuUsage(), cpuAt = clock(), cpuPct = 0;
  const cpuTimer = setInterval(() => {
    const now = clock(), d = process.cpuUsage(cpuPrev);
    cpuPct = Math.round(((d.user + d.system) / 1000) / Math.max(1, now - cpuAt) * 100);
    cpuPrev = process.cpuUsage(); cpuAt = now;
  }, 10_000);
  cpuTimer.unref?.();

  /** middleware: считает запросы к /api */
  function track(req, res, next) {
    if (!req.path.startsWith('/api') || req.path === '/api/stream') return next();
    inFlight++;
    const now = clock();
    hits.push(now);
    while (hits.length && now - hits[0] > 60_000) hits.shift();
    let done = false;
    const end = () => { if (!done) { done = true; inFlight--; } };
    res.on('finish', end); res.on('close', end);
    next();
  }

  const lagMs = () => Math.round(lag.percentile(95) / 1e6);
  const rpm = () => { const now = clock(); while (hits.length && now - hits[0] > 60_000) hits.shift(); return hits.length; };

  function deployInfo() {
    try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'deploy-log.json'), 'utf8')); } catch { return { events: [] }; }
  }

  /** Внешние API: ключ Hypixel (без самого ключа), лимит из заголовков, источники с последним успехом и ошибкой */
  function apiInfo() {
    let snap = null;
    try { snap = apis(); } catch { snap = null; }
    if (!snap) return null;
    const h = snap.hypixel || {};
    const key = !apiKey ? 'none' : h.keyErrorAt && h.keyErrorAt > (h.keyOkAt || 0) ? 'invalid' : h.keyOkAt ? 'ok' : 'unknown';
    const limit = h.limit || null;
    return {
      key: {
        state: key,
        // У ключей разработчика Hypixel лимит 300 запросов за 5 минут; у одобренных ключей приложений — больше
        type: !limit ? null : limit <= HYPIXEL_LIMIT ? 'dev' : 'production',
        since: key === 'ok' ? (() => { try { return keySince(); } catch { return null; } })() : null,
        error: key === 'invalid' ? h.keyError : null,
      },
      rate: limit ? { limit, remaining: h.remaining, resetSec: h.resetSec, at: h.at } : null,
      sources: snap.sources || [],
    };
  }

  function publicStatus() {
    const l = loadLevel({ lagMs: lagMs(), inFlight, keyed5m: keyedCallsRecent(), rpm: rpm() });
    return { ok: true, load: l.level, why: l.why, at: clock() };
  }

  function adminStatus() {
    const mem = process.memoryUsage();
    const keyed5m = keyedCallsRecent();
    const l = loadLevel({ lagMs: lagMs(), inFlight, keyed5m, rpm: rpm() });
    const deploy = deployInfo();
    return {
      ...publicStatus(), load: l.level, why: l.why,
      uptimeSec: Math.round((clock() - started) / 1000),
      build: buildId(), node: process.version, platform: `${os.type()} ${os.release()}`,
      cpu: { process: cpuPct, cores: os.cpus().length, loadavg: os.loadavg().map(x => Math.round(x * 100) / 100) },
      memory: {
        rssMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576), heapTotalMb: Math.round(mem.heapTotal / 1048576),
        buffersMb: Math.round(mem.external / 1048576),
        systemFreeMb: Math.round(os.freemem() / 1048576), systemTotalMb: Math.round(os.totalmem() / 1048576),
        // что из данных сайта лежит в памяти: [{ label, count, unit, hint }]
        parts: (() => { try { return memoryParts(); } catch { return []; } })(),
      },
      requests: { inFlight, perMinute: rpm(), lagMs: lagMs() },
      hypixel: { used5m: keyed5m, limit5m: HYPIXEL_LIMIT },
      api: apiInfo(),
      profile: { status: state?.status ?? null, error: state?.error ?? null, updatedAt: state?.updatedAt || null },
      prices: { bazaarAt: prices?.bazaarAt || null, auctionsAt: prices?.binAt || null },
      history: (() => { try { return historySize(); } catch { return null; } })(),
      marketCharts: (() => { try { return marketCharts(); } catch { return null; } })(),
      deploy: { last: deploy.events?.[0] || null, events: (deploy.events || []).slice(0, 10), autoUpdate: process.env.AUTO_UPDATE !== '0' },
    };
  }

  return { track, publicStatus, adminStatus, stop: () => { lag.disable(); clearInterval(cpuTimer); } };
}
