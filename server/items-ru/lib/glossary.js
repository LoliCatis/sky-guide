// Русский глоссарий SkyBlock. Расширяет server/i18n/ru.js ядра: все его экспорты сохранены
// с теми же именами, поэтому ядро может импортировать этот файл вместо своего.
//
// Политика перевода (как в контракте): имена собственные предметов, боссов, NPC и локаций
// остаются на английском, как в игре и на аукционе. Переводим характеристики, типы предметов,
// редкости, служебные фразы лора и ванильные предметы Minecraft (по официальной локализации ru_ru).

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

/** Ключи slayer_req из NEU → русский текст */
export const SLAYER_REQ = { ZOMBIE: 'Зомби', SPIDER: 'Паук', WOLF: 'Волк', EMAN: 'Эндермен', BLAZE: 'Блейз', VAMPIRE: 'Вампир' };

export const CLASSES = { healer: 'Хилер', mage: 'Маг', berserk: 'Берсерк', archer: 'Лучник', tank: 'Танк' };

export const RARITY = {
  COMMON: 'Обычный', UNCOMMON: 'Необычный', RARE: 'Редкий', EPIC: 'Эпический', LEGENDARY: 'Легендарный',
  MYTHIC: 'Мифический', DIVINE: 'Божественный', SPECIAL: 'Особый', 'VERY SPECIAL': 'Очень особый',
  ULTIMATE: 'Ультимативный', ADMIN: 'Админский',
};

export const STATS = {
  'Health': 'Здоровье', 'Max Health': 'Макс. здоровье', 'Defense': 'Защита', 'True Defense': 'Истинная защита',
  'Strength': 'Сила', 'Speed': 'Скорость', 'Crit Chance': 'Шанс крита', 'Crit Damage': 'Крит. урон',
  'Intelligence': 'Интеллект', 'Mana': 'Мана', 'Mana Regen': 'Регенерация маны',
  'Bonus Attack Speed': 'Скорость атаки', 'Attack Speed': 'Скорость атаки', 'Sea Creature Chance': 'Шанс морского существа',
  'Magic Find': 'Magic Find (удача на дроп)', 'Pet Luck': 'Удача питомцев', 'Ferocity': 'Свирепость',
  'Ability Damage': 'Урон способностей', 'Mining Speed': 'Скорость добычи', 'Mining Fortune': 'Удача добычи',
  'Gemstone Fortune': 'Удача на самоцветы', 'Block Fortune': 'Удача на блоки', 'Ore Fortune': 'Удача на руду',
  'Farming Fortune': 'Фермерская удача', 'Foraging Fortune': 'Удача лесорубства', 'Hunting Fortune': 'Удача охоты',
  'Pristine': 'Чистота (Pristine)', 'Mining Spread': 'Радиус добычи (Mining Spread)', 'Gemstone Spread': 'Радиус добычи самоцветов',
  'Health Regen': 'Регенерация здоровья', 'Vitality': 'Живучесть', 'Mending': 'Лечение', 'Damage': 'Урон',
  'Gear Score': 'Рейтинг снаряжения', 'Fishing Speed': 'Скорость рыбалки', 'Swing Range': 'Дальность удара',
  'Combat Wisdom': 'Мудрость боя', 'Mining Wisdom': 'Мудрость добычи', 'Farming Wisdom': 'Мудрость фермерства',
  'Foraging Wisdom': 'Мудрость лесорубства', 'Fishing Wisdom': 'Мудрость рыбалки', 'Enchanting Wisdom': 'Мудрость зачарования',
  'Alchemy Wisdom': 'Мудрость алхимии', 'Carpentry Wisdom': 'Мудрость плотничества', 'Taming Wisdom': 'Мудрость приручения',
  'Social Wisdom': 'Мудрость общения', 'Runecrafting Wisdom': 'Мудрость рунического ремесла', 'Hunting Wisdom': 'Мудрость охоты',
  'Breaking Power': 'Сила разрушения', 'Heat Resistance': 'Термостойкость', 'Cold Resistance': 'Морозостойкость',
  'Pressure Resistance': 'Сопротивление давлению', 'Respiration': 'Дыхание',
  'Bonus Pest Chance': 'Шанс вредителей', 'Trophy Fish Chance': 'Шанс трофейной рыбы', 'Double Hook Chance': 'Шанс двойного улова',
  'Treasure Chance': 'Шанс сокровища', 'Sweep': 'Размах (Sweep)', 'Shot Cooldown': 'Перезарядка выстрела',
  'Rift Time': 'Время в Rift', 'Rift Damage': 'Урон в Rift', 'Hearts': 'Сердца', 'Overbloom': 'Overbloom',
  'Accessory Power': 'Сила аксессуара', 'Mana Cost': 'Затраты маны', 'Cooldown': 'Перезарядка',
  'Soulflow Cost': 'Затраты Soulflow', 'Fuel': 'Топливо', 'Gemstones': 'Самоцветы', 'Pull': 'Тяга',
  'Fear': 'Страх', 'Timber': 'Timber', 'Trophy Chance': 'Шанс трофея', 'Speed Cap': 'Предел скорости',
  'Max Storage': 'Макс. вместимость', 'Time Between Actions': 'Время между действиями',
  'Resources Generated': 'Произведено ресурсов', 'Capacity': 'Вместимость', 'Mining Speed Boost': 'Ускорение добычи',
};

