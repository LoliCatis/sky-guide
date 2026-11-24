// «Живой советчик»: карточка на главной (совет от ИИ по последним изменениям) и чат, который открывается
// кнопкой в углу на любой странице (ChatDock). Предметы в ответах — кнопки, открывают карточку предмета.
import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Badge } from './ui.jsx';
import { ago, viewHeaders, useView, viewKey, me } from '../api.js';
import Markdown, { fixStars } from './Markdown.jsx';
import { RefsProvider } from '../guides/Rich.jsx';
import { useApp } from '../App.jsx';

const usd = v => `$${(v || 0).toFixed(v && v < 0.01 ? 4 : 2)}`;

async function call(path, body) {
  if (me.guest) throw new Error('Советчик доступен после входа');
  const r = await fetch(`/api/live${path}`, body === undefined ? { headers: viewHeaders() } : { method: 'POST', headers: { 'Content-Type': 'application/json', ...viewHeaders() }, body: JSON.stringify(body) });
  if (r.status === 401) { location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`; throw new Error('Нужен вход'); }
  const j = await r.json().catch(() => ({}));
  if (j.mustChange) { location.href = '/account?must=1'; throw new Error(j.error); }
  if (!r.ok) throw new Error(j.error || `Ошибка ${r.status}`);
  return j;
}

// Что сейчас смотрит советчик: показываем человеку вместо молчаливого «…»
const TOOL_RU = {
  get_gear: 'смотрю снаряжение', compare_weapons: 'сравниваю оружие', find_items: 'ищу по хранилищам', get_pets: 'смотрю питомцев',
  get_accessories: 'смотрю аксессуары', get_item: 'смотрю предмет', get_price: 'смотрю цену', get_steps: 'смотрю план', get_money_methods: 'смотрю заработок',
};

/** Вопрос с потоковым ответом: onEvent получает { type: 'text' | 'tool' }, возвращает итоговую запись чата */
async function askStream(body, onEvent) {
  const r = await fetch('/api/live/ask', { method: 'POST', headers: { 'Content-Type': 'application/json', ...viewHeaders() }, body: JSON.stringify({ ...body, stream: true }) });
  if (r.status === 401) { location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`; throw new Error('Нужен вход'); }
  if (!r.ok || !r.body || !String(r.headers.get('Content-Type')).includes('event-stream')) {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Ошибка ${r.status}`);
    return j;
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i).replace(/^data: /, '');
      buf = buf.slice(i + 2);
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.type === 'done') return ev.entry;
      if (ev.type === 'error') throw new Error(ev.error);
      onEvent(ev);
    }
  }
  throw new Error('Соединение оборвалось, ответ появится в чате, когда будет готов');
}

// Открыть чат из любого места сайта: openChat() или openChat('вопрос')
export const openChat = (q = '') => dispatchEvent(new CustomEvent('sb-chat', { detail: { q } }));

const SUGGEST = ['Что мне качать дальше?', 'На что копить деньги?', 'Как заработать больше в час?', 'Что улучшить в снаряжении?'];

/** Состояние советчика и отправка вопросов — общее для карточки на главной и для чата в углу */
function useAdvisor({ listen = true } = {}) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState(null); // ответ, который ещё печатается: { q, text, tool }
  const sending = useRef(false); // два быстрых Enter подряд не отправляют вопрос дважды
  // Открыт чужой профиль: и вопросы в чате, и совет — про него, по его данным
  const view = useView();
  const app = useApp();
  const friend = view ? (app?.state?.player?.name || view.player) : null;
  // Друг, вошедший под своим ником, на своём профиле: его вопросы помечены его же ником
  const subject = friend || (me.admin ? null : me.name);
  const mine = c => (subject ? (c.who || '').split(' (')[0].toLowerCase() === subject.toLowerCase() : !c.who);

  const vk = viewKey(view);
  const load = useCallback(() => call('/state').then(setS).catch(() => {}), [vk]);
  useEffect(() => {
    setS(null); // совет прошлого профиля не показываем ни секунды
    load();
    if (!listen) return undefined;
    const es = new EventSource('/api/stream');
    es.addEventListener('live', load);
    return () => es.close();
  }, [load, listen]);

  const run = async (kind, fn) => {
    setBusy(kind); setErr('');
    try { await fn(); await load(); } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  /** Отправить вопрос; при ошибке вернёт его в поле через onFail */
  const [failed, setFailed] = useState(null); // вопрос, на который ответа не вышло: кнопка «Повторить»
  const ask = (question, deep, onFail) => !busy && !sending.current && question.trim() && run(deep ? 'deep' : 'ask', async () => {
    sending.current = true;
    setFailed(null);
    setDraft({ q: question, text: '', tool: '' });
    try {
      await askStream({ question, deep }, ev => setDraft(d => d && (ev.type === 'tool'
        ? { ...d, text: '', tool: TOOL_RU[ev.name] || ev.name } // текст до инструмента — черновик, итог придёт после
        : { ...d, text: d.text + ev.text, tool: '' })));
    } catch (e) { onFail?.(question); setFailed({ q: question, deep }); throw e; }
    finally { setDraft(null); sending.current = false; }
  });
  const clear = () => run('clear', () => call('/chat/clear', {}));
  const chat = (s?.chat || []).filter(mine);
  const live = s?.mode === 'live';
  const offText = s?.mode === 'off' ? 'Чат с советчиком сейчас выключен владельцем сайта.' : 'Чат с советчиком на этом сайте пока не подключён.';
  return { s, load, run, ask, clear, busy, err, draft, chat, live, friend, subject, offText, failed, openItem: app?.openItem };
}

function Budget({ s }) {
  if (s.mode === 'free') return <>{s.friend ? 'не подключён' : 'без ИИ: добавь ANTHROPIC_API_KEY в .env'}</>;
  if (s.mode === 'off') return <>выключен</>;
  // Другу не показываем доллары: только сколько вопросов осталось (0, если общий бюджет на день кончился)
  if (s.friend && s.questions) return <>вопросов сегодня: {s.budget.leftUsd > 0 ? s.questions.left : 0} из {s.questions.limit}</>;
  if (s.friend) return <>{s.budget.leftUsd > 0 ? 'можно спрашивать' : 'на сегодня вопросы кончились'}</>;
  return <>сегодня {usd(s.budget.today.usd)} из {usd(s.budget.dailyUsd)} · за месяц {usd(s.budget.monthUsd)}</>;
}

/** Переписка: вопросы справа, ответы слева; длинный ответ свёрнут */
function ChatThread({ adv }) {
  const end = useRef(null);
  // Прокручиваем только сам чат, а не всю страницу
  useEffect(() => { const box = end.current?.parentElement; if (box) box.scrollTop = box.scrollHeight; }, [adv.chat.length, adv.subject, adv.draft?.text, adv.draft?.tool]);
  return (
    <div className="cd-thread">
      {adv.chat.map((c, i) => (
        <div key={c.at + '-' + i} className="cd-pair">
          <div className="cd-q">{c.q}</div>
          <div className="cd-a">
            {/* NPC, мобы, места и механики — пунктиром, с подсказкой, как в гайдах */}
            <RefsProvider refs={c.refs}><Markdown text={c.a} onItem={adv.openItem} collapse={i === adv.chat.length - 1 ? 0 : 4} /></RefsProvider>
            <div className="cd-meta">{c.model?.includes('sonnet') ? <Badge>подробно</Badge> : null} {usd(c.usd)}{c.ms ? ` · ${(c.ms / 1000).toFixed(1)} с` : ''}{c.tools?.length ? ` · смотрел: ${c.tools.map(t => TOOL_RU[t]?.replace(/^смотрю /, '') || t).join(', ')}` : ''}</div>
          </div>
        </div>
      ))}
      {adv.draft && (
        <div className="cd-pair">
          <div className="cd-q">{adv.draft.q}</div>
          <div className="cd-a">
            {adv.draft.text ? <Markdown text={adv.draft.text} /> : <div className="la-typing muted small"><span className="la-dots"><i /><i /><i /></span>{adv.draft.tool ? `${adv.draft.tool}…` : 'думаю…'}</div>}
          </div>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

/** Кнопка в углу и окно чата поверх любой страницы. На телефоне окно на весь экран. */
// Гостю советчик недоступен (/api/live только после входа): не дёргаем его вовсе, иначе 401 уводит гостя на страницу входа
export function ChatDock() {
  return me.guest ? null : <ChatDockInner />;
}

function ChatDockInner() {
  const [open, setOpen] = useState(false);
  const adv = useAdvisor({ listen: open });
  const [q, setQ] = useState('');
  const input = useRef(null);
  useEffect(() => {
    const f = e => { setOpen(true); if (e.detail?.q) setQ(e.detail.q); setTimeout(() => input.current?.focus(), 50); };
    addEventListener('sb-chat', f);
    return () => removeEventListener('sb-chat', f);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    adv.load();
    const k = e => { if (e.key === 'Escape' && !document.querySelector('.modal-bg, .gref-tip.pinned')) setOpen(false); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = adv.s;
  // Нет ИИ и нет переписки — кнопку не показываем (на главной об этом говорит строка советчика)
  if (!s || (!adv.live && !adv.chat.length)) return null;
  const send = (text, deep = false) => { const v = (text ?? q).trim(); if (!v) return; setQ(''); adv.ask(v, deep, setQ); };
  return (
    <>
      {!open && (
        <button type="button" className="chat-fab" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 50); }} title="Спросить советчика про профиль" aria-label="Открыть чат с советчиком">
          <span aria-hidden="true">🧠</span><span className="chat-fab-text">Советчик</span>
        </button>
      )}
      {open && (
        <section className="chat-dock" role="dialog" aria-label="Чат с советчиком">
          <header className="cd-head">
            <div>
              <b>🧠 Советчик</b>
              <div className="cd-sub">{adv.friend ? <>про профиль <b>{adv.friend}</b> · </> : null}<Budget s={s} /></div>
            </div>
            {adv.chat.length > 0 && <button type="button" className="cd-icon" onClick={adv.clear} disabled={!!adv.busy} title="Очистить переписку">🗑</button>}
            <button type="button" className="cd-icon" onClick={() => setOpen(false)} title="Свернуть (Esc)" aria-label="Закрыть чат">✕</button>
          </header>
          {adv.chat.length || adv.draft ? <ChatThread adv={adv} /> : (
            <div className="cd-empty">
              <p className="muted small">Спроси про {adv.friend ? 'этот' : 'свой'} профиль: советчик видит скиллы, снаряжение, питомцев, хранилища и цены рынка. Предметы в ответе можно открыть кликом.</p>
              <div className="cd-suggest">
                {SUGGEST.map(t => <button key={t} type="button" className="chip" disabled={!adv.live || !!adv.busy} onClick={() => send(t)}>{t}</button>)}
              </div>
            </div>
          )}
          {(adv.err || s.error) && (
            <p className="la-warn cd-err">
              {adv.err || s.error}
              {adv.err && adv.failed && <button type="button" className="btn ghost sm cd-retry" disabled={!!adv.busy || !adv.live} onClick={() => { setQ(''); adv.ask(adv.failed.q, adv.failed.deep, setQ); }}>↻ Повторить</button>}
            </p>
          )}
          <div className="cd-input">
            <textarea ref={input} value={q} onChange={e => setQ(e.target.value)} rows={1} disabled={!adv.live} maxLength={500}
              placeholder={adv.live ? (adv.friend ? `Вопрос про ${adv.friend}…` : 'Твой вопрос…') : adv.offText}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button type="button" className="btn ghost cd-deep" disabled={!!adv.busy || !adv.live || !q.trim()} onClick={() => send(undefined, true)} title="Ответ модели посильнее (Claude Sonnet 5.5), примерно $0,03">Подробно</button>
            <button type="button" className="btn cd-send" disabled={!!adv.busy || !adv.live || !q.trim()} onClick={() => send()} aria-label="Отправить">{adv.busy === 'ask' || adv.busy === 'deep' ? '…' : '↑'}</button>
          </div>
        </section>
      )}
    </>
  );
}

/** Карточка на главной: автосовет. Сам чат — в окне по кнопке, чтобы не растягивать страницу. */
export default function LiveAdvisor({ className = 'span-12' }) {
  const adv = useAdvisor();
  const app = useApp();
  const { s, live, friend, chat, busy } = adv;
  if (!s) return null;
  const a = s.advice;
  const coop = (app?.state?.member?.coopMembers || 1) > 1;

  // Без ключа ИИ и без накопленных советов/чата — одна строка вместо большого пустого блока,
  // чтобы «Что делать прямо сейчас» было видно сразу. Другу не пишем про .env: настроить советчика может только владелец
  if (!live && !a && !chat.length) {
    return (
      <div className={`la-compact muted small ${className}`}>
        {s.friend
          ? <>🧠 {adv.offText} Подсказки «Что делать» и гайды работают и без него.</>
          : <>🧠 Живой советчик {s.mode === 'off' ? 'выключен' : 'без ИИ'}: чтобы получать советы по изменениям и задавать вопросы, добавь <code>ANTHROPIC_API_KEY</code> в <code>.env</code> (см. README).</>}
      </div>
    );
  }

  const last = chat[chat.length - 1];
  const askBtn = <button type="button" className="btn" disabled={!live && !chat.length} onClick={() => openChat()}>💬 {chat.length ? `Открыть чат (${chat.length})` : 'Задать вопрос'}</button>;
  return (
    <Card title="Живой советчик" icon="🧠" right={<span className="muted small"><Budget s={s} /></span>} className={`live-advisor ${className}`}>
      {friend && (
        <p className="la-friend small">
          Сейчас открыт профиль <b>{friend}</b>{s.coopMate ? ' (сосед по коопу)' : ''}: совет и вопросы в чате — про него, по его скиллам, снаряжению и кошельку.
          {coop && ' Bank, Garden, миньоны и коллекции на кооп-острове общие, советчик это учитывает.'}
          {!s.friend && ' Лимит на день общий с твоим.'}
        </p>
      )}
      {!friend && coop && <p className="la-friend small">Bank, Garden, миньоны и коллекции на кооп-острове общие с соседями: советы с тратами из банка это учитывают.</p>}
      {!a && s.busy ? (
        <p className="muted"><span className="spinner sm" /> Советчик разбирает профиль{s.adviceFor ? ` ${s.adviceFor.split(' (')[0]}` : ''}…</p>
      ) : !a && s.friend && !s.adviceFor ? (
        <p className="muted">Спроси советчика про свой профиль: что качать, на что копить, где взять предмет. Чат открывается кнопкой 🧠 в углу на любой странице.</p>
      ) : a ? (
        <div className="la-advice">
          <div className="la-headline">{fixStars(a.headline)}</div>
          <p className="muted">{fixStars(a.changes)} <span className="tiny">· {ago(a.at)} · {usd(a.usd)}</span></p>
          <ol className="la-now">
            {a.now.map((n, i) => (
              <li key={i}>
                <b>{fixStars(n.title)}</b>
                <div>{fixStars(n.why)}</div>
                {n.how?.length > 0 && <ul>{n.how.map((h, j) => <li key={j}>{fixStars(h)}</li>)}</ul>}
              </li>
            ))}
          </ol>
          {a.money && <p className="la-money">💰 {fixStars(a.money)}</p>}
          {a.warnings?.map((w, i) => <p key={i} className="la-warn">⚠ {fixStars(w)}</p>)}
        </div>
      ) : (
        <p className="muted">{!live ? 'Советы ИИ выключены. Шаги от движка правил — в блоке «Что делать прямо сейчас».'
          : s.adviceFor ? `Совета по ${s.adviceFor.split(' (')[0]} пока нет${s.autoNote && s.autoNote !== 'недавно пробовали' ? `: ${s.autoNote}` : ''}. Нажми «Обновить совет».`
          : 'Первый совет появится после загрузки профиля.'}</p>
      )}

      {last && <p className="la-last small"><span className="muted">Последний вопрос:</span> {last.q}</p>}
      <div className="la-bar">
        {!s.friend && s.pending && <span className="muted small">Сторож: {s.pending.reason}{s.pending.events?.length ? `. Замечено: ${s.pending.events.slice(0, 3).join('; ')}` : ''}</span>}
        <div className="row-gap">
          {askBtn}
          {(!s.friend || s.adviceFor) && <button className="btn ghost" disabled={!!busy || !live || s.busy} onClick={() => adv.run('refresh', () => call('/refresh', {}))}>{busy === 'refresh' || s.busy ? 'Думаю…' : 'Обновить совет'}</button>}
        </div>
      </div>
      {(adv.err || s.error) && <p className="la-warn">{adv.err || s.error}</p>}
    </Card>
  );
}
