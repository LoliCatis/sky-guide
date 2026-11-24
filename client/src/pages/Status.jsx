// Панель состояния сервера — только владельцу сайта: жив ли сервер, нагрузка, лимит Hypixel, обновления и откаты.
import { Fragment, useEffect, useState } from 'react';
import { ago, me } from '../api.js';
import StatusMonitor from './StatusMonitor.jsx';

const LOAD = { low: ['Спокойно', 'ok'], medium: ['Занят', 'mid'], high: ['Перегружен', 'bad'] };
const KIND = { update: 'Обновился', rollback: 'Откат', crash: 'Падение сервера' };

function dur(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  return d ? `${d} д ${h} ч` : h ? `${h} ч ${m} мин` : `${m} мин`;
}

function Meter({ label, value, max, unit = '', hint }) {
  const pct = Math.max(0, Math.min(100, max ? value / max * 100 : 0));
  const cls = pct > 85 ? 'bad' : pct > 55 ? 'mid' : 'ok';
  return (
    <div className="st-meter" title={hint}>
      <div className="st-meter-top"><span>{label}</span><b>{value}{unit}{max ? <span className="muted"> / {max}{unit}</span> : null}</b></div>
      <div className={`st-bar ${cls}`}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function useServerStatus(path = '/api/status', every = 30_000) {
  const [s, setS] = useState(null);
  const [down, setDown] = useState(false);
  useEffect(() => {
    let stop = false;
    const load = () => {
      if (document.hidden) return; // вкладка в фоне — не дёргаем сервер
      fetch(path, { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(j => { if (!stop) { setS(j); setDown(false); } })
        .catch(() => { if (!stop) setDown(true); });
    };
    load();
    const t = setInterval(load, every);
    document.addEventListener('visibilitychange', load);
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', load); };
  }, [path, every]);
  return { s, down };
}

const kb = b => b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`;

export default function Status() {
  const { s, down } = useServerStatus('/api/admin/status', 5000);
  if (!me.admin || me.guest) return <div className="card warn-card"><h3>Это страница владельца сайта</h3><p>Здесь видно состояние сервера. Игрокам она не нужна: нагрузку показывает лампочка вверху.</p></div>;
  if (!s) return <div className="card">{down ? 'Сервер не отвечает' : <><div className="spinner" /> Загружаю…</>}</div>;
  const [loadLabel, loadCls] = LOAD[s.load] || LOAD.low;
  const last = s.deploy.last;
  return (
    <div className="grid status-page">
      <div className="card span-12 st-hero">
        <span className={`st-light ${down ? "bad" : "ok"}`} />
        <div>
          <h2>{down ? 'Сервер не отвечает' : 'Сервер работает'}</h2>
          <div className="muted">Без перерыва {dur(s.uptimeSec)} · сборка {s.build} · Node {s.node.replace(/^v/, '')} · {s.platform}</div>
        </div>
        <span className={`st-chip ${loadCls}`} title={s.why}>Нагрузка: {loadLabel}</span>
      </div>

      <div className="card span-6">
        <h3>Нагрузка</h3>
        <p className="muted small">{s.why[0].toUpperCase() + s.why.slice(1)}. Обновляется раз в 5 секунд.</p>
        <Meter label="Запросы к Hypixel за 5 минут" value={s.hypixel.used5m} max={s.hypixel.limit5m} hint="Лимит ключа — 300 запросов за 5 минут. Ближе к пределу чужие профили обновляются реже" />
        <Meter label="CPU процесса" value={s.cpu.process} max={100} unit="%" hint={`Ядер: ${s.cpu.cores}. Средняя загрузка системы: ${s.cpu.loadavg.join(' / ')}`} />
        <div className="st-kv">
          <span>Запросов в работе</span><b>{s.requests.inFlight}</b>
          <span>Запросов за минуту</span><b>{s.requests.perMinute}</b>
          <span title="95-й перцентиль задержки цикла событий Node: чем больше, тем медленнее отвечает сайт">Задержка ответа</span><b>{s.requests.lagMs} мс</b>
        </div>
      </div>

      <MemoryCard m={s.memory} />
      <ApiCard api={s.api} />

      <div className="card span-6">
        <h3>Данные</h3>
        <div className="st-kv">
          <span>Свой профиль</span><b className={s.profile.status === 'ok' ? 'pos' : 'neg'}>{({ ok: 'обновляется', error: 'ошибка', loading: 'загружается', starting: 'запускается' })[s.profile.status] || s.profile.status || '—'}{s.profile.updatedAt ? ` · ${ago(s.profile.updatedAt)}` : ''}</b>
          <span>Цены Bazaar</span><b>{s.prices.bazaarAt ? ago(s.prices.bazaarAt) : 'ещё нет'}</b>
          <span>Цены аукциона</span><b>{s.prices.auctionsAt ? ago(s.prices.auctionsAt) : 'ещё нет'}</b>
          {s.history && <><span title="Графики на «Прогрессе»: последние 30 дней по часу, дальше по дню, после года по неделе">История графиков</span><b>{kb(s.history.ownBytes + s.history.friendBytes)} · {s.history.points} точек{s.history.friendFiles ? ` · друзей: ${s.history.friendFiles}` : ''}</b></>}
          {s.marketCharts && <><span title="Свечи Bazaar для «Рынка»: 1 минута за 3 суток, 5 минут за 30 суток, час за год, день — всё время">Графики рынка</span><b>{kb(s.marketCharts.bytes)} · товаров: {s.marketCharts.products}{s.marketCharts.errors ? ` · ошибок записи: ${s.marketCharts.errors}` : ''}</b></>}
        </div>
        {s.profile.error && <p className="neg small">Последняя ошибка: {s.profile.error}</p>}

        <h3 style={{ marginTop: 18 }}>Обновления сайта</h3>
        <p className="muted small">{s.deploy.autoUpdate ? 'Автообновление включено: раз в минуту сервер берёт свежий main.' : 'Автообновление выключено (AUTO_UPDATE=0).'}</p>
        {last?.kind === 'rollback' && <div className="card warn-card small"><b>Последнее обновление откатилось:</b> {last.why}. Сайт работает на {last.to}, новая версия встанет после исправления в main.</div>}
        {s.deploy.events.length ? (
          <ul className="st-log">
            {s.deploy.events.map((e, i) => (
              <li key={i} className={e.kind}>
                <b>{KIND[e.kind] || e.kind}</b>
                <span>{e.kind === 'update' ? `${e.from} → ${e.to}, файлов: ${e.files}` : e.kind === 'rollback' ? `${e.why}, вернул ${e.to}` : `код ${e.code}`}</span>
                <span className="muted">{ago(e.at)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">Пока не было: журнал ведёт скрипт автообновления (npm run share).</p>}
      </div>

      <StatusMonitor />
    </div>
  );
}

const num = n => Number(n || 0).toLocaleString('ru-RU');

/** Память: сколько занимает сам сайт и сколько весь ПК — это разные вещи, раньше 82% ПК читалось как память сайта */
function MemoryCard({ m }) {
  const used = Math.max(0, m.systemTotalMb - m.systemFreeMb);
  const pcPct = m.systemTotalMb ? Math.round(used / m.systemTotalMb * 100) : 0;
  const share = used ? Math.round(m.rssMb / used * 100) : 0;
  return (
    <div className="card span-6">
      <h3>Память</h3>
      <Meter label="Сайт" value={m.rssMb} max={m.systemTotalMb} unit=" МБ" hint="Сколько памяти занимает процесс сервера сайта" />
      <Meter label="Весь ПК, все программы" value={pcPct} max={100} unit="%" hint={`Занято ${num(used)} МБ из ${num(m.systemTotalMb)} МБ`} />
      <p className="muted small">Из {num(used)} МБ, занятых на ПК, на сайт приходится {share}%. Остальное — браузер, игра и другие программы.</p>
      <div className="st-kv">
        <span title="Объекты JavaScript: профили, анализ, цены, база предметов">Данные сервера</span><b>{num(m.heapMb)} МБ</b>
        <span title="Ответы API в обработке, картинки, файлы">Буферы и файлы</span><b>{num(m.buffersMb)} МБ</b>
        {(m.parts || []).map(p => <Fragment key={p.label}><span title={p.hint}>{p.label}</span><b>{num(p.count)} {p.unit}</b></Fragment>)}
      </div>
    </div>
  );
}

const KEY = {
  ok: ['работает', 'pos'],
  invalid: ['не принят', 'neg'],
  none: ['не задан в .env', 'neg'],
  unknown: ['ещё не проверялся', 'muted'],
};
const SRC = { ok: 'ok', error: 'bad', none: 'idle' };

/** Внешние сервисы: ключ Hypixel (сам ключ никогда не показываем), лимит, последние ответы и ошибки */
function ApiCard({ api }) {
  if (!api) return null;
  const [keyLabel, keyCls] = KEY[api.key.state] || KEY.unknown;
  const r = api.rate;
  const resetIn = r?.resetSec != null ? Math.max(0, Math.round(r.resetSec - (Date.now() - r.at) / 1000)) : null;
  return (
    <div className="card span-6">
      <h3>Внешние сервисы (API)</h3>
      <div className="st-kv">
        <span>Ключ Hypixel</span><b className={keyCls}>{keyLabel}</b>
        {api.key.type && <><span>Тип ключа</span><b>{api.key.type === 'dev' ? 'ключ разработчика' : 'ключ приложения'}</b></>}
        {api.key.since && <><span>Этот ключ работает</span><b>с {new Date(api.key.since).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</b></>}
        {r && <><span title="По заголовкам ответа Hypixel">Осталось запросов</span><b>{num(r.remaining)} / {num(r.limit)}{resetIn != null ? <span className="muted"> · сброс через {resetIn} с</span> : null}</b></>}
      </div>
      {api.key.error && <p className="neg small">Hypixel ответил: {api.key.error}. Выпусти новый ключ на developer.hypixel.net и впиши его в .env (HYPIXEL_API_KEY).</p>}
      {api.key.type === 'dev' && !api.key.error && <p className="muted small">Ключи разработчика Hypixel временные: когда ключ перестанет приниматься, здесь появится ошибка и подсказка.</p>}
      {api.sources.length ? (
        <ul className="st-api">
          {api.sources.map(x => (
            <li key={x.id} className={SRC[x.state]}>
              <i />
              <span className="st-api-name">{x.name}</span>
              <span className="muted">{x.lastMs != null ? `${num(x.lastMs)} мс` : ''}</span>
              <span className="muted">{x.lastOkAt ? ago(x.lastOkAt) : 'ещё не отвечал'}</span>
              {x.state === 'error' && <span className="st-api-err neg">Ошибка {ago(x.lastErrAt)}: {x.lastError}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="muted small">Запросов наружу ещё не было.</p>}
    </div>
  );
}

/** Лампочка для всех: показывает текст, только когда сервер занят */
export function LoadDot() {
  const { s, down } = useServerStatus();
  if (!s || down) return null; // «нет связи» уже показывает LiveDot
  const [label, cls] = LOAD[s.load] || LOAD.low;
  const title = s.load === 'low' ? 'Сервер не загружен — всё обновляется как обычно' : `Сервер ${label.toLowerCase()}: ${s.why}. Данные могут обновляться медленнее`;
  return (
    <span className={`load-dot ${cls}`} title={title} aria-label={title}>
      <i />{s.load !== 'low' && <span>{s.load === 'high' ? 'Высокая нагрузка' : 'Нагрузка'}</span>}
    </span>
  );
}