/** Ключи характеристик из reforges.json / pets.json NEU (snake_case) → английское название */
export const STAT_KEYS = {
  health: 'Health', defense: 'Defense', true_defense: 'True Defense', strength: 'Strength', speed: 'Speed',
  walk_speed: 'Speed', crit_chance: 'Crit Chance', critical_chance: 'Crit Chance', crit_damage: 'Crit Damage',
  critical_damage: 'Crit Damage', intelligence: 'Intelligence', bonus_attack_speed: 'Bonus Attack Speed',
  attack_speed: 'Attack Speed', sea_creature_chance: 'Sea Creature Chance', magic_find: 'Magic Find', pet_luck: 'Pet Luck',
  ferocity: 'Ferocity', ability_damage: 'Ability Damage', ability_damage_percent: 'Ability Damage', mining_speed: 'Mining Speed',
  mining_fortune: 'Mining Fortune', farming_fortune: 'Farming Fortune', foraging_fortune: 'Foraging Fortune', pristine: 'Pristine',
  health_regen: 'Health Regen', vitality: 'Vitality', mending: 'Mending', damage: 'Damage', fishing_speed: 'Fishing Speed',
  swing_range: 'Swing Range', combat_wisdom: 'Combat Wisdom', mining_wisdom: 'Mining Wisdom', farming_wisdom: 'Farming Wisdom',
  foraging_wisdom: 'Foraging Wisdom', fishing_wisdom: 'Fishing Wisdom', breaking_power: 'Breaking Power',
  heat_resistance: 'Heat Resistance', cold_resistance: 'Cold Resistance', double_hook_chance: 'Double Hook Chance',
  trophy_fish_chance: 'Trophy Fish Chance', treasure_chance: 'Treasure Chance', gemstone_fortune: 'Gemstone Fortune',
  mining_spread: 'Mining Spread', hunting_fortune: 'Hunting Fortune', bonus_pest_chance: 'Bonus Pest Chance',
  sweep: 'Sweep', respiration: 'Respiration', pressure_resistance: 'Pressure Resistance', mana_regen: 'Mana Regen',
};

/** Иконки характеристик из ресурс-пака Hypixel (символы Private Use Area в лоре NEU) → обычные символы */
export const STAT_GLYPHS = {
  '': '⚔', '': '๑', '': '✎', '': '✎', '': 'Ⓟ', '': '❄', '': '☠', '': '❈',
  '': '⚓', '': '⫽', '': '☂', '': '❁', '': '❤', '': '❣', '': '♨', '': '♣',
  '': '☄', '': '⸕', '': '▚', '': 'ൠ', '': 'ൠ', '': '✯', '': '❍', '': '✧',
  '': '⚶', '': 'ф', '': 'α', '': '✦', '': '∮', '': 'Ⓢ', '': '⛃', '': '❂',
  '': '♨', '': '♔', '': '☣', '': '❁', '': '☘', '': '☘', '': '☘', '': '☘',
};

