import { useState } from 'react';
import { Card, Stat, Sparkline, Progress, Empty } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, itemValue, num, ago, saveLocal, me, prettyId, useProfileStore } from '../api.js';
import { useApp } from '../App.jsx';
import { pricesLoaded } from './Gear.jsx';
import PlayerModel from '../components/PlayerModel.jsx';
import LiveAdvisor from '../components/LiveAdvisor.jsx';
import { EventsStrip } from './Events.jsx';
import ShareCard from '../components/ShareCard.jsx';

const SKILL_ICON = { farming: 'golden_hoe', mining: 'stone_pickaxe', combat: 'stone_sword', foraging: 'jungle_sapling', fishing: 'fishing_rod', enchanting: 'enchanting_table', alchemy: 'brewing_stand', carpentry: 'crafting_table', runecrafting: 'magma_cream', taming: 'bone', social: 'emerald', hunting: 'lead' };
export { SKILL_ICON };

export default function Overview({ state }) {
  const m = state.member;
  const a = state.analysis;
  const { openItem } = useApp();
  const [share, setShare] = useState(false);
  const [doneMarks, setDoneMarks] = useProfileStore('sb-roadmap-done', {}); // свои у каждого профиля
  if (!m || !a) return <Empty>Профиль ещё не загружен.</Empty>;
  const nw = a.gear.networth;
  const nwHist = state.history.map(h => [h.t, h.nw]);
  // Шаги, отмеченные «сделано» на странице плана, на главной не показываем
  // «✓» прямо на главной: шаг уходит, на его место встаёт следующий — не нужно идти в план
  const markDone = (e, id) => {
    e.preventDefault(); e.stopPropagation();
    const n = { ...doneMarks, [id]: true };
    setDoneMarks(n);
  };
  const top = a.roadmap.filter(s => !doneMarks[s.id]).slice(0, 6);
  return (
    <div className="grid">
      <div className="hero card span-12">
        <PlayerModel uuid={m.uuid} className="hero-body" width={170} height={260} />
        <div className="hero-main">
          <div className="hero-level">
            <div className="lvl-ring" style={{ '--p': (m.sbLevel % 1) * 100 }}><span>{Math.floor(m.sbLevel)}</span></div>
            <div>
              <div className="muted small">Уровень SkyBlock</div>
              <div className="hero-title">{state.player.name} <span className="muted">на {m.profileName}</span></div>
              <div className="muted small">{Math.round((m.sbLevel % 1) * 100)}/100 опыта до {Math.floor(m.sbLevel) + 1} уровня</div>
            </div>
            <button className="btn ghost small share-btn" onClick={() => setShare(true)} title="Картинка с главными цифрами профиля, чтобы скинуть в Discord или ВК">Карточка для Discord</button>
          </div>
          <div className="stats-row">
            <Stat href="#/gear" title="Из чего складывается — на «Снаряжении»" label="Состояние" value={coins(nw.total)} sub={pricesLoaded(state) ? `оценка · предметы ${coins(nw.items)} · монеты ${coins(nw.coins)}` : `монеты ${coins(nw.coins)} · цены предметов ещё грузятся…`} accent="#f5c542" icon={<img src="/api/texture/gold_ingot" alt="" />} />
            <Stat href="#/accessories" title="Как поднять — на «Аксессуарах»" label="Magical Power" value={num(m.magicalPower)} sub={m.selectedPower ? `сила: ${prettyId(m.selectedPower)}` : 'сила не выбрана'} accent="#c879ff" icon={<img src="/api/texture/ender_eye" alt="" />} />
            <Stat href="#/skills" title="Классы и этажи — на «Прогрессе»" label="Catacombs" value={m.dungeons.catacombs.level} sub={`классы ~${m.dungeons.classAverage.toFixed(1).replace('.', ',')}`} accent="#ff5e5e" icon={<img src="/api/texture/bone" alt="" />} />
            <Stat href="#/skills" title="Все скиллы — на «Прогрессе»" label="Средний скилл" value={m.skillAverage.toFixed(1).replace('.', ',')} sub="9 основных скиллов" accent="#4ade80" icon={<img src="/api/texture/experience_bottle" alt="" />} />
            <Stat href="#/money" title="Как заработать — на «Заработке»" label="Банк" value={coins(m.bank)} sub={`кошелёк ${coins(m.purse)}`} accent="#60a5fa" icon={<img src="/api/texture/gold_block" alt="" />} />
          </div>
        </div>
      </div>

      {share && <ShareCard name={state.player.name} member={m} analysis={a} onClose={() => setShare(false)} />}
      <EventsStrip className="span-12" />

      {!me.guest && <LiveAdvisor className="span-12" />}

      <Card title="Что делать прямо сейчас" className="span-8" right={<a href="#/roadmap" className="link">весь план →</a>}>
        <div className="next-steps">
          {top.map((s, i) => (
            <a key={s.id} href={`#/roadmap/${encodeURIComponent(s.id)}`} className="next-step" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="step-num">{i + 1}</div>
              <div className="step-body">
                <div className="step-cat">{s.cat} · {s.effort}</div>
                <div className="step-title">{s.title}</div>
                <div className="muted small">{s.why}</div>
              </div>
              {s.items?.[0] && <ItemIcon id={s.items[0]} size={44} />}
              <button className="step-done" title="Отметить сделанным" aria-label="Отметить сделанным" onClick={e => markDone(e, s.id)}>✓</button>
            </a>
          ))}
        </div>
      </Card>

      <Card title="Живая лента" className="span-4">
        {state.feed.length ? (
          <ul className="feed">
            {state.feed.slice(0, 14).map((e, i) => <li key={i} className={`feed-${e.kind}`}><span>{e.text}</span><time>{ago(e.t)}</time></li>)}
          </ul>
        ) : (
          <div className="feed-empty">
            <div className="radar"><span /><span /><img src="/api/texture/ender_eye" alt="" /></div>
            <div>Слежу за профилем. Как только ты что-то сделаешь в игре, изменения появятся здесь.</div>
            <div className="muted tiny">Hypixel обновляет данные раз в 1–3 минуты</div>
          </div>
        )}
      </Card>

      <Card title="Скиллы" className="span-6" right={<a href="#/skills" className="link">подробнее →</a>}>
        <div className="skill-mini">
          {Object.entries(m.skills).filter(([k]) => k !== 'social').map(([k, s]) => (
            <div key={k} className="skill-mini-row">
              <img src={`/api/texture/${SKILL_ICON[k]}`} alt="" className={s.level >= s.maxLevel ? 'maxed' : ''} />
              <div className="grow"><Progress value={s.progress} max={s.level >= s.maxLevel} label={`${s.name} ${s.level}`} sub={s.level >= s.maxLevel ? (s.capMax ? `кап → ${s.capMax}` : 'МАКС') : `${Math.round(s.progress * 100)}%`} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Состояние за время отслеживания" className="span-6" right={<a href="#/skills/history" className="link">все графики →</a>}>
        <Sparkline points={nwHist} color="#f5c542" format={coins} />
        <div className="mini-stats">
          <div><span className="muted small">Самые ценные предметы</span></div>
          <div className="item-row">
            {a.gear.topItems.slice(0, 10).map((it, i) => (
              <div key={i} className="item-with-price" onClick={() => openItem(it.id, it.uuid)}>
                <ItemIcon item={it} size={42} slot />
                <span className="small" title={it.value > 0 ? '' : 'Цена неизвестна: нет на Bazaar/AH или аукцион ещё сканируется'}>{itemValue(it.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
