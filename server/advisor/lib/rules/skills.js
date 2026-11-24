// Быстрые победы, скиллы, добыча, лесорубство (Galatea), сад, Rift.
import { hotmPowderRemaining } from '../hotm.js';
import { fmtCoins, fmtNum, plural } from '../util.js';

const SKILL_HOWTO = {
  combat: ['Слееры T4–T5 и Master Mode дают больше всего опыта боя', 'Мини-боссы Crimson Isle и Kuudra', 'Зелье опыта боя и питомец с бонусом к Combat XP'],
  foraging: ['Galatea: рубка новых пород деревьев одновременно качает Foraging и Heart of the Forest', 'Топор с Efficiency и питомец Monkey', 'Foraging-зелье и Booster Cookie (+25% опыта скиллов)'],
  fishing: ['Лавовая рыбалка в Crimson Isle (Magma Lord/Thunder) — лучший опыт на твоём уровне', 'Морские существа во время Spooky Festival и Fishing Festival', 'Trophy Fishing параллельно даёт трофеи'],
  enchanting: ['Experimentation Table: Superpairs и Chronomatron каждый день', 'Зачарование на столе с максимальным Bookshelf Power'],
  alchemy: ['Варка зелий с усилителями (Enchanted Sugar Cane, Enchanted Blaze Rod)', 'Ингредиенты дешевле купить на Bazaar, чем добывать'],
  taming: ['Опыт Taming идёт с любого опыта скиллов через активного питомца', 'Сначала подними кап до 60 (шаг в «Питомцах»)'],
  carpentry: ['Крафт на верстаке: самый дешёвый путь — массовый крафт из Bazaar-материалов'],
  mining: ['Commissions в Dwarven Mines и Glacite Tunnels', 'Gemstone mining в Crystal Hollows'],
  farming: ['Сад: культура с максимальной Farming Fortune', 'Контесты Jacob за медали и опыт'],
  hunting: ['Охота и ловушки на животных (Galatea, Backwater Bayou)'],
};
// Приоритет скилла в общей прогрессии (на этапе позднего мидгейма)
const SKILL_WEIGHT = { combat: 1.3, foraging: 1.1, fishing: 1.0, taming: 1.2, alchemy: 0.8, carpentry: 0.7, enchanting: 0.9, mining: 0.9, farming: 0.8, hunting: 0.6 };
const GARDEN_PLOTS = 24;

export function quickRules(ctx, add) {
  const m = ctx.m;
  const fs = m.fairySouls || {};
  const unspent = fs.unspent ?? Math.max(0, (fs.collected || 0) - (fs.exchanges || 0) * 5);
  if (unspent >= 5) {
    const ex = Math.floor(unspent / 5);
    add({
      id: 'fairy-exchange', cat: 'Быстрые победы', priority: 96, effort: 'минуты',
      title: `Обменяй ${unspent} ${plural(unspent, 'фею', 'феи', 'фей')} у Tia the Fairy`,
      why: `Каждые 5 фей — постоянные бонусы к здоровью, защите, силе и скорости. Доступно обменов: ${ex}.`,
      how: ['Хаб → Tia the Fairy у Fairy Pond (Wilderness)', 'Нажми на неё — обмен произойдёт автоматически'],
      payoff: `${ex} ${plural(ex, 'обмен', 'обмена', 'обменов')} на статы`,
    });
  }
  const left = Math.max(0, ctx.data.fairySoulsMax - (fs.collected || 0));
  if (left > 0) {
    add({
      id: 'fairy-collect', cat: 'Быстрые победы', priority: left >= 20 ? 62 : 35, effort: 'часы',
      title: `Собери оставшиеся феи: ${left} из ${ctx.data.fairySoulsMax}`,
      why: `Собрано ${fs.collected || 0}. Каждые 5 новых фей — ещё один обмен на постоянные статы, а это бесплатно.`,
      how: ['Гайды → «Души и коллекции»: все феи по островам с маршрутом, подсказкой «от какого варпа идти» и координатами', 'Отмечай найденные — останутся только недостающие', 'Мод с вэйпоинтами (SkyHanni, Skytils, NEU) покажет точку по координатам'],
      payoff: `до ${Math.floor(left / 5)} обменов у Tia`,
      link: 'fairy-souls',
    });
  }
  if (m.cookie === false) {
    add({
      id: 'cookie', cat: 'Быстрые победы', priority: 92, effort: 'минуты',
      title: 'Активируй Booster Cookie',
      why: '+25 к Wisdom всех скиллов (≈+25% опыта), +10 Magic Find, Bits для магазина Elizabeth, монеты не теряются при смерти, /ah и /bazaar откуда угодно.',
      how: [`Купи Booster Cookie на Bazaar${ctx.price('BOOSTER_COOKIE') ? ` (сейчас ~${fmtCoins(ctx.price('BOOSTER_COOKIE'))})` : ''} и съешь`],
      items: ['BOOSTER_COOKIE'],
      cost: ctx.price('BOOSTER_COOKIE') || undefined,
    });
  }
}

