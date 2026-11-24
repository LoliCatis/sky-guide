// Сервер с автообновлением: запускает server/index.js и раз в минуту проверяет origin/main.
// Если там новые коммиты: git pull --ff-only → npm install (если менялись зависимости) → npm run build → перезапуск сервера.
// Открытые вкладки сами перезагрузятся и вернутся на то же место (client/src/keepPlace.js).
// Туннель (scripts/tunnel.js) работает отдельным процессом, поэтому его адрес не меняется.
// Выключить автообновление: AUTO_UPDATE=0 в .env. Интервал: AUTO_UPDATE_SEC (по умолчанию 60).
import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const every = Math.max(process.env.NODE_ENV === 'test' ? 1 : 20, Number(process.env.AUTO_UPDATE_SEC || 60)) * 1000; // в тестах — чаще
const enabled = process.env.AUTO_UPDATE !== '0';
const log = (...a) => console.log(`[автообновление ${new Date().toLocaleTimeString('ru-RU')}]`, ...a);

// Журнал обновлений и откатов для панели состояния владельца (#/status): последние 20 событий, новые сверху
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
function record(kind, extra = {}) {
  const file = path.join(dataDir, 'deploy-log.json');
  try {
    let events = [];
    try { events = JSON.parse(fs.readFileSync(file, 'utf8')).events || []; } catch { /* первый раз */ }
    events.unshift({ kind, at: Date.now(), ...extra });
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ events: events.slice(0, 20) }, null, 2));
  } catch (e) { log('не удалось записать журнал обновлений:', e.message); }
}

let child = null;
let stopping = false;
let startedAt = 0;
let badRemote = null;   // коммит origin/main, на котором сервер падал: не ставим его снова, пока не появится новый
let onEarlyCrash = null; // проверка «сервер упал сразу после обновления» → откат

function startServer() {
  startedAt = Date.now();
  // Канал IPC: если сам скрипт автообновления умрёт (закрыли окно, убили процесс), сервер узнает об этом
  // и завершится сам. Иначе на Windows старый сервер оставался сиротой: держал порт и память, а новый не мог запуститься.
  child = spawn(process.execPath, ['server/index.js'], { cwd: root, stdio: ['inherit', 'inherit', 'inherit', 'ipc'], env: { ...process.env, SB_SUPERVISED: '1' } });
  child.on('error', e => log('не удалось запустить сервер:', e.message));
  child.on('exit', (code, sig) => {
    const was = child;
    child = null;
    if (stopping || was?._restarting) return;
    if (onEarlyCrash && Date.now() - startedAt < 60_000) { const f = onEarlyCrash; onEarlyCrash = null; f(); return; }
    log(`сервер завершился (код ${code ?? sig}), перезапускаю через 3 с`);
    record('crash', { code: code ?? sig ?? null });
    setTimeout(startServer, 3000);
  });
}

function restartServer() {
  return new Promise(resolve => {
    if (!child) { startServer(); return resolve(); }
    const c = child;
    c._restarting = true;
    c.once('exit', () => { startServer(); resolve(); });
    c.kill(win ? undefined : 'SIGTERM');
    setTimeout(() => { try { c.kill('SIGKILL'); } catch { /* уже вышел */ } }, 8000);
  });
}

const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const npm = (...args) => spawnSync(win ? 'npm.cmd' : 'npm', args, { cwd: root, encoding: 'utf8', shell: win, stdio: 'inherit' });

let busy = false;
async function check() {
  if (busy) return;
  busy = true;
  try {
    const f = git('fetch', '--quiet', 'origin', 'main');
    if (f.status !== 0) return; // нет сети — попробуем позже
    const head = git('rev-parse', 'HEAD').stdout.trim();
    const remote = git('rev-parse', 'origin/main').stdout.trim();
    if (!remote || head === remote || remote === badRemote) return;
    // Только если наш HEAD — предок origin/main (никаких локальных коммитов поверх)
    if (git('merge-base', '--is-ancestor', head, remote).status !== 0) { log('локальная ветка разошлась с origin/main — пропускаю'); return; }
    const changed = git('diff', '--name-only', head, remote).stdout.split('\n').filter(Boolean);
    log(`новые изменения (${changed.length} файлов), обновляюсь до ${remote.slice(0, 7)}`);
    const pull = git('pull', '--ff-only', '--quiet', 'origin', 'main');
    if (pull.status !== 0) { log('git pull не удался:', (pull.stderr || '').trim()); return; }
    const deps = changed.some(f => /^package(-lock)?\.json$/.test(f));
    const front = changed.some(f => /^(client\/|vite\.config|index\.html|package)/.test(f));
    // Не вышло поставить или собрать: код уже подтянут, а dist/ сборка успела очистить — без отката сайт
    // остался бы пустым, а следующий перезапуск поднял бы новый сервер со старым фронтендом
    const revert = why => {
      log(`${why} — возвращаю ${head.slice(0, 7)} и жду исправления в main`);
      badRemote = remote;
      record('rollback', { why, from: remote.slice(0, 7), to: head.slice(0, 7) });
      // --keep, а не --hard: свои несохранённые правки владельца в файлах репозитория не стираем
      const r = git('reset', '--keep', head);
      if (r.status !== 0) { log('откат не удался (есть свои правки в тех же файлах):', (r.stderr || '').trim()); return; }
      if (deps) npm('install', '--no-audit', '--no-fund');
      if (front && npm('run', 'build').status !== 0) log('старая версия тоже не собралась — сайт может не открываться, нужен ручной npm run build');
    };
    if (deps) {
      log('менялись зависимости — npm install');
      if (npm('install', '--no-audit', '--no-fund').status !== 0) { revert('npm install не удался'); return; }
    }
    if (front) {
      log('собираю сайт — npm run build');
      if (npm('run', 'build').status !== 0) { revert('сборка не удалась'); return; }
    }
    if (changed.some(f => f === 'scripts/supervisor.js')) log('изменился сам скрипт автообновления — новая версия начнёт работать после ручного перезапуска npm run share');
    // Если новая версия падает в первую минуту — откатываемся на прошлую и больше этот коммит не ставим
    onEarlyCrash = () => {
      revert(`новая версия ${remote.slice(0, 7)} падает при запуске`);
      startServer();
    };
    setTimeout(() => { onEarlyCrash = null; }, 60_000);
    await restartServer();
    log('сервер перезапущен');
    record('update', { from: head.slice(0, 7), to: remote.slice(0, 7), files: changed.length });
  } finally {
    busy = false;
  }
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stopping = true; child?.kill(); process.exit(0); });
// На любом выходе (в том числе из-за ошибки) не оставляем сервер работать без присмотра
process.on('exit', () => { stopping = true; try { child?.kill(); } catch { /* уже вышел */ } });

startServer();
if (enabled) {
  log(`включено, проверка каждые ${every / 1000} с (выключить: AUTO_UPDATE=0 в .env)`);
  setInterval(() => check().catch(e => log('ошибка:', e.message)), every);
} else {
  log('выключено (AUTO_UPDATE=0)');
}
