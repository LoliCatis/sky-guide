// Данжи, слееры, Crimson Isle и Kuudra.
import LADDERS from '../../data/ladders.json' with { type: 'json' };
import { fmtCoins, fmtNum, plural } from '../util.js';
import { dojoState } from '../../../guides/crimson-data.js';

export const MASTER_REQ = { 1: 24, 2: 26, 3: 28, 4: 30, 5: 32, 6: 34, 7: 36 };
// Репутация фракции, нужная для тиров Kuudra
export const KUUDRA_TIERS = [
  { key: 'basic', name: 'Basic', rep: 0 },
  { key: 'hot', name: 'Hot', rep: 1000 },
  { key: 'burning', name: 'Burning', rep: 3000 },
  { key: 'fiery', name: 'Fiery', rep: 7000 },
  { key: 'infernal', name: 'Infernal', rep: 12000 },
];
// Стоимость запуска квеста слеера по тирам (NEU misc.slayer_cost)
const SLAYER_COST = [2000, 7500, 20000, 50000, 100000];
const SLAYER_ORDER = ['zombie', 'spider', 'wolf', 'enderman', 'blaze', 'vampire'];
const SLAYER_WHERE = {
  zombie: 'Хаб → Graveyard или Crypts',
  spider: "Spider's Den → Arachne's Burrow",
  wolf: 'Хаб → Ruins или Howling Cave в Парке',
  enderman: 'The End → Dragon\'s Nest / Void Sepulture',
  blaze: 'Crimson Isle → Smoldering Tomb и Stronghold',
  vampire: 'Rift → Stillgore Château',
};

/** Какие предметы из лестниц открывает данный уровень слеера. */
function unlocksAt(slayer, level) {
  const out = [];
  for (const l of LADDERS.ladders) for (const t of l.tiers) if (t.req?.slayer === slayer && t.req.level === level) out.push(t.name);
  return out;
}

export function dungeonRules(ctx, add) {
  const d = ctx.m.dungeons;
  if (!d) return;
  const cata = d.catacombs.level;
  const mf = d.masterFloors || {};
  const f7 = Number(d.floors?.['7'] || 0);
  // M-этаж открыт, если хватает уровня Catacombs И пройден предыдущий этаж (M1 — после F7, M2 — после M1, …)
  const doneM = f => Number(mf[String(f)]) > 0;
  const unlocked = [];
  for (const [f, r] of Object.entries(MASTER_REQ).map(([f, r]) => [Number(f), r]).sort((a, b) => a[0] - b[0])) {
    if (cata < r || (f === 1 ? !(f7 > 0) : !doneM(f - 1))) break;
    unlocked.push(f);
  }
  const notDone = unlocked.filter(f => !doneM(f));

  if (f7 > 0 && notDone.length) {
    add({
      id: 'dungeon-master', cat: 'Данжи', priority: 86, effort: 'часы',
      title: unlocked.some(doneM) ? `Пройди M${notDone[0]}: следующий открытый этаж Master Mode` : `Начни Master Mode с M${notDone[0]}`,
      why: `Catacombs ${cata}, F7 пройден ${f7} ${plural(f7, 'раз', 'раза', 'раз')}. Master Mode даёт намного больше опыта Catacombs, чем F7, и ценный лут: Master Stars, Recombobulator 3000, дорогие книги.`,
      how: [
        `Хаб данжей → Party Finder (или вход в Catacombs) → выбери Master Mode, этаж M${notDone[0]}`,
        `Начни с M${notDone[0]}: мобы и боссы сильнее, но механики те же, что на F${notDone[0]}`,
        'Ищи группу в Party Finder; на первых заходах помогает Kismet Feather для перекрутки сундука',
      ],
      items: ['FIRST_MASTER_STAR', 'KISMET_FEATHER'],
      payoff: 'Быстрый опыт Catacombs и доход с сундуков M-этажей',
      link: 'dungeons',
    });
  }

  if (cata < 50) {
    const next = Object.entries(MASTER_REQ).find(([, r]) => r > cata);
    const target = next ? next[1] : Math.min(50, cata + 1);
    const left = Math.max(0, (d.catacombs.xpForNext || 0) - (d.catacombs.xpCurrent || 0));
    add({
      id: 'dungeon-cata', cat: 'Данжи', priority: next ? 72 : 55, effort: 'долго',
      title: `Качай Catacombs до ${target}${next ? `: откроет M${next[0]}` : ''}`,
      why: `Сейчас ${cata} (${Math.round((d.catacombs.progress || 0) * 100)}% до ${cata + 1}, осталось ${fmtNum(left)} опыта). Каждый уровень Catacombs усиливает всё данж-снаряжение${next ? `, а ${next[1]} открывает новый Master-этаж` : ''}.`,
      how: [
        unlocked.length ? `Лучший опыт сейчас: M${unlocked[unlocked.length - 1]} на S+` : 'Лучший опыт сейчас: F7 на S+',
        'Включай зелье опыта данжей и выбирай мэра/перки с бонусом к опыту Catacombs, когда они есть',
        'Играй выбранным классом: остальным идёт только 25% опыта',
      ],
      payoff: next ? `Доступ к M${next[0]}` : 'Сильнее данж-снаряжение',
      link: 'dungeons',
    });
  }

  const weak = Object.entries(d.classes || {}).filter(([, c]) => c.level < cata - 8);
  if (weak.length) {
    add({
      id: 'dungeon-classes', cat: 'Данжи', priority: 34, effort: 'долго',
      title: `Подтяни отстающие классы: ${weak.map(([, c]) => `${c.name} ${c.level}`).join(', ')}`,
      why: `Средний уровень классов ${d.classAverage.toFixed(1)}. Он нужен для достижений и SkyBlock XP, а в группе иногда не хватает именно этого класса.`,
      how: ['Играй отстающим классом на лёгких этажах (F5–F7 или M1)', 'В Party Finder ищи группы, где нужен этот класс'],
    });
  }
}

