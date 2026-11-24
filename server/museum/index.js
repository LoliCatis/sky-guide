// Музей: каталог (catalog.js), анализ игрока (analyze.js) и маршруты API.
//   GET /api/museum            — полный разбор музея выбранного игрока (свой профиль, друг или гость по нику)
//   GET /api/museum/item/:id   — статус одного предмета для карточки («в музее ✔» / «можно пожертвовать»)
import { analyzeMuseum, museumItemStatus, setName, setIcon } from './analyze.js';
import { museumCatalog, CATEGORIES, MILESTONE_REWARDS, OTHER_REWARDS, MILESTONE_XP, MILESTONES } from './catalog.js';

export { analyzeMuseum, museumItemStatus, museumCatalog, setName, setIcon, CATEGORIES };

/** Короткая сводка для /api/state (Обзор, шапка, «Сравнение»): без длинных списков. */
export function museumSummary(m, o) {
  const a = analyzeMuseum(m, o);
  return {
    status: a.status, donated: a.donated, total: a.total, xp: a.xp, xpMax: a.xpMax, value: a.value, appraisal: !!a.appraisal,
    milestone: a.milestone, canDonate: a.canDonate.length, canDonateXp: a.canDonateXp || 0, borrowed: a.borrowed.length, special: a.special.count,
    categories: a.categories.map(c => ({ id: c.id, ru: c.ru, donated: c.donated, total: c.total })),
  };
}

/** Полный ответ для страницы «Музей». */
export function museumPage(m, o) {
  const a = analyzeMuseum(m, { ...o, full: true });
  const cat = museumCatalog(o.constants);
  const name = id => o.name?.(id) || id;
  // Иконки и имена записей каталога (сеты — по нагруднику)
  const entryInfo = {};
  for (const e of cat.entries.values()) entryInfo[e.id] = e.set ? { name: setName(e.set, name), icon: setIcon(e.set) } : { name: name(e.id), icon: e.id };
  const milestones = [];
  for (let i = 1; i <= MILESTONES; i++) milestones.push({ n: i, xp: i * MILESTONE_XP, done: a.milestone.n >= i, rewards: MILESTONE_REWARDS[i] || null });
  return { ...a, entryInfo, milestones, otherRewards: OTHER_REWARDS };
}

export function mountMuseumRoutes(app, { getView, deps }) {
  app.get('/api/museum', async (req, res) => {
    let v;
    try { v = await getView(req); } catch (e) { return res.status(200).json({ status: 'error', error: e.message }); }
    const m = v?.member;
    if (!m) return res.json({ status: 'error', error: v?.error || 'Профиль ещё не загружен' });
    try {
      res.json({ ...museumPage(m, deps()), player: v.player?.name || null, profile: m.profileName || null, self: !!v.self });
    } catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
  });
  app.get('/api/museum/item/:id', async (req, res) => {
    const v = await getView(req).catch(() => null);
    const m = v?.member;
    try { res.json({ museum: m ? museumItemStatus(m, req.params.id, deps()) : museumItemStatus({}, req.params.id, deps()) }); } catch (e) { res.status(500).json({ error: e.message }); }
  });
}
