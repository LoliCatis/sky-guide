import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadLevel, createStatus } from '../status.js';

test('loadLevel: спокойно, занят, перегружен', () => {
  assert.equal(loadLevel({}).level, 'low');
  assert.equal(loadLevel({ lagMs: 80 }).level, 'medium');
  assert.equal(loadLevel({ keyed5m: 200 }).level, 'medium');
  assert.match(loadLevel({ keyed5m: 200 }).why, /Hypixel/);
  assert.equal(loadLevel({ keyed5m: 280 }).level, 'high');
  assert.equal(loadLevel({ inFlight: 40 }).level, 'high');
  assert.equal(loadLevel({ lagMs: 500 }).level, 'high');
});

test('createStatus: считает запросы к /api и читает журнал обновлений', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-status-'));
  fs.writeFileSync(path.join(dir, 'deploy-log.json'), JSON.stringify({ events: [{ kind: 'rollback', why: 'сборка не удалась', at: 1 }] }));
  const s = createStatus({ dataDir: dir, keyedCallsRecent: () => 42, state: { status: 'ok' }, buildId: () => 'abc' });
  try {
    const handlers = {};
    const res = { on: (e, f) => { handlers[e] = f; } };
    let nexts = 0;
    s.track({ path: '/api/profile' }, res, () => nexts++);
    s.track({ path: '/style.css' }, { on() {} }, () => nexts++);
    assert.equal(nexts, 2);
    let a = s.adminStatus();
    assert.equal(a.requests.inFlight, 1);
    assert.equal(a.requests.perMinute, 1);
    assert.equal(a.hypixel.used5m, 42);
    assert.equal(a.build, 'abc');
    assert.equal(a.deploy.last.kind, 'rollback');
    handlers.finish(); handlers.close(); // закрытие после finish не уводит счётчик в минус
    a = s.adminStatus();
    assert.equal(a.requests.inFlight, 0);
    const p = s.publicStatus();
    assert.deepEqual(Object.keys(p).sort(), ['at', 'load', 'ok', 'why']); // игрокам — без подробностей
  } finally { s.stop(); }
});
