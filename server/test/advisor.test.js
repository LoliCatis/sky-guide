import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadmap, buildProgressMap, advise, diffRoadmaps, collectionTiersFromResources } from '../advisor/index.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

const price = id => PRICES[id] || 0;
const ACC = { highestMp: 1009, cheapestNext: [{ id: 'X_RING', name: 'X Ring', gain: 8, price: 400_000, perMp: 50_000 }], notRecombCount: 3, recombPrice: 6.5e6, recombGain: 15 };
const GEAR = { topItems: [{ name: 'Old Sword', where: 'Рюкзак 2', value: 30e6 }] };
const byId = steps => new Map(steps.map(s => [s.id, s]));

test('шаги корректной формы, отсортированы, на русском и без мусора', () => {
  const steps = buildRoadmap(ownercatMember(), ACC, GEAR, { price });
  assert.ok(steps.length > 20);
  const ids = new Set();
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    for (const k of ['id', 'cat', 'priority', 'effort', 'title', 'why', 'how']) assert.ok(s[k] !== undefined, `${s.id}: нет ${k}`);
    assert.ok(Array.isArray(s.how));
    assert.ok(s.priority >= 0 && s.priority <= 100);
    assert.ok(!ids.has(s.id), `дубль ${s.id}`); ids.add(s.id);
    if (i) assert.ok(steps[i - 1].priority >= s.priority, 'не отсортировано');
    const text = [s.title, s.why, ...s.how].join(' ');
    assert.match(text, /[а-яё]/i, `${s.id}: нет русского текста`);
    assert.doesNotMatch(text, /undefined|NaN|\[object/, `${s.id}: мусор в тексте: ${text}`);
    assert.notEqual(s.cat, 'Служебное', `правило упало: ${s.why}`);
  }
});

test('ключевые дыры профиля OwnerCat попадают в roadmap', () => {
  const s = byId(buildRoadmap(ownercatMember(), ACC, GEAR, { price }));
  for (const id of ['dungeon-master', 'dungeon-cata', 'slayer-blaze', 'slayer-vampire', 'kuudra', 'pets-taming-cap', 'hotf', 'skill-foraging', 'rift-souls', 'fairy-collect', 'mp-cheap', 'gear-equipment', 'money-idle']) {
    assert.ok(s.has(id), `нет шага ${id}`);
  }
  // M2 открывается только после победы на M1, даже при Catacombs 26+
  assert.match(s.get('dungeon-master').title, /Начни Master Mode с M1$/);
  assert.match(s.get('fairy-collect').title, /44 из 289/);
  assert.match(s.get('pets-taming-cap').title, /50 → 60/);
  assert.ok(s.get('slayer-blaze').priority > s.get('slayer-wolf').priority, 'блейз важнее волка 7→8');
  assert.ok(!s.has('fairy-exchange'), 'нечего обменивать');
  assert.ok(!s.has('cookie'), 'куки активна');
});

test('Master Mode: следующий этаж открывается победой на предыдущем', () => {
  const m = ownercatMember();
  m.dungeons.masterFloors = { 1: 3 };
  const s = byId(buildRoadmap(m, ACC, GEAR, { price }));
  assert.match(s.get('dungeon-master').title, /Пройди M2/);
  assert.match(s.get('dungeon-cata').how[0], /M2/);
});

test('Master Mode не советуется без F7, обмен фей — при 5+ несданных', () => {
  const m = ownercatMember();
  m.dungeons.floors['7'] = 0;
  m.fairySouls.unspent = 12;
  const s = byId(buildRoadmap(m, ACC, GEAR, { price }));
  assert.ok(!s.has('dungeon-master'));
  assert.match(s.get('fairy-exchange').title, /12 фей/);
});

test('лестницы: цель — самый высокий тир с выполненными требованиями', () => {
  const s = byId(buildRoadmap(ownercatMember(), ACC, GEAR, { price }));
  assert.match(s.get('gear-ender-slayer-weapon').title, /Atomsplit Katana/);
  assert.match(s.get('gear-dungeon-archer-weapon').title, /Juju Shortbow .* → Terminator/);
  assert.match(s.get('gear-kuudra-armor').title, /(→|начни с) Hot /, 'броня Kuudra под открытый тир');
  assert.ok(!s.has('gear-farming-armor'), 'Fermento уже есть');
  assert.ok(!s.has('gear-mining-drill'), "Divan's Drill уже есть");
});

test('цены: дорогие шаги помечаются needsSaving и опускаются', () => {
  const withP = byId(buildRoadmap(ownercatMember(), ACC, GEAR, { price }));
  const noP = byId(buildRoadmap(ownercatMember(), ACC, GEAR));
  const t = withP.get('gear-dungeon-archer-weapon');
  assert.equal(t.cost, PRICES.TERMINATOR);
  assert.equal(t.needsSaving, true);
  assert.ok(t.priority < noP.get('gear-dungeon-archer-weapon').priority);
  assert.equal(noP.get('gear-dungeon-archer-weapon').cost, undefined);
  const rich = ownercatMember(); rich.bank = 3e9;
  assert.ok(!byId(buildRoadmap(rich, ACC, GEAR, { price })).get('gear-dungeon-archer-weapon').needsSaving);
});

