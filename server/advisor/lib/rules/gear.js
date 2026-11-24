// Снаряжение: лестницы брони/оружия/инструментов под этап и доводка надетого (рекомб, книги, звёзды).
import LADDERS from '../../data/ladders.json' with { type: 'json' };
import { fmtCoins, setPieces, plural } from '../util.js';
import { planItemUpgrades } from '../../../analysis/item-upgrades.js';
import { ownKuudraSet, kuudraUpgradePlan, kuudraSetName } from './kuudra-upgrade.js';
import { witherFamily, witherOwned, dungeonLoadout } from '../loadouts.js';

const KUUDRA_REP = [0, 1000, 3000, 7000, 12000];
const SLOTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
// Сеты для сбора ресурсов: их не качают книгами Hot Potato (дают только здоровье и защиту)
const GATHERING_ARMOR = /^(FERMENTO|HELIANTHUS|SQUASH|CROPIE|MELON|FARM_SUIT|FARM_ARMOR|RANCHERS|PUMPKIN|MINERAL|GLACITE|DIVAN|SORROW|LAPIS_ARMOR|MINER_OUTFIT|ARMOR_OF_YOG|HARDENED_DIAMOND|SPONGE|ANGLER|SHARK_SCALE|DIVER|THUNDER|MAGMA_LORD|BIOHAZARD|SALMON|LUMBERJACK|FIG|ARMOR_OF_THE_RESISTANCE)/;
const MASTER_STARS = ['FIRST_MASTER_STAR', 'SECOND_MASTER_STAR', 'THIRD_MASTER_STAR', 'FOURTH_MASTER_STAR', 'FIFTH_MASTER_STAR'];

/** Актуальна ли лестница для этого профиля. */
function relevant(ctx, l) {
  const m = ctx.m;
  const cls = m.dungeons?.selectedClass;
  const cata = m.dungeons?.catacombs?.level || 0;
  const sk = k => m.skills?.[k]?.level || 0;
  switch (l.id) {
    case 'dungeon-archer-weapon':
    case 'dungeon-mage-weapon':
      return cata >= 15 && (!cls || l.classes.includes(cls));
    case 'dungeon-armor': return cata >= 15;
    case 'ender-slayer-weapon':
    case 'ender-slayer-armor': return (m.slayers?.enderman?.level || 0) >= 1;
    case 'zombie-slayer-weapon': return (m.slayers?.zombie?.level || 0) >= 3;
    case 'blaze-slayer-weapon': return !!m.crimson?.faction;
    case 'kuudra-armor': return !!m.crimson?.faction;
    case 'mining-drill':
    case 'mining-armor': return sk('mining') >= 30;
    case 'farming-armor': return sk('farming') >= 30;
    case 'fishing-armor':
    case 'fishing-rod': return sk('fishing') >= 20;
    default: return true;
  }
}

function reqMet(ctx, req) {
  if (!req) return { ok: true };
  const m = ctx.m;
  if (req.slayer) {
    const lvl = m.slayers?.[req.slayer]?.level || 0;
    const floorOk = req.orFloor != null && Number(m.dungeons?.floors?.[String(req.orFloor)] || 0) > 0;
    if (lvl >= req.level || floorOk) return { ok: true };
    return { ok: false, text: `нужен ${m.slayers?.[req.slayer]?.name || req.slayer} ${req.level} (у тебя ${lvl})` };
  }
  // Данжевая броня надевается только после прохождения этажа, с которого она падает (Shadow Assassin — F5, Wither — F7)
  if (req.floor != null) {
    const done = Number(m.dungeons?.floors?.[String(req.floor)] || 0) > 0;
    const best = Object.entries(m.dungeons?.floors || {}).filter(([, n]) => Number(n) > 0).map(([f]) => Number(f)).filter(Number.isFinite);
    return done ? { ok: true } : { ok: false, text: `пройди F${req.floor} (${best.length ? `у тебя пройден F${Math.max(...best)}` : 'этажи ещё не пройдены'})` };
  }
  if (req.hotm) {
    const lvl = m.mining?.hotm?.level || 0;
    return lvl >= req.hotm ? { ok: true } : { ok: false, text: `нужен HotM ${req.hotm} (у тебя ${lvl})` };
  }
  if (req.skill) {
    const lvl = m.skills?.[req.skill]?.level || 0;
    return lvl >= req.level ? { ok: true } : { ok: false, text: `нужен ${m.skills?.[req.skill]?.name || req.skill} ${req.level} (у тебя ${lvl})` };
  }
  return { ok: true };
}

