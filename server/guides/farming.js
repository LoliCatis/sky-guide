// Гайд по фермерству и Саду (Garden): уровень Сада, Crop Upgrades, участки, Composter, гости, Jacob's Contest,
// инструменты по культурам, броня и снаряжение, вредители, питомцы, заработок.
import { fmt, short, plural, hasItem, bestPet, ladderPos, howText, constants, cell, tone, topNext } from './gathering-util.js';
import { gardenLevel, GARDEN_EXP_FALLBACK } from '../parse/extras-view.js';

// Культура: id в API Сада и коллекциях, ключ вех (crop_milestones в NEU), лестница инструментов
const CROPS = [
  { id: 'WHEAT', ru: 'Пшеница', ms: 'WHEAT', tools: ['THEORETICAL_HOE_WHEAT_1', 'THEORETICAL_HOE_WHEAT_2', 'THEORETICAL_HOE_WHEAT_3'] },
  { id: 'CARROT_ITEM', ru: 'Морковь', ms: 'CARROT', tools: ['THEORETICAL_HOE_CARROT_1', 'THEORETICAL_HOE_CARROT_2', 'THEORETICAL_HOE_CARROT_3'] },
  { id: 'POTATO_ITEM', ru: 'Картофель', ms: 'POTATO', tools: ['THEORETICAL_HOE_POTATO_1', 'THEORETICAL_HOE_POTATO_2', 'THEORETICAL_HOE_POTATO_3'] },
  { id: 'PUMPKIN', ru: 'Тыква', ms: 'PUMPKIN', tools: ['PUMPKIN_DICER', 'PUMPKIN_DICER_2', 'PUMPKIN_DICER_3'] },
  { id: 'MELON', ru: 'Арбуз', ms: 'MELON', tools: ['MELON_DICER', 'MELON_DICER_2', 'MELON_DICER_3'] },
  { id: 'SUGAR_CANE', ru: 'Сахарный тростник', ms: 'SUGAR_CANE', tools: ['THEORETICAL_HOE_CANE_1', 'THEORETICAL_HOE_CANE_2', 'THEORETICAL_HOE_CANE_3'] },
  { id: 'CACTUS', ru: 'Кактус', ms: 'CACTUS', tools: ['CACTUS_KNIFE', 'CACTUS_KNIFE_2', 'CACTUS_KNIFE_3'] },
  { id: 'INK_SACK:3', ru: 'Какао-бобы', ms: 'COCOA_BEANS', tools: ['COCO_CHOPPER', 'COCO_CHOPPER_2', 'COCO_CHOPPER_3'] },
  { id: 'NETHER_STALK', ru: 'Адский нарост', ms: 'NETHER_WART', tools: ['THEORETICAL_HOE_WARTS_1', 'THEORETICAL_HOE_WARTS_2', 'THEORETICAL_HOE_WARTS_3'] },
  { id: 'MUSHROOM_COLLECTION', ru: 'Грибы', ms: 'MUSHROOM', tools: ['FUNGI_CUTTER', 'FUNGI_CUTTER_2', 'FUNGI_CUTTER_3'] },
  { id: 'DOUBLE_PLANT', ru: 'Подсолнух', ms: 'SUNFLOWER', tools: ['THEORETICAL_HOE_SUNFLOWER_1', 'THEORETICAL_HOE_SUNFLOWER_2', 'THEORETICAL_HOE_SUNFLOWER_3'] },
  { id: 'MOONFLOWER', ru: 'Лунный цветок', ms: 'MOONFLOWER', tools: ['THEORETICAL_HOE_SUNFLOWER_1', 'THEORETICAL_HOE_SUNFLOWER_2', 'THEORETICAL_HOE_SUNFLOWER_3'] },
  { id: 'WILD_ROSE', ru: 'Дикая роза', ms: 'WILD_ROSE', tools: ['THEORETICAL_HOE_WILD_ROSE_1', 'THEORETICAL_HOE_WILD_ROSE_2', 'THEORETICAL_HOE_WILD_ROSE_3'] },
];
// Старые ключи Crop Upgrades (до перехода на id предметов)
const UPG_ALIAS = { CARROT_ITEM: ['CARROT'], POTATO_ITEM: ['POTATO'], 'INK_SACK:3': ['COCOA_BEANS'], NETHER_STALK: ['NETHER_WART'], MUSHROOM_COLLECTION: ['MUSHROOM'], DOUBLE_PLANT: ['SUNFLOWER'] };

