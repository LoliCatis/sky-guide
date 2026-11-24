import { useState } from 'react';
import { ItemIcon } from './ItemIcon.jsx';
import { Progress } from './ui.jsx';
import { coins, RARITY_COLOR } from '../api.js';
import { Rich } from '../guides/Rich.jsx';

const KIND_RU = { weapon: 'оружие', armor: 'броня', equipment: 'экипировка', accessory: 'аксессуар', tool: 'инструмент', pet: 'питомец', other: 'предмет' };

function Step({ s, open }) {
  return (
    <li className={`upg-step${s.locked ? ' locked' : ''}`}>
      <span className="upg-num">{s.order}</span>
      <div className="grow">
        <div className="upg-title"><Rich text={s.title} /></div>
        <div className="muted tiny">
          сейчас: {s.current}
          {s.locked ? ` · ${s.locked}` : ''}
          {s.why ? <> · <Rich text={s.why} /></> : ''}
        </div>
        {s.note && <div className="muted tiny"><Rich text={s.note} /></div>}
      </div>
      <div className="upg-parts">
        {(s.parts || []).filter(p => p.id).slice(0, 3).map(p => (
          <span key={p.id} className="upg-part" title={`${p.id}${p.price ? ` · ${coins(p.price)} за шт.` : ''}`}>
            <ItemIcon id={p.id} size={24} onClick={() => open?.(p.id)} />
            {p.count > 1 && <span className="tiny">×{p.count >= 1000 ? `${Math.round(p.count / 100) / 10}k` : p.count}</span>}
          </span>
        ))}
      </div>
      <div className="upg-cost">{s.cost == null ? <span className="muted small" title="Сейчас нет на Bazaar и аукционе">нет цены</span> : s.cost === 0 ? <span className="small">бесплатно</span> : <>{s.approx ? '≈ ' : ''}{coins(s.cost)}</>}</div>
    </li>
  );
}

/** Чек-лист улучшений своего предмета: по порядку выгоды, с ценами */
export function UpgradePlan({ copies, sel, setSel, open }) {
  const [showDone, setShowDone] = useState(false);
  const [all, setAll] = useState(false);
  const copy = copies.find(c => c.uuid === sel) || copies[0];
  const p = copy.plan;
  return (
    <div className="upg">
      {copies.length > 1 && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {copies.map(c => (
            <button key={c.uuid} className={`chip${c === copy ? ' active' : ''}`} onClick={() => setSel(c.uuid)} title={c.name}>
              {c.where}{c.value ? ` · ${coins(c.value)}` : ''}
            </button>
          ))}
        </div>
      )}
      <div className="upg-head">
        <Progress value={p.score / 100} max={p.score >= 100} label={`Прокачано на ${p.score}%`} sub={[KIND_RU[p.kind], p.roleRu && `роль: ${p.roleRu}`].filter(Boolean).join(' · ')} />
        <div className="upg-sum small">
          {p.todo.length
            ? <>До максимума: <b style={{ color: 'var(--gold)' }}>{coins(p.missingCost)}</b>{p.unpriced ? <span className="muted"> + {p.unpriced} шаг(ов) без цены</span> : null}</>
            : <b style={{ color: 'var(--green)' }}>Всё на максимуме ✓</b>}
        </div>
      </div>
      {p.todo.length > 0 && <ol className="upg-list">{(all ? p.todo : p.todo.slice(0, 10)).map(s => <Step key={s.key} s={s} open={open} />)}</ol>}
      {p.todo.length > 10 && <button className="link small upg-more" onClick={() => setAll(v => !v)}>{all ? 'Свернуть' : `Показать все шаги (ещё ${p.todo.length - 10})`}</button>}
      {p.done.length > 0 && (
        <div className="upg-done">
          <button className="link small" onClick={() => setShowDone(v => !v)}>{showDone ? '▾' : '▸'} Уже сделано: {p.done.length}</button>
          {showDone && <div className="chips" style={{ marginTop: 6 }}>{p.done.map(s => <span key={s.key} className="chip done" title={s.current}>✓ {s.title}</span>)}</div>}
        </div>
      )}
      <p className="muted tiny" style={{ marginTop: 8 }}>
        Порядок — по выгоде: сначала то, что даёт больше силы за меньшие деньги. Цены — Bazaar и самые дешёвые лоты аукциона прямо сейчас.
        «Максимум» — мета-сборка для роли, а не всё подряд: например, Knockback на меч не советуется.
      </p>
    </div>
  );
}

export const copyColor = c => RARITY_COLOR[c?.rarity] || undefined;
