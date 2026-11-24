// Гайд по данжам (Catacombs): этажи, классы, Master Mode, снаряжение — по профилю игрока.
import { CLASSES } from '../i18n/ru.js';
import { MASTER_REQ, FLOORS, WITHER_SETS, CLASS_GEAR, DUNGEON_ESSENTIALS, RECIPES } from './combat/data.js';
import { fmtCoins, plural, num, priceText, craftCost, methodText, sortNext, pieces, setPrice, nice } from './combat/util.js';
import { dungeonLoadout, witherOwned, familiesLabel, offClassPieces, bestFamilyFor, WITHER_FAMILIES, SLOTS, SLOT_RU } from '../advisor/lib/loadouts.js';
import { planItemUpgrades } from '../analysis/item-upgrades.js';

const n = v => Number(v || 0);

export function build(m, ctx) {
  const name = id => nice(ctx, id);
  const d = m.dungeons || {};
  const cataL = d.catacombs || { level: 0 };
  const cata = cataL.level || 0;
  const cls = d.selectedClass || null;
  const clsName = cls ? CLASSES[cls] || cls : 'не выбран';
  const clsLvl = cls ? d.classes?.[cls]?.level ?? 0 : 0;
  const floors = d.floors || {};
  const mf = d.masterFloors || {};
  const f7 = n(floors['7']);
  const mDone = [1, 2, 3, 4, 5, 6, 7].filter(f => n(mf[f]) > 0);
  // M1 открывается после F7 и Catacombs 24; каждый следующий M-этаж — после победы на предыдущем и своего уровня Catacombs
  const mIsOpen = f => cata >= MASTER_REQ[f] && (f === 1 ? f7 > 0 : n(mf[f - 1]) > 0);
  const mOpen = [1, 2, 3, 4, 5, 6, 7].filter(mIsOpen);
  const nextM = [1, 2, 3, 4, 5, 6, 7].find(f => !n(mf[f]));
  const nextReq = Object.entries(MASTER_REQ).find(([, r]) => r > cata);
  const xpLeft = Math.max(0, (cataL.xpForNext || 0) - (cataL.xpCurrent || 0));
  const highestF = [7, 6, 5, 4, 3, 2, 1, 0].find(f => n(floors[f]) > 0);
  const next = [];

  // --- Что делать дальше
  if (!f7) {
    next.push({ priority: 90, title: highestF == null ? 'Начни данжи: Entrance и F1 через Party Finder в Dungeon Hub' : `Дойди до F7: сейчас лучший этаж F${highestF}`,
      why: 'Master Mode открывается только после F7 и Catacombs 24.' });
  } else if (nextM && mOpen.includes(nextM)) {
    next.push({ priority: 92, title: mDone.length ? `Переходи на M${nextM}: он тебе уже открыт` : `Начни Master Mode с M1 (открыты: M${mOpen.join(', M')})`,
      why: `F7 пройден ${f7} ${plural(f7, 'раз', 'раза', 'раз')}. M-этажи дают намного больше опыта Catacombs, чем F7, а с M3 падают Master Stars.` });
  }
  if (nextReq && cata < 50) {
    next.push({ priority: 80, title: `Catacombs ${cata} → ${nextReq[1]}: откроет M${nextReq[0]}`,
      why: `До ${cata + 1} уровня осталось ${num(xpLeft)} опыта.${Number(nextReq[0]) > 1 && !n(mf[Number(nextReq[0]) - 1]) ? ` Ещё нужна победа на M${Number(nextReq[0]) - 1}.` : ''} Быстрее всего — ${mOpen.length ? `M${mOpen[mOpen.length - 1]}` : 'F7'} на S+ своим классом.` });
  }
  const cg = CLASS_GEAR[cls] || CLASS_GEAR.archer;
  const bestWeapon = cg.weapons.find(id => ctx.has(id));
  if (cls === 'archer' && !ctx.has('TERMINATOR')) {
    const eman = m.slayers?.enderman?.level || 0;
    const p = ctx.price('TERMINATOR');
    const cc = craftCost(ctx, RECIPES.TERMINATOR);
    next.push(eman >= 7
      ? { priority: 78, title: `Terminator: требование Enderman 7 у тебя уже есть${p ? `, цена ~${fmtCoins(p)}` : ''}`,
        why: `Главное оружие лучника в M-этажах.${cc.total ? ` Крафт из Judgement Core, Null Blade, Braided Griffin Feather и т. д. по текущим ценам ~${fmtCoins(cc.total)}.` : ''} Сейчас у тебя ${bestWeapon ? name(bestWeapon) : 'нет лука из списка'}.` }
      : { priority: 70, title: `Подними Enderman Slayer до 7 для Terminator (сейчас ${eman})`, why: 'Без этого Terminator нельзя использовать.' });
  }
  // Броня Wither: смотрим не на «сколько частей Necron/Maxor по отдельности», а на сет, в котором игрок
  // реально ходит (надетый или слот гардероба). Бонус Witherborn общий для всех семейств Wither.
  const lo = dungeonLoadout(m);
  const wo = witherOwned(ctx.owned);
  const setPlan = lo ? loadoutPlan(lo, ctx) : null;
  const famName = f => WITHER_FAMILIES[f]?.name || f;
  const loName = lo ? `${lo.label}${lo.families.length ? ` (${familiesLabel(lo.families)})` : ''}` : '';
  const off = lo ? offClassPieces(lo, cls) : [];
  if (lo?.witherborn) {
    const top = setPlan.rows.filter(r => r.next).slice(0, 3);
    next.push({ priority: 68,
      title: `Прокачай свой сет Wither — ${loName}${setPlan.cost ? `: ~${fmtCoins(setPlan.cost)}` : ''}`,
      why: `Ты уже в полном сете: бонус Witherborn 4/4 работает при любой смеси частей Necron, Storm, Goldor, Maxor и Wither, так что собирать «недостающие части» не нужно.${top.length ? ` Дальше: ${top.map(r => `${r.short} — ${r.next}`).join('; ')}.` : ' Все части уже доведены.'}` });
    if (off.length && cls) {
      const best = bestFamilyFor(cls);
      next.push({ priority: 40,
        title: `Для класса «${clsName}» лучше ${famName(best)}: замени ${off.map(p => `${SLOT_RU[p.slot]} ${WITHER_FAMILIES[p.family].short}`).join(', ')}`,
        why: `Бонус сета сохранится (он общий для всей брони Wither), а ${WITHER_FAMILIES[best].short} даёт ${WITHER_FAMILIES[best].stats}. ${off.map(p => `${WITHER_FAMILIES[p.family].short} — ${WITHER_FAMILIES[p.family].stats}`).join('; ')}.` });
    }
  } else if (wo.total) {
    const missing = SLOTS.filter(sl => !wo.bySlot[sl]);
    const best = bestFamilyFor(cls);
    const buy = missing.reduce((s, sl) => s + ctx.price(`${best}_${sl}`), 0);
    next.push({ priority: 68,
      title: missing.length
        ? `Добери броню Wither: не хватает ${missing.map(sl => SLOT_RU[sl]).join(', ')}${buy ? ` (~${fmtCoins(buy)} за ${famName(best)})` : ''}`
        : `Собери 4 части Wither в один слот гардероба (сейчас в лучшем слоте ${lo?.wither || 0}/4)`,
      why: missing.length
        ? `Части можно смешивать: бонус Witherborn считается по любым 4 частям Necron/Storm/Goldor/Maxor/Wither. Для класса «${clsName}» лучше всего ${famName(best)} (${WITHER_FAMILIES[best].stats}).`
        : 'Шлем, нагрудник, поножи и ботинки Wither у тебя есть, но лежат в разных местах. Бонус Witherborn включается, только когда все 4 части надеты вместе — смешивать семейства можно.' });
  } else if (WITHER_SETS.some(s => s.for.includes(cls))) {
    const s = WITHER_SETS.find(x => x.for.includes(cls));
    const cost = setPrice(ctx, s.base);
    next.push({ priority: 68, title: `Броня Wither для класса «${clsName}»: ${s.name}`,
      why: `Броня Wither — основа M-этажей.${cost ? ` Полный сет по текущим ценам ~${fmtCoins(cost)}.` : ''} Части падают с F7/M7, и их можно смешивать: бонус Witherborn общий для всех семейств Wither.` });
  }
  const missEss = DUNGEON_ESSENTIALS.filter(e => !ctx.has(e.id) && !(e.alt || []).some(a => ctx.has(a)));
  if (missEss.length) {
    next.push({ priority: 55, title: `Добери данж-предметы: ${missEss.slice(0, 3).map(e => name(e.id)).join(', ')}${missEss.length > 3 ? ` и ещё ${missEss.length - 3}` : ''}`,
      why: 'Они не дают урона, но сильно ускоряют и упрощают заходы.' });
  }
  const weak = Object.entries(d.classes || {}).filter(([k, c]) => k !== cls && c.level < cata - 10);
  if (weak.length) {
    next.push({ priority: 30, title: `Подтяни классы: ${weak.map(([, c]) => `${c.name} ${c.level}`).join(', ')}`,
      why: 'Средний уровень классов даёт SkyBlock XP и награды, а не выбранный класс получает только 25% опыта.' });
  }

  // --- Секции
  const floorRows = FLOORS.map(fl => {
    const done = n(floors[fl.f]);
    let mcell = '—';
    if (fl.f > 0) {
      const md = n(mf[fl.f]);
      mcell = md ? { text: `${md} ${plural(md, 'раз', 'раза', 'раз')}`, tone: 'good' }
        : mIsOpen(fl.f) ? { text: 'открыт, не пройден', tone: 'warn' }
        : cata >= MASTER_REQ[fl.f] ? { text: fl.f === 1 ? 'сначала F7' : `сначала M${fl.f - 1}`, tone: 'muted' }
        : { text: `нужен Catacombs ${MASTER_REQ[fl.f]}`, tone: 'muted' };
    }
    const loot = [...(fl.loot || []), ...(fl.mloot || [])].map(id => name(id)).join(', ');
    return [fl.f ? `F${fl.f}` : 'Entrance', fl.boss, done ? { text: String(done), tone: 'good' } : { text: '0', tone: 'muted' }, mcell, loot || '—'];
  });
  const curRow = nextM && f7 ? nextM : highestF == null ? 0 : Math.min(7, highestF + 1);

  const classRows = Object.entries(d.classes || {}).sort((a, b) => b[1].level - a[1].level)
    .map(([k, c]) => [k === cls ? { text: `${c.name} (выбран)`, tone: 'good' } : c.name, String(c.level), CLASS_GEAR[k]?.note || '']);

  const mPath = [1, 2, 3, 4, 5, 6, 7].map(f => {
    const fl = FLOORS[f];
    const done = n(mf[f]) > 0;
    const open = mIsOpen(f);
    return {
      title: `M${f} — ${fl.boss}${done ? ` · пройден ${n(mf[f])} ${plural(n(mf[f]), 'раз', 'раза', 'раз')}` : open ? ' · открыт' : cata >= MASTER_REQ[f] ? ` · сначала ${f === 1 ? 'F7' : `M${f - 1}`}` : ` · нужен Catacombs ${MASTER_REQ[f]}`}`,
      done, current: f === nextM && open,
      items: fl.mloot,
      text: [
        f === 1 ? 'Механики как на F1, но мобы и босс заметно сильнее. Отличный первый шаг после F7.' : null,
        f === 3 ? 'С M3 начинают падать Master Stars: First Master Star поднимает данж-предмет до 6 звёзд.' : null,
        f === 5 ? 'Livid: найди настоящего среди копий. Здесь Third Master Star и Shadow Fury.' : null,
        f === 6 ? 'Sadan: нужна приличная броня и урон. Fourth Master Star, Giant\'s Sword.' : null,
        f === 7 ? 'Wither Lords и Wither King. Fifth Master Star, Dark Claymore, Necron\'s Handle. Нужна полностью улучшенная броня Wither и топ-оружие.' : null,
      ].filter(Boolean),
    };
  });

  const gearChecks = [
    ...cg.weapons.map(id => ({ text: name(id), item: id, done: ctx.has(id), hint: ctx.has(id) ? 'есть' : priceText(ctx, id) })),
    lo?.witherborn
      ? { text: `Сет Wither: ${loName}`, item: lo.pieces.find(p => p.family)?.item.id, done: true, hint: `Witherborn 4/4${lo.mixed ? ', части смешаны — бонус всё равно работает' : ''}` }
      : { text: `Сет Wither: ${lo?.wither || 0}/4 в одном слоте`, item: `${bestFamilyFor(cls)}_CHESTPLATE`, done: false, hint: wo.total ? `частей Wither всего ${wo.total}; любые 4 вместе дают бонус` : 'падает с F7/M7' },
    ...DUNGEON_ESSENTIALS.map(e => {
      const have = ctx.has(e.id) || (e.alt || []).some(a => ctx.has(a));
      return { text: name(e.id), item: e.id, done: have, hint: e.hint };
    }),
  ];

  const income = (ctx.analysis?.methods || []).filter(x => x.tag === 'Dungeons').map(methodText).filter(Boolean);

  const status = cata >= 50 && n(mf[7]) > 0 ? 'done' : highestF == null ? 'start' : 'progress';
  const summary = `Catacombs ${cata}, ${clsName} ${clsLvl}. F7 пройден ${f7} ${plural(f7, 'раз', 'раза', 'раз')}; Master Mode: ${mDone.length ? `пройдены M${mDone.join(', M')}` : 'ещё не начат'}.`;

  return {
    summary, status,
    level: { label: 'Catacombs', value: cata, max: 50 },
    next: sortNext(next),
    sections: [
      { kind: 'table', title: 'Этажи и Master Mode', note: 'Ценный лут — заметные дропы из сундуков этажа (по RNG-метру NEU).', columns: ['Этаж', 'Босс', 'Пройдено', 'Master Mode', 'Ценный лут'], rows: floorRows, current: curRow },
      { kind: 'steps', title: 'Путь M1 → M7', note: `Каждый Master-этаж открывается победой на предыдущем (M1 — после F7) и уровнем Catacombs: M1 — 24, M2 — 26, M3 — 28, M4 — 30, M5 — 32, M6 — 34, M7 — 36. У тебя ${cata}.`, items: mPath },
      { kind: 'checklist', title: `Снаряжение: ${clsName}`, note: cg.note, items: gearChecks },
      ...(setPlan ? [{ kind: 'table', title: `Твой сет: ${loName}`,
        note: `${lo.witherborn ? 'Бонус Witherborn 4/4 активен' : `Частей Wither в этом слоте: ${lo.wither}/4`}. Что улучшить в каждой части — по тому же движку, что карточка предмета${setPlan.cost ? `; всё вместе ~${fmtCoins(setPlan.cost)}` : ''}.`,
        columns: ['Часть', 'Предмет', 'Звёзды', 'Прокачано', 'Что дальше'],
        rows: setPlan.rows.map(r => [SLOT_RU[r.slot], { text: r.name, item: r.id }, r.stars, r.score == null ? '—' : { text: `${r.score}%`, tone: r.score >= 90 ? 'good' : r.score >= 60 ? 'warn' : 'bad' }, r.nextList || (r.score == null ? '—' : { text: 'доведено', tone: 'good' })]) }] : []),
      { kind: 'table', title: 'Классы', note: 'Опыт получает в полной мере только выбранный класс, остальные — 25%.', columns: ['Класс', 'Уровень', 'Роль'], rows: classRows },
      { kind: 'text', title: 'Как быстрее качать Catacombs', text: [
        'Играй на S+ (300 очков): очки дают секреты, убитые мобы, скорость и отсутствие смертей.',
        lo?.witherborn ? `Твой сет для данжей — ${loName}: бонус Witherborn 4/4 активен. Смешивать части Necron/Storm/Goldor/Maxor можно, бонус у них общий.`
          : wo.total ? `Частей Wither у тебя ${wo.total}; в лучшем слоте ${lo?.wither || 0}/4. Бонус Witherborn включается, когда надеты 4 любые части Wither.`
          : 'Брони Wither пока нет: она падает с F7/M7 и улучшается эссенцией Wither.',
        `Секретов найдено: ${num(d.secrets)}. Секреты дают очки исследования (Exploration) для S+.`,
        'Kismet Feather перекручивает содержимое сундука после захода, а Dungeon Chest Key позволяет открыть ещё один сундук.',
      ] },
      ...(income.length ? [{ kind: 'text', title: 'Заработок в данжах', text: income }] : []),
    ],
  };
}

