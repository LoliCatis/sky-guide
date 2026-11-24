import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { PNG } from 'pngjs';
import { loadPacks, packTexture, packVanillaTexture, packs, publicPackNames } from '../packs.js';

const png = (w, h, r) => { const p = new PNG({ width: w, height: h }); p.data.fill(r); return PNG.sync.write(p); };

test('приоритет паков и три формата', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packs-'));
  // Hypixel Plus: CIT
  const a = new AdmZip();
  a.addFile('pack.mcmeta', Buffer.from('{"pack":{"description":"Hypixel+"}}'));
  a.addFile('assets/minecraft/optifine/cit/weapons/hyperion.properties', Buffer.from('type=item\nitems=iron_sword\nnbt.ExtraAttributes.id=HYPERION\n'));
  a.addFile('assets/minecraft/optifine/cit/weapons/hyperion.png', png(16, 16, 10));
  a.addFile('assets/minecraft/optifine/cit/anim/aote.properties', Buffer.from('type=item\nnbt.ExtraAttributes.id=regex:ASPECT_OF_THE_(END|VOID)\ntexture=aote_tex\n'));
  a.addFile('assets/minecraft/optifine/cit/anim/aote_tex.png', png(16, 64, 20)); // анимация 4 кадра
  a.writeZip(path.join(dir, 'Hypixel Plus 0.23.4.zip'));
  // FurfSky: Firmament (во вложенной папке)
  const b = new AdmZip();
  b.addFile('FSR/pack.mcmeta', Buffer.from('{"pack":{"description":"FSR"}}'));
  b.addFile('FSR/assets/firmskyblock/models/item/hyperion.json', Buffer.from('{"parent":"minecraft:item/handheld","textures":{"layer0":"firmskyblock:item/hyp"}}'));
  b.addFile('FSR/assets/firmskyblock/textures/item/hyp.png', png(16, 16, 99));
  b.addFile('FSR/assets/firmskyblock/models/item/terminator.json', Buffer.from('{"textures":{"layer0":"firmskyblock:item/term"}}'));
  b.addFile('FSR/assets/firmskyblock/textures/item/term.png', png(32, 32, 30));
  b.writeZip(path.join(dir, 'FurfSky Reborn v2.0-pre.4.zip'));
  // Официальный пак Hypixel: items → models → textures
  const c = new AdmZip();
  c.addFile('assets/hypixel_skyblock/items/item/uncategorized/divan.json', Buffer.from('{"model":{"type":"minecraft:model","model":"hypixel_skyblock:item/divan"}}'));
  c.addFile('assets/hypixel_skyblock/models/item/divan.json', Buffer.from('{"textures":{"layer0":"hypixel_skyblock:item/divan_tex"}}'));
  c.addFile('assets/hypixel_skyblock/textures/item/divan_tex.png', png(16, 16, 40));
  c.writeZip(path.join(dir, 'Hypixel SkyBlock 31-10-2026.zip'));

  const info = loadPacks(dir);
  assert.deepEqual(info.map(i => i.name), ['Hypixel Plus 0.23.4', 'FurfSky Reborn v2.0-pre.4', 'Hypixel SkyBlock 31-10-2026']);
  assert.equal(packTexture('HYPERION').pack, 'Hypixel Plus 0.23.4'); // приоритет у Hypixel Plus
  assert.equal(packTexture('TERMINATOR').pack, 'FurfSky Reborn v2.0-pre.4');
  const aote = packTexture('ASPECT_OF_THE_VOID');
  assert.equal(aote.pack, 'Hypixel Plus 0.23.4');
  assert.equal(PNG.sync.read(aote.buf).height, 16); // первый кадр анимации
  assert.equal(packTexture('DIVAN_DRILL', 'hypixel_skyblock:item/uncategorized/divan').pack, 'Hypixel SkyBlock 31-10-2026');
  assert.equal(packTexture('UNKNOWN_THING'), null);
  assert.ok(packs.list.length === 3);
});