export function slayerRules(ctx, add) {
  const s = ctx.m.slayers || {};
  const { slayerBossXp, slayerBossXpType, slayerHighestTier } = ctx.data;

  for (const key of SLAYER_ORDER) {
    const sl = s[key];
    if (!sl) continue;
    if (sl.level >= sl.maxLevel) continue;
    const bossXp = slayerBossXpType[key] || slayerBossXp;
    const maxTier = slayerHighestTier[key] || 4;
    const doneTiers = Object.entries(sl.kills || {}).filter(([, k]) => k > 0).map(([t]) => Number(t));
    const tier = Math.min(maxTier, doneTiers.length ? Math.max(...doneTiers) : 1);
    const left = Math.max(0, (sl.xpForNext || 0) - (sl.xp || 0));
    const bosses = Math.ceil(left / bossXp[tier - 1]);
    const questCost = bosses * SLAYER_COST[tier - 1];
    const unlocks = unlocksAt(key, sl.level + 1);

    if (sl.level === 0) {
      const blaze = key === 'blaze';
      add({
        id: `slayer-${key}`, cat: 'Слееры', priority: blaze ? 82 : 68, effort: 'часы',
        title: `Начни ${sl.name} (${sl.ru}): сейчас уровень 0`,
        why: blaze
          ? `Блейз-слеер открывает кинжалы для Crimson Isle, Kuudra-крафты и постоянные статы.${Object.values(ctx.m.dungeons?.masterFloors || {}).some(n => Number(n) > 0) ? ' Это главная дыра в твоём профиле после Master Mode.' : ''}`
          : 'Вампир-слеер (Rift) даёт постоянные статы и предметы Rift. Пять уровней качаются за пару вечеров и добавляют SkyBlock XP.',
        how: blaze
          ? [
            'Возьми квест у Maddox the Slayer (батфон или Хаб) → Inferno Demonlord T1',
            `Бой проходит в ${SLAYER_WHERE.blaze}`,
            'Броня Kuudra (Crimson/Aurora) и любое сильное оружие закрывают T1–T2; со 2 уровня скрафти Firedust или Twilight Dagger (нужен Molten Powder: крафт из 128 Derelict Ashe, которые падают с босса, и Amalgamated Crimsonite)',
            'Против щитов босса переключай Attunement кинжала (ПКМ), чтобы цвет совпадал со щитом',
          ]
          : [
            'Rift → Stillgore Château → NPC вампир-слеера',
            'Нужен Steak Stake, чтобы добить босса',
            'Квест стоит Motes, а не монеты: копи их в Rift',
          ],
        payoff: blaze ? 'Доступ к Blaze-снаряжению, статы, рост SkyBlock XP' : 'Статы и SkyBlock XP',
        items: blaze ? ['FIREDUST_DAGGER', 'MAWDUST_DAGGER'] : ['STEAK_STAKE'],
        link: 'slayers',
      });
      continue;
    }

    add({
      id: `slayer-${key}`, cat: 'Слееры', priority: 38 + (sl.maxLevel - sl.level) * 3 + (unlocks.length ? 10 : 0), effort: bosses > 60 ? 'долго' : 'часы',
      title: `${sl.name} (${sl.ru}) ${sl.level} → ${sl.level + 1}`,
      why: `Осталось ${fmtNum(left)} опыта слеера: примерно ${bosses} ${plural(bosses, 'босс', 'босса', 'боссов')} T${tier}${key === 'vampire' ? '' : ` (квесты ~${fmtCoins(questCost)})`}.${unlocks.length ? ` Откроет: ${unlocks.join(', ')}.` : ' Новый уровень даёт постоянные статы.'}`,
      how: [
        `Где: ${SLAYER_WHERE[key]}`,
        doneTiers.length ? `Твои убийства: ${doneTiers.map(t => `T${t}: ${sl.kills[t]}`).join(', ')}` : 'Начни с T1–T2, потом поднимай тир',
        'Мэр Aatrox (перк Slayer XP Buff) даёт +25% опыта слееров: копи квесты под него',
      ],
      payoff: unlocks.length ? `Новое снаряжение: ${unlocks.join(', ')}` : 'Постоянные статы',
      link: 'slayers',
    });
  }
}