const ARMOR = ['FARM_SUIT', 'MELON', 'CROPIE', 'SQUASH', 'FERMENTO', 'HELIANTHUS'];
const PEONY = ['LOTUS_NECKLACE', 'LOTUS_CLOAK', 'LOTUS_BELT', 'LOTUS_BRACELET'];
const PESTHUNTER = ['PESTHUNTERS_NECKLACE', 'PESTHUNTERS_CLOAK', 'PESTHUNTERS_BELT', 'PESTHUNTERS_GLOVES'];
const VACUUMS = ['SKYMART_VACUUM', 'SKYMART_TURBO_VACUUM', 'SKYMART_HYPER_VACUUM', 'INFINI_VACUUM', 'INFINI_VACUUM_HOOVERIUS'];
const PETS = [
  ['ELEPHANT', 'Farming Fortune от защиты и скорости: основной питомец для большинства культур'],
  ['MOOSHROOM_COW', 'Farming Fortune от силы и грибы при фарме: лучший для грибов и с высоким Strength'],
  ['HEDGEHOG', 'Больше урона по вредителям и Farming Fortune за тиры бестиария Pests'],
  ['SLUG', 'Bonus Pest Chance и Fortune на участке со Sprayonator'],
  ['RABBIT', 'Farming Wisdom и ускорение фермерских миньонов'],
];

const CROP_UPG_COPPER_FALLBACK = [5, 10, 20, 50, 100, 500, 1000, 2000, 4000];

function milestone(collected, steps) {
  let lvl = 0, acc = 0;
  for (const need of steps || []) { if (collected >= acc + need) { acc += need; lvl++; } else break; }
  return { level: lvl, max: (steps || []).length };
}

const prettyNpc = s => String(s || '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
const pieces = (ctx, base) => ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].filter(s => hasItem(ctx, `${base}_${s}`)).length;

