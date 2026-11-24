// Русский глоссарий. Имена собственные (Hyperion, Kuudra, Bazaar) оставляем на английском,
// как принято в русскоязычном комьюнити SkyBlock, потому что в игре и на аукционе они только на английском.

export const SKILLS = {
  farming: 'Фермерство', mining: 'Добыча', combat: 'Бой', foraging: 'Лесорубство',
  fishing: 'Рыбалка', enchanting: 'Зачарование', alchemy: 'Алхимия', carpentry: 'Плотничество',
  runecrafting: 'Руническое ремесло', taming: 'Приручение', social: 'Общение', hunting: 'Охота',
};

export const SLAYERS = {
  zombie: { name: 'Revenant Horror', ru: 'Зомби' },
  spider: { name: 'Tarantula Broodfather', ru: 'Паук' },
  wolf: { name: 'Sven Packmaster', ru: 'Волк' },
  enderman: { name: 'Voidgloom Seraph', ru: 'Эндермен' },
  blaze: { name: 'Inferno Demonlord', ru: 'Блейз' },
  vampire: { name: 'Riftstalker Bloodfiend', ru: 'Вампир' },
};

export const CLASSES = { healer: 'Хилер', mage: 'Маг', berserk: 'Берсерк', archer: 'Лучник', tank: 'Танк' };

export const RARITY = {
  COMMON: 'Обычный', UNCOMMON: 'Необычный', RARE: 'Редкий', EPIC: 'Эпический', LEGENDARY: 'Легендарный',
  MYTHIC: 'Мифический', DIVINE: 'Божественный', SPECIAL: 'Особый', 'VERY SPECIAL': 'Очень особый',
  ULTIMATE: 'Ультимативный', ADMIN: 'Админский',
};

export const STATS = {
  'Health': 'Здоровье', 'Defense': 'Защита', 'True Defense': 'Истинная защита', 'Strength': 'Сила',
  'Speed': 'Скорость', 'Crit Chance': 'Шанс крита', 'Crit Damage': 'Крит. урон', 'Intelligence': 'Интеллект',
  'Bonus Attack Speed': 'Скорость атаки', 'Attack Speed': 'Скорость атаки', 'Sea Creature Chance': 'Шанс морского существа',
  'Magic Find': 'Magic Find (удача на дроп)', 'Pet Luck': 'Удача питомцев', 'Ferocity': 'Свирепость',
  'Ability Damage': 'Урон способностей', 'Mining Speed': 'Скорость добычи', 'Mining Fortune': 'Удача добычи',
  'Farming Fortune': 'Фермерская удача', 'Foraging Fortune': 'Удача лесорубства', 'Pristine': 'Чистота (Pristine)',
  'Health Regen': 'Регенерация здоровья', 'Vitality': 'Живучесть', 'Mending': 'Лечение', 'Damage': 'Урон',
  'Gear Score': 'Рейтинг снаряжения', 'Fishing Speed': 'Скорость рыбалки', 'Swing Range': 'Дальность удара',
  'Combat Wisdom': 'Мудрость боя', 'Mining Wisdom': 'Мудрость добычи', 'Farming Wisdom': 'Мудрость фермерства',
  'Breaking Power': 'Сила разрушения', 'Heat Resistance': 'Термостойкость', 'Cold Resistance': 'Морозостойкость',
  'Bonus Pest Chance': 'Шанс вредителей', 'Trophy Fish Chance': 'Шанс трофейной рыбы', 'Double Hook Chance': 'Шанс двойного улова',
};

export const ISLANDS = {
  hub: 'Хаб', dungeon_hub: 'Хаб данжей', crimson_isle: 'Crimson Isle (Багровый остров)', the_end: 'Энд',
  dwarven_mines: 'Dwarven Mines (Гномьи шахты)', crystal_hollows: 'Crystal Hollows (Хрустальные пещеры)',
  garden: 'Сад (Garden)', rift: 'Rift (Разлом)', park: 'Парк', galatea: 'Galatea', spider_den: "Spider's Den (Паучье логово)",
  deep_caverns: 'Deep Caverns', gold_mine: 'Золотой рудник', barn: 'Ферма', mushroom_desert: 'Грибная пустыня',
  backwater_bayou: 'Backwater Bayou (Болото)', jerry: 'Остров Джерри', glacite_tunnels: 'Glacite Tunnels (Ледниковые тоннели)',
};

export const CROPS = {
  WHEAT: 'Пшеница', CARROT_ITEM: 'Морковь', POTATO_ITEM: 'Картофель', PUMPKIN: 'Тыква', MELON: 'Арбуз',
  SUGAR_CANE: 'Сахарный тростник', CACTUS: 'Кактус', INK_SACK_3: 'Какао-бобы', 'INK_SACK:3': 'Какао-бобы',
  MUSHROOM_COLLECTION: 'Грибы', NETHER_STALK: 'Незерский нарост', DOUBLE_PLANT: 'Подсолнух', MOONFLOWER: 'Лунный цветок',
  WILD_ROSE: 'Дикая роза',
};

export function rarityRu(r) { return RARITY[r] || r || ''; }

// Перевод строк лора: переводим названия характеристик, остальное оставляем как в игре
const statRe = new RegExp(`^((?:§.)*)(${Object.keys(STATS).sort((a, b) => b.length - a.length).map(s => s.replace(/ /g, '\\s')).join('|')}):`, '');
export function translateLoreLine(line) {
  return line.replace(statRe, (_, colors, stat) => `${colors}${STATS[stat] || stat}:`)
    .replace(/§6§l(LEGENDARY|EPIC|RARE|MYTHIC)/, m => m)
    .replace(/Requires/g, 'Требуется')
    .replace(/This item can be reforged!/, 'Этот предмет можно перековать!');
}

// Форматирование чисел по-русски: 1,2 млн, 3,4 млрд
export function fmtCoins(n) {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  const f = (v, u) => `${(n / v).toLocaleString('ru-RU', { maximumFractionDigits: v >= 1e6 ? 2 : 1 })} ${u}`;
  if (a >= 1e9) return f(1e9, 'млрд');
  if (a >= 1e6) return f(1e6, 'млн');
  if (a >= 1e3) return f(1e3, 'тыс.');
  return Math.round(n).toLocaleString('ru-RU');
}

// Склонение: plural(5, 'раз', 'раза', 'раз')
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
