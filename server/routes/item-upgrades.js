// GET /api/item/:id/upgrades — все экземпляры этого предмета у игрока и чек-лист улучшений для каждого.
// Если предмета у игрока нет — copies: [] (карточка тогда показывает, где его взять).
import { planItemUpgrades } from '../analysis/item-upgrades.js';
import { allStoredItems, itemValue, petValue } from '../parse/gear.js';

export function mountItemUpgradeRoutes(app, { getMember, neu, priceOf, petPriceOf, translateLoreLine, translateLore }) {
  app.get('/api/item/:id/upgrades', async (req, res) => {
    const member = await getMember(req);
    if (!member) return res.json({ copies: [] });
    const id = req.params.id;
    const ctx = { constants: neu.constants, getItem: x => neu.items.get(x) || null, priceOf, petPriceOf, member };
    const copies = [];
    if (/;\d$/.test(id)) {
      member.pets.filter(p => p.id === id).forEach((p, i) => {
        copies.push({
          uuid: p.uuid || `pet-${i}`, where: p.active ? 'активный питомец' : 'меню питомцев', name: `[Ур. ${p.level}] ${neu.items.get(id)?.name?.replace(/^\[Lvl \{LVL\}\] /, '') || p.type}`,
          rarity: p.tier, value: petValue(p), level: p.level, plan: planItemUpgrades({ ...p, isPet: true }, ctx),
        });
      });
    } else {
      const seen = new Set();
      for (const it of allStoredItems(member.inv || {})) {
        if (it.id !== id || (it.count || 1) > 1) continue;
        if (it.uuid && seen.has(it.uuid)) continue;
        if (it.uuid) seen.add(it.uuid);
        copies.push({
          uuid: it.uuid || `${it.where}-${copies.length}`, where: it.where, name: it.name, rawName: it.rawName, rarity: it.rarity, value: itemValue(it),
          // абзацами: многострочные описания переводятся словарём целиком, построчно они остаются на английском
          loreRu: translateLore ? translateLore(it.lore || []).lines : (it.lore || []).map(l => translateLoreLine(l)), plan: planItemUpgrades(it, ctx),
        });
      }
    }
    copies.sort((a, b) => b.value - a.value);
    res.json({ copies: copies.slice(0, 12) });
  });
}
