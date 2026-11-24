// Открывает сайт с этого ПК в интернет через бесплатный Cloudflare Quick Tunnel.
// Нужен установленный cloudflared:  winget install --id Cloudflare.cloudflared
// Запуск: npm run tunnel   (сервер должен уже работать: npm start)
//      или npm run share   (сервер + туннель одной командой)
import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const port = Number(process.env.PORT || 3000);

if (!String(process.env.SITE_PASSWORD || '')) {
  console.error('\n  Сначала задай пароль: впиши SITE_PASSWORD=... в файл .env и перезапусти сервер.');
  console.error('  Без пароля сайт из интернета будет закрыт.\n');
  process.exit(1);
}

function findCloudflared() {
  if (process.env.CLOUDFLARED) return process.env.CLOUDFLARED;
  const probe = spawnSync('cloudflared', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
  if (probe.status === 0) return 'cloudflared';
  const guesses = [
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'cloudflared.exe'),
  ];
  return guesses.find(p => p && fs.existsSync(p)) || null;
}

const bin = findCloudflared();
if (!bin) {
  console.error('\n  Не найден cloudflared. Установи его одной командой в терминале:');
  console.error('    winget install --id Cloudflare.cloudflared');
  console.error('  Потом закрой и снова открой терминал и запусти npm run tunnel.\n');
  process.exit(1);
}

console.log(`  Открываю туннель к http://localhost:${port} ...`);
const child = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
let shown = false;
const onData = buf => {
  const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && !shown) {
    shown = true;
    const line = '='.repeat(m[0].length + 4);
    console.log(`\n  ${line}\n    ${m[0]}\n  ${line}`);
    console.log('  Это адрес сайта для телефона. Вход по паролю из SITE_PASSWORD.');
    console.log('  Адрес меняется при каждом запуске туннеля. Ctrl+C — закрыть доступ.\n');
    try { fs.mkdirSync('data', { recursive: true }); fs.writeFileSync(path.join('data', 'tunnel-url.txt'), m[0] + '\n'); } catch {}
  }
  if (process.env.TUNNEL_DEBUG) process.stderr.write(buf);
};
child.stdout.on('data', onData);
child.stderr.on('data', onData);
child.on('exit', code => { console.log(`  Туннель закрыт (код ${code}).`); process.exit(code || 0); });
process.on('SIGINT', () => child.kill('SIGINT'));
