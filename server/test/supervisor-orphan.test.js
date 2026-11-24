// Если скрипт автообновления убит (закрыли окно, диспетчер задач), сервер не остаётся сиротой с портом и памятью.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };

test('сервер завершается, когда убит скрипт автообновления', { timeout: 30_000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-orphan-'));
  fs.mkdirSync(path.join(dir, 'server')); fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(path.join(root, 'scripts/supervisor.js'), path.join(dir, 'scripts/supervisor.js'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
  // тот же обработчик, что в server/index.js
  fs.writeFileSync(path.join(dir, 'server/index.js'), "import fs from 'node:fs'; fs.writeFileSync('pid', String(process.pid) + ' ' + (process.env.SB_SUPERVISED || '')); if (process.send) process.on('disconnect', () => process.exit(0)); setInterval(() => {}, 1e9);");
  const sup = spawn(process.execPath, ['scripts/supervisor.js'], { cwd: dir, env: { ...process.env, AUTO_UPDATE: '0' }, stdio: 'ignore' });
  const pidFile = path.join(dir, 'pid');
  for (let i = 0; i < 50 && !fs.existsSync(pidFile); i++) await sleep(100);
  const [pid, flag] = fs.readFileSync(pidFile, 'utf8').split(' ');
  assert.equal(flag, '1', 'сервер знает, что запущен скриптом автообновления');
  assert.ok(alive(Number(pid)));
  sup.kill('SIGKILL'); // жёстко, без обработчиков — как «Завершить задачу»
  for (let i = 0; i < 50 && alive(Number(pid)); i++) await sleep(100);
  assert.equal(alive(Number(pid)), false, 'сервер не остался сиротой');
});