export function crimsonRules(ctx, add) {
  const c = ctx.m.crimson;
  if (!c) return;
  const rep = Math.max(c.barbarianRep || 0, c.mageRep || 0);
  const k = c.kuudra || {};
  const total = KUUDRA_TIERS.reduce((s, t) => s + (k[t.key] || 0), 0);
  const unlocked = KUUDRA_TIERS.filter(t => rep >= t.rep);
  const highestDone = [...KUUDRA_TIERS].reverse().find(t => (k[t.key] || 0) > 0);
  const nextLocked = KUUDRA_TIERS.find(t => rep < t.rep);
  const farmTier = unlocked.filter(t => KUUDRA_TIERS.indexOf(t) <= (highestDone ? KUUDRA_TIERS.indexOf(highestDone) + 1 : 0)).pop() || KUUDRA_TIERS[0];

  if (!c.faction) {
    add({
      id: 'crimson-faction', cat: 'Crimson Isle и Kuudra', priority: 60, effort: 'часы',
      title: 'Открой Crimson Isle и выбери фракцию',
      why: 'Без фракции нет квестов репутации, а без репутации не открываются тиры Kuudra.',
      how: ['На Crimson Isle ведёт лаунчпад в глубине Spider\'s Den (нужен Combat 24)', 'Mages (Scarleton) или Barbarians (Dragontail): на тиры Kuudra засчитывается репутация любой. Сменить можно у Elle, но репутация сгорит'],
    });
    return;
  }

  add({
    id: 'kuudra', cat: 'Crimson Isle и Kuudra', priority: total < 20 ? 74 : 55, effort: 'часы',
    title: total < 20 ? `Kuudra: всего ${total} ${plural(total, 'заход', 'захода', 'заходов')}, фарми ${farmTier.name}` : `Kuudra: переходи на ${farmTier.name}`,
    why: `Репутация фракции ${fmtNum(rep)}: открыты ${unlocked.map(t => t.name).join(', ')}.${nextLocked ? ` Для ${nextLocked.name} нужно ${fmtNum(nextLocked.rep)} репутации.` : ''} Kuudra — стабильный заработок: броня, атрибуты, Kuudra Teeth и эссенция Crimson, а ещё основа для улучшения брони Kuudra.`,
    how: [
      'Платный сундук открывается Kuudra Key своего тира (крафт за монеты и материалы; ещё падает с мини-боссов, а за Nether Star его продаёт Emissary) — сверяй его цену с ценой лута',
      `Прохождения по тирам: ${KUUDRA_TIERS.map(t => `${t.name} ${k[t.key] || 0}`).join(', ')}`,
      nextLocked ? `Репутацию проще всего добрать ежедневными квестами фракции (${fmtNum(nextLocked.rep - rep)} до ${nextLocked.name})` : 'Все тиры открыты — фарми максимальный тир, который проходишь стабильно',
    ],
    items: ['KUUDRA_TEETH', 'ESSENCE_CRIMSON'],
    payoff: 'Регулярный доход и материалы для брони Kuudra',
    link: 'crimson',
  });

  if (nextLocked && rep < nextLocked.rep) {
    add({
      id: 'crimson-rep', cat: 'Crimson Isle и Kuudra', priority: 46, effort: 'часы',
      title: `Добери репутацию до ${fmtNum(nextLocked.rep)}: откроет Kuudra ${nextLocked.name}`,
      why: `Сейчас ${fmtNum(rep)} репутации (${c.faction === 'mages' ? 'Mages' : 'Barbarians'}). Высокие тиры Kuudra дают в разы более дорогой лут.`,
      how: ['До 5 квестов фракции в день на доске в Community Center своего города', 'Типы квестов: мини-босс, принести предметы, рыбалка, спасение, Dojo, Kuudra'],
      link: 'crimson',
    });
  }

  const dojo = dojoState(c.dojo);
  if (dojo.tried > 0 && dojo.tried < 7) {
    add({
      id: 'crimson-dojo', cat: 'Crimson Isle и Kuudra', priority: 22, effort: 'минуты',
      title: `Пройди все испытания Dojo (${dojo.tried}/7)`,
      why: 'Пояс Dojo — отдельный слот экипировки, а квесты фракции «Dojo» требуют минимальный ранг.',
      how: [`Не пройдены: ${dojo.tests.filter(t => !t.tried).map(t => t.name).join(', ')}`, 'Вход с пустым инвентарём и без питомца'],
      link: 'crimson',
    });
  } else if (dojo.tried === 7 && dojo.sRanks < 7) {
    const w = dojo.tests.filter(t => t.rank !== 'S').sort((a, b) => a.points - b.points)[0];
    add({
      id: 'crimson-dojo', cat: 'Crimson Isle и Kuudra', priority: 18, effort: 'минуты',
      title: `Dojo: подтяни ${w.name} (${fmtNum(w.points)}, ранг ${w.rank})`,
      why: `S-рангов ${dojo.sRanks}/7. Чёрный пояс — это S во всех семи испытаниях.`,
      how: [w.tip],
      link: 'crimson',
    });
  }
}

