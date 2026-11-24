// Автообновление на «ПК» в песочнице: свой origin, сломанная сборка и падающий сервер откатываются,
// своя правка владельца в файле репозитория при откате не стирается.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sh = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

test('автообновление: сломанная сборка и падение при запуске откатываются, свои правки целы', { timeout: 90_000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-sup-'));
  const origin = path.join(dir, 'origin.git'), dev = path.join(dir, 'dev'), pc = path.join(dir, 'pc');
  sh(dir, 'init', '-q', '--bare', origin);
  sh(dir, 'clone', '-q', origin, dev);
  sh(dev, 'config', 'user.email', 't@t'); sh(dev, 'config', 'user.name', 't');
  for (const d of ['server', 'scripts', 'client']) fs.mkdirSync(path.join(dev, d));
  const w = (f, s) => fs.writeFileSync(path.join(dev, f), s);
  w('package.json', '{"name":"x","type":"module","scripts":{"build":"node build.js"}}');
  w('build.js', "import fs from 'node:fs'; fs.rmSync('dist',{recursive:true,force:true}); fs.mkdirSync('dist'); const v=fs.readFileSync('client/app.txt','utf8'); if(v.includes('BROKEN')) process.exit(1); fs.writeFileSync('dist/index.html', v);");
  w('server/index.js', "import fs from 'node:fs'; if (fs.readFileSync('server/ver.txt','utf8').trim()==='crash') throw new Error('boom'); setInterval(()=>{},1e9);");
  w('server/ver.txt', 'v1'); w('client/app.txt', 'v1'); w('.gitignore', 'node_modules\ndist\n');
  w('notes.txt', 'общий файл');
  fs.copyFileSync(path.join(root, 'scripts/supervisor.js'), path.join(dev, 'scripts/supervisor.js'));
  sh(dev, 'add', '-A'); sh(dev, 'commit', '-qm', 'v1'); sh(dev, 'push', '-q', 'origin', 'HEAD:main');
  sh(dir, 'clone', '-q', '-b', 'main', origin, pc);
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(pc, 'node_modules'), 'junction');
  execFileSync(process.execPath, ['build.js'], { cwd: pc });
  fs.appendFileSync(path.join(pc, 'notes.txt'), '\nмоя правка');
  const good = sh(pc, 'rev-parse', 'HEAD');

  const sup = spawn(process.execPath, ['scripts/supervisor.js'], { cwd: pc, env: { ...process.env, NODE_ENV: 'test', AUTO_UPDATE_SEC: '2', AUTO_UPDATE: '1', DATA_DIR: path.join(pc, 'data') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; sup.stdout.on('data', d => (log += d)); sup.stderr.on('data', d => (log += d));
  t.after(() => sup.kill());
  const push = (files, msg) => { mark = log.length; for (const [f, s] of Object.entries(files)) w(f, s); sh(dev, 'commit', '-qam', msg); sh(dev, 'push', '-q', 'origin', 'HEAD:main'); };
  let mark = 0; // ищем только в новом выводе после последнего push
  const until = async (re, ms = 30_000) => { const end = Date.now() + ms; while (!re.test(log.slice(mark)) && Date.now() < end) await sleep(300); assert.match(log.slice(mark), re, log.slice(-1500)); };

  push({ 'client/app.txt': 'v2 BROKEN' }, 'broken build');
  await until(/сборка не удалась — возвращаю/);
  await sleep(500);
  assert.equal(sh(pc, 'rev-parse', 'HEAD'), good, 'код вернулся на рабочую версию');
  assert.equal(fs.readFileSync(path.join(pc, 'dist/index.html'), 'utf8'), 'v1', 'сайт пересобран, а не оставлен пустым');
  assert.match(fs.readFileSync(path.join(pc, 'notes.txt'), 'utf8'), /моя правка/, 'своя правка не стёрта');

  push({ 'client/app.txt': 'v3', 'server/ver.txt': 'crash' }, 'crash');
  await until(/падает при запуске — возвращаю/);
  await sleep(1500);
  assert.equal(sh(pc, 'rev-parse', 'HEAD'), good);
  assert.match(fs.readFileSync(path.join(pc, 'notes.txt'), 'utf8'), /моя правка/);

  push({ 'client/app.txt': 'v4', 'server/ver.txt': 'v4' }, 'fix');
  await until(/сервер перезапущен/);
  assert.equal(fs.readFileSync(path.join(pc, 'dist/index.html'), 'utf8'), 'v4', 'исправление встало');
  // журнал для панели состояния: обновление сверху, ниже два отката
  const ev = JSON.parse(fs.readFileSync(path.join(pc, 'data/deploy-log.json'), 'utf8')).events;
  assert.equal(ev[0].kind, 'update');
  assert.equal(ev.filter(e => e.kind === 'rollback').length, 2);
  assert.match(ev.find(e => e.kind === 'rollback').why, /падает при запуске/);
});