const KUUDRA_RU = { '': '', HOT_: 'Hot ', BURNING_: 'Burning ', FIERY_: 'Fiery ', INFERNAL_: 'Infernal ' };
/** Тир с понятным именем (для брони Kuudra имя собирается из семейств). */
export function tierLabel(l, i) {
  const t = l.tiers[i];
  if (l.kind !== 'kuudra-armor') return t;
  // Пять семейств в каждом названии читались как каша — семейство пишем один раз, в скобках
  return { ...t, name: `${t.prefix ? KUUDRA_RU[t.prefix].trim() : 'Базовый тир'} (любое: Crimson, Aurora, Terror, Fervor, Hollow)` };
}

/** Индекс лучшего полученного тира (−1 если ничего) и цена тира. */
export function ladderState(ctx, l) {
  const tierOwned = t => {
    if (l.kind === 'kuudra-armor') return l.families.some(f => setPieces(ctx, `${t.prefix}${f}`) >= 3);
    // Броня Wither смешивается: Necron + Maxor + Storm… — это один сет с общим бонусом Witherborn
    if (t.set && witherFamily(`${t.set}_HELMET`)) return witherOwned(ctx.owned).slotsCovered >= 3 || (dungeonLoadout(ctx.m)?.wither || 0) >= 3;
    if (t.set) return [t.set, ...(t.altSets || [])].some(s => setPieces(ctx, s) >= 3);
    return (t.ids || []).some(id => ctx.owned.has(id));
  };
  const tierPrice = t => {
    if (l.kind === 'kuudra-armor') {
      const per = l.families.map(f => SLOTS.reduce((s, sl) => s + ctx.price(`${t.prefix}${f}_${sl}`), 0)).filter(Boolean);
      return per.length ? Math.min(...per) : 0;
    }
    if (t.set) {
      const per = [t.set, ...(t.altSets || [])].map(s => SLOTS.reduce((sum, sl) => sum + ctx.price(`${s}_${sl}`), 0)).filter(Boolean);
      return per.length ? Math.min(...per) : 0;
    }
    const ps = (t.ids || []).map(id => ctx.price(id)).filter(Boolean);
    return ps.length ? Math.min(...ps) : 0;
  };
  let best = -1;
  l.tiers.forEach((t, i) => { if (tierOwned(t)) best = i; });
  return { best, tierPrice, tierOwned };
}

