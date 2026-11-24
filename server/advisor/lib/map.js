// Карта прогрессии: ветки с вехами, которые сайт рисует как дерево/дорожную карту.
import LADDERS from '../data/ladders.json' with { type: 'json' };
import KEY_PETS from '../data/key-pets.json' with { type: 'json' };
import { MASTER_REQ, KUUDRA_TIERS } from './rules/combat.js';
import { MP_MILESTONES, MINION_SLOTS } from './rules/economy.js';
import { ladderState, tierLabel } from './rules/gear.js';
import { analyzeMuseum } from '../../museum/analyze.js';
import { bestPets, petTierIndex, PET_TIER_RU, fmtNum, clamp, plural, prettyId } from './util.js';

/**
 * @typedef {'done'|'current'|'available'|'locked'} NodeStatus
 *   done — выполнено; current — в процессе (следующая цель); available — открыто, но не начато; locked — не выполнено требование.
 * @typedef {Object} MapNode
 * @property {string} id
 * @property {string} title
 * @property {NodeStatus} status
 * @property {number} [progress]  0..1 для current
 * @property {string} [detail]    требование или пояснение по-русски
 * @property {string} [stepId]    id шага roadmap, который ведёт к этой вехе
 * @typedef {Object} Branch
 * @property {string} id
 * @property {string} title
 * @property {number} progress 0..1 (доля done)
 * @property {string} summary
 * @property {MapNode[]} nodes
 */

/** Ставит статус current первому невыполненному открытому узлу. */
function markCurrent(nodes) {
  const first = nodes.find(n => n.status === 'available');
  if (first) first.status = 'current';
  return nodes;
}

function branch(id, title, nodes, summary) {
  const done = nodes.filter(n => n.status === 'done').length;
  return { id, title, progress: nodes.length ? done / nodes.length : 0, summary, nodes };
}

function levelNodes(prefix, label, level, max, progress, stepId, from = 1) {
  const nodes = [];
  for (let i = from; i <= max; i++) {
    const n = { id: `${prefix}:${i}`, title: `${label} ${i}`, status: i <= level ? 'done' : i === level + 1 ? 'current' : 'available' };
    if (i === level + 1) { n.progress = clamp(progress || 0, 0, 1); n.stepId = stepId; }
    nodes.push(n);
  }
  return nodes;
}