/** Типы монстров (Bestiary/бонусы урона) */
export const MOB_TYPES = {
  Airborne: 'летающие', Animal: 'животные', Aquatic: 'водные', Arcane: 'магические', Arthropod: 'членистоногие',
  Construct: 'конструкты', Cubic: 'кубические', Elusive: 'неуловимые', Ender: 'эндер-существа', Frozen: 'ледяные',
  Glacial: 'ледниковые', Humanoid: 'гуманоиды', Infernal: 'адские', Magmatic: 'магматические', Mythological: 'мифические',
  Pest: 'вредители', Shielded: 'бронированные', Skeletal: 'скелеты', Spooky: 'жуткие', Subterranean: 'подземные',
  Undead: 'нежить', Wither: 'визер-существа', Woodland: 'лесные', Critter: 'зверьки', Timid: 'пугливые',
};

/** Тип предмета из последней строки лора («LEGENDARY DUNGEON SWORD» → тип «SWORD», данжевый) */
export const ITEM_TYPES = {
  SWORD: 'Меч', LONGSWORD: 'Длинный меч', BOW: 'Лук', SHORTBOW: 'Шортбоу', WAND: 'Посох', GAUNTLET: 'Перчатка-оружие',
  HELMET: 'Шлем', CHESTPLATE: 'Нагрудник', LEGGINGS: 'Поножи', BOOTS: 'Ботинки',
  NECKLACE: 'Ожерелье', CLOAK: 'Плащ', BELT: 'Пояс', GLOVES: 'Перчатки', BRACELET: 'Браслет',
  ACCESSORY: 'Аксессуар', HATCESSORY: 'Аксессуар-шляпа', PET: 'Питомец', 'PET ITEM': 'Предмет для питомца',
  'REFORGE STONE': 'Камень перековки', 'POWER STONE': 'Камень силы', GEMSTONE: 'Самоцвет', COSMETIC: 'Косметика',
  DYE: 'Краска', SACK: 'Мешок', 'TRAVEL SCROLL': 'Свиток перемещения', PORTAL: 'Портал', ORE: 'Руда', BLOCK: 'Блок',
  'FISHING ROD': 'Удочка', 'FISHING WEAPON': 'Удочка-оружие', 'ROD PART': 'Деталь удочки', BAIT: 'Наживка', AXE: 'Топор',
  PICKAXE: 'Кирка', DRILL: 'Бур', SHOVEL: 'Лопата', HOE: 'Мотыга', SHEARS: 'Ножницы', 'FARMING TOOL': 'Фермерский инструмент',
  'HUNTING TOOL': 'Инструмент охоты', 'GARDEN CHIP': 'Чип Garden', MUTATION: 'Мутация', ARROW: 'Стрела',
  'ARROW POISON': 'Яд для стрел', DEPLOYABLE: 'Размещаемый предмет', 'DWARVEN METAL': 'Гномий металл', MEMENTO: 'Памятный предмет',
  TROPHY: 'Трофей', 'SEA CREATURE': 'Морское существо', RABBIT: 'Кролик', BOOSTER: 'Бустер', SALT: 'Соль',
  'RIFT TIMECHARM': 'Rift Timecharm', 'CARNIVAL MASK': 'Карнавальная маска', VACUUM: 'Пылесос', 'WATERING CAN': 'Лейка',
  TRAP: 'Ловушка', ITEM: 'Предмет', 'DUNGEON ITEM': 'Данжевый предмет', CHISEL: 'Долото', LASSO: 'Лассо',
  'BELT BUCKLE': 'Пряжка', SHARD: 'Осколок', 'ATTRIBUTE SHARD': 'Осколок атрибута', SPADE: 'Лопата',
  'ENCHANTED BOOK': 'Зачарованная книга', 'FISHING NET': 'Рыболовная сеть', CONSUMABLE: 'Расходник',
  'SLAYER SWORD': 'Меч слеера', CAPSULE: 'Капсула', 'ABILITY SCROLL': 'Свиток способности',
};

/** Категории базы (поле category) и их русские подписи */
export const CATEGORIES = {
  weapon: 'Оружие', armor: 'Броня', equipment: 'Экипировка', accessory: 'Аксессуар', pet: 'Питомец', pet_item: 'Предмет для питомца',
  tool: 'Инструмент', enchant_book: 'Зачарованная книга', reforge_stone: 'Камень перековки', power_stone: 'Камень силы',
  gemstone: 'Самоцвет', material: 'Материал', minion: 'Миньон', cosmetic: 'Косметика', consumable: 'Расходник',
  sack: 'Мешок', npc: 'NPC', mob: 'Моб', shard: 'Осколок', rune: 'Руна', furniture: 'Мебель', misc: 'Прочее',
};

