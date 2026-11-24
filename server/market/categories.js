// Категория товара для фильтров на вкладке «Заработок»: Фермерство, Добыча, Бой, Лес, Рыбалка, Книги, Осколки…
// Bazaar API категорий не отдаёт, поэтому определяем по ID (сжатые формы ENCHANTED_* попадают в группу сырья),
// а для предметов аукциона берём тип из базы items-ru (броня, оружие, аксессуар, питомец).

/** Порядок важен: первое совпадение побеждает (INK_SACK:3 — какао, а не чернила кальмара). */
const RULES = [
  // Улучшения предметов (звёзды, Recombobulator, Potato Books): их покупают для перепродажи улучшенных вещей
  ['Улучшения', /RECOMBOBULATOR|MASTER_STAR|KISMET_FEATHER|POTATO_BOOK|^THE_ART_OF_(WAR|PEACE)$|^BOOK_OF_STATS$|^FARMING_FOR_DUMMIES$|^JALAPENO_BOOK$|^POLARVOID_BOOK$|^TRANSMISSION_TUNER$|^MANA_DISINTEGRATOR$/],
  ['Книги', /^ENCHANTMENT_|_BOOK$/],
  ['Осколки', /^SHARD_|^ATTRIBUTE_SHARD/],
  ['Эссенции', /^ESSENCE_/],
  ['Фермерство', /WHEAT|HAY_BALE|SEEDS|CARROT|POTATO|PUMPKIN|MELON|SUGAR|CACTUS|COCOA|INK_SACK:3|NETHER_STALK|NETHER_WART|MUSHROOM|MYCEL|MUTTON|PORK|RAW_CHICKEN|COOKED_CHICKEN|(?<!GRIFFIN_)FEATHER|LEATHER|RAW_BEEF|RABBIT|ENCHANTED_EGG|SUPER_EGG|COMPOST|CROPIE|SQUASH|FERMENTO|DOUBLE_PLANT|SUNFLOWER|MOONFLOWER|WILD_ROSE|HONEY|JACOBS|PEST|DUNG|PLANT_MATTER|BOX_OF_SEEDS|FINE_FLOUR|TIGHTLY_TIED_HAY/],
  ['Рыбалка', /FISH|SALMON|PUFFER|CLOWN|PRISMARINE|INK_SACK|SPONGE|WATER_LILY|LILY_PAD|SHARK|CHUM|SHELL|SEA_|NURSE|AGARIMOO|TROPHY/],
  ['Лес', /_LOG|LOG_|_WOOD|OAK|BIRCH|SPRUCE|JUNGLE|ACACIA|MANGROVE|FIG|SAPLING|LEAVES|VINESAP|LUSHLILAC|TENDER_WOOD|STURDY_BONE/],
  ['Добыча', /COBBLE|STONE|COAL|IRON|GOLD|DIAMOND|LAPIS|EMERALD|REDSTONE|QUARTZ|OBSIDIAN|GLOWSTONE|GRAVEL|FLINT|SAND|MITHRIL|TITANIUM|_GEM$|GEMSTONE|GLACITE|TUNGSTEN|UMBER|SULPHUR|NETHERRACK|ENDSTONE|END_STONE|(?:^|_)ICE(?:_|$)|SNOW|STARFALL|TREASURITE|SORROW|REFINED_|CLAY|MINERAL|DWARVEN|MAGMA_CORE|SLUDGE|ROBOTRON|CONTROL_SWITCH|SYNTHETIC_HEART|ELECTRON|FTX|SUPERLITE|GOBLIN|AMBER|JADE|AMETHYST|SAPPHIRE|TOPAZ|JASPER|OPAL|ONYX|AQUAMARINE|CITRINE|PERIDOT|RUBY/],
  ['Бой и данжи', /ROTTEN_FLESH|BONE|STRING|SPIDER_EYE|GUNPOWDER|SULPHUR|ENDER_PEARL|EYE_OF_ENDER|GHAST|SLIME|BLAZE|MAGMA_CREAM|REVENANT|TARANTULA|WOLF_TOOTH|GRIZZLY|NULL_|SUMMONING_EYE|JUDGEMENT|DERELICT|ARCHFIEND|CHILI|KUUDRA|WITHER|ZOMBIE|SKELETON|SPIDER|ENDER|ZEALOT|DRAGON|GRIFFIN|MINOS|DAEDALUS|MASTER_STAR|RECOMBOBULATOR|NECRON|SCYTHE|VISCERA|FLESH|HEART|CORE$|TEETH|ENRAGER/],
];

/** Тип предмета из items-ru → человеческая категория (для лотов аукциона и крафтов). */
const KIND = {
  armor: 'Броня', weapon: 'Оружие', accessory: 'Аксессуары', pet: 'Питомцы', pet_item: 'Питомцы', tool: 'Инструменты',
  equipment: 'Экипировка', enchant_book: 'Книги', shard: 'Осколки', gemstone: 'Добыча', reforge_stone: 'Перековка',
  power_stone: 'Перековка', rune: 'Косметика', cosmetic: 'Косметика', minion: 'Миньоны', consumable: 'Расходники', sack: 'Прочее',
};

/**
 * @param {string} id ID Bazaar или аукциона
 * @param {{ kind?: (id: string) => string | null }} [ctx] ctx.kind — тип из базы items-ru
 * @returns {string}
 */
export function categoryOf(id, ctx) {
  const s = String(id || '').toUpperCase();
  const t = ctx?.kind ? ctx.kind(s) : null;
  // Экипировка с аукциона: тип из базы надёжнее слов в ID (WITHER_GOGGLES — броня, а не «бой»)
  if (t && t !== 'material' && t !== 'misc' && t !== 'mob' && t !== 'npc' && KIND[t]) return KIND[t];
  if (/^PET_|;\d$/.test(s) && !s.startsWith('ENCHANTMENT_')) return 'Питомцы';
  for (const [name, re] of RULES) if (re.test(s)) return name;
  return 'Прочее';
}