export function ladderRules(ctx, add) {
  for (const l of LADDERS.ladders) {
    if (!relevant(ctx, l)) continue;
    const { best, tierPrice } = ladderState(ctx, l);
    if (best >= l.tiers.length - 1) continue;
    // Цель — самый высокий тир, требования к которому уже выполнены (нет смысла советить Voidwalker при Enderman 7)
    let targetIdx = best + 1;
    for (let i = l.tiers.length - 1; i > best; i--) if (reqMet(ctx, l.tiers[i].req).ok) { targetIdx = i; break; }
    if (l.kind === 'kuudra-armor') {
      // Броня Kuudra — под тот тир Kuudra, который открыт репутацией
      const rep = Math.max(ctx.m.crimson?.barbarianRep || 0, ctx.m.crimson?.mageRep || 0);
      const open = KUUDRA_REP.filter(r => rep >= r).length - 1;
      targetIdx = Math.max(best + 1, Math.min(open, l.tiers.length - 1));
    }
    // Своя броня Kuudra: не «купи», а как улучшить именно её (престиж у кузнеца), с ценой и сравнением с покупкой
    const own = l.kind === 'kuudra-armor' ? ownKuudraSet(ctx, l.families) : null;
    if (own && own.tier === best) {
      const plan = kuudraUpgradePlan(ctx, own, targetIdx);
      const from = kuudraSetName(own.fam, own.tier), to = kuudraSetName(own.fam, targetIdx);
      const cost = plan.cheaper === 'buy' ? plan.buyNet : plan.upgradeCost || plan.buyNet;
      add({
        id: `gear-${l.id}`, cat: l.cat, priority: 62 + 8, effort: 'монеты',
        title: plan.cheaper === 'buy' ? `Броня Kuudra: ${from} → ${to} (выгоднее купить готовую)` : `Улучши свою броню Kuudra: ${from} → ${to}`,
        why: `${tierLabel(l, targetIdx).note[0].toUpperCase()}${tierLabel(l, targetIdx).note.slice(1)}. Свой сет не надо менять: каждую часть можно поднять на следующий тир у кузнеца.${cost ? ` Выйдет ~${fmtCoins(cost)}.` : ''}`,
        how: plan.lines,
        items: [...['ESSENCE_CRIMSON', 'KUUDRA_TEETH'], ...(plan.totals.pearls ? ['HEAVY_PEARL'] : []), ...plan.pieces.map(p => p.id || p.buyId)],
        cost: cost || undefined,
        payoff: `${to}: больше статов и сильнее бонус сета`,
        link: 'gear',
        mapNode: `ladder:${l.id}:${targetIdx}`,
      });
      continue;
    }
    const next = tierLabel(l, targetIdx);
    const req = reqMet(ctx, next.req);
    const cost = tierPrice(next);
    const have = best >= 0 ? tierLabel(l, best).name : null;
    // Самые важные ветки для текущего этапа OwnerCat-подобного профиля — данжи и Kuudra
    const base = ({ 'Dungeons': 70, 'Crimson Isle и Kuudra': 62, 'Slayers': 46, 'Mining': 36, 'Garden': 34, 'Fishing': 30 }[l.cat] ?? 40) - (best < 0 && l.kind !== 'kuudra-armor' && l.cat !== 'Dungeons' ? 6 : 0);
    const items = next.ids || (next.set ? SLOTS.map(s => `${next.set}_${s}`) : l.families ? SLOTS.map(s => `${next.prefix}${l.families[0]}_${s}`) : []);
    add({
      id: `gear-${l.id}`, cat: l.cat, priority: base + (req.ok ? 8 : -12), effort: cost ? 'монеты' : 'часы',
      title: best >= 0 ? `${l.titleRu}: ${have} → ${next.name}` : `${l.titleRu}: начни с ${next.name}`,
      why: `${next.note[0].toUpperCase()}${next.note.slice(1)}.${req.ok ? '' : ` Сначала ${req.text}.`}${cost ? ` Цена сейчас ~${fmtCoins(cost)}.` : ''}`,
      how: [
        cost ? `Купить: ${next.name} — ~${fmtCoins(cost)} (Bazaar или аукцион)` : `Получить: ${next.name}`,
        ...(l.kind === 'kuudra-armor' ? ['Следующий тир можно получить и престижем: часть с 10 звёздами улучшается у кузнеца (Blacksmith) за эссенцию Crimson, Kuudra Teeth и монеты — часто дешевле, чем покупать готовый сет'] : []),
        ...(best >= 0 ? [`Старое снаряжение (${tierLabel(l, best).name}) можно продать, когда перейдёшь на новое`] : []),
      ],
      items,
      cost: cost || undefined,
      payoff: next.note,
      link: 'gear',
      mapNode: `ladder:${l.id}:${targetIdx}`,
    });
  }
}

const isDungeonItem = it => /DUNGEON/.test((it.lore?.[it.lore.length - 1] || '').replace(/§./g, ''));