export const WEAPON_TYPES = new Set(['SWORD', 'SLAYER SWORD', 'LONGSWORD', 'BOW', 'SHORTBOW', 'WAND', 'GAUNTLET', 'FISHING WEAPON']);
export const ARMOR_TYPES = new Set(['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS']);
export const EQUIPMENT_TYPES = new Set(['NECKLACE', 'CLOAK', 'BELT', 'GLOVES', 'BRACELET']);
export const TOOL_TYPES = new Set(['AXE', 'PICKAXE', 'DRILL', 'SHOVEL', 'HOE', 'SHEARS', 'FARMING TOOL', 'FISHING ROD', 'HUNTING TOOL',
  'VACUUM', 'WATERING CAN', 'CHISEL', 'LASSO', 'SPADE', 'FISHING NET']);

export const ISLANDS = {
  hub: 'Хаб', dungeon_hub: 'Хаб данжей', crimson_isle: 'Crimson Isle (Багровый остров)', the_end: 'Энд', combat_3: 'The End (Энд)',
  dwarven_mines: 'Dwarven Mines (Гномьи шахты)', mining_3: 'Dwarven Mines (Гномьи шахты)',
  crystal_hollows: 'Crystal Hollows (Хрустальные пещеры)', garden: 'Сад (Garden)', rift: 'Rift (Разлом)',
  park: 'The Park (Парк)', foraging_1: 'The Park (Парк)', galatea: 'Galatea', foraging_2: 'Galatea (Moonglade Marsh)',
  spider_den: "Spider's Den (Паучье логово)", combat_1: "Spider's Den (Паучье логово)",
  deep_caverns: 'Deep Caverns (Глубокие пещеры)', mining_2: 'Deep Caverns (Глубокие пещеры)',
  gold_mine: 'Gold Mine (Золотой рудник)', mining_1: 'Gold Mine (Золотой рудник)',
  barn: 'The Barn (Ферма)', farming_1: 'The Farming Islands (Фермерские острова)', mushroom_desert: 'Mushroom Desert (Грибная пустыня)',
  backwater_bayou: 'Backwater Bayou (Болото)', fishing_1: 'Backwater Bayou (Болото)', jerry: "Jerry's Workshop (Мастерская Джерри)",
  winter: "Jerry's Workshop (Мастерская Джерри)", glacite_tunnels: 'Glacite Tunnels (Ледниковые тоннели)',
  mineshaft: 'Glacite Mineshafts (Ледниковые шахты)', dynamic: 'Личный остров', dungeon: 'Данж (The Catacombs)',
  kuudra: "Kuudra's Hollow", lotus_atoll: 'Lotus Atoll',
};

export const CROPS = {
  WHEAT: 'Пшеница', CARROT_ITEM: 'Морковь', POTATO_ITEM: 'Картофель', PUMPKIN: 'Тыква', MELON: 'Арбуз',
  SUGAR_CANE: 'Сахарный тростник', CACTUS: 'Кактус', INK_SACK_3: 'Какао-бобы', 'INK_SACK:3': 'Какао-бобы',
  MUSHROOM_COLLECTION: 'Грибы', NETHER_STALK: 'Незерский нарост', DOUBLE_PLANT: 'Подсолнух', MOONFLOWER: 'Лунный цветок',
  WILD_ROSE: 'Дикая роза',
};

/** Ванильные чары Minecraft: официальные русские названия из ru_ru. SkyBlock-чары остаются на английском. */
export const ENCHANTS_RU = {
  sharpness: 'Острота', smite: 'Небесная кара', bane_of_arthropods: 'Бич членистоногих', knockback: 'Отдача',
  fire_aspect: 'Заговор огня', looting: 'Добыча', protection: 'Защита', fire_protection: 'Огнеупорность',
  blast_protection: 'Взрывоустойчивость', projectile_protection: 'Защита от снарядов', feather_falling: 'Невесомость',
  respiration: 'Подводное дыхание', aqua_affinity: 'Подводник', thorns: 'Шипы', depth_strider: 'Подводная ходьба',
  frost_walker: 'Ледоход', efficiency: 'Эффективность', silk_touch: 'Шёлковое касание', unbreaking: 'Прочность',
  fortune: 'Удача', power: 'Сила', punch: 'Откидывание', flame: 'Горящая стрела', infinite_quiver: 'Бесконечность',
  luck_of_the_sea: 'Морская удача', lure: 'Приманка', impaling: 'Пронзатель', piercing: 'Пронзающая стрела',
  respite: 'Respite', smelting_touch: 'Smelting Touch',
};