test('Hypixel Plus 1.21: custom_data в assets/minecraft/items и оверлей', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packs2-'));
  const z = new AdmZip();
  z.addFile('pack.mcmeta', Buffer.from('{"pack":{"description":"H+"}}'));
  const def = { model: { type: 'minecraft:condition', property: 'minecraft:component', predicate: 'minecraft:custom_data', value: { id: 'HYPERION' },
    on_true: { type: 'minecraft:model', model: 'hplus:skyblock/weapons/swords/hyperion' },
    on_false: { type: 'minecraft:select', property: 'minecraft:component', component: 'minecraft:custom_data',
      cases: [{ when: '{id:"GIANTS_SWORD"}', model: { type: 'minecraft:model', model: 'hplus:skyblock/weapons/swords/giant' } }],
      fallback: { type: 'minecraft:model', model: 'minecraft:item/iron_sword' } } } };
  z.addFile('assets/minecraft/items/iron_sword.json', Buffer.from(JSON.stringify(def)));
  z.addFile('assets/hplus/models/skyblock/weapons/swords/hyperion.json', Buffer.from('{"parent":"item/handheld","textures":{"layer0":"hplus:skyblock/weapons/swords/hyperion"}}'));
  z.addFile('assets/hplus/textures/skyblock/weapons/swords/hyperion.png', png(16, 16, 7));
  z.addFile('assets/hplus/models/skyblock/weapons/swords/giant.json', Buffer.from('{"textures":{"layer0":"hplus:skyblock/weapons/swords/giant"}}'));
  z.addFile('assets/hplus/textures/skyblock/weapons/swords/giant.png', png(16, 16, 8));
  z.addFile('1_21_5/assets/minecraft/items/stone.json', Buffer.from('{"model":{"type":"minecraft:model","model":"minecraft:item/stone"}}'));
  z.writeZip(path.join(dir, 'Hypixel Plus 0.23.4.zip'));
  const info = loadPacks(dir);
  assert.equal(info[0].components, 2);
  assert.equal(packTexture('HYPERION').pack, 'Hypixel Plus 0.23.4');
  assert.equal(packTexture('GIANTS_SWORD').pack, 'Hypixel Plus 0.23.4');
});

test('вложенные условия (is_shiny, using_item) дают текстуру «в покое»', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packs3-'));
  const z = new AdmZip();
  z.addFile('pack.mcmeta', Buffer.from('{"pack":{"description":"H+"}}'));
  const m = n => ({ type: 'minecraft:model', model: `hplus:w/${n}` });
  const cd = { property: 'minecraft:component', predicate: 'minecraft:custom_data' };
  const def = { model: { type: 'minecraft:condition', ...cd, value: { id: 'HYPERION' },
    on_true: { type: 'minecraft:condition', ...cd, value: { is_shiny: 1 }, on_true: m('shiny_hyperion'), on_false: m('hyperion') },
    on_false: { type: 'minecraft:condition', ...cd, value: { id: 'TERMINATOR' },
      on_true: { type: 'minecraft:condition', property: 'minecraft:using_item',
        on_true: { type: 'minecraft:range_dispatch', property: 'minecraft:use_duration', entries: [{ threshold: 0.5, model: m('terminator_pulling_1') }], fallback: m('terminator_pulling_0') },
        on_false: m('terminator') },
      on_false: m('iron_sword') } } };
  z.addFile('assets/minecraft/items/iron_sword.json', Buffer.from(JSON.stringify(def)));
  const tex = { shiny_hyperion: 1, hyperion: 2, terminator_pulling_0: 3, terminator_pulling_1: 4, terminator: 5, iron_sword: 6 };
  for (const [n, c] of Object.entries(tex)) {
    z.addFile(`assets/hplus/models/w/${n}.json`, Buffer.from(`{"textures":{"layer0":"hplus:w/${n}"}}`));
    z.addFile(`assets/hplus/textures/w/${n}.png`, png(16, 16, c));
  }
  z.writeZip(path.join(dir, 'Hypixel Plus 0.23.4.zip'));
  loadPacks(dir);
  assert.equal(PNG.sync.read(packTexture('HYPERION').buf).data[0], 2);
  assert.equal(PNG.sync.read(packTexture('TERMINATOR').buf).data[0], 5);
});

