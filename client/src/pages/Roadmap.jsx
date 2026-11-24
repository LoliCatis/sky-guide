import { useState, useMemo, useEffect } from 'react';
import { Card, Empty, Badge, Tabs, Progress } from '../components/ui.jsx';
import { coins, useHashTab, saveLocal, useProfileStore } from '../api.js';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { useApp } from '../App.jsx';

const KEY = 'sb-roadmap-done';
const STATUS = { done: 'пройдено', current: 'сейчас', available: 'доступно', locked: 'закрыто' };

function ProgressMap({ map, goStep }) {
  if (!map?.branches?.length) return <Empty>Карта появится после загрузки профиля.</Empty>;
  return (
    <div className="pmap">
      <div className="pmap-overall">Общий прогресс по карте: <b>{Math.round((map.overall?.progress || 0) * 100)}%</b> <span className="muted small">({map.overall?.done}/{map.overall?.total} вех)</span><Progress value={map.overall?.progress || 0} /></div>
      <div className="pmap-legend"><span className="lg done">пройдено</span><span className="lg current">сейчас</span><span className="lg available">можно взять</span><span className="lg locked">закрыто</span></div>
      {map.branches.map((b, bi) => (
        <div key={b.id} className="branch" style={{ animationDelay: `${bi * 50}ms` }}>
          <div className="branch-head"><h4>{b.title}</h4><span className="muted small">{b.summary}</span><span className="branch-pct">{Math.round(b.progress * 100)}%</span></div>
          <div className="nodes">
            {b.nodes.map((n, i) => (
              <div key={n.id} className={`node ${n.status}`} onClick={() => n.stepId && goStep(n.stepId)} title={n.detail || ''}>
                {i > 0 && <span className="connector" />}
                <span className="node-dot" />
                <span className="node-title">{n.title}</span>
                <span className="node-status">{n.detail && n.status !== 'done' ? n.detail : n.detail || STATUS[n.status]}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PurchasePlan({ plan, onStep }) {
  if (!plan?.length) return <Empty>План покупок появится, когда загрузятся цены Bazaar и аукциона.</Empty>;
  return (
    <table className="table">
      <thead><tr><th>#</th><th>Что купить</th><th>Цена</th><th>Нарастающим итогом</th><th>Когда</th></tr></thead>
      <tbody>{plan.map((p, i) => (
        <tr key={p.stepId} className="clickable-row" onClick={() => onStep(p.stepId)} title="Открыть шаг плана: что именно и где взять">
          <td>{i + 1}</td><td>{p.title}</td><td>{coins(p.cost)}</td><td>{coins(p.cumulative)}</td>
          <td>{p.affordableNow ? <span className="green">хватает уже сейчас</span> : p.hoursOfFarming != null ? `~${Math.ceil(p.hoursOfFarming)} ч лучшего заработка` : 'нужно накопить'}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}


export default function Roadmap({ state, sub }) {
  const [view, setView] = useHashTab('roadmap', sub, ['steps', 'map', 'plan'], 'steps');
  const { openItem } = useApp();
  const [done, setDone] = useProfileStore(KEY, {}); // отметки «сделано» — свои у каждого профиля
  const [cat, setCat] = useState('all');
  const [hideDone, setHideDone] = useState(() => localStorage.getItem('sb-roadmap-hide-done') === '1');
  const [flash, setFlash] = useState(null);
  const steps = state.analysis?.roadmap || [];
  const cats = useMemo(() => {
    const n = new Map();
    for (const s of steps) n.set(s.cat, (n.get(s.cat) || 0) + (done[s.id] ? 0 : 1));
    return [...n];
  }, [steps, done]);
  const toggle = id => { const n = { ...done, [id]: !done[id] }; if (!n[id]) delete n[id]; setDone(n); };
  const setHide = v => { setHideDone(v); saveLocal('sb-roadmap-hide-done', v ? '1' : '0'); };
  const goStep = id => {
    setView('steps'); setCat('all');
    // Шаг отмечен сделанным и скрыт — показываем сделанные на этот раз (настройку не трогаем), иначе прокручивать некуда
    if (done[id]) setHideDone(false);
    setTimeout(() => { document.getElementById('step-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setFlash(id); setTimeout(() => setFlash(null), 1800); }, 80);
  };
  // Переход с главной: #/roadmap/<id шага> — прокрутить к шагу и подсветить его
  // #/roadmap/cat:<категория> — открыть шаги одной категории (ссылки со страницы «Прогресс»)
  useEffect(() => {
    if (!sub || ['steps', 'map', 'plan'].includes(sub) || !steps.length) return;
    const v = decodeURIComponent(sub);
    if (v.startsWith('cat:')) { setView('steps'); setCat(steps.some(s => s.cat === v.slice(4)) ? v.slice(4) : 'all'); }
    else goStep(v);
  }, [sub, steps.length]);
  if (!steps.length) return <Empty>Нет рекомендаций — профиль не загружен.</Empty>;
  const doneCount = steps.filter(s => done[s.id]).length;
  // Сделанные уходят в конец списка (или скрываются), чтобы сверху всегда было то, что делать дальше
  const shown = steps.filter(s => (cat === 'all' || s.cat === cat) && !(hideDone && done[s.id]))
    .sort((x, y) => (done[x.id] ? 1 : 0) - (done[y.id] ? 1 : 0));
  const a = state.analysis;
  return (
    <div className="grid">
      <Card className="span-12" title="Персональный план прогрессии" right={<Tabs value={view} onChange={setView} tabs={[{ id: 'steps', label: 'Шаги' }, { id: 'map', label: 'Карта прогрессии' }, { id: 'plan', label: 'План покупок' }]} />}>
        {a?.summary?.headline && <div className="plan-summary">🎯 {a.summary.headline}{a.summary.quickWins ? ` · быстрых побед: ${a.summary.quickWins}` : ''}</div>}
        {view === 'map' && <ProgressMap map={a?.map} goStep={goStep} />}
        {view === 'plan' && <PurchasePlan plan={a?.plan} onStep={goStep} />}
        {view === 'steps' && <div className="chips">
          <button className={cat === 'all' ? 'chip active' : 'chip'} onClick={() => setCat('all')}>Все ({steps.length - doneCount})</button>
          {cats.map(([c, n]) => <button key={c} className={cat === c ? 'chip active' : 'chip'} onClick={() => setCat(c)}>{c}{n ? ` (${n})` : ' ✓'}</button>)}
        </div>}
        {view === 'steps' && doneCount > 0 && (
          <div className="done-bar small">
            <span>Отмечено сделанным: <b>{doneCount}</b> из {steps.length}</span>
            <label className="check"><input type="checkbox" checked={hideDone} onChange={e => setHide(e.target.checked)} /> скрыть сделанные</label>
          </div>
        )}
      </Card>
      {view === 'steps' && <div className="span-12 roadmap">
        {shown.map((s, i) => (
          <div key={s.id} id={'step-' + s.id} className={`road-step stars-${Math.max(1, Math.round(s.priority / 20))} ${i === 0 && !done[s.id] ? 'top' : ''} ${done[s.id] ? 'done' : ''} ${flash === s.id ? 'flash' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
            <div className="road-line"><div className="road-dot" style={{ '--p': s.priority }} /></div>
            <div className="road-card card">
              <div className="road-head">
                <div>
                  <div className="step-cat">{s.cat} <Badge>{s.effort}</Badge> <span className="prio" title="Приоритет">{'★'.repeat(Math.max(1, Math.round(s.priority / 20)))}</span></div>
                  <h4>{s.title}</h4>
                </div>
                <label className="check"><input type="checkbox" checked={!!done[s.id]} onChange={() => toggle(s.id)} /> сделано</label>
              </div>
              <p className="why">{s.why}</p>
              {(() => {
                // «→ итог» не повторяем, если он слово в слово совпадает с началом объяснения
                const payoff = s.payoff && !String(s.why || '').toLowerCase().startsWith(String(s.payoff).toLowerCase().replace(/\.$/, '')) ? s.payoff : null;
                return (s.cost > 0 || payoff) && <div className="cost-line">{s.cost > 0 && <Badge color={s.needsSaving ? '#f87171' : '#f5c542'}>~{coins(s.cost)}{s.needsSaving ? ' · нужно накопить' : ''}</Badge>}{payoff && <span className="muted small">→ {payoff}</span>}</div>;
              })()}
              {s.how?.length > 0 && <ul className="how">{s.how.map((h, j) => <li key={j}>{h}</li>)}</ul>}
              {s.items?.length > 0 && (
                <div className="item-row">{s.items.map(id => <ItemIcon key={id} id={id} size={40} slot onClick={() => openItem(id)} title={s.itemNames?.[id] || id} />)}</div>
              )}
            </div>
          </div>
        ))}
        {!shown.length && <Empty>{hideDone ? 'Всё в этой категории отмечено сделанным.' : 'В этой категории нет шагов.'}</Empty>}
      </div>}
    </div>
  );
}
