// Гайды по каждому слееру: тиры, что открывают уровни, снаряжение, дропы, деньги — по профилю игрока.
import { SLAYER_INFO, SLAYER_UNLOCKS, SLAYER_RNG, SLAYER_COST, SLAYER_BOSS_XP, SLAYER_MAX_TIER } from './combat/data.js';
import { fmtCoins, plural, num, priceText, method, methodText, sortNext, nice, priceOfDrop } from './combat/util.js';

export const SLAYER_ORDER = ['zombie', 'spider', 'wolf', 'enderman', 'blaze', 'vampire'];
// Что нужно пройти, чтобы открыть босса (вики, страница Slayer)
const PREREQ = { spider: ['zombie', 2], wolf: ['spider', 2], enderman: ['wolf', 4], blaze: ['enderman', 3], vampire: ['wolf', 2] };
// Минимальный уровень этого слеера для тира (известные требования)
const TIER_LEVEL = { zombie: { 5: 7 } };

const kills = sl => sl?.kills || {};
const maxKilledTier = sl => Math.max(0, ...Object.entries(kills(sl)).filter(([, k]) => k > 0).map(([t]) => Number(t)));

function prereqDone(m, key) {
  const p = PREREQ[key];
  if (!p) return true;
  const [other, tier] = p;
  return maxKilledTier(m.slayers?.[other]) >= tier;
}