test('текстуры паков: PACKS_PUBLIC=none — только владельцу, список — разрешённым', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packs-lic-'));
  const z = new AdmZip();
  z.addFile('assets/minecraft/optifine/cit/hyp.properties', Buffer.from('type=item\nnbt.ExtraAttributes.id=HYPERION\ntexture=hyp\n'));
  z.addFile('assets/minecraft/optifine/cit/hyp.png', png(16, 16, 10));
  z.addFile('assets/minecraft/textures/item/diamond.png', png(16, 16, 11));
  z.writeZip(path.join(dir, 'FurfSky Reborn.zip'));
  const before = process.env.PACKS_PUBLIC;
  try {
    process.env.PACKS_PUBLIC = 'none';
    const info = loadPacks(dir);
    assert.equal(info[0].public, false);
    assert.equal(packTexture('HYPERION').pack, 'FurfSky Reborn', 'владельцу — из пака');
    assert.equal(packTexture('HYPERION', undefined, 'public'), null, 'гостю — нет');
    assert.ok(packVanillaTexture('diamond'));
    assert.equal(packVanillaTexture('diamond', 'public'), null);
    process.env.PACKS_PUBLIC = 'hypixel plus, furfsky';
    loadPacks(dir);
    assert.equal(packTexture('HYPERION', undefined, 'public').pack, 'FurfSky Reborn', 'после разрешения — всем');
  } finally {
    if (before === undefined) delete process.env.PACKS_PUBLIC; else process.env.PACKS_PUBLIC = before;
  }
});

test('текстуры паков: авто — всем, пока нет рекламы РСЯ; с рекламой — только владельцу', () => {
  assert.deepEqual(publicPackNames({}), ['*'], 'без рекламы — всем');
  assert.deepEqual(publicPackNames({ YANDEX_RTB_BOTTOM: 'R-A-1234567-1' }), [], 'с рекламой — никому');
  assert.deepEqual(publicPackNames({ YANDEX_RTB_LANDING: 'R-A-1234567-2' }), []);
  assert.deepEqual(publicPackNames({ YANDEX_RTB_BOTTOM: 'мусор' }), ['*'], 'неверный id блока рекламу не включает');
  assert.deepEqual(publicPackNames({ YANDEX_RTB_BOTTOM: 'R-A-1234567-1', PACKS_PUBLIC: 'all' }), ['*'], 'ручное all сильнее');
  assert.deepEqual(publicPackNames({ PACKS_PUBLIC: 'none' }), [], 'ручное none сильнее');
  assert.deepEqual(publicPackNames({ YANDEX_RTB_BOTTOM: 'R-A-1234567-1', PACKS_PUBLIC: 'FurfSky' }), ['furfsky']);
});

test('большие текстуры паков ужимаются до ICON_MAX, кадр анимации — квадрат', async () => {
  const { firstFrame, ICON_MAX } = await import('../packs.js');
  const big = PNG.sync.read(firstFrame(png(512, 512, 7)));
  assert.equal(big.width, ICON_MAX); assert.equal(big.height, ICON_MAX); assert.equal(big.data[0], 7);
  const anim = PNG.sync.read(firstFrame(png(256, 1024, 9)));
  assert.equal(anim.width, ICON_MAX); assert.equal(anim.height, ICON_MAX);
  const small = png(16, 16, 3);
  assert.equal(firstFrame(small), small); // маленькую не трогаем вовсе
});