test('методы заработка из модуля prices и план покупок', () => {
  const r = advise(ownercatMember(), ACC, GEAR, { price, moneyMethods: [
    { id: 'a', title: 'Фарм', available: true, coinsPerHour: 20e6, desc: 'Сад' },
    { id: 'b', title: 'Kuudra Infernal', available: false, coinsPerHour: 90e6 },
  ] });
  const best = r.roadmap.find(s => s.id === 'money-best');
  assert.match(best.title, /Фарм/);
  assert.ok(r.plan.length > 0);
  assert.ok(r.plan.every((p, i) => !i || p.cumulative >= r.plan[i - 1].cumulative));
  const term = r.plan.find(p => p.stepId === 'gear-dungeon-archer-weapon');
  assert.equal(term.affordableNow, false);
  assert.ok(term.hoursOfFarming > 0);
});

test('карта прогрессии', () => {
  const map = buildProgressMap(ownercatMember(), ACC, GEAR, { price });
  const b = Object.fromEntries(map.branches.map(x => [x.id, x]));
  for (const id of ['dungeons', 'slayers', 'kuudra', 'accessories', 'gear', 'skills', 'pets', 'minions', 'mining', 'foraging', 'rift', 'general']) assert.ok(b[id], `нет ветки ${id}`);
  const st = new Set(['done', 'current', 'available', 'locked']);
  for (const br of map.branches) for (const n of br.nodes) {
    assert.ok(st.has(n.status), `${n.id}: ${n.status}`);
    assert.ok(n.progress === undefined || (n.progress >= 0 && n.progress <= 1), `${n.id}: progress ${n.progress}`);
  }
  const node = id => map.branches.flatMap(x => x.nodes).find(n => n.id === id);
  assert.equal(node('dungeon:f7').status, 'done');
  assert.equal(node('dungeon:m1').status, 'current');
  assert.equal(node('dungeon:m3').status, 'locked');
  assert.equal(node('kuudra:hot').status, 'done');
  assert.equal(node('kuudra:burning').status, 'locked');
  assert.equal(node('mp:1100').status, 'current');
  assert.equal(node('hotf:4').status, 'current');
  assert.ok(map.overall.progress > 0 && map.overall.progress < 1);
  // stepId на карте ссылаются на существующие шаги (там, где шаг есть)
  const ids = new Set(buildRoadmap(ownercatMember(), ACC, GEAR, { price }).map(s => s.id));
  assert.ok(ids.has(node('dungeon:m1').stepId));
});

test('пустой/неполный профиль не роняет движок', () => {
  const steps = buildRoadmap({ skills: {}, pets: [], inv: {} });
  assert.ok(Array.isArray(steps));
  assert.ok(!steps.some(s => s.cat === 'Служебное'), 'ни одно правило не должно падать');
  const map = buildProgressMap({ skills: {}, pets: [], inv: {} });
  assert.ok(Array.isArray(map.branches));
});

test('diffRoadmaps и collectionTiersFromResources', () => {
  const a = [{ id: 'x', priority: 10 }, { id: 'y', priority: 10 }];
  const b = [{ id: 'y', priority: 10 }, { id: 'z', priority: 5 }];
  const d = diffRoadmaps(a, b);
  assert.deepEqual(d.completed.map(s => s.id), ['x']);
  assert.deepEqual(d.added.map(s => s.id), ['z']);
  const tiers = collectionTiersFromResources({ collections: { FARMING: { items: { WHEAT: { tiers: [{ tier: 2, amountRequired: 100 }, { tier: 1, amountRequired: 50 }] } } } } });
  assert.deepEqual(tiers, { WHEAT: [50, 100] });
  const s = byId(buildRoadmap(ownercatMember(), ACC, GEAR, { collectionTiers: { LOG: [100, 50_000, 100_000] } }));
  assert.match(s.get('collections-near').how[0], /тир 2\/3/);
});

test('в советах нет сырых id: питомцы и миньоны названы по-человечески', () => {
  const m = ownercatMember();
  m.minions = ['WHEAT_1', 'WHEAT_2', 'CAVESPIDER_1'];
  const steps = buildRoadmap(m, ACC, GEAR, { price });
  const text = steps.flatMap(s => [s.title, s.why, ...(s.how || [])]).join('\n');
  assert.doesNotMatch(text, /\b[A-Z]{3,}_[A-Z_]{3,}\b/, 'сырой id вида GOLDEN_DRAGON');
  { const bad = text.split('\n').find(l => /\b(GOLDEN DRAGON|BLACK CAT|GRIFFIN)\b/.test(l)); assert.ok(!bad, 'имя питомца капсом: ' + bad); }
  assert.doesNotMatch(text, /\bcavespider\b|шаг\(ов\)/);
});

test('план для игрока без F7 и Master Mode: не советует Necron и не пишет «после Master Mode»', async () => {
  const { ownercatMember: mkm } = await import('./fixtures/ownercat.js');
  const m = mkm();
  m.dungeons.catacombs.level = 15;
  m.dungeons.floors = { 0: 3, 1: 5, 2: 4, 3: 2, 4: 1 };
  m.dungeons.masterFloors = {};
  m.slayers.blaze = { ...(m.slayers.blaze || {}), level: 0, xp: 0, kills: {} };
  const { advise: adv } = await import('../advisor/index.js');
  const r = adv(m, null, null, { price: () => 1000 });
  const armor = r.roadmap.find(s => s.id === 'gear-dungeon-armor');
  // Necron советуется только с пометкой, что сначала нужен F7 (у фикстуры уже есть Shadow Assassin)
  if (armor && /Necron/.test(armor.title)) assert.match(armor.why, /пройди F7/);
  const blaze = r.roadmap.find(s => s.id === 'slayer-blaze');
  assert.ok(blaze, 'шаг блейза есть');
  assert.ok(!/после Master Mode/.test(blaze.why), blaze.why);
});