export function build(key, m, ctx) {
  const ctxName = id => nice(ctx, id);
  const info = SLAYER_INFO[key];
  const sl = m.slayers?.[key] || { level: 0, maxLevel: 9, xp: 0, kills: {} };
  const vamp = key === 'vampire';
  const cur = vamp ? 'Motes' : 'монет';
  const costs = SLAYER_COST[key] || SLAYER_COST.default;
  const bossXp = SLAYER_BOSS_XP[key] || SLAYER_BOSS_XP.default;
  const maxTier = SLAYER_MAX_TIER[key];
  const lvl = sl.level || 0;
  const maxLvl = sl.maxLevel || 9;
  const top = maxKilledTier(sl);
  const tierAllowed = t => (TIER_LEVEL[key]?.[t] || 0) <= lvl && t <= Math.min(maxTier, top + 1);
  // Тир для фарма: самый высокий пройденный; если следующий уже разрешён и уровень позволяет — предлагаем попробовать
  const farm = Math.max(1, top);
  const tryNext = top > 0 && top < maxTier && tierAllowed(top + 1) ? top + 1 : null;
  const left = sl.xpForNext ? Math.max(0, sl.xpForNext - (sl.xp || 0)) : 0;
  const bosses = left ? Math.ceil(left / bossXp[farm - 1]) : 0;
  const questCost = bosses * costs[farm - 1];
  const unlocked = prereqDone(m, key);
  const nextUnlocks = SLAYER_UNLOCKS[key]?.[lvl + 1] || [];
  const next = [];

  if (!unlocked && lvl === 0) {
    const [o, t] = PREREQ[key];
    next.push({ priority: 85, title: `Сначала открой босса: пройди ${SLAYER_INFO[o].title} T${t}`, why: info.unlock });
  } else if (lvl === 0 && top === 0) {
    next.push({ priority: 88, title: `Начни ${info.title}: квест T1 у ${vamp ? 'NPC в Stillgore Château' : 'Maddox the Slayer (Hub или Maddox Batphone)'}`,
      why: `Квест стоит ${num(costs[0])} ${cur}, первый уровень — ${num(left)} опыта (${Math.ceil(left / bossXp[0])} ${plural(Math.ceil(left / bossXp[0]), 'босс', 'босса', 'боссов')} T1). Где: ${info.where}.${nextUnlocks.length ? ` Уровень 1 откроет: ${nextUnlocks.map(ctxName).join(', ')}.` : ''}` });
  }
  if (left > 0 && (unlocked || lvl > 0) && !(lvl === 0 && top === 0)) {
    next.push({ priority: 75, title: `${info.ru} ${lvl} → ${lvl + 1}: ~${num(bosses)} ${plural(bosses, 'босс', 'босса', 'боссов')} T${farm}`,
      why: `Осталось ${num(left)} опыта слеера (T${farm} даёт ${bossXp[farm - 1]}).${nextUnlocks.length ? ` Откроет: ${nextUnlocks.map(ctxName).join(', ')}.` : ''} Квесты: ~${vamp ? num(questCost) + ' Motes' : fmtCoins(questCost)}` });
  }
  if (tryNext) {
    const mult = bossXp[tryNext - 1] / bossXp[farm - 1];
    const mech = info.tiers[tryNext - 1]?.mech;
    next.push({ priority: 70, title: `Пробуй T${tryNext}: в ${Number.isInteger(mult) ? mult : mult.toFixed(1).replace('.', ',')} раза больше опыта за босса`,
      why: `Ты проходишь T${top} (${num(kills(sl)[top] || 0)} ${plural(kills(sl)[top] || 0, 'победа', 'победы', 'побед')}).${(sl.attempts?.[tryNext] || 0) > 0 ? ` На T${tryNext} уже ${sl.attempts[tryNext]} ${plural(sl.attempts[tryNext], 'попытка', 'попытки', 'попыток')} без победы: сначала подтяни урон и защиту.` : ''}${mech && !/^(Сильнее|Высший|Первый)/.test(mech) ? ` На T${tryNext}: ${mech}.` : ''}` });
  }
  for (const [L, ids] of Object.entries(SLAYER_UNLOCKS[key] || {})) {
    if (Number(L) > lvl) continue;
    const want = ids.filter(id => !ctx.has(id) && ctx.price(id) > 0 && /SWORD|KATANA|DAGGER|BOW|HELMET|CHESTPLATE|SCYTHE|AXE|TERMINATOR|STING|FOIL|SHORTBOW/.test(id));
    if (want.length && Number(L) >= lvl - 2) {
      next.push({ priority: 40 + Number(L), title: `Уже открыто ${L} уровнем: ${want.slice(0, 2).map(ctxName).join(', ')}`, why: `Цена на рынке: ${want.slice(0, 2).map(id => `${ctxName(id)} ${priceText(ctx, id)}`).join(', ')}.` });
    }
  }
  if (key === 'blaze' && lvl < 2) {
    next.push({ priority: 72, title: 'На 2 уровне скрафти Firedust или Twilight Dagger', why: 'С T2 у босса щит Hellion Shield: без кинжала с нужным аттюнментом урон режется на 99%. Для крафта нужен Molten Powder.' });
  }
  if (!vamp && left > 0) next.push({ priority: 25, title: 'Копи квесты под мэра Aatrox', why: 'Его перк Slayer XP Buff даёт +25% опыта слееров.' });

  // Таблица тиров
  const tierRows = info.tiers.map((t, i) => {
    const T = i + 1;
    const k = kills(sl)[T] || 0;
    return [`T${T}`, t.hp, t.mech, vamp ? `${num(costs[i])} Motes` : fmtCoins(costs[i]), String(bossXp[i]), k ? { text: num(k), tone: 'good' } : { text: '0', tone: 'muted' }];
  });

  // Уровни и что они открывают
  const xpTable = ctx.adv?.data?.slayerXp?.[key] || [];
  const levelRows = [];
  for (let L = 1; L <= maxLvl; L++) {
    const ids = SLAYER_UNLOCKS[key]?.[L] || [];
    const got = L <= lvl;
    levelRows.push([
      got ? { text: `${L} ✓`, tone: 'good' } : String(L),
      xpTable[L - 1] != null ? num(xpTable[L - 1]) : '—',
      ids.length ? ids.map(id => `${ctxName(id)}${ctx.has(id) ? ' (есть)' : ''}`).join(', ') : 'постоянные статы',
    ]);
  }

  const drops = (SLAYER_RNG[key] || []).map(id => ({ id, p: priceOfDrop(ctx, id) })).sort((a, b) => b.p - a.p);
  const dropRows = drops.map(d => [{ text: nice(ctx, d.id), item: d.id }, d.p ? fmtCoins(d.p) : '—']);

  const mt = method(ctx, `slayer-${key}`);
  const status = lvl >= maxLvl ? 'done' : lvl === 0 && top === 0 ? (unlocked ? 'start' : 'locked') : 'progress';
  return {
    summary: `${info.title}: уровень ${lvl} из ${maxLvl}${top ? `, лучший тир T${top}` : ''}${left ? `, до следующего ${num(left)} опыта` : ''}.`,
    status,
    level: { label: `${info.ru}-слеер`, value: lvl, max: maxLvl },
    next: sortNext(next),
    sections: [
      { kind: 'text', title: 'Где и как', text: [`Где: ${info.where}.`, `Открытие: ${info.unlock}.`, vamp ? 'Квесты оплачиваются Motes (валюта Рифта).' : 'Квест берётся у Maddox the Slayer в Hub или по Maddox Batphone (открывается Wolf Slayer 3).'] },
      { kind: 'table', title: 'Тиры босса', note: 'HP и механики — по вики; опыт и цена квеста — по данным NEU.', columns: ['Тир', 'HP', 'Механика', 'Квест', 'Опыт', 'Твои убийства'], rows: tierRows, current: farm - 1 },
      { kind: 'steps', title: 'Снаряжение', items: info.gear.map(g => ({ title: g })) },
      { kind: 'table', title: 'Что открывают уровни', note: 'Опыт — сколько всего нужно набрать для уровня.', columns: ['Уровень', 'Опыт', 'Открывает'], rows: levelRows, current: Math.min(lvl, maxLvl - 1) },
      { kind: 'table', title: 'Редкие дропы', note: 'Дропы RNG-метра, отсортированы по текущей цене. Чем выше тир, тем выше шанс.', columns: ['Предмет', 'Цена'], rows: dropRows },
      { kind: 'text', title: 'Деньги', text: [info.money, methodText(mt)].filter(Boolean) },
    ],
  };
}

export default SLAYER_ORDER.map(key => ({
  id: `slayer-${key}`, title: `${SLAYER_INFO[key].title} (${SLAYER_INFO[key].ru})`, icon: SLAYER_INFO[key].icon, group: 'combat',
  build: (m, ctx) => build(key, m, ctx),
}));
