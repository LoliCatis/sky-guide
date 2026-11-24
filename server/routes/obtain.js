// GET /api/item/:id/obtain — пошагово, как получить предмет: NPC (где и почём), крафт с деревом
// ингредиентов и живыми ценами, кузница, Kat, дропы (моб, место, шанс, требования) и ссылка на вики.
// Требования проверяются по выбранному игроку (свой профиль или друг).
import { buildObtainGuide } from '../analysis/obtain.js';
import { collectionsFromNeu } from '../market/requirements.js';

/** Цена покупки сейчас: Bazaar (мгновенно и через заказ) или lowest BIN на аукционе */
export function makeBuy(prices) {
  return id => {
    const ids = [id];
    const m = /^([A-Z0-9_]+);(\d+)$/.exec(id);
    if (m) ids.push(`ENCHANTMENT_${m[1]}_${m[2]}`);
    for (const k of ids) {
      const bz = prices.bazaar?.get?.(k);
      if (bz && bz.buy > 0) return { price: bz.buy, order: bz.sell > 0 ? bz.sell : null, market: 'bazaar' };
    }
    for (const k of ids) {
      const b = prices.bin?.get?.(k);
      if (b && b.price > 0) return { price: b.price, count: b.count || null, market: 'ah' };
    }
    return null;
  };
}

export function mountObtainRoutes(app, { getMember, neu, prices, getCollections }) {
  app.get('/api/item/:id/obtain', async (req, res) => {
    let id = req.params.id;
    const bz = /^ENCHANTMENT_(.+)_(\d+)$/.exec(id);
    if (bz && !neu.items.has(id)) id = `${bz[1]};${bz[2]}`;
    if (!neu.items.has(id)) return res.status(404).json({ error: 'Предмет не найден' });
    const member = await getMember(req).catch(() => null);
    const guide = buildObtainGuide(id, {
      items: neu.items, constants: neu.constants, buy: makeBuy(prices), member,
      collections: getCollections() || collectionsFromNeu(neu.items),
    });
    res.json(guide);
  });
}