export function rarityRu(r) { return RARITY[r] || r || ''; }

/** Перевод названия характеристики; неизвестное возвращается как есть */
export function translateStat(name) {
  if (!name) return '';
  const k = STAT_KEYS[name] || STAT_KEYS[String(name).toLowerCase()] || name;
  return STATS[k] || k;
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

/** Длительность в секундах → «3 ч 20 мин», «5 дн.» */
export function fmtDuration(sec) {
  if (!sec) return '';
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d} дн.`);
  if (h) parts.push(`${h} ч`);
  if (m && !d) parts.push(`${m} мин`);
  return parts.join(' ') || `${sec} с`;
}

const ROMAN = { I: 1, V: 5, X: 10, L: 50 };
export function romanToInt(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]], nx = ROMAN[s[i + 1]] || 0;
    n += v < nx ? -v : v;
  }
  return n;
}
export function intToRoman(n) {
  const t = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}

/** Род типа предмета для согласования прилагательных: m, f, n, pl */
export const TYPE_GENDER = {
  SWORD: 'm', LONGSWORD: 'm', BOW: 'm', SHORTBOW: 'm', WAND: 'm', GAUNTLET: 'f', HELMET: 'm', CHESTPLATE: 'm',
  LEGGINGS: 'pl', BOOTS: 'pl', NECKLACE: 'n', CLOAK: 'm', BELT: 'm', GLOVES: 'pl', BRACELET: 'm', ACCESSORY: 'm',
  HATCESSORY: 'm', PET: 'm', 'PET ITEM': 'm', 'REFORGE STONE': 'm', 'POWER STONE': 'm', GEMSTONE: 'm', COSMETIC: 'f',
  DYE: 'f', SACK: 'm', 'TRAVEL SCROLL': 'm', PORTAL: 'm', ORE: 'f', BLOCK: 'm', 'FISHING ROD': 'f', 'FISHING WEAPON': 'f',
  'ROD PART': 'f', BAIT: 'f', AXE: 'm', PICKAXE: 'f', DRILL: 'm', SHOVEL: 'f', HOE: 'f', SHEARS: 'pl', 'FARMING TOOL': 'm',
  'HUNTING TOOL': 'm', 'GARDEN CHIP': 'm', MUTATION: 'f', ARROW: 'f', 'ARROW POISON': 'm', DEPLOYABLE: 'm',
  'DWARVEN METAL': 'm', MEMENTO: 'm', TROPHY: 'm', 'SEA CREATURE': 'n', RABBIT: 'm', BOOSTER: 'm', SALT: 'f',
  'RIFT TIMECHARM': 'm', 'CARNIVAL MASK': 'f', VACUUM: 'm', 'WATERING CAN': 'f', TRAP: 'f', ITEM: 'm', 'DUNGEON ITEM': 'm',
  CHISEL: 'n', LASSO: 'n', SHARD: 'm', 'ATTRIBUTE SHARD': 'm', SPADE: 'f', 'ENCHANTED BOOK': 'f', CONSUMABLE: 'm',
  'SLAYER SWORD': 'm', CAPSULE: 'f', 'ABILITY SCROLL': 'm',
  'FISHING NET': 'f', 'BELT BUCKLE': 'f',
};

/** Согласует прилагательное в м.р. ед.ч. («Легендарный», «Редкий») с родом */
export function agreeAdj(adj, g) {
  if (g === 'm' || !g) return adj;
  return adj.split(' ').map(w => {
    const soft = /[кгхжшчщ]ий$/.test(w);
    if (/(ый|ий|ой)$/.test(w)) {
      const stem = w.slice(0, -2);
      if (g === 'f') return stem + 'ая';
      if (g === 'n') return stem + 'ое';
      return stem + (soft ? 'ие' : 'ые');
    }
    return w;
  }).join(' ');
}

