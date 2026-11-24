// «Новости» (server/news): порядок записей, id, запрещённые слова и ответ /api/news.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEWS, KIND_RU } from '../news/entries.js';
import { newsView, mountNewsRoutes } from '../news/index.js';
import { newsLinks, plainNews } from '../news/links.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clientSrc = () => {
  const out = [];
  const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p); else if (/\.jsx?$/.test(f.name)) out.push(fs.readFileSync(p, 'utf8'));
  } };
  walk(path.join(ROOT, 'client', 'src'));
  return out.join('\n');
};

test('записи: самая новая первой, id уникальны и начинаются с даты', () => {
  assert.ok(NEWS.length > 0);
  const ids = new Set();
  for (let i = 0; i < NEWS.length; i++) {
    const e = NEWS[i];
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, `${e.id}: дата ГГГГ-ММ-ДД`);
    assert.ok(e.id.startsWith(e.date), `${e.id}: id начинается с даты`);
    assert.match(e.id, /^[a-z0-9-]+$/, `${e.id}: id латиницей`);
    assert.ok(!ids.has(e.id), `${e.id}: id повторяется`);
    ids.add(e.id);
    assert.ok(KIND_RU[e.kind], `${e.id}: kind — new, better или fix`);
    assert.ok(e.title && Array.isArray(e.items) && e.items.length, `${e.id}: есть заголовок и пункты`);
    if (i) assert.ok(NEWS[i - 1].date >= e.date, `${e.id}: записи идут от новых к старым`);
  }
});

test('в новостях нет ников владельца и друзей, технических слов и советчика для гостей', () => {
  const text = NEWS.flatMap(e => [e.title, ...e.items]).join('\n');
  for (const bad of ['OwnerCat', 'Friend4ik', 'Nightowl', 'Zucchini', 'Pomegranate']) assert.ok(!text.includes(bad), `ник: ${bad}`);
  for (const bad of [/\bPR\b/, /\bAPI\b/i, /\be2e\b/i, /\bdevelop\b/i, /\bdeploy/i, /\bcommit/i, /\bgit\b/i, /\.env\b/, /ветк[аиу]/i, /\bSMTP\b/i, /советчик/i])
    assert.ok(!bad.test(text), `техническое слово или скрытая возможность: ${bad}`);
});

test('/api/news отдаёт записи с подписью вида и словарь подсказок; /api/news/latest — id свежей', async () => {
  const routes = {};
  let calls = 0;
  mountNewsRoutes({ get: (p, h) => { routes[p] = h; } }, { textRefs: t => { calls++; assert.ok(t.includes(NEWS[0].title)); return { phrases: {}, data: {} }; } });
  const call = p => new Promise(res => routes[p]({}, { json: res }));
  const full = await call('/api/news');
  assert.equal(full.latest, NEWS[0].id);
  assert.equal(full.entries.length, NEWS.length);
  assert.equal(full.entries[0].kindRu, KIND_RU[NEWS[0].kind]);
  assert.deepEqual(full.refs, { phrases: {}, data: {} });
  await call('/api/news');
  assert.equal(calls, 1, 'словарь считается один раз, а не на каждый запрос');
  assert.equal((await call('/api/news/latest')).latest, NEWS[0].id);
  assert.equal(newsView([]).latest, null);
});

test('/api/news/latest: id всех записей по порядку и свежая запись для окошка', async () => {
  const routes = {};
  mountNewsRoutes({ get: (p, h) => { routes[p] = h; } }, { textRefs: () => ({ phrases: {}, data: {} }) });
  const r = await new Promise(res => routes['/api/news/latest']({}, { json: res }));
  assert.deepEqual(r.ids, NEWS.map(e => e.id));
  assert.equal(r.top.id, NEWS[0].id);
  assert.equal(r.top.kindRu, KIND_RU[NEWS[0].kind]);
  assert.ok(r.top.items.length);
  assert.ok(r.refs);
});

test('новости короткие: заголовок до 6 слов, до 4 пунктов, пункт до 130 знаков, без «ты» и устройства сайта', () => {
  const word = w => new RegExp(`(?<![\\p{L}])(${w})(?![\\p{L}])`, 'iu');
  for (const e of NEWS) {
    assert.ok(plainNews(e.title).split(/\s+/).length <= 6, `${e.id}: заголовок длиннее 6 слов`);
    assert.ok(e.items.length <= 4, `${e.id}: больше 4 пунктов — разбей на темы или вычеркни лишнее`);
    for (const t of [e.title, ...e.items]) {
      const p = plainNews(t);
      assert.ok(p.length <= 130, `${e.id}: пункт длиннее 130 знаков: ${p}`);
      for (const bad of ['ты', 'тебе', 'тебя', 'твой', 'твоя', 'твои', 'твоё', 'мы', 'нам'])
        assert.ok(!word(bad).test(p), `${e.id}: без обращения на «ты» и без «мы» (${bad}): ${p}`);
      for (const bad of ['данные', 'данных', 'загрузк[а-я]*', 'сервер[а-я]*', 'браузер[а-я]*', 'кэш[а-я]*', 'больше не нужно'])
        assert.ok(!word(bad).test(p), `${e.id}: устройство сайта или оправдание (${bad}): ${p}`);
    }
  }
});

test('ссылки в новостях ведут на существующий раздел и блок', () => {
  const app = fs.readFileSync(path.join(ROOT, 'client', 'src', 'App.jsx'), 'utf8');
  const pages = new Set([...app.slice(app.indexOf('const PAGES')).matchAll(/\{ id: '([a-z-]+)'/g)].map(m => m[1]));
  const guides = new Set(fs.readdirSync(path.join(ROOT, 'server', 'guides')).filter(f => f.endsWith('.js'))
    .flatMap(f => [...fs.readFileSync(path.join(ROOT, 'server', 'guides', f), 'utf8').matchAll(/export default \{ id: '([a-z-]+)'/g)].map(m => m[1])));
  const src = clientSrc();
  const links = newsLinks(NEWS);
  assert.ok(links.length > 0);
  for (const l of links) {
    const [page, sub] = l.path.split('/');
    assert.ok(pages.has(page), `${l.id}: нет раздела «${page}» (ссылка «${l.label}»)`);
    if (page === 'guides' && sub) assert.ok(guides.has(sub), `${l.id}: нет гайда «${sub}»`);
    if (l.anchor) assert.ok(new RegExp(`(data-news="${l.anchor}"|news="${l.anchor}"|news: '${l.anchor}')`).test(src),
      `${l.id}: на сайте нет блока с data-news="${l.anchor}" (ссылка «${l.label}»)`);
  }
  assert.equal(plainNews('В [Запасах](stash/essence#essence) сверху'), 'В Запасах сверху');
});
