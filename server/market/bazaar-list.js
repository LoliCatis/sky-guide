// Список товаров Bazaar для раздела «Рынок»: поиск, сортировка и постраничная выдача по ВСЕМ товарам.
// Раньше браузер получал только 300 самых ходовых и сортировал их у себя, поэтому остальные ~1900 товаров
// (редкие книги, осколки, товары без ордеров) не было видно, пока не наберёшь название.

/** Сортировки списка: ключ → значение строки (null — в конец при любом направлении). */
const SORT_VALUE = {
  vol: r => (r.buyWeek + r.sellWeek) * (r.buy || r.sell),
  d1: r => r.d1?.buy ?? null,
  buy: r => (r.buy > 0 ? r.buy : null),
  spreadPct: r => (r.buy > 0 && r.sell > 0 ? (r.spread / r.buy) * 100 : null),
  buyWeek: r => r.buyWeek,
};

/**
 * @param {Map<string, any>} bazaar id → запись parseBazaar
 * @param {{ q?: string, sort?: string, offset?: number, limit?: number,
 *   row: (id: string, p: any) => any,              // строка для клиента (id, name, nameEn, цены…)
 *   searchIds?: (q: string) => Map<string, number> | null, // русский поиск/жаргон: id базы → место в выдаче
 *   keyOf?: (id: string) => string                  // Bazaar-ID → ID базы поиска (ENCHANTMENT_SHARPNESS_5 → SHARPNESS;5)
 * }} opt
 * @returns {{ total: number, items: any[] }}
 */
export function listBazaar(bazaar, { q = '', sort = '', offset = 0, limit = 200, row, searchIds = null, keyOf = id => id }) {
  const query = String(q || '').trim().toLowerCase();
  const ruIds = query.length >= 2 && searchIds ? searchIds(query) : null;
  const ruRank = new Map(); // id товара → место в русском поиске
  if (ruIds) for (const id of bazaar.keys()) {
    const at = ruIds.get(id) ?? ruIds.get(keyOf(id));
    if (at != null) ruRank.set(id, at);
  }
  const hit = r => !query || r.name.toLowerCase().includes(query) || (r.nameEn || '').toLowerCase().includes(query)
    || r.id.toLowerCase().includes(query) || ruRank.has(r.id);
  const list = [];
  for (const [id, p] of bazaar) {
    const r = row(id, p);
    if (hit(r)) list.push(r);
  }
  const vol = SORT_VALUE.vol;
  const [key, d] = String(sort || '').split(':');
  const dir = Number(d) || -1;
  let cmp;
  if (key === 'name') cmp = (a, b) => a.name.localeCompare(b.name, 'ru') * dir;
  else if (SORT_VALUE[key]) {
    const val = SORT_VALUE[key];
    cmp = (a, b) => {
      const va = val(a), vb = val(b);
      if (va == null || vb == null) return (va == null) - (vb == null) || vol(b) - vol(a);
      return (va - vb) * dir || vol(b) - vol(a);
    };
  } else if (query) {
    // При поиске — сначала совпадения по названию, потом по релевантности русского поиска, затем по обороту
    const rank = x => (x.name.toLowerCase().includes(query) || (x.nameEn || '').toLowerCase().includes(query) ? -1
      : ruRank.get(x.id) ?? 999);
    cmp = (a, b) => rank(a) - rank(b) || vol(b) - vol(a);
  } else cmp = (a, b) => vol(b) - vol(a);
  list.sort(cmp);
  const from = Math.max(0, Math.floor(Number(offset) || 0));
  const n = Math.max(1, Math.min(Math.floor(Number(limit) || 200), 3000));
  return { total: list.length, items: list.slice(from, from + n) };
}