export function skillRules(ctx, add) {
  const m = ctx.m;
  for (const [key, s] of Object.entries(m.skills || {})) {
    if (key === 'social' || key === 'runecrafting' || s.apiMissing) continue;
    if (s.level >= s.maxLevel) continue;
    const gap = s.maxLevel - s.level;
    const w = SKILL_WEIGHT[key] ?? 0.8;
    const left = Math.max(0, (s.xpForNext || 0) - (s.xpCurrent || 0));
    add({
      id: `skill-${key}`, cat: 'Скиллы', priority: Math.round(Math.min(62, (18 + gap * 1.2) * w)), effort: gap > 10 ? 'долго' : 'часы',
      title: `${s.name} ${s.level} → ${s.maxLevel}`,
      why: `Осталось ${gap} ${plural(gap, 'уровень', 'уровня', 'уровней')}, до ${s.level + 1} — ${fmtNum(left)} опыта. Каждый уровень даёт статы и SkyBlock XP; средний скилл сейчас ${(m.skillAverage || 0).toFixed(1)}.`,
      how: SKILL_HOWTO[key] || [],
      link: 'skills',
    });
  }
  // Кап Farming 50 → 60 поднимается у Anita за медали Jacob's Farming Contest
  const f = m.skills?.farming;
  const cap = m.farmingCap || 50;
  if (f && !f.apiMissing && cap < 60 && f.level >= cap - 2) {
    add({
      id: 'skill-farming-cap', cat: 'Скиллы', priority: f.level >= cap ? 58 : 45, effort: 'часы',
      title: `Подними кап Farming: ${cap} → 60`,
      why: `Farming ${f.level} упирается в кап ${cap}. Каждый уровень выше 50 даёт ещё Farming Fortune, статы и SkyBlock XP.`,
      how: ['NPC Anita (рядом с Jacob) → Farming Level Cap, оплата медалями Jacob\'s Farming Contest', 'Медали дают за места в Jacob\'s Contest: участвуй в контестах по своим культурам'],
      link: 'skills',
    });
  }
}

/** Уровень HotF по опыту. */
function hotfLevel(ctx, xp) {
  const t = ctx.data.hotf;
  let lvl = 0;
  for (let i = 0; i < t.length; i++) if (xp >= t[i]) lvl = i + 1;
  return lvl;
}

export function foragingRules(ctx, add) {
  const m = ctx.m;
  const f = m.skills?.foraging;
  if (m.hotfXp == null && !f) return;
  const lvl = hotfLevel(ctx, m.hotfXp || 0);
  const max = ctx.data.hotf.length;
  if (lvl < max) {
    add({
      id: 'hotf', cat: 'Лесорубство и Galatea', priority: lvl < 5 ? 54 : 40, effort: 'долго',
      title: `Heart of the Forest ${lvl} → ${max}`,
      why: `HotF — дерево перков для Galatea: скорость и удача рубки, новые способности. Сейчас уровень ${lvl}${f ? `, Foraging ${f.level}` : ''}. Прокачка идёт параллельно со скиллом.`,
      how: ['Galatea → задания (commissions) и рубка новых пород', 'Вкладывай очки HotF в скорость и Foraging Fortune в первую очередь'],
      payoff: 'Быстрее Foraging и доход с древесины Galatea',
      link: 'foraging',
    });
  }
}