/** @returns {{ branches: Branch[], overall: { done: number, total: number, progress: number } }} */
export function buildMap(ctx) {
  const m = ctx.m;
  const B = [];

  // ===== Данжи =====
  const d = m.dungeons;
  if (d) {
    const cata = d.catacombs.level;
    const f7 = Number(d.floors?.['7'] || 0);
    const nodes = [{ id: 'dungeon:f7', title: 'Пройти F7', status: f7 > 0 ? 'done' : 'available', detail: `пройдено ${f7}` }];
    for (const [f, req] of Object.entries(MASTER_REQ)) {
      const done = Number(d.masterFloors?.[f] || 0) > 0;
      nodes.push({
        id: `dungeon:m${f}`, title: `Пройти M${f}`,
        status: done ? 'done' : cata >= req && f7 > 0 ? 'available' : 'locked',
        detail: done ? `пройдено ${d.masterFloors[f]}` : `нужно Catacombs ${req}`,
        stepId: cata >= req ? 'dungeon-master' : 'dungeon-cata',
      });
    }
    for (const lvl of [30, 40, 50]) {
      nodes.push({ id: `dungeon:cata${lvl}`, title: `Catacombs ${lvl}`, status: cata >= lvl ? 'done' : 'available', detail: `сейчас ${cata}`, stepId: 'dungeon-cata' });
    }
    B.push(branch('dungeons', 'Данжи', markCurrent(nodes), `Catacombs ${cata}, класс ${d.classes?.[d.selectedClass]?.name || '—'}`));
  }

  // ===== Слееры =====
  const sl = m.slayers || {};
  const slNodes = Object.entries(sl).map(([k, s]) => ({
    id: `slayer:${k}`, title: `${s.name} (${s.ru})`,
    status: s.level >= s.maxLevel ? 'done' : s.level === 0 ? 'available' : 'current',
    progress: s.level >= s.maxLevel ? 1 : (s.level + (s.progress || 0)) / s.maxLevel,
    detail: `уровень ${s.level}/${s.maxLevel}`, stepId: `slayer-${k}`,
  }));
  if (slNodes.length) B.push(branch('slayers', 'Слееры', slNodes, slNodes.map(n => n.detail.replace('уровень ', '')).join(' · ')));

  // ===== Kuudra =====
  const c = m.crimson;
  if (c) {
    const rep = Math.max(c.barbarianRep || 0, c.mageRep || 0);
    const highest = Math.max(-1, ...KUUDRA_TIERS.map((t, i) => ((c.kuudra?.[t.key] || 0) > 0 ? i : -1)));
    const nodes = KUUDRA_TIERS.map((t, i) => ({
      id: `kuudra:${t.key}`, title: `Kuudra ${t.name}`,
      status: i <= highest ? 'done' : rep >= t.rep && c.faction ? 'available' : 'locked',
      detail: i <= highest ? `пройдено ${c.kuudra?.[t.key] || 0}` : `нужно ${fmtNum(t.rep)} репутации`,
      stepId: rep >= t.rep ? 'kuudra' : 'crimson-rep',
    }));
    B.push(branch('kuudra', 'Crimson Isle и Kuudra', markCurrent(nodes), `репутация ${fmtNum(rep)}`));
  }

  // ===== Magical Power =====
  const mp = m.magicalPower || 0;
  const mpNodes = MP_MILESTONES.map(x => ({ id: `mp:${x}`, title: `${x} MP`, status: mp >= x ? 'done' : 'available', stepId: 'mp-cheap' }));
  markCurrent(mpNodes);
  const cur = mpNodes.find(n => n.status === 'current');
  if (cur) { const i = mpNodes.indexOf(cur); const prev = i ? MP_MILESTONES[i - 1] : 0; cur.progress = clamp((mp - prev) / (MP_MILESTONES[i] - prev), 0, 1); }
  B.push(branch('accessories', 'Аксессуары и Magical Power', mpNodes, `${fmtNum(mp)} MP`));

  // ===== Снаряжение =====
  const gearNodes = [];
  for (const l of LADDERS.ladders) {
    const { best } = ladderState(ctx, l);
    // показываем только ветки, где что-то есть, или ключевые для этапа
    if (best < 0 && !['dungeon-archer-weapon', 'dungeon-armor', 'kuudra-armor', 'blaze-slayer-weapon'].includes(l.id)) continue;
    if (l.id === 'dungeon-archer-weapon' && m.dungeons?.selectedClass && !l.classes.includes(m.dungeons.selectedClass)) continue;
    if (l.id === 'dungeon-mage-weapon' && best < 0) continue;
    const max = l.tiers.length;
    gearNodes.push({
      id: `ladder:${l.id}`, title: l.titleRu,
      status: best >= max - 1 ? 'done' : 'current',
      progress: (best + 1) / max,
      detail: `${best >= 0 ? tierLabel(l, best).name : 'нет'}${best < max - 1 ? ` → ${tierLabel(l, best + 1).name}` : ''}`,
      stepId: `gear-${l.id}`,
    });
  }
  if (gearNodes.length) B.push(branch('gear', 'Снаряжение', gearNodes, `${gearNodes.filter(n => n.status === 'done').length} из ${gearNodes.length} веток на максимуме`));

  // ===== Скиллы =====
  // Фермерство и Приручение упираются в кап 50, который поднимается до 60 (Anita / сдача питомцев)
  const RAISABLE = { farming: 60, taming: 60 };
  const skNodes = Object.entries(m.skills || {}).filter(([k, s]) => !s.apiMissing && k !== 'social' && k !== 'runecrafting').map(([k, s]) => {
    const abs = Math.max(RAISABLE[k] || 0, s.maxLevel);
    const capped = s.level >= s.maxLevel && s.maxLevel < abs;
    return {
      id: `skill:${k}`, title: s.name, status: s.level >= abs ? 'done' : 'current',
      progress: (s.level + (s.level >= s.maxLevel ? 0 : s.progress || 0)) / abs,
      detail: capped ? `${s.level}/${abs} (упёрся в кап ${s.maxLevel})` : `${s.level}/${s.maxLevel}`,
      stepId: capped && k === 'taming' ? 'pets-taming-cap' : `skill-${k}`,
    };
  });
  B.push(branch('skills', 'Скиллы', skNodes, `средний ${(m.skillAverage || 0).toFixed(1)}`));

  // ===== Питомцы =====
  const best = bestPets(ctx);
  const petNodes = [{
    id: 'pets:taming-cap', title: `Кап Taming 60`, status: (m.tamingCap || 50) >= 60 ? 'done' : 'current',
    progress: ((m.tamingCap || 50) - 50) / 10, detail: `сейчас ${m.tamingCap || 50}`, stepId: 'pets-taming-cap',
  }];
  for (const p of KEY_PETS.pets) {
    const have = best.get(p.type);
    petNodes.push({
      id: `pets:${p.type}`, title: `${prettyId(p.type)} (${p.role})`,
      status: have && petTierIndex(have.tier) >= p.tier ? 'done' : 'available',
      detail: have ? `есть: ${PET_TIER_RU[petTierIndex(have.tier)]}` : `нужен ${PET_TIER_RU[p.tier]}`,
      stepId: 'pets-missing',
    });
  }
  B.push(branch('pets', 'Питомцы', petNodes, `${best.size} ${plural(best.size, 'тип', 'типа', 'типов')} питомцев`));

  // ===== Миньоны =====
  const unique = new Set(m.minions || []).size;
  const idx = MINION_SLOTS.findIndex(([n]) => n > unique);
  const window = MINION_SLOTS.slice(Math.max(0, (idx < 0 ? MINION_SLOTS.length : idx) - 2), (idx < 0 ? MINION_SLOTS.length : idx) + 3);
  const minNodes = window.map(([n, slots]) => ({ id: `minions:${slots}`, title: `${slots} ${plural(slots, 'слот', 'слота', 'слотов')}`, status: unique >= n ? 'done' : 'available', detail: `${n} ${plural(n, 'уникальный крафт', 'уникальных крафта', 'уникальных крафтов')}`, stepId: 'minions-slots' }));
  markCurrent(minNodes);
  B.push(branch('minions', 'Миньоны', minNodes, `${unique} ${plural(unique, 'уникальный крафт', 'уникальных крафта', 'уникальных крафтов')}`));

  // ===== Добыча / Лесорубство =====
  if (m.mining) B.push(branch('mining', 'Добыча (HotM)', levelNodes('hotm', 'HotM', m.mining.hotm.level, 10, m.mining.hotm.progress, 'hotm'), `HotM ${m.mining.hotm.level}`));
  if (m.hotfXp != null) {
    const t = ctx.data.hotf;
    let lvl = 0;
    for (let i = 0; i < t.length; i++) if (m.hotfXp >= t[i]) lvl = i + 1;
    const nextNeed = t[lvl];
    const prog = nextNeed ? (m.hotfXp - (t[lvl - 1] || 0)) / (nextNeed - (t[lvl - 1] || 0)) : 1;
    B.push(branch('foraging', 'Лесорубство (HotF)', levelNodes('hotf', 'HotF', lvl, t.length, prog, 'hotf'), `HotF ${lvl}`));
  }

  // ===== Музей =====
  if (m.museum?.status === 'ok') {
    const mu = analyzeMuseum(m, { constants: ctx.opts?.constants, price: ctx.price, name: ctx.name, owned: ctx.owned });
    const ms = mu.milestone;
    const from = Math.max(1, Math.min(ms.max - 4, ms.n - 1));
    const muNodes = [];
    for (let i = from; i < from + 5 && i <= ms.max; i++) {
      muNodes.push({ id: `museum:m${i}`, title: `Веха ${i}`, status: ms.n >= i ? 'done' : 'available', detail: `${i * 100} XP музея`, stepId: mu.canDonate.length ? 'museum-donate-owned' : 'museum-milestone' });
    }
    markCurrent(muNodes);
    const curM = muNodes.find(n => n.status === 'current');
    if (curM) curM.progress = ms.progress;
    for (const c of mu.categories) muNodes.push({ id: `museum:${c.id}`, title: `${c.ru}: ${c.donated}/${c.total}`, status: c.donated >= c.total ? 'done' : 'current', progress: c.total ? c.donated / c.total : 0, detail: `${c.xp}/${c.xpMax} XP`, stepId: 'museum-donate-owned' });
    B.push(branch('museum', 'Музей', muNodes, `${mu.donated}/${mu.total}, веха ${ms.n}/${ms.max}`));
  }

  // ===== Rift и феи =====
  const souls = m.rift?.enigmaSouls ?? 0;
  const riftNodes = [10, 20, 30, 40, 52].map(x => ({ id: `rift:souls${x}`, title: `${x} Enigma Souls`, status: souls >= x ? 'done' : 'available', stepId: 'rift-souls' }));
  riftNodes.push({ id: 'rift:prism', title: 'Rift Prism (+11 MP)', status: m.riftPrism ? 'done' : 'available', stepId: 'mp-rift-prism' });
  const vamp = m.slayers?.vampire;
  if (vamp) riftNodes.push({ id: 'rift:vampire', title: `Vampire Slayer ${vamp.maxLevel}`, status: vamp.level >= vamp.maxLevel ? 'done' : 'available', detail: `сейчас ${vamp.level}`, stepId: 'slayer-vampire' });
  B.push(branch('rift', 'Rift', markCurrent(riftNodes), `${souls}/52 Enigma Souls`));

  const fsMax = ctx.data.fairySoulsMax;
  const fsHave = m.fairySouls?.collected || 0;
  B.push(branch('general', 'Общее', markCurrent([
    { id: 'general:fairy', title: `Все феи (${fsMax})`, status: fsHave >= fsMax ? 'done' : 'available', progress: fsHave / fsMax, detail: `${fsHave}/${fsMax}`, stepId: 'fairy-collect' },
    { id: 'general:cookie', title: 'Booster Cookie активен', status: m.cookie ? 'done' : 'available', stepId: 'cookie' },
  ]), `SkyBlock ${Math.floor(m.sbLevel || 0)} уровень`));

  const all = B.flatMap(b => b.nodes);
  const done = all.filter(n => n.status === 'done').length;
  return { branches: B, overall: { done, total: all.length, progress: all.length ? done / all.length : 0 } };
}
