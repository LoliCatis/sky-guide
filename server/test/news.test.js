// «Новости» (server/news): порядок записей, id, запрещённые слова и ответ /api/news.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEWS, KIND_RU } from '../news/entries.js';
import { newsView, mountNewsRoutes } from '../news/index.js';

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