const STAR = n => (n > 5 ? `${'★'.repeat(5)} +${n - 5} master` : n ? '★'.repeat(n) : '—');

/** Чек-лист улучшений по каждой части сета (движок карточки предмета, если есть константы NEU). */
function loadoutPlan(lo, ctx) {
  const constants = ctx.adv?.opts?.constants;
  const engine = constants?.enchants && constants?.essencecosts;
  let cost = 0;
  const rows = lo.pieces.map(p => {
    const it = p.item;
    const name = ctx.name(it.id);
    const short = `${p.family ? WITHER_FAMILIES[p.family].short : name} ${SLOT_RU[p.slot]}`;
    const row = { slot: p.slot, id: it.id, name, short, stars: STAR(it.stars || 0), score: null, next: null, nextList: null };
    if (!engine) {
      const fixes = [];
      if (!it.recomb) fixes.push('Recombobulator');
      if ((it.hpb || 0) < 15) fixes.push(`книги Potato ${it.hpb || 0}/15`);
      if ((it.stars || 0) < 10) fixes.push(`звёзды ${it.stars || 0}/10`);
      row.next = fixes.join(', ') || null;
      row.nextList = row.next;
      return row;
    }
    let plan = null;
    try { plan = planItemUpgrades(it, { constants, getItem: () => null, priceOf: ctx.price, petPriceOf: () => 0, member: ctx.m }); } catch { plan = null; }
    if (!plan) return row;
    row.score = plan.score;
    const top = plan.todo.filter(st => !st.locked).slice(0, 3);
    for (const st of top) cost += st.cost || 0;
    row.next = top.map(st => st.title).join(', ') || null;
    row.nextList = top.length ? top.map(st => `${st.title}${st.cost ? ` ~${fmtCoins(st.cost)}` : ''}`).join('; ') : null;
    return row;
  });
  return { rows, cost };
}

export default { id: 'dungeons', title: 'Dungeons', icon: 'NECRON_HANDLE', group: 'combat', build };