export default {
  id: 'farming', title: 'Фермерство и Сад', icon: 'THEORETICAL_HOE_WARTS_3', group: 'farming',
  build(m, ctx) {
    const c = constants(ctx).garden || {};
    const g = m.garden || {};
    const skill = m.skills?.farming;
    const gl = gardenLevel(Number(g.experience || 0), c.garden_exp || GARDEN_EXP_FALLBACK);
    const copper = Number(g.copper || 0);
    const next = [];
    const sections = [];

    // ---- кап Farming и перки Anita ----
    const capPerk = Number(m.jacob?.perks?.farming_level_cap || 0);
    const ddPerk = Number(m.jacob?.perks?.double_drops || 0);
    const medals = m.jacob?.medals || {};
    if (capPerk < 10) {
      next.push({ title: `Подними кап Farming у Anita: ${50 + capPerk} → 60`, priority: 85, why: 'Каждый уровень капа стоит медалей Jacob’s Contest и открывает ещё один уровень Farming (Fortune, статы, SkyBlock XP).' });
    }
    if (ddPerk < 15) {
      next.push({ title: `Перк Anita Extra Farming Fortune: ${ddPerk}/15`, priority: 64, why: `Докупи оставшиеся ${15 - ddPerk} ${plural(15 - ddPerk, 'уровень', 'уровня', 'уровней')} за медали Jacob’s Contest: это постоянный Farming Fortune для всех культур. Медали сейчас: золото ${fmt(medals.gold || 0)}, серебро ${fmt(medals.silver || 0)}, бронза ${fmt(medals.bronze || 0)}.` });
    }

    // ---- Crop Upgrades ----
    const upgCost = c.crop_upgrades || CROP_UPG_COPPER_FALLBACK;
    const maxUpg = upgCost.length;
    const cu = g.cropUpgrades || {};
    const upgOf = id => Number(cu[id] ?? (UPG_ALIAS[id] || []).map(k => cu[k]).find(v => v != null) ?? 0);
    const cropRows = CROPS.map(cr => {
      const lvl = upgOf(cr.id);
      const copperLeft = upgCost.slice(lvl).reduce((s, v) => s + v, 0);
      const ms = milestone(Number(g.resources?.[cr.id] || 0), c.crop_milestones?.[cr.ms]);
      const tool = ladderPos(ctx, cr.tools);
      return { ...cr, upg: lvl, copperLeft, nextCopper: upgCost[lvl] || 0, ms, tool, pb: Number(m.jacob?.personalBests?.[cr.id] || 0) };
    });
    const copperAll = cropRows.reduce((s, r) => s + r.copperLeft, 0);
    const notMax = cropRows.filter(r => r.upg < maxUpg);
    if (notMax.length) {
      // сначала то, что дешевле докачать
      const cheap = [...notMax].sort((a, b) => a.nextCopper - b.nextCopper).slice(0, 5);
      next.push({
        title: `Crop Upgrades: ${notMax.length} ${plural(notMax.length, 'культура', 'культуры', 'культур')} не на максимуме`, priority: 72,
        why: `Каждый уровень даёт +5 Farming Fortune своей культуре. Меди ${fmt(copper)}, на всё нужно ${fmt(copperAll)}. Дешевле всего: ${cheap.map(r => `${r.ru} ${r.upg}/${maxUpg} (${fmt(r.nextCopper)} меди)`).join(', ')}.`,
      });
    }

    // ---- участки ----
    const plotIds = new Set(g.plotIds || []);
    const totalPlots = 24;
    const plotsHave = g.unlockedPlots ?? plotIds.size;
    if (plotsHave < totalPlots) {
      const costs = c.plot_costs;
      let nextCost = null;
      if (costs && plotIds.size) {
        for (const tier of ['beginner', 'intermediate', 'advanced', 'expert']) {
          const have = [...plotIds].filter(p => p.startsWith(tier)).length;
          if (have < (costs[tier] || []).length) { nextCost = costs[tier][have]; break; }
        }
      }
      next.push({
        title: `Открой участок Сада: ${plotsHave}/${totalPlots}`, priority: 46,
        why: `Больше участков — больше места под культуры и больше вредителей.${nextCost ? ` Следующий стоит ${nextCost.amount}× ${ctx.name(nextCost.item)}${ctx.price(nextCost.item) ? ` (~${short(ctx.price(nextCost.item) * nextCost.amount)} монет)` : ''}.` : ''} Desk → Configure Plots.`,
      });
    }

    // ---- Composter ----
    const comp = g.composter || {};
    const compUp = c.composter_upgrades || {};
    const compRows = ['speed', 'multi_drop', 'fuel_cap', 'organic_matter_cap', 'cost_reduction'].map(k => {
      const lvl = Number(comp[k] || 0);
      const nx = compUp[k]?.[String(lvl + 1)];
      return { k, lvl, max: Object.keys(compUp[k] || {}).length || 25, next: nx };
    });
    const compLow = compRows.filter(r => r.lvl < r.max);
    if (compLow.length) {
      const sp = compRows.find(r => r.k === 'speed'), md = compRows.find(r => r.k === 'multi_drop');
      next.push({
        title: `Прокачай Composter: Speed ${sp.lvl}/${sp.max}, Multi Drop ${md.lvl}/${md.max}`, priority: sp.lvl < 10 ? 58 : 36,
        why: `Composter сам делает Compost из органики и топлива: им платишь за участки, а лишнее продаёшь на Bazaar${ctx.price('COMPOST') ? ` (Compost ~${short(ctx.price('COMPOST'))})` : ''}. ${sp.next ? `Следующий Speed: ${fmt(sp.next.copper)} меди + ${Object.entries(sp.next.items || {}).map(([i, n]) => `${n}× ${ctx.name(i.toUpperCase())}`).join(', ')}.` : ''}`,
      });
    }

    // ---- гости ----
    const visitors = (g.activeVisitors || []).map(v => ({ npc: v.npc, wants: v.items || [] }));
    const totalVisitors = Object.keys(c.visitors || {}).length || null;
    if (visitors.length) {
      const priced = visitors.map(v => ({ ...v, cost: v.wants.reduce((s, w) => s + ctx.price(w.id) * w.amount, 0) }));
      next.push({
        title: `Обслужи гостей в Саду: ${visitors.length} ждут`, priority: 60,
        why: `Гости дают медь, опыт Сада и Farming XP, иногда редкие дропы. Сейчас: ${priced.slice(0, 5).map(v => `${prettyNpc(v.npc)} — ${v.wants.map(w => `${fmt(w.amount)}× ${ctx.name(w.id)}`).join(', ')}${v.cost ? ` (~${short(v.cost)})` : ''}`).join('; ')}.`,
      });
    }

    // ---- инструменты ----
    const noTool = cropRows.filter(r => r.tool.best < 0 && !['DOUBLE_PLANT', 'MOONFLOWER', 'WILD_ROSE'].includes(r.id));
    const lowTool = cropRows.filter(r => r.tool.best >= 0 && r.tool.best < 2);

    // ---- броня ----
    const armor = ARMOR.map(b => ({ b, n: pieces(ctx, b) }));
    const topIdx = armor.reduce((mx, a, i) => (a.n >= 2 ? i : mx), -1);
    if (topIdx < ARMOR.length - 1) {
      const nb = ARMOR[topIdx + 1];
      next.push({ title: `Фермерская броня: следующий сет ${ctx.name(`${nb}_CHESTPLATE`).replace(/ Chestplate$/, '')}`, priority: topIdx < 3 ? 56 : 42, why: `${topIdx >= 0 ? `Сейчас лучший сет — ${ctx.name(`${ARMOR[topIdx]}_CHESTPLATE`).replace(/ Chestplate$/, '')}. ` : ''}${howText(ctx, `${nb}_CHESTPLATE`)}.` });
    }
    const peony = PEONY.filter(id => hasItem(ctx, id)).length;
    if (peony < 4) next.push({ title: `Снаряжение Peony: ${peony}/4`, priority: 40, why: 'Дёшево и сразу: по +5 Farming Fortune за предмет. Покупается у SkyMart в Саду за медь (50–500 меди).' });
    const vac = ladderPos(ctx, VACUUMS);
    if (vac.best < 3) next.push({ title: `Пылесос для вредителей: ${vac.next ? ctx.name(vac.next) : '—'}`, priority: 38, why: `Вредители (Pests) появляются при фарме и режут рост культур на участке. Пылесос засасывает их и даёт Pest-дропы. ${vac.next ? howText(ctx, vac.next) : ''}` });
    const pets = PETS.map(([t, why]) => ({ t, why, pet: bestPet(ctx, t) }));
    const hedge = pets.find(p => p.t === 'HEDGEHOG');
    if (hedge && !hedge.pet) next.push({ title: 'Питомец Hedgehog для вредителей', priority: 30, why: hedge.why + '.' });

    // ================= Секции =================
    sections.push({
      kind: 'steps', title: 'Как развивать Сад',
      items: [
        { title: 'Гости каждый день', text: 'Visitors приходят сами (до 5 в очереди). Это главный источник меди и опыта Сада; редкие гости дают ценные дропы.', current: visitors.length > 0 },
        { title: 'Crop Upgrades и участки', text: `Медь → Crop Upgrades (+5 Fortune за уровень, максимум ${maxUpg}). Compost → новые участки.`, done: !notMax.length && plotsHave >= totalPlots },
        { title: 'Composter', text: 'Прокачай Speed и Multi Drop: пассивный Compost на участки и на продажу.', done: !compLow.length },
        { title: 'Инструменты Mk. III', text: 'Для каждой культуры свой инструмент: Mk. I у SkyMart за медь, Mk. II и III — крафт за Jacob’s Ticket и сжатые культуры.', done: !noTool.length && !lowTool.length },
        { title: 'Вредители', text: 'Pests: пылесос, Sprayonator и Hedgehog. Pest-дропы продаются, а за Pests Pesthunter Phillip продаёт снаряжение Pesthunter’s.' },
        { title: 'Jacob’s Contest', text: 'Проходит каждый час (3 игровых дня). Медали тратятся у Anita на кап Farming и постоянный Fortune; Jacob’s Ticket — на инструменты.' },
      ],
    });

    sections.push({
      kind: 'table', title: 'Культуры',
      note: `Медь: ${fmt(copper)}. Вехи (milestones) растут от собранного в Саду, Crop Upgrades покупаются за медь в Desk.`,
      columns: ['Культура', 'Crop Upgrade', 'Медь до максимума', 'Веха', 'Инструмент', 'Рекорд Jacob'],
      rows: cropRows.map(r => [
        cell(r.ru, { item: r.tools[0] }),
        cell(`${r.upg}/${maxUpg}`, { tone: r.upg >= maxUpg ? 'good' : r.upg >= 7 ? 'warn' : 'bad' }),
        r.copperLeft ? fmt(r.copperLeft) : '—',
        r.ms.max ? `${r.ms.level}/${r.ms.max}` : '—',
        cell(r.tool.have ? ctx.name(r.tool.have) : 'нет', { tone: r.tool.best >= 2 ? 'good' : r.tool.best >= 0 ? 'warn' : 'muted' }),
        r.pb ? fmt(r.pb) : '—',
      ]),
    });

    if (visitors.length) {
      sections.push({
        kind: 'table', title: 'Гости сейчас',
        note: `Обслужено всего: ${fmt(g.visitorsServed || 0)}, уникальных ${fmt(g.uniqueVisitors || 0)}${totalVisitors ? ` из ${totalVisitors}` : ''}. Цена — сколько стоит купить просьбу на Bazaar.`,
        columns: ['Гость', 'Просит', 'Цена'],
        rows: visitors.map(v => {
          const cost = v.wants.reduce((s, w) => s + ctx.price(w.id) * w.amount, 0);
          return [prettyNpc(v.npc), v.wants.map(w => `${fmt(w.amount)}× ${ctx.name(w.id)}`).join(', ') || '—', cost ? short(cost) : '—'];
        }),
      });
    }

    sections.push({
      kind: 'table', title: 'Composter',
      columns: ['Улучшение', 'Уровень', 'Следующий уровень'],
      rows: compRows.map(r => [
        { speed: 'Speed', multi_drop: 'Multi Drop', fuel_cap: 'Fuel Cap', organic_matter_cap: 'Organic Matter Cap', cost_reduction: 'Cost Reduction' }[r.k],
        cell(`${r.lvl}/${r.max}`, { tone: r.lvl >= r.max ? 'good' : r.lvl ? 'warn' : 'bad' }),
        r.next ? `${fmt(r.next.copper)} меди + ${Object.entries(r.next.items || {}).map(([i, n]) => `${n}× ${ctx.name(i.toUpperCase())}`).join(', ')}` : r.lvl >= r.max ? 'максимум' : '—',
      ]),
    });

    sections.push({
      kind: 'table', title: 'Снаряжение фермера',
      columns: ['Что', 'Есть', 'Как получить следующее'],
      rows: [
        ...armor.map(({ b, n }) => [cell(ctx.name(`${b}_CHESTPLATE`).replace(/ Chestplate$/, ''), { item: `${b}_CHESTPLATE` }), cell(`${n}/4`, { tone: n === 4 ? 'good' : n ? 'warn' : 'muted' }), n === 4 ? '—' : howText(ctx, `${b}_CHESTPLATE`)]),
        [cell('Peony (ожерелье, плащ, пояс, браслет)', { item: 'LOTUS_BELT' }), cell(`${peony}/4`, { tone: peony === 4 ? 'good' : 'warn' }), '+5 Farming Fortune каждый, SkyMart за медь'],
        [cell('Pesthunter’s (снаряжение)', { item: 'PESTHUNTERS_GLOVES' }), `${PESTHUNTER.filter(id => hasItem(ctx, id)).length}/4`, 'Bonus Pest Chance, Pesthunter Phillip за Pests (40–100 шт.)'],
        [cell('Пылесос', { item: vac.have || VACUUMS[0] }), vac.have ? ctx.name(vac.have) : 'нет', vac.next ? howText(ctx, vac.next) : 'максимум'],
      ],
    });

    sections.push({
      kind: 'table', title: 'Питомцы для фермерства',
      columns: ['Питомец', 'Есть', 'Зачем'],
      rows: pets.map(p => [cell(ctx.name(`${p.t};4`).replace(/^\[Lvl \{LVL\}\] /, ''), { item: `${p.t};4` }), cell(p.pet ? `${p.pet.tier[0] + p.pet.tier.slice(1).toLowerCase()}${p.pet.level ? `, ур. ${p.pet.level}` : ''}` : 'нет', { tone: p.pet ? 'good' : 'muted' }), p.why]),
    });

    sections.push({
      kind: 'checklist', title: 'Jacob’s Contest и Anita',
      items: [
        { text: `Кап Farming: ${50 + capPerk}/60`, done: capPerk >= 10, hint: 'Anita → Farming Level Cap, за медали' },
        { text: `Extra Farming Fortune: ${ddPerk}/15`, done: ddPerk >= 15, hint: 'Anita, за медали' },
        { text: `Медали: ${fmt(medals.gold || 0)} золотых, ${fmt(medals.silver || 0)} серебряных, ${fmt(medals.bronze || 0)} бронзовых`, done: true, hint: 'Бронза — топ 60% участников, серебро — 30%, золото — 10%; платина и бриллиант (5% и 2%) идут в зачёт уникальных наград' },
      ],
    });

    const methods = (ctx.analysis?.methods || []).filter(x => x.tag === 'Фермерство');
    sections.push({
      kind: 'table', title: 'Заработок фермерством',
      note: 'Доход по живым ценам, если модуль цен уже посчитал. Подробнее — страница «Заработок», вкладка «Культуры».',
      columns: ['Способ', 'Монет в час', 'Как'],
      rows: [
        ...methods.map(x => [x.title, x.coinsPerHour ? short(x.coinsPerHour) : '—', x.detail || x.desc || '']),
        ...(!methods.length ? [['Фарм лучшей культуры', 'по ценам', 'Культура и форма продажи считаются на странице «Заработок»']] : []),
        ['Вредители', 'по ценам', 'Pest-дропы и Pests для Pesthunter Phillip'],
        ['Compost', 'пассивно', 'Composter с прокачанными Speed и Multi Drop, продажа на Bazaar'],
      ],
    });

    const status = gl.level >= gl.max && !notMax.length && plotsHave >= totalPlots && capPerk >= 10 ? 'done' : skill?.level ? 'progress' : 'start';
    return {
      summary: [skill ? `Farming ${skill.level}` : null, `Сад ${gl.level}/${gl.max}`, `Crop Upgrades ${cropRows.reduce((a, r) => a + r.upg, 0)}/${cropRows.length * maxUpg} (на максимуме ${cropRows.length - notMax.length} из ${cropRows.length})`, `участки ${plotsHave}/${totalPlots}`].filter(Boolean).join(' · '),
      status,
      level: { label: 'Уровень Сада', value: gl.level, max: gl.max },
      next: topNext(next),
      sections,
    };
  },
};
