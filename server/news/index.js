// Раздел «Новости» (журнал изменений сайта). Записи — в entries.js, самая новая первой.
// GET /api/news        → { latest, entries: [{ id, date, kind, kindRu, title, items }], refs }
// GET /api/news/latest → { latest, ids, top, refs } — лёгкий запрос: число непрочитанных на кнопке меню
//   и окошко «Что нового» при заходе (top — самая свежая запись, refs — подсказки только к ней)
import { NEWS, KIND_RU } from './entries.js';
import { plainNews } from './links.js';

export function newsView(list = NEWS) {
  return {
    latest: list[0]?.id || null,
    entries: list.map(e => ({ ...e, kindRu: KIND_RU[e.kind] || '' })),
  };
}

export function mountNewsRoutes(app, { textRefs = null } = {}) {
  // Словарь подсказок: текст новостей меняется только с обновлением сайта, но база предметов после запуска
  // догружается не сразу — пересчитываем не чаще раза в 10 минут
  const cached = text => {
    let c = { at: 0, refs: null };
    return () => {
      if (!textRefs) return null;
      if (Date.now() - c.at > 600_000) {
        let refs = null;
        try { refs = textRefs(text); } catch { /* нет базы NEU — без подсказок */ }
        c = { at: Date.now(), refs };
      }
      return c.refs;
    };
  };
  const top = newsView().entries[0] || null;
  const allRefs = cached(plainNews(NEWS.flatMap(e => [e.title, ...e.items]).join('\n')));
  const topRefs = cached(top ? plainNews([top.title, ...top.items].join('\n')) : '');
  app.get('/api/news/latest', (req, res) => res.json({ latest: top?.id || null, ids: NEWS.map(e => e.id), top, refs: top ? topRefs() : null }));
  app.get('/api/news', (req, res) => res.json({ ...newsView(), refs: allRefs() }));
}
