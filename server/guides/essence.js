// Гайд по эссенциям: что это за валюта, где брать каждую, на что тратить (звёзды и перки Essence Shop)
// и что из этого можно купить прямо сейчас. Расчёт — server/stash/index.js (analyzeEssence).
import { analyzeEssence } from '../stash/index.js';
import { fmt, short, plural, constants, cell, topNext } from './gathering-util.js';

export function build(m, ctx) {
  const e = analyzeEssence(m, { constants: constants(ctx), price: ctx.price, name: ctx.name, owned: ctx.owned });
  const sections = [];
  sections.push({
    kind: 'text', title: 'Что такое эссенции',
    text: [
      'Эссенция — валюта для улучшений. Она не занимает места в инвентаре: лежит на счёте профиля, у каждого вида — свой (максимум 2 млрд каждого).',
      'Главное применение — звёзды на предметах (✪). Каждая звезда даёт +2% к статам предмета, а данжевым предметам внутри Catacombs — +10% за звезду. Обычно звёзд 5; броня Kuudra и оружие Crimson Isle за Crimson Essence получают их до 10, а Infernal — до 15.',
      'Второе применение — магазины эссенций (Essence Shop): перки, которые покупаются один раз и действуют навсегда. Самые полезные — Forbidden-перки за Wither Essence: статы везде, не только в данже.',
      'На Bazaar эссенции покупаются только с Catacombs 20. Исключение — Forest Essence: её можно купить сразу.',
      'Звёзды ставят в меню Essence Crafting (NPC Malik). Звёзды остаются на предмете: продаёшь предмет — эссенция уходит вместе с ним (и предмет со звёздами стоит дороже).',
    ],
  });

  sections.push({
    kind: 'table', title: 'Твои эссенции',
    note: 'Цена — мгновенная продажа на Bazaar. «Перки» — сколько перков магазина прокачано до конца.',
    columns: ['Эссенция', 'Есть', 'Стоит', 'Перки', 'Осталось на перки', 'Можно купить сейчас'],
    rows: e.types.map(t => [
      cell(`${t.ru} Essence`, { item: t.id }),
      cell(fmt(t.amount), { tone: t.amount ? undefined : 'muted' }),
      t.value ? short(t.value) : '—',
      t.perks.length ? cell(`${t.perkDone} / ${t.perks.length}`, { tone: t.perkDone === t.perks.length ? 'good' : undefined }) : '—',
      t.perkLeft ? fmt(t.perkLeft) : cell('всё', { tone: 'good' }),
      t.buyable ? cell(`${t.buyable} ${plural(t.buyable, 'уровень', 'уровня', 'уровней')}`, { tone: 'good' }) : '—',
    ]),
  });

  for (const t of e.types) {
    sections.push({
      kind: 'text', title: `${t.ru} Essence${t.area ? ` · ${t.area}` : ''}`,
      text: [
        t.info.what,
        `Где взять: ${t.info.get.join(' ')}`,
        `На что тратить: ${t.info.use.join(' ')}`,
        t.info.shop ? `Магазин перков: ${t.info.shop}` : 'Магазин перков: открой меню перков в игре — вики его пока не описывает.',
        t.itemsUsing ? `Звёзды за эту эссенцию ставятся на ${t.itemsUsing} ${plural(t.itemsUsing, 'предмет', 'предмета', 'предметов')} (по NEU).` : 'Звёзд за эту эссенцию нет.',
      ].filter(Boolean),
    });
    if (t.perks.length) {
      sections.push({
        kind: 'table', title: `Перки за ${t.ru} Essence`,
        note: 'Цены уровней — по NEU. Описание дано, где эффект ясен; точные проценты — в меню перка в игре.',
        columns: ['Перк', 'Уровень', 'Следующий', 'До конца', 'Что даёт'],
        rows: t.perks.map(p => [
          p.ruName ? `${p.ruName} (${p.name})` : p.name,
          cell(`${p.level} / ${p.max}`, { tone: p.level >= p.max ? 'good' : p.level ? undefined : 'muted' }),
          p.next == null ? cell('куплен', { tone: 'good' }) : cell(fmt(p.next), { tone: p.affordable ? 'good' : undefined }),
          p.left ? fmt(p.left) : '—',
          cell(p.ru || '—', { tone: p.ru ? undefined : 'muted' }),
        ]),
      });
    }
  }

  const stars = e.types.flatMap(t => t.stars.map(s => ({ ...s, t })));
  if (stars.length) {
    sections.push({
      kind: 'table', title: 'Звёзды на твоих предметах',
      note: 'Предметы из инвентаря, гардероба, сундуков и рюкзаков, у которых звёзд меньше максимума.',
      columns: ['Предмет', 'Звёзды', 'Следующая', 'До максимума', 'Где лежит'],
      rows: stars.slice(0, 25).map(s => [
        cell(s.name, { item: s.id }),
        `${s.stars} / ${s.max}`,
        cell(`${fmt(s.next)} ${s.t.ru}`, { tone: s.affordable ? 'good' : 'warn' }),
        `${fmt(s.need)} ${s.t.ru}`,
        cell(s.where || '—', { tone: 'muted' }),
      ]),
    });
  }

  const next = [];
  for (const t of e.types) {
    const can = t.perks.filter(p => p.affordable).sort((a, b) => a.next - b.next);
    if (can.length) {
      next.push({
        title: `${t.ru} Essence: хватает на ${can.length} ${plural(can.length, 'перк', 'перка', 'перков')} в магазине`,
        priority: t.type === 'WITHER' ? 70 : 45,
        why: `${can.slice(0, 3).map(p => `${p.ruName || p.name} ${p.level + 1} за ${fmt(p.next)}`).join(', ')}. Есть ${fmt(t.amount)}.`,
        item: t.id,
      });
    }
    const sa = t.stars.find(s => s.affordable);
    if (sa) next.push({ title: `Поставь звезду на ${sa.name} (${sa.stars} → ${sa.stars + 1})`, priority: 55, why: `Стоит ${fmt(sa.next)} ${t.ru} Essence, у тебя ${fmt(t.amount)}. +2% к статам предмета, в данже больше.`, item: sa.id });
  }
  const forbidden = e.types.find(t => t.type === 'WITHER');
  const fLeft = forbidden?.perks.filter(p => p.key.startsWith('permanent_') && p.level < p.max) || [];
  if (fLeft.length && !next.some(n => n.item === 'ESSENCE_WITHER')) {
    const c = fLeft.reduce((s, p) => s + p.left, 0);
    next.push({ title: `Докачай Forbidden-перки: нужно ${fmt(c)} Wither Essence`, priority: 35, why: `Статы навсегда и везде: ${fLeft.map(p => `${p.ruName || p.name} ${p.level}/${p.max}`).join(', ')}. Wither Essence дают сундуки поздних данжей.`, item: 'ESSENCE_WITHER' });
  }

  const owned = e.types.filter(t => t.amount > 0);
  const allDone = e.types.every(t => t.perkLeft === 0);
  return {
    summary: owned.length
      ? `${owned.length} ${plural(owned.length, 'вид', 'вида', 'видов')} эссенции на ${short(e.total)}, перков прокачано ${e.types.reduce((s, t) => s + t.perkDone, 0)} из ${e.types.reduce((s, t) => s + t.perks.length, 0)}`
      : 'Эссенций пока нет: первые дадут данжи и Crystal Hollows',
    status: allDone ? 'done' : owned.length ? 'progress' : 'start',
    level: { label: 'Перки', value: e.types.reduce((s, t) => s + t.perkDone, 0), max: e.types.reduce((s, t) => s + t.perks.length, 0) },
    next: topNext(next),
    sections,
  };
}

export default { id: 'essence', title: 'Эссенции и перки', icon: 'ESSENCE_WITHER', group: 'other', build };
