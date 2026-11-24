import { MuseumBadge } from '../components/MuseumBadge.jsx';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Card, Empty, Sparkline, Badge } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { McTooltipBox } from '../components/Tooltip.jsx';
import { coins, num, api, useApi, RARITY_COLOR, RARITY_RU, getRecent, pushRecent, variantLabel } from '../api.js';
import { useApp } from '../App.jsx';
import { UpgradePlan } from '../components/UpgradePlan.jsx';
import { ObtainGuide } from '../components/ObtainGuide.jsx';
import { RefsProvider, Rich } from '../guides/Rich.jsx';

// Мини-график цены Bazaar (библиотека графиков грузится только когда карточка товара Bazaar открыта)
const MiniChart = lazy(() => import('../components/chart/MiniChart.jsx'));

/** Закрыть карточку предмета и открыть товар на «Рынке» (полный биржевой график). */
export function openOnMarket(id) {
  const target = `#/market/${encodeURIComponent(id)}`;
  if (history.state?.item) { addEventListener('popstate', () => { location.hash = target; }, { once: true }); history.back(); }
  else location.hash = target;
}

// Понятная ошибка вместо «Ошибка 404»: что случилось и куда идти дальше
function ItemError({ id, error }) {
  const missing = /404/.test(error);
  const q = String(id).split(';')[0].toLowerCase().replace(/_/g, ' ');
  return (
    <Empty>
      {missing
        ? <>Такого предмета нет в базе: <code>{id}</code>. Возможно, его убрали из игры или переименовали.</>
        : /fetch|network|failed/i.test(error) ? 'Сервер трекера не отвечает. Карточка откроется, когда связь вернётся.' : `Не удалось открыть карточку: ${error}`}
      {missing && <div style={{ marginTop: 10 }}><a className="link" href={`#/wiki/${encodeURIComponent(q)}`}>Поискать похожие в вики →</a></div>}
    </Empty>
  );
}