export function miningRules(ctx, add) {
  const mi = ctx.m.mining;
  if (!mi) return;
  if (mi.hotm.level < 10) {
    add({
      id: 'hotm', cat: 'Добыча', priority: 44, effort: 'долго',
      title: `Heart of the Mountain ${mi.hotm.level} → 10`,
      why: 'HotM открывает перки скорости и удачи добычи и Peak of the Mountain — основа дохода с гемов и Glacite.',
      how: ['Commissions в Dwarven Mines и Glacite Tunnels — основной опыт HotM'],
      link: 'mining',
    });
  }
  const avail = { MITHRIL: mi.powder?.mithrilAvail || 0, GEMSTONE: mi.powder?.gemstoneAvail || 0, GLACITE: mi.powder?.glaciteAvail || 0 };
  // Сколько ещё можно вложить: не больше, чем стоит докачать оставшиеся перки (иначе powder некуда тратить)
  const remaining = hotmPowderRemaining(mi.nodes, ctx.opts.constants?.hotmlayout);
  const spendable = remaining
    ? Object.fromEntries(Object.entries(avail).map(([k, v]) => [k, Math.min(v, remaining[k])]))
    : avail;
  const total = spendable.MITHRIL + spendable.GEMSTONE + spendable.GLACITE;
  if (total > 500_000) {
    const parts = [['Mithril', 'MITHRIL'], ['Gemstone', 'GEMSTONE'], ['Glacite', 'GLACITE']]
      .filter(([, k]) => spendable[k] > 0)
      .map(([n, k]) => `${n} ${fmtNum(spendable[k])}${remaining && avail[k] > spendable[k] ? ` (на руках ${fmtNum(avail[k])}, но перкам до максимума нужно только ${fmtNum(remaining[k])})` : ''}`);
    add({
      id: 'hotm-powder', cat: 'Добыча', priority: 42, effort: 'минуты',
      title: `Вложи powder в перки HotM: ~${fmtNum(total)}`,
      why: `Можно вложить: ${parts.join('; ')}. Пока powder лежит неистраченным, он ничего не даёт.`,
      how: ['Меню HotM → докачай перки Mining Speed / Mining Fortune, затем перки под твой способ добычи'],
      link: 'mining',
    });
  }
}

const CROP_RU = { WHEAT: 'Пшеница', CARROT_ITEM: 'Морковь', POTATO_ITEM: 'Картофель', PUMPKIN: 'Тыква', MELON: 'Арбуз', SUGAR_CANE: 'Сахарный тростник', CACTUS: 'Кактус', 'INK_SACK:3': 'Какао-бобы', NETHER_STALK: 'Адский нарост', MUSHROOM_COLLECTION: 'Грибы', DOUBLE_PLANT: 'Подсолнух', MOONFLOWER: 'Лунный цветок', WILD_ROSE: 'Дикая роза' };
const CROP_KEY = { CARROT: 'CARROT_ITEM', POTATO: 'POTATO_ITEM', COCOA_BEANS: 'INK_SACK:3', NETHER_WART: 'NETHER_STALK', MUSHROOM: 'MUSHROOM_COLLECTION', SUNFLOWER: 'DOUBLE_PLANT' };

export function gardenRules(ctx, add) {
  const g = ctx.m.garden || {};
  // Ключи API бывают старыми (CARROT) и новыми (CARROT_ITEM): сводим к одной культуре и пишем по-русски
  const byCrop = {};
  for (const [k, v] of Object.entries(g.cropUpgrades || {})) {
    const id = CROP_KEY[k] || k;
    byCrop[id] = Math.max(byCrop[id] ?? 0, Number(v) || 0);
  }
  const low = Object.entries(byCrop).filter(([, v]) => v < 9).map(([c, v]) => [CROP_RU[c] || c, v]);
  if (low.length) {
    add({
      id: 'garden-crops', cat: 'Сад (Garden)', priority: 48, effort: 'минуты',
      title: `Улучши Crop Upgrades: ${low.length} ${plural(low.length, 'культура', 'культуры', 'культур')} не на максимуме`,
      why: `Каждый уровень +5 Farming Fortune для своей культуры. Меди: ${fmtNum(g.copper || 0)}.`,
      how: ['Сад → Desk → Crop Upgrades', ...low.map(([c, v]) => `${c}: ${v}/9`)],
      link: 'garden',
    });
  }
  if (g.unlockedPlots != null && g.unlockedPlots < GARDEN_PLOTS) {
    add({
      id: 'garden-plots', cat: 'Сад (Garden)', priority: 30, effort: 'монеты',
      title: `Открой участки Сада: ${g.unlockedPlots}/${GARDEN_PLOTS}`,
      why: 'Больше участков — больше места под культуры и вредителей (Pests), а значит больше дохода с Сада.',
      how: ['Сад → Desk → Configure Plots; оплата Compost'],
      items: ['COMPOST'],
    });
  }
}

export function riftRules(ctx, add) {
  const r = ctx.m.rift || {};
  if (r.enigmaSouls != null && r.enigmaSouls < 52) {
    const left = 52 - r.enigmaSouls;
    add({
      id: 'rift-souls', cat: 'Rift', priority: left > 20 ? 38 : 26, effort: 'часы',
      title: `Собери Enigma Souls: ${r.enigmaSouls}/52`,
      why: `Осталось ${left}. Enigma Souls увеличивают время в Rift и открывают апгрейды за Motes; они же нужны для полного прохождения Rift.`,
      how: ['Вход в Rift — через Wizard Tower в Хабе', 'Включи маршрут Enigma Souls в моде (NEU/Skytils) или пользуйся картой на вики'],
      link: 'rift',
    });
  }
}
