// Сквозной прогон сайта в настоящем браузере, как будто игрок сел пользоваться.
// Запуск: npm run e2e   (нужен собранный фронтенд: npm run build)
// Нужен Playwright: npm i -D playwright && npx playwright install chromium
//
// Поднимает сервер на отдельном порту (или берёт E2E_URL), обходит все страницы
// на компьютере и телефоне и проверяет: нет JS-ошибок, нет «undefined/NaN/[object Object]»
// в тексте, нет горизонтального скролла, работают поиск из шапки, карточка предмета и «Назад».
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  // Глобально установленный Playwright виден только через require (NODE_PATH)
  try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch {}
}
if (!chromium) {
  console.log('Playwright не установлен — пропускаю e2e.\n  npm i -D playwright && npx playwright install chromium');
  process.exit(0);
}
if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) { console.error('Нет dist/: сначала npm run build'); process.exit(1); }

const PORT = Number(process.env.E2E_PORT || 3999);
let BASE = process.env.E2E_URL;
let server;
if (!BASE) {
  BASE = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['server/index.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), SITE_PASSWORD: process.env.SITE_PASSWORD || 'e2e-only-pass' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  server.stdout.on('data', d => (log += d)); server.stderr.on('data', d => (log += d));
  server.on('exit', c => { if (c) { console.error('Сервер упал:\n' + log); process.exit(1); } });
}

async function waitReady() {
  const until = Date.now() + 120_000;
  while (Date.now() < until) {
    try {
      const s = await (await fetch(`${BASE}/api/state`)).json();
      const n = await (await fetch(`${BASE}/api/search?q=hyperion`)).json();
      if (s.member && n.length) return s;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Сервер не готов за 2 минуты (нет профиля или базы предметов). Без ключа: node scripts/make-fixture.js');
}

const PAGES = [
  ['overview', 'Что делать прямо сейчас'], ['roadmap', 'план'], ['skills', 'Скиллы'], ['gear', 'Надето'],
  ['accessories', 'Stats Tuning'], ['pets', 'Питомцы'], ['museum', 'Музей'], ['stash', 'Мешки'], ['stash/essence', 'Перки'], ['collections', 'Коллекции'], ['minions', 'Миньоны'], ['events', 'Мэр'], ['money', 'заработ'], ['money/bank', 'Как на самом деле работают проценты'], ['money/bits', 'монет даёт 1 Bit'], ['market', 'Bazaar'], ['wiki', 'Вики'], ['top', 'Рейтинг игроков'], ['news', 'Новости сайта'],
];
const BAD_TEXT = /\bundefined\b|\bNaN\b|\[object Object\]|Infinity/;
const failures = [];
const fail = (where, msg) => { failures.push(`${where}: ${msg}`); console.log(`  ✗ ${msg}`); };
const ok = msg => console.log(`  ✓ ${msg}`);

function watch(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Картинки и внешние ресурсы без сети — не ошибка сайта
    if (/Failed to load resource|ERR_|net::/.test(t)) return;
    errs.push(t);
  });
  page.on('response', r => { if (r.status() >= 500 && r.url().includes('/api/')) errs.push(`${r.status()} ${r.url()}`); });
  // Иконки, для которых сервер не нашёл картинку и отдал барьер (красный знак «запрещено»)
  page.on('response', async r => {
    if (!r.url().endsWith('/api/icons')) return;
    try { for (const [id, m] of Object.entries(await r.json())) if (m?.name === 'barrier') barriers.add(id); } catch {}
  });
  return errs;
}
const barriers = new Set();

// Телефон пальцем (сенсорный экран 320px, как iPhone SE): то, что ловили «вживую» на маленьком экране
// Гость (зашёл через туннель, без входа) открывает профиль по нику: страницы показываются, а не уводят на /login
async function guestChecks() {
  console.log('\n— гость по нику');
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': '203.0.113.7' } });
  const page = await ctx.newPage();
  const name = (await (await fetch(`${BASE}/api/state`)).json()).player?.name || 'OwnerCat';
  for (const p of ['roadmap', 'gear', 'money']) {
    await page.goto(`${BASE}/?player=${encodeURIComponent(name)}#/${p}`);
    await page.waitForTimeout(2500);
    page.url().includes('/login') ? fail(`гость/${p}`, 'гостя увело на страницу входа') : ok(`гость: «${p}» открылась без входа`);
  }

  // Приватность: гость без ника не видит ни владельца, ни друзей — ни в шапке, ни в ответах сервера, ни в коде сайта
  console.log('- гость без ника: пустые данные, ни владельца, ни друзей');
  const errs = watch(page);
  const tunnel = { 'X-Forwarded-For': '203.0.113.7' };
  const st = await (await fetch(`${BASE}/api/state`, { headers: tunnel })).json();
  !st.member && !st.player ? ok('гостю без ника /api/state пустой') : fail('гость/api', `отдан профиль ${st.player?.name}`);
  const meApi = await (await fetch(`${BASE}/api/me`, { headers: tunnel })).json();
  !(meApi.users || []).length ? ok('гостю /api/me без списка аккаунтов') : fail('гость/api', 'отдан список аккаунтов');
  const coopApi = await (await fetch(`${BASE}/api/coop?player=${encodeURIComponent(name)}`, { headers: { ...tunnel, 'X-SB-Player': encodeURIComponent(name) } })).json();
  !(coopApi.members || []).length ? ok('гостю /api/coop без соседей') : fail('гость/api', 'отданы кооп-соседи');
  const gl = await (await fetch(`${BASE}/api/guides`, { headers: tunnel })).json();
  const g1 = gl.guides?.[0] && await fetch(`${BASE}/api/guides/${gl.guides[0].id}`, { headers: tunnel });
  gl.guides?.length && g1?.ok ? ok(`гость без ника читает гайды (${gl.guides.length})`) : fail('гость/гайды', 'гайды пустые без ника');
  for (const p of ['overview', 'guides', 'market', 'wiki', 'compare']) {
    await page.goto(`${BASE}/#/${p}`); await page.waitForTimeout(2000);
    const head = await page.locator('.topbar').innerText().catch(() => '');
    const leak = head.includes(name) || /уровень|кооп из/.test(head) || (await page.locator('.coop-quick').count());
    leak ? fail(`гость/${p}`, `в шапке чужие данные: «${head.slice(0, 80)}»`) : ok(`гость без ника: «${p}» — шапка пустая`);
  }
  errs.length ? fail('гость', errs.slice(0, 3).join('; ')) : ok('гость: без ошибок JS');

  // Аватарка в шапке сразу меняется после ввода ника (раньше висела заглушка до перезагрузки):
  // на стартовой голова-заглушка не грузится → <img> помечался «broken», и пометка оставалась на новом нике
  console.log('- гость вводит ник: аватарка в шапке обновляется без перезагрузки');
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.route('**/api/head/**', r => /MHF_Steve/.test(r.request().url()) ? r.fulfill({ status: 404 }) : r.fulfill({ body: pixel, contentType: 'image/png' }));
  await page.goto(`${BASE}/#/overview`); await page.waitForTimeout(1500);
  await page.fill('input[aria-label="Ник Minecraft"]', name); await page.click('button:has-text("Открыть профиль")');
  await page.waitForFunction(() => !/MHF_Steve/.test(document.querySelector('.who-btn img')?.getAttribute('src') || 'MHF_Steve'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const av = await page.$eval('.who-btn img', i => ({ src: i.getAttribute('src'), broken: i.classList.contains('broken'), w: i.naturalWidth })).catch(() => null);
  av && !/MHF_Steve/.test(av.src) && !av.broken && av.w > 0 ? ok('аватарка в шапке — новый игрок, без перезагрузки') : fail('гость/аватарка', `в шапке не обновилась: ${JSON.stringify(av)}`);
  await page.unroute('**/api/head/**');

  const html =await (await fetch(BASE, { headers: tunnel })).text();
  // Сайт разбит на куски по страницам: проверяем не только главный файл, но и все куски, на которые он ссылается
  const seen = new Set(), js = [];
  const queue = [...html.matchAll(/src="\/(assets\/[^"]+\.js)"/g)].map(m => m[1]);
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    const t = await fetch(`${BASE}/${f}`).then(r => r.text());
    js.push(t);
    for (const m of t.matchAll(/assets\/[\w.-]+\.js|"\.\/([\w.-]+\.js)"/g)) queue.push(m[1] ? `assets/${m[1]}` : m[0]);
  }
  js.length > 5 ? ok(`проверено файлов сайта: ${js.length}`) : fail('гость/код', `нашлось только ${js.length} файлов JS — куски страниц не найдены`);
  /Friend4ik|Nightowl|OwnerCat/.test(html + js.join('')) ? fail('гость/код', 'в коде сайта зашиты ники владельца или друзей') : ok('в коде сайта нет ников владельца и друзей');
  await ctx.close();
}

async function phoneChecks() {
  console.log('\n== телефон пальцем 320px');
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = watch(page);
  const where = 'телефон 320';
  for (const id of ['compare', 'guides', 'guides/collectibles', 'gear', 'market', 'top']) {
    await page.goto(`${BASE}/#/${id}`); await page.waitForSelector('.page', { timeout: 15_000 }); await page.waitForTimeout(800);
    // с isMobile окно растягивается под широкий контент, поэтому сравниваем с шириной экрана, а не с innerWidth
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - 320);
    sw > 2 ? fail(`${where}/${id}`, `горизонтальный скролл на ${sw}px`) : ok(`${id}: без горизонтального скролла`);
  }

  console.log('- облегчённый режим на телефоне');
  await page.goto(`${BASE}/#/overview`); await page.waitForSelector('.page'); await page.waitForTimeout(800);
  const liteOn = await page.evaluate(() => document.documentElement.classList.contains('lite'));
  liteOn ? ok('включился сам') : fail(`${where}/облегчённый`, 'на телефоне не включился сам');
  const orbAnim = await page.evaluate(() => getComputedStyle(document.querySelector('.bg-orbs span')).animationName);
  orbAnim === 'none' ? ok('фон не анимируется') : fail(`${where}/облегчённый`, `фон анимируется: ${orbAnim}`);
  await page.locator('.bn-more').tap(); await page.waitForTimeout(400);
  await page.selectOption('.more-sheet .lite-toggle select', 'on'); await page.waitForTimeout(300);
  (await page.inputValue('.more-sheet .lite-toggle select')) === 'on' ? ok('«сам» → «включён» виден в переключателе') : fail(`${where}/облегчённый`, 'переключатель вернулся к «сам»');
  await page.selectOption('.more-sheet .lite-toggle select', 'off'); await page.waitForTimeout(300);
  const liteOff = await page.evaluate(() => !document.documentElement.classList.contains('lite') && localStorage.getItem('sb-lite') === 'off');
  liteOff ? ok('переключатель выключает и запоминает') : fail(`${where}/облегчённый`, 'переключатель не сработал');
  await page.reload(); await page.waitForSelector('.page'); await page.waitForTimeout(500);
  (await page.evaluate(() => !document.documentElement.classList.contains('lite'))) ? ok('после перезагрузки выбор сохранился') : fail(`${where}/облегчённый`, 'выбор не сохранился');
  await page.evaluate(() => localStorage.removeItem('sb-lite'));

  console.log('- рынок: товары с подтипом («какао-бобы» = INK_SACK:3)');
  await page.goto(`${BASE}/#/market`);
  await page.fill('.mk-side input.search', 'какао'); await page.waitForTimeout(1200);
  const first = (await page.locator('.mk-row').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  /Какао-бобы/.test(first) ? ok('«какао» → «Какао-бобы» первым') : fail(`${where}/рынок`, `первая строка: «${first.slice(0, 60)}»`);
  (await page.locator('.mk-title', { hasText: /^INK_SACK/ }).count()) ? fail(`${where}/рынок`, 'вместо названия сырой ID INK_SACK:3') : ok('нет сырых ID вида INK_SACK:3');

  console.log('- рынок на телефоне: сразу график сверху, список товаров под ним');
  await page.fill('.mk-side input.search', ''); await page.waitForTimeout(900);
  await page.goto(`${BASE}/#/market`); await page.waitForTimeout(2500);
  const order = await page.evaluate(() => { const m = document.querySelector('.mk-main'), l = document.querySelector('.mk-side'); return m && l ? m.getBoundingClientRect().top < l.getBoundingClientRect().top : false; });
  order && (await page.locator('.tc-canvas canvas').count()) ? ok('график открыт сразу и стоит над списком') : fail(`${where}/рынок`, 'на телефоне нет графика сверху');
  const second = page.locator('.mk-row').nth(1);
  const secondName = (await second.locator('.mk-title').innerText()).trim();
  await second.tap(); await page.waitForTimeout(2500);
  const phoneChart = await page.evaluate(() => ({ canvas: !!document.querySelector('.tc-canvas canvas'), name: document.querySelector('.mk-head-name h2')?.innerText, top: document.querySelector('.mk-main').getBoundingClientRect().top, sw: document.documentElement.scrollWidth - 320, h: document.querySelector('.tc-stage')?.getBoundingClientRect().height || 0 }));
  phoneChart.canvas && phoneChart.name === secondName && phoneChart.top < 200 && phoneChart.h >= 300 ? ok('нажатие на товар показывает его график наверху') : fail(`${where}/рынок`, `график: ${JSON.stringify(phoneChart)} (ждали ${secondName})`);
  phoneChart.sw > 2 ? fail(`${where}/рынок`, `горизонтальный скролл на ${phoneChart.sw}px у графика`) : ok('у графика нет горизонтального скролла');
  await page.locator('button[title="Индикаторы"]').tap(); await page.waitForTimeout(300);
  const pop = await page.evaluate(() => { const r = document.querySelector('.tc-pop')?.getBoundingClientRect(); return r && { l: r.left, r: r.right }; });
  pop && pop.l >= 0 && pop.r <= 320 ? ok('меню индикаторов помещается в экран') : fail(`${where}/рынок`, `меню индикаторов: ${JSON.stringify(pop)}`);
  await page.keyboard.press('Escape');
  const bar = await page.evaluate(() => {
    const b = document.querySelector('.tc-bar'), r = b.getBoundingClientRect();
    const vis = [...b.querySelectorAll('button')].filter(x => x.offsetParent && !x.closest('.tc-pop'));
    const tops = vis.map(x => x.getBoundingClientRect().top).sort((a, c) => a - c);
    const rows = tops.filter((t, i) => i === 0 || t - tops[i - 1] > 10).length;
    return { rows, over: vis.filter(x => x.getBoundingClientRect().right > r.right + 1 || x.scrollWidth > x.clientWidth + 1).map(x => x.innerText || x.title), sw: b.scrollWidth - b.clientWidth };
  });
  bar.rows <= 2 && !bar.over.length && bar.sw <= 1 ? ok(`панель графика в ${bar.rows} строки, без прокрутки и обрезанных кнопок`) : fail(`${where}/рынок`, `панель графика: ${JSON.stringify(bar)}`);
  await page.locator('.tc-more > button').tap(); await page.waitForTimeout(300);
  await page.locator('.tc-pop .tc-item', { hasText: 'Во весь экран' }).tap(); await page.waitForTimeout(600);
  (await page.evaluate(() => !!document.fullscreenElement || !!document.querySelector('.tc.tc-full'))) ? ok('полный экран включается') : fail(`${where}/рынок`, 'полный экран не включился');
  await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : document.querySelector('button[title^="Выйти из полного"]')?.click()));
  await page.waitForTimeout(300);
  await page.locator('.mk-back').tap(); await page.waitForTimeout(900);
  (await page.evaluate(() => document.querySelector('.mk-side').getBoundingClientRect().top < 300)) ? ok('«Выбрать другой товар» прокручивает к списку') : fail(`${where}/рынок`, 'кнопка не прокрутила к списку');

  console.log('- нижняя панель: четыре раздела + «Ещё», лист со всеми разделами');
  await page.goto(`${BASE}/#/overview`); await page.waitForSelector('.page'); await page.waitForTimeout(500);
  const bn = await page.evaluate(() => {
    const n = document.querySelector('.bottom-nav'); if (!n) return null;
    const r = n.getBoundingClientRect();
    return { bottom: Math.round(innerHeight - r.bottom), labels: [...n.children].map(x => x.querySelector('span:last-child').innerText.trim()), topNav: getComputedStyle(document.querySelector('.sidebar nav')).display };
  });
  bn && bn.bottom === 0 && bn.labels.join('|') === 'Обзор|Что делать|Рынок|Заработок|Ещё' ? ok('панель внизу: ' + bn.labels.join(', ')) : fail(`${where}/панель`, JSON.stringify(bn));
  bn?.topNav === 'none' ? ok('верхней ленты вкладок нет') : fail(`${where}/панель`, 'верхняя лента вкладок видна');
  const cut = await page.evaluate(() => [...document.querySelectorAll('.bottom-nav > * > span:last-child')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
  cut.length ? fail(`${where}/панель`, `обрезаны подписи: ${cut.join(', ')}`) : ok('подписи панели целиком на 320px');
  const fab = await page.evaluate(() => { const f = document.querySelector('.chat-fab'), n = document.querySelector('.bottom-nav'); return f ? f.getBoundingClientRect().bottom <= n.getBoundingClientRect().top : null; });
  fab === false ? fail(`${where}/панель`, 'кнопка советчика перекрывает панель') : ok(fab ? 'кнопка советчика над панелью' : 'кнопки советчика нет (гость)');
  await page.locator('.bn-more').tap(); await page.waitForTimeout(400);
  const sheet = await page.evaluate(() => { const s = document.querySelector('.more-sheet'); const r = s.getBoundingClientRect(); return { open: s.classList.contains('open'), inView: r.top < innerHeight - 100, links: s.querySelectorAll('.more-grid a').length, groups: [...s.querySelectorAll('h4')].map(h => h.textContent) }; });
  sheet.open && sheet.inView && sheet.links >= 13 ? ok(`«Ещё»: ${sheet.links} разделов, группы: ${sheet.groups.join(', ')}`) : fail(`${where}/ещё`, JSON.stringify(sheet));
  await page.locator('.more-sheet a', { hasText: 'Музей' }).tap(); await page.waitForTimeout(700);
  const after = await page.evaluate(() => ({ hash: location.hash, open: document.querySelector('.more-sheet').classList.contains('open'), moreActive: document.querySelector('.bn-more').classList.contains('active') }));
  after.hash === '#/museum' && !after.open && after.moreActive ? ok('из листа открылся «Музей», лист закрылся, «Ещё» подсвечено') : fail(`${where}/ещё`, JSON.stringify(after));
  await page.locator('.bn-more').tap(); await page.waitForTimeout(300);
  await page.mouse.click(160, 20); await page.waitForTimeout(400);
  (await page.evaluate(() => document.querySelector('.more-sheet').classList.contains('open'))) ? fail(`${where}/ещё`, 'лист не закрывается тапом мимо') : ok('лист закрывается тапом мимо');
  const nsw = await page.evaluate(() => document.documentElement.scrollWidth - 320);
  nsw > 2 ? fail(`${where}/панель`, `горизонтальный скролл на ${nsw}px`) : ok('без горизонтального скролла');

  console.log('- переход по меню открывает страницу сверху, «Назад» возвращает прокрутку');
  await page.goto(`${BASE}/#/skills`); await page.waitForTimeout(1500);
  await page.evaluate(() => scrollTo(0, 1800)); await page.waitForTimeout(200);
  const was = await page.evaluate(() => scrollY);
  await page.locator('.bn-more').tap(); await page.waitForTimeout(400);
  await page.locator('.more-sheet a', { hasText: 'Питомцы' }).tap(); await page.waitForTimeout(800);
  const top = await page.evaluate(() => scrollY);
  top < 5 ? ok('«Питомцы» открылись сверху') : fail(`${where}/меню`, `«Питомцы» открылись с прокруткой ${top}px`);
  await page.goBack(); await page.waitForTimeout(1500);
  const back = await page.evaluate(() => scrollY);
  Math.abs(back - was) < 10 ? ok('«Назад» вернул на то же место') : fail(`${where}/назад`, `было ${was}px, стало ${back}px`);

  console.log('- гардероб: названия наборов читаются целиком');
  await page.goto(`${BASE}/#/gear`); await page.waitForTimeout(1200);
  const wtab = page.getByRole('button', { name: 'Гардероб' });
  if (await wtab.count()) {
    await wtab.tap(); await page.waitForTimeout(500);
    const cut = await page.evaluate(() => [...document.querySelectorAll('.set-name')].filter(e => e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2).map(e => e.textContent));
    cut.length ? fail(`${where}/гардероб`, `обрезаны: ${cut.join(', ')}`) : ok(`наборов: ${await page.locator('.set-name').count()}, все подписи целиком`);
  }

  console.log('- вики на телефоне не открывает клавиатуру сама');
  await page.goto(`${BASE}/#/wiki`); await page.waitForTimeout(800);
  (await page.evaluate(() => document.activeElement?.matches('input.search'))) ? fail(`${where}/вики`, 'поле поиска в фокусе — на телефоне вылезет клавиатура') : ok('поле не в фокусе');

  console.log('- поиск: «sharpness 6» → Sharpness VI');
  const sh = await page.evaluate(async () => (await (await fetch('/api/search?q=sharpness%206')).json())[0]?.name);
  sh === 'Sharpness VI' ? ok('арабские цифры → римские') : fail(`${where}/поиск`, `«sharpness 6» первым дал «${sh}»`);

  console.log('- нет связи: поиск говорит об этом, а не «ничего не найдено»');
  await ctx.setOffline(true);
  await page.locator('.gsearch-input').tap(); await page.locator('.gsearch-input').fill('терма'); await page.waitForTimeout(1200);
  const msg = await page.locator('.gsearch').innerText();
  /Нет связи/.test(msg) ? ok('«Нет связи с сервером…»') : fail(`${where}/офлайн`, `поиск без сети пишет: «${msg.slice(0, 80)}»`);
  await ctx.setOffline(false);
  errs.length = 0; // офлайн-запросы закономерно падали
  await ctx.close();

  console.log('\n== телефон боком 568×320');
  const lc = await browser.newContext({ viewport: { width: 568, height: 320 }, hasTouch: true, isMobile: true });
  const lp = await lc.newPage();
  await lp.goto(`${BASE}/#/gear`); await lp.waitForSelector('.page', { timeout: 15_000 }); await lp.waitForTimeout(800);
  const ltop = await lp.evaluate(() => Math.round(document.querySelector('.page').getBoundingClientRect().top));
  ltop < 170 ? ok(`содержимое начинается на ${ltop}px из 320`) : fail("телефон боком", `шапка занимает ${ltop}px из 320`);
  const lsw = await lp.evaluate(() => document.documentElement.scrollWidth - 568);
  lsw > 2 ? fail('телефон боком', `горизонтальный скролл на ${lsw}px`) : ok('без горизонтального скролла');
  await lc.close();
}

let code = 0;
const browser = await chromium.launch();
try {
  await waitReady();
  for (const [label, viewport] of [['компьютер', { width: 1400, height: 900 }], ['телефон', { width: 390, height: 844 }]]) {
    console.log(`\n== ${label} ${viewport.width}px`);
    const page = await browser.newPage({ viewport });
    const errs = watch(page);
    for (const [id, expect] of PAGES) {
      // Точка «новое» у «Новостей»: в чистом браузере горит (на ПК — в меню, на телефоне — на «Ещё»), после захода в раздел гаснет
      if (id === 'news') {
        const sel = viewport.width > 800 ? '.sidebar nav .nav-badge' : '.bn-more .nav-badge';
        const lit = await page.waitForSelector(sel, { timeout: 5000 }).then(() => true, () => false);
        const n = lit ? await page.innerText(sel) : '';
        lit && /^\d+\+?$/.test(n.trim()) ? ok(`значок «Новостей» с числом ${n.trim()} до захода`) : fail(`${label}/news`, 'нет значка с числом у «Новостей»');
        (await page.title()).startsWith('(') ? ok('число новостей в заголовке вкладки') : fail(`${label}/news`, `в заголовке вкладки нет числа: ${await page.title()}`);
      }
      const t0 = Date.now();
      await page.goto(`${BASE}/#/${id}`);
      await page.waitForSelector('.page', { timeout: 15_000 });
      await page.waitForTimeout(800);
      // страница может ещё догружать данные (календарь, рынок): ждём нужный текст до 8 с, а не фиксированное время
      await page.waitForFunction(e => document.querySelector('main')?.innerText.toLowerCase().includes(e), expect.toLowerCase(), { timeout: 8000 }).catch(() => {});
      const text = await page.innerText('main');
      const ms = Date.now() - t0;
      const where = `${label}/${id}`;
      console.log(`- ${id} (${ms} мс)`);
      if (!text.toLowerCase().includes(expect.toLowerCase())) fail(where, `нет текста «${expect}»`);
      if (id === PAGES[0][0]) {
        // Окошко «Что нового» всплывает при первом заходе, «Позже» прячет его, а число на кнопке остаётся
        const pop = await page.waitForSelector('.news-pop', { timeout: 6000 }).then(() => true, () => false);
        pop ? ok('окошко «Что нового» всплыло') : fail(where, 'нет окошка «Что нового»');
        if (pop) {
          await page.click('.news-pop .btn.ghost'); await page.waitForTimeout(300);
          (await page.evaluate(() => !document.querySelector('.news-pop') && !!document.querySelector('.nav-badge'))) ? ok('«Позже» прячет окошко, значок остаётся') : fail(where, '«Позже» не сработало');
        }
      }
      if (id === 'news') {
        await page.waitForTimeout(300);
        (await page.evaluate(() => !document.querySelector('.nav-badge') && !document.querySelector('.news-pop') && !document.title.startsWith('('))) ? ok('после захода в «Новости» значок, окошко и число в заголовке пропали') : fail(where, 'оповещение о новостях не гаснет после захода');
      }
      const bad = text.match(BAD_TEXT);
      if (bad) fail(where, `в тексте «${bad[0]}»: …${text.slice(Math.max(0, bad.index - 60), bad.index + 30).replace(/\s+/g, ' ')}…`);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (sw > 2) fail(where, `горизонтальный скролл на ${sw}px`);
      if (errs.length) { fail(where, `ошибки: ${errs.join(' | ').slice(0, 300)}`); errs.length = 0; }
      if (barriers.size) { fail(where, `иконки-барьеры вместо картинок: ${[...barriers].slice(0, 10).join(', ')}`); barriers.clear(); }
    }

    console.log('- поиск из шапки');
    await page.goto(`${BASE}/#/skills`);
    await page.waitForSelector('.gsearch-input');
    await page.click('.gsearch-input');
    await page.keyboard.type('терма');
    await page.waitForSelector('.gsearch-item', { timeout: 5000 });
    const first = await page.locator('.gsearch-item').first().innerText();
    first.includes('Terminator') ? ok('«терма» → Terminator') : fail(`${label}/поиск`, `«терма» первым дал «${first.split('\n')[0]}»`);
    await page.keyboard.press('Enter');
    await page.waitForSelector('.modal h2', { timeout: 8000 });
    ok(`карточка: ${await page.locator('.modal h2').innerText()}`);
    // Свой предмет: вместо «где взять» — чек-лист улучшений, а рецепты свёрнуты в «Как получить ещё один»
    await page.waitForTimeout(600);
    if (await page.locator('.modal .upg').count()) ok(`чек-лист улучшений: ${await page.locator('.modal .upg-step').count()} шагов`);
    const more = page.locator('.modal details.obtain-more:not([open]) > summary');
    if (await more.count()) await more.first().click();
    const ing = page.locator('.modal .recipe-cell > *').first();
    if (await ing.count()) {
      await ing.click();
      await page.waitForSelector('.modal-back', { timeout: 5000 });
      await page.click('.modal-back');
      const back = await page.waitForFunction(() => document.querySelector('.modal h2')?.textContent.includes('Terminator'), null, { timeout: 5000 }).catch(() => null);
      back ? ok('«Назад» в карточке') : fail(`${label}/карточка`, '«Назад» не вернул Terminator');
    }
    await page.keyboard.press('Escape');
    // карточка закрывается через history.back() → popstate, это асинхронно: ждём, а не проверяем мгновенно
    (await page.waitForSelector('.modal', { state: 'detached', timeout: 3000 }).then(() => true, () => false)) ? ok('Esc закрывает карточку') : fail(`${label}/карточка`, 'Esc не закрыл');
    // «Назад» браузера (кнопка на телефоне) закрывает карточку и не уводит со страницы
    await page.locator('.gsearch-input').click();
    await page.keyboard.press('Control+a'); await page.keyboard.type('рекомб');
    await page.waitForSelector('.gsearch-item'); await page.keyboard.press('Enter');
    await page.waitForSelector('.modal h2', { timeout: 8000 });
    await page.goBack(); await page.waitForTimeout(400);
    (await page.locator('.modal').count()) === 0 && page.url().includes('#/skills') ? ok('«Назад» браузера закрывает карточку') : fail(`${label}/карточка`, `«Назад» браузера: модалка ${await page.locator('.modal').count()}, адрес ${page.url()}`);

    console.log('- шаг с главной открывает его в плане');
    await page.goto(`${BASE}/#/overview`);
    await page.waitForSelector('.next-step');
    await page.locator('.next-step').nth(1).click();
    const flashed = await page.waitForSelector('.road-step.flash', { timeout: 5000 }).catch(() => null);
    flashed ? ok('шаг подсвечен на странице плана') : fail(`${label}/план`, 'клик по шагу на главной не подсветил его в плане');

    console.log('- «где лежит» в хранилищах');
    await page.goto(`${BASE}/#/gear`);
    await page.waitForSelector('input.search', { timeout: 10_000 });
    await page.fill('input.search', 'гиперион');
    const where = await page.waitForFunction(() => /Hyperion/.test(document.querySelector('main')?.innerText.split('Хранилища').pop() || ''), null, { timeout: 5000 }).catch(() => null);
    where ? ok('«гиперион» найден в хранилищах') : fail(`${label}/хранилища`, '«гиперион» не найден в хранилищах');

    console.log('- плитки обзора нажимаются целиком');
    await page.goto(`${BASE}/#/overview`);
    await page.waitForSelector('a.stat-link', { timeout: 10_000 }).catch(() => null);
    // переход по хэшу не сбрасывает прокрутку: каждую плитку сначала ставим в видимую область
    const blocked = await page.evaluate(() => [...document.querySelectorAll('a.stat-link')].filter(a => {
      a.scrollIntoView({ block: 'center' });
      const r = a.getBoundingClientRect();
      return [[r.left + 8, r.top + 8], [r.right - 8, r.top + 8], [r.right - 8, r.bottom - 8], [r.left + 8, r.bottom - 8]]
        .some(([x, y]) => !a.contains(document.elementFromPoint(x, y)));
    }).map(a => a.querySelector('.stat-label')?.textContent));
    blocked.length ? fail(`${label}/обзор`, `плитки перекрыты: ${blocked.join(', ')}`) : ok('все плитки кликабельны');

    console.log('- вики: пустой результат и несуществующий предмет');
    await page.goto(`${BASE}/#/wiki/zzzzqqq`);
    const nf = await page.waitForFunction(() => /Ничего не нашлось/.test(document.querySelector('main')?.innerText || ''), null, { timeout: 5000 }).catch(() => null);
    nf ? ok('«Ничего не нашлось» с подсказками') : fail(`${label}/вики`, 'нет понятного пустого результата');
    await page.evaluate(() => { history.pushState({ item: 'NOT_AN_ITEM' }, ''); dispatchEvent(new PopStateEvent('popstate')); });
    const miss = await page.waitForFunction(() => /нет в базе/.test(document.querySelector('.modal')?.innerText || ''), null, { timeout: 5000 }).catch(() => null);
    miss ? ok('несуществующий предмет: «нет в базе»') : fail(`${label}/карточка`, 'нет понятной ошибки для несуществующего предмета');
    await page.keyboard.press('Escape');

    console.log('- «Прогресс» → шаги плана нужной категории');
    await page.goto(`${BASE}/#/skills`);
    const planLink = page.locator('.card a.link', { hasText: 'шагов в плане' }).nth(1);
    if (await planLink.waitFor({ timeout: 10_000 }).then(() => true, () => false)) {
      await planLink.click();
      const cat = await page.waitForFunction(() => /^Слееры/.test(document.querySelector('.chip.active')?.innerText || ''), null, { timeout: 5000 }).catch(() => null);
      cat ? ok('открылись шаги «Слееры»') : fail(`${label}/план`, 'ссылка со слееров не открыла категорию «Слееры»');
    } else fail(`${label}/план`, 'нет ссылки «шагов в плане» на странице «Прогресс»');

    console.log('- рынок по-русски');
    await page.goto(`${BASE}/#/market`);
    await page.fill('.mk-side input.search', 'печенька');
    await page.waitForTimeout(900);
    const rows = await page.locator('.mk-row').allInnerTexts();
    rows.some(r => r.includes('Booster Cookie')) ? ok('«печенька» → Booster Cookie') : fail(`${label}/рынок`, '«печенька» не нашла Booster Cookie');

    console.log('- рынок: биржевой график и управление');
    await page.locator('.mk-row', { hasText: 'Booster Cookie' }).first().click();
    await page.waitForFunction(() => location.hash.includes('BOOSTER_COOKIE') && document.querySelector('.tc-canvas canvas'), null, { timeout: 15_000 }).catch(() => null);
    const api1 = await (await fetch(`${BASE}/api/market/candles/BOOSTER_COOKIE?tf=1h&limit=50`)).json();
    Array.isArray(api1.candles) && api1.candles.every(c => c.length === 11) ? ok(`свечи отдаются (${api1.candles.length} шт.)`) : fail(`${label}/рынок`, 'API свечей ответило не тем');
    (await page.locator('.tc-canvas canvas').count()) ? ok('график нарисован') : fail(`${label}/рынок`, 'нет холста графика');
    const tfReq = page.waitForResponse(r => r.url().includes('/api/market/candles/BOOSTER_COOKIE?tf=1d'), { timeout: 8000 }).catch(() => null);
    await page.locator('.tc-tf', { hasText: '1д' }).click();
    (await tfReq) ? ok('смена периода грузит дневные свечи') : fail(`${label}/рынок`, 'период 1д не запросил свечи');
    await page.locator('button[title="Индикаторы"]').click();
    await page.locator('.tc-pop .tc-check', { hasText: 'Индекс силы' }).click();
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sb-chart') || '{}'));
    saved.tf === '1d' && saved.ind?.rsi ? ok('настройки графика запоминаются') : fail(`${label}/рынок`, `настройки: ${JSON.stringify(saved).slice(0, 120)}`);
    if (api1.candles.length) {
      await page.locator('button[title="Рисование"]').click();
      await page.locator('.tc-item', { hasText: 'Горизонтальный уровень' }).click();
      const bx = await page.locator('.tc-canvas').boundingBox();
      await page.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 3); await page.waitForTimeout(300);
      const dr = await page.evaluate(() => JSON.parse(localStorage.getItem('sb-chart-draw:BOOSTER_COOKIE') || '[]'));
      dr.length === 1 && dr[0].k === 'h' && dr[0].p > 0 ? ok('уровень нарисован и сохранён') : fail(`${label}/рынок`, `рисунок: ${JSON.stringify(dr)}`);
    }
    await page.evaluate(() => { localStorage.removeItem('sb-chart'); localStorage.removeItem('sb-chart-draw:BOOSTER_COOKIE'); });
    const txt = await page.locator('.mk').innerText();
    BAD_TEXT.test(txt) ? fail(`${label}/рынок`, 'в тексте undefined/NaN') : ok('текст «Рынка» без мусора');
    if (errs.length) fail(label, `ошибки: ${errs.join(' | ').slice(0, 300)}`);
    await page.close();
  }
  await phoneChecks();
  await guestChecks();
} catch (e) {
  fail('прогон', e.message);
} finally {
  await browser.close();
  server?.kill();
}
if (failures.length) { console.log(`\nПроблем: ${failures.length}\n- ${failures.join('\n- ')}`); code = 1; }
else console.log('\nВсё прошло.');
process.exit(code);