export function ItemView({ id, uuid, onOpen }) {
  const { data, error } = useApi(`/item/${encodeURIComponent(id)}`, [id]);
  const { data: inv } = useApi('/inventory', [], { keep: true });
  // Свои экземпляры предмета: вместо «где взять» показываем, как прокачать до максимума
  const { data: up } = useApi(`/item/${encodeURIComponent(id)}/upgrades`, [id]);
  const [sel, setSel] = useState(uuid || null);
  useEffect(() => setSel(uuid || null), [id, uuid]);
  const copies = up?.copies || [];
  const copy = copies.find(c => c.uuid === sel) || copies[0] || null;
  const owned = whereOwned(inv, id);
  const open = onOpen;
  useEffect(() => { if (data) pushRecent(data); }, [data]);
  if (error) return <ItemError id={id} error={error} />;
  if (!data) return <div className="loader"><div className="spinner" /></div>;
  if (data.gui) return <GuiItemView data={data} />;
  const bz = data.prices.bazaar, bin = data.prices.bin;
  const hist = data.prices.history?.map(p => [p[0], p[2] || p[1]]) || data.prices.binHistory;
  const wiki = (data.info || []).filter(u => /^https?:/.test(u));
  return (
    <div className="item-view">
      <div className="item-view-head">
        <ItemIcon id={data.id} size={96} />
        <div>
          <h2 style={{ color: RARITY_COLOR[data.rarity] }}>{data.name}</h2>
          {data.ru?.nameRu && data.ru.nameRu !== data.name && <div className="name-ru">{data.ru.nameRu}</div>}
          <div className="muted">{[...new Set([RARITY_RU[data.rarity], data.ru?.typeRu || data.type, data.ru?.categoryRu].filter(Boolean))].join(' · ')} · <code>{data.id}</code></div>
          <div className="price-tags">
            {bz && <><Badge color="#4ade80">Купить: {coins(bz.buy)}</Badge><Badge color="#60a5fa">Продать: {coins(bz.sell)}</Badge></>}
            {bin && <Badge color="#f5c542">Аукцион: от {coins(bin.price)} ({bin.count} лотов)</Badge>}
            {data.npc && <Badge color="#aaa">NPC: {coins(data.npc)}</Badge>}
            {!bz && !bin && <span className="muted small">На рынке сейчас не продаётся</span>}
          </div>
          <MuseumBadge id={data.id} onOpen={open} />
          {owned.length > 0 && <div className="owned small">✔ У тебя: {owned.map(([p, n]) => `${p}${n > 1 ? ` ×${num(n)}` : ''}`).join(' · ')}</div>}
          {wiki.length > 0 && <div className="small">Вики: {wiki.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="link">{u.includes('fandom') ? 'Fandom' : 'hypixelskyblock.minecraft.wiki'}</a>).reduce((a, b) => [a, ' · ', b])}</div>}
        </div>
      </div>
      {data.ru?.descriptionRu && <p className="desc-ru">{data.ru.descriptionRu}</p>}
      <div className="item-view-body">
        <div>
          <h4 className="sub-h">{copy?.loreRu?.length ? 'Твой предмет (как в игре)' : 'Описание (характеристики на русском)'}</h4>
          {copy?.loreRu?.length ? <McTooltipBox name={copy.rawName || data.name} lore={copy.loreRu} /> : <McTooltipBox name={data.name} lore={data.loreRu} />}
        </div>
        <div>
          {copy && <>
            <h4 className="sub-h">Как улучшить до максимума</h4>
            <UpgradePlan copies={copies} sel={copy.uuid} setSel={setSel} open={open} />
          </>}
          <ObtainSection collapsed={!!copy}>
          <h4 className="sub-h">Как получить — пошагово</h4>
          <ObtainGuide id={data.id} open={open} fallbackText={data.crafttext}
            extra={(data.ru?.whereToGet || []).filter(w => (w.kind === 'other' || w.kind === 'shop') && !['BAZAAR', 'AUCTION', 'KAT_NPC', 'WIKI'].includes(w.source) && w.subkind !== 'kat' && w.subkind !== 'unknown')} />
          </ObtainSection>
          {bz ? <>
            <h4 className="sub-h">График цены на Bazaar</h4>
            <Suspense fallback={<div className="mc-stage" />}><MiniChart id={data.priceId || data.id} onOpenMarket={() => openOnMarket(data.priceId || data.id)} /></Suspense>
          </> : <>
            <h4 className="sub-h">История цены (14 дней)</h4>
            <Sparkline points={hist} color="#4ade80" format={coins} />
          </>}
          {data.usedIn?.length > 0 && (
            <>
              <h4 className="sub-h">Используется в крафтах</h4>
              <div className="item-row wrap">{data.usedIn.map(u => <ItemIcon key={u.id} id={u.id} size={38} slot onClick={() => open(u.id)} title={u.name} />)}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Служебный предмет интерфейса (меню SkyBlock): не вещь, а кнопка в 9-м слоте. Вместо «как улучшить»,
// цены и рецептов — короткая карточка-пасхалка по-русски.
function GuiItemView({ data }) {
  return (
    <div className="item-view gui-item">
      <div className="item-view-head">
        <ItemIcon id={data.id} size={96} />
        <div>
          <h2>{data.gui.nameRu}</h2>
          <div className="name-ru">{data.name.replace(/\s*\(Click\)$/, '')}</div>
          <div className="muted">Кнопка интерфейса · <code>{data.id}</code></div>
          <div className="owned small">✔ Прокачано на 100%</div>
        </div>
      </div>
      <RefsProvider refs={data.gui.refs}>
        <p className="desc-ru"><Rich text={data.gui.textRu} /></p>
      </RefsProvider>
      {data.loreRu?.length > 0 && <McTooltipBox name={`§a${data.gui.nameRu}`} lore={data.loreRu} />}
    </div>
  );
}

// Если предмет уже есть, «где взять» и рецепты сворачиваются: главное — как его улучшить
function ObtainSection({ collapsed, children }) {
  if (!collapsed) return children;
  return <details className="obtain-more"><summary className="sub-h">Как получить ещё один</summary>{children}</details>;
}

export function ItemModal({ id, uuid, onClose }) {
  // Стек просмотренных предметов: переходы по ингредиентам можно отменить кнопкой «Назад»
  const [stack, setStack] = useState([id]);
  useEffect(() => setStack([id]), [id]);
  const cur = stack[stack.length - 1];
  const setCur = next => next !== cur && setStack(s => [...s, next]);
  const back = () => setStack(s => s.slice(0, -1));
  // Фокус в карточку при открытии (Tab ходит по её содержимому), при закрытии — обратно, откуда открыли
  const box = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    box.current?.focus();
    return () => prev?.focus?.();
  }, []);
  // Tab и Shift+Tab ходят по кругу внутри карточки, а не уходят на страницу под ней
  useEffect(() => {
    const f = e => {
      if (e.key !== 'Tab' || !box.current) return;
      const els = [...box.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter(el => !el.disabled && el.offsetParent !== null);
      if (!els.length) { e.preventDefault(); box.current.focus(); return; }
      const first = els[0], last = els[els.length - 1];
      const inside = box.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, []);
  useEffect(() => { const f = e => e.key === 'Escape' && onClose(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" tabIndex={-1} ref={box} onClick={e => e.stopPropagation()}>
        <button className="x-btn modal-x" onClick={onClose} aria-label="Закрыть">×</button>
        {stack.length > 1 && <button className="modal-back" onClick={back}>← {stack.length > 2 ? `Назад (${stack.length - 1})` : 'Назад'}</button>}
        <ItemView id={cur} uuid={stack.length === 1 ? uuid : null} onOpen={setCur} />
      </div>
    </div>
  );
}

const PLACES = {
  inventory: 'инвентарь', armor: 'надето', equipment: 'экипировка', wardrobe: 'гардероб', enderChest: 'эндер-сундук',
  vault: 'личное хранилище', talismans: 'сумка аксессуаров', quiver: 'колчан', potions: 'сумка зелий', fishingBag: 'сумка рыбака',
};
// Где этот предмет лежит у игрока: «инвентарь ×1 · рюкзак 3 ×2 · мешки ×120»
export function whereOwned(inv, id) {
  if (!inv || !id) return [];
  const out = [];
  const count = list => (Array.isArray(list) ? list : []).reduce((n, it) => n + (it?.id === id ? it.count || 1 : 0), 0);
  for (const [k, label] of Object.entries(PLACES)) { const n = count(inv[k]); if (n) out.push([label, n]); }
  for (const [k, list] of Object.entries(inv.backpacks || {})) { const n = count(list); if (n) out.push([`рюкзак ${Number(k) + 1}`, n]); }
  if (inv.sacks?.[id]) out.push(['мешки', inv.sacks[id]]);
  return out;
}

// [запрос, предмет для иконки]
const EXAMPLES = [['гиперион', 'HYPERION'], ['терма', 'TERMINATOR'], ['рекомб', 'RECOMBOBULATOR_3000'], ['печенька', 'BOOSTER_COOKIE'], ['зачарованный алмаз', 'ENCHANTED_DIAMOND'], ['питомец дракон', 'DRAGON_EGG'], ['меч', 'ASPECT_OF_THE_END'], ['аксессуары', 'SPEED_TALISMAN'], ['fpb', 'FUMING_POTATO_BOOK']];

// Пустая вики: недавно открытые и примеры запросов, чтобы не гадать, что можно искать
// Пустой результат с подсказкой, что попробовать: отдельные слова запроса и пару примеров
function NotFound({ q, setQ }) {
  const words = q.trim().split(/\s+/).filter(w => w.length >= 3);
  return (
    <Empty>
      Ничего не нашлось по «{q}». Попробуй короче, по-английски или жаргоном игроков.
      <div className="chips" style={{ justifyContent: 'center', marginTop: 10 }}>
        {(words.length > 1 ? words : ['терма', 'аоте', 'fpb']).map(w => <button key={w} className="chip" onClick={() => setQ(w)}>{w}</button>)}
      </div>
    </Empty>
  );
}

function WikiStart({ setQ, openItem }) {
  const recent = getRecent();
  return (
    <div className="wiki-start">
      {recent.length > 0 && <>
        <h4 className="sub-h">Недавно открытые</h4>
        <div className="search-results">
          {recent.map(r => (
            <div key={r.id} className="search-item" onClick={() => openItem(r.id)}>
              <ItemIcon id={r.id} size={32} />
              <div className="grow" style={{ color: RARITY_COLOR[r.rarity] }}>{r.name || r.id}</div>
            </div>
          ))}
        </div>
      </>}
      <h4 className="sub-h">Попробуй найти</h4>
      <div className="chips">{EXAMPLES.map(([e, id]) => <button key={e} className="chip chip-ico" onClick={() => setQ(e)}><ItemIcon id={id} size={22} />{e}</button>)}</div>
      <p className="muted small">База: ~9 000 предметов на русском с рецептами, источниками, координатами NPC и ценами. Понимает транслит, жаргон и падежи. Искать можно с любой страницы: Ctrl+K.</p>
    </div>
  );
}

// На телефоне не открываем клавиатуру сама: она закрывает полэкрана, а человек мог прийти просто полистать
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const decode = s => { try { return decodeURIComponent(s || ''); } catch { return s || ''; } };

export default function Wiki() {
  const { openItem, sub } = useApp();
  const [q, setQ] = useState(() => decode(sub));
  // Запрос живёт в адресе (#/wiki/гиперион): ссылкой можно поделиться, «Назад» возвращает к поиску
  useEffect(() => { const s = decode(sub); if (s !== q) setQ(s); }, [sub]);
  useEffect(() => {
    const t = setTimeout(() => {
      const want = q.trim() ? `#/wiki/${encodeURIComponent(q.trim())}` : '#/wiki';
      if (location.hash !== want) history.replaceState(history.state, '', want);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);
  const [res, setRes] = useState([]);
  // пока идёт поиск, не показываем «Ничего не найдено» — оно мелькало после каждой буквы
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false); // нет связи — это не «ничего не нашлось»
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setSearching(q.length >= 2);
    const t = setTimeout(() => (q.length >= 2 ? api(`/search?q=${encodeURIComponent(q)}`).then(r => { if (alive) { setRes(r); setFailed(false); } }).catch(() => { if (alive) { setRes([]); setFailed(true); } }).finally(() => alive && setSearching(false)) : setRes([])), 200);
    return () => { alive = false; clearTimeout(t); };
  }, [q, retry]);
  return (
    <div className="grid">
      <Card className="span-12" title="Вики предметов">
        <input className="search big" autoFocus={!TOUCH} placeholder="Найди любой предмет по-русски или по-английски: гиперион, терма, аоте, меч, питомец дракон…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="search-results">
          {res.map(r => (
            <div key={r.id} className="search-item" onClick={() => openItem(r.id)}>
              <ItemIcon id={r.id} size={40} />
              <div className="grow"><div style={{ color: RARITY_COLOR[r.rarity] }}>{r.name}</div><div className="muted tiny">{[r.nameRu && r.nameRu !== r.name && r.nameRu !== `NPC ${r.name}` ? r.nameRu : '', RARITY_RU[r.rarity], r.type,
                // два предмета с одним названием и редкостью (Rift Necklace) различаем по ID
                res.some(x => x !== r && x.name === r.name && x.rarity === r.rarity) && variantLabel(r.id)].filter(Boolean).join(' · ')}</div></div>
              <div className="price">{r.price ? coins(r.price) : ''}</div>
            </div>
          ))}
          {q.length >= 2 && !res.length && (searching ? <div className="loader"><div className="spinner" /></div> : failed ? (
            <Empty>Нет связи с сервером, поиск не сработал. <button className="btn ghost" onClick={() => setRetry(x => x + 1)}>Ещё раз</button></Empty>
          ) : <NotFound q={q} setQ={setQ} />)}
          {q.length < 2 && <WikiStart setQ={setQ} openItem={openItem} />}
        </div>
      </Card>
    </div>
  );
}