/** Доводка основного снаряжения: надетая броня + лучшее оружие из лестниц. */
export function upgradeRules(ctx, add) {
  const m = ctx.m;
  const main = [];
  // Надетая броня может быть фермерской/шахтёрской — книги Hot Potato ей бесполезны.
  // Для доводки берём боевую броню: надетую, если она боевая, иначе лучший сет для данжей из хранилищ.
  for (const it of m.inv?.armor || []) if (it?.id && !GATHERING_ARMOR.test(it.id)) main.push(it);
  // Если надет не сет Wither, а он есть в гардеробе — качать надо его (смешанный сет тоже считается)
  const dlo = dungeonLoadout(m);
  if (dlo && !main.some(it => witherFamily(it.id)) && dlo.wither >= 3) {
    main.length = 0;
    for (const p of dlo.pieces) if (!GATHERING_ARMOR.test(p.item.id)) main.push(p.item);
  }
  if (!main.length) {
    const dl = LADDERS.ladders.find(x => x.kind === 'armor' && x.cat === 'Dungeons');
    const st = dl ? ladderState(ctx, dl) : { best: -1 };
    if (st.best >= 0) {
      const t = dl.tiers[st.best];
      const set = [t.set, ...(t.altSets || [])].find(x => setPieces(ctx, x) >= 3);
      for (const slot of SLOTS) { const it = ctx.owned.get(`${set}_${slot}`)?.[0]; if (it) main.push(it); }
    }
  }
  // лучшее оружие: верхний полученный тир лестниц оружия, актуальных для профиля
  for (const l of LADDERS.ladders.filter(x => x.kind === 'weapon' && relevant(ctx, x) && x.cat === 'Dungeons')) {
    const { best } = ladderState(ctx, l);
    if (best < 0) continue;
    const id = l.tiers[best].ids.find(i => ctx.owned.has(i));
    const it = ctx.owned.get(id)?.[0];
    if (it) main.push(it);
  }
  if (!main.length) return;

  const lines = [];
  let cost = 0;
  const items = new Set();
  const masterDone = Object.values(m.dungeons?.masterFloors || {}).some(v => v > 0);
  // Есть константы NEU — точный чек-лист из того же движка, что и в карточке предмета (с ценой каждого шага)
  const constants = ctx.opts?.constants;
  const engine = constants?.enchants && constants?.essencecosts;
  for (const it of main) {
    if (engine) {
      let plan = null;
      try { plan = planItemUpgrades(it, { constants, getItem: () => null, priceOf: ctx.price, petPriceOf: () => 0, member: ctx.m }); } catch { plan = null; }
      if (plan) {
        const top = plan.todo.filter(st => !st.locked && st.cost != null && st.cost > 0).slice(0, 4);
        if (!top.length) continue;
        for (const st of top) { cost += st.cost; for (const p of st.parts || []) if (p.id && !p.id.startsWith('ESSENCE_')) items.add(p.id); }
        lines.push(`${it.name || ctx.name(it.id)} (прокачано на ${plan.score}%): ${top.map(st => `${st.title} ~${fmtCoins(st.cost)}`).join('; ')}${plan.todo.length > top.length ? ` · ещё ${plan.todo.length - top.length} ${plural(plan.todo.length - top.length, 'шаг', 'шага', 'шагов')} в карточке предмета` : ''}`);
        continue;
      }
    }
    const fixes = [];
    if (!it.recomb && ['LEGENDARY', 'MYTHIC', 'EPIC'].includes(it.rarity)) {
      fixes.push('Recombobulator 3000'); cost += ctx.price('RECOMBOBULATOR_3000'); items.add('RECOMBOBULATOR_3000');
    }
    const hpb = it.hpb || 0;
    if (hpb < 10) { fixes.push(`Hot Potato Book ×${10 - hpb}`); cost += ctx.price('HOT_POTATO_BOOK') * (10 - hpb); items.add('HOT_POTATO_BOOK'); }
    if (hpb < 15) { const n = Math.min(5, 15 - Math.max(10, hpb)); fixes.push(`Fuming Potato Book ×${n}`); cost += ctx.price('FUMING_POTATO_BOOK') * n; items.add('FUMING_POTATO_BOOK'); }
    if (isDungeonItem(it)) {
      const stars = it.stars || 0;
      if (stars < 5) fixes.push(`звёзды ${stars}/5 за эссенцию (Wither/Undead/Dragon — смотри в меню улучшения)`);
      else if (stars < 10 && masterDone) {
        const need = MASTER_STARS.slice(stars - 5);
        fixes.push(`Master Stars ${stars - 5}/5`);
        for (const s of need) { cost += ctx.price(s); items.add(s); }
      }
    }
    const isWeapon = !/(HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/.test(it.id);
    if (isWeapon && !Object.keys(it.enchants || {}).some(e => e.startsWith('ultimate_'))) fixes.push('ультимативное зачарование');
    if (fixes.length) lines.push(`${it.name || it.id}: ${fixes.join(', ')}`);
  }
  if (!lines.length) return;
  add({
    id: 'gear-upgrades', cat: 'Снаряжение', priority: 64, effort: 'монеты',
    title: `Доведи основное снаряжение до максимума (${lines.length} ${lines.length === 1 ? 'предмет' : lines.length < 5 ? 'предмета' : 'предметов'})`,
    why: `Улучшения уже имеющихся вещей почти всегда дешевле, чем следующий сет, а прибавка к урону и защите заметная.${cost ? ` Всего ~${fmtCoins(cost)}.` : ''}`,
    how: lines,
    items: [...items],
    cost: cost || undefined,
    payoff: 'Больше урона и защиты без смены сета',
    link: 'gear',
  });
}

export function equipmentRules(ctx, add) {
  const eq = ctx.m.inv?.equipment || [];
  const empty = 4 - eq.filter(i => i?.id).length;
  if (empty > 0 && !ctx.m.inv?.apiDisabled) {
    add({
      id: 'gear-equipment', cat: 'Снаряжение', priority: 70, effort: 'минуты',
      title: `Заполни пустые слоты экипировки: ${empty} из 4`,
      why: 'Ожерелье, плащ, пояс и перчатки дают статы так же, как броня. Пустой слот — потерянные характеристики.',
      how: [
        'Ранний вариант: экипировка из Rift и Dojo (Black Belt), Crimson Isle — Molten-экипировка из Kuudra',
        'Для данжей стандарт — Molten-сет или его улучшения с атрибутами',
      ],
      items: ['MOLTEN_NECKLACE', 'MOLTEN_CLOAK', 'MOLTEN_BELT', 'MOLTEN_BRACELET'],
      link: 'gear',
    });
  }
}
