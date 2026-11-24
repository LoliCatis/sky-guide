// Посещения, ошибки и почта на странице «Сервер» (только владелец). Данные — свой учёт сайта (server/monitor),
// без внешних счётчиков: IP не хранится, уникальные посетители считаются по хешу с солью, которая меняется каждые сутки.
import { useCallback, useEffect, useState } from 'react';
import { ago } from '../api.js';

const SECTIONS = {
  overview: 'Обзор', roadmap: 'Что делать', skills: 'Прогресс', gear: 'Снаряжение', accessories: 'Аксессуары', pets: 'Питомцы',
  museum: 'Музей', stash: 'Запасы', collections: 'Коллекции', minions: 'Миньоны', guides: 'Гайды', events: 'События',
  compare: 'Сравнение', top: 'Рейтинг', money: 'Заработок', market: 'Рынок', wiki: 'Вики', status: 'Сервер', item: 'Карточка предмета', other: 'Другое',
};
const PERIODS = [['today', 'Сегодня'], ['yesterday', 'Вчера'], ['week', '7 дней'], ['month', '30 дней']];
const KIND = { client: 'браузер', server: 'сервер', api: 'внешний API' };
const num = n => Number(n || 0).toLocaleString('ru-RU');
const sec = ms => (ms == null ? '—' : ms >= 10_000 ? 'дольше 7 с' : `до ${(ms / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} с`);
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

function Bars({ rows, total, label = k => k }) {
  if (!rows.length) return <p className="muted small">Пока пусто.</p>;
  const max = Math.max(...rows.map(r => r[1]));
  return (
    <ul className="mon-bars">
      {rows.map(([k, v]) => (
        <li key={k} title={total ? `${pct(v, total)}%` : undefined}>
          <span>{label(k)}</span><i style={{ width: `${Math.max(3, v / max * 100)}%` }} /><b>{num(v)}</b>
        </li>
      ))}
    </ul>
  );
}

/** Столбики по дням: посетители (высота) и дни с ошибками (красная точка) */
function Days({ days }) {
  const max = Math.max(1, ...days.map(d => d.visitors));
  return (
    <div className="mon-days" role="img" aria-label="Посетители по дням за 30 дней">
      {days.map(d => (
        <span key={d.day} title={`${d.day.split('-').reverse().join('.')}: посетителей ${d.visitors}, просмотров ${d.views}${d.errors ? `, ошибок ${d.errors}` : ''}`}>
          <i style={{ height: `${Math.max(2, d.visitors / max * 100)}%` }} />{d.errors > 0 && <em />}
        </span>
      ))}
    </div>
  );
}

export default function StatusMonitor() {
  const [m, setM] = useState(null);
  const [fail, setFail] = useState(false);
  const [period, setPeriod] = useState('today');
  const [mailMsg, setMailMsg] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => {
    if (document.hidden) return;
    fetch('/api/admin/monitor', { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(j => { setM(j); setFail(false); }).catch(() => setFail(true));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  if (!m) return <div className="card span-12">{fail ? 'Не удалось загрузить статистику' : <><div className="spinner" /> Загружаю статистику…</>}</div>;
  const s = m[period];
  const devTotal = s.devices.mobile + s.devices.desktop;

  const resolve = fp => fetch('/api/admin/monitor/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fp }) }).then(load);
  const testMail = () => {
    setMailMsg('Отправляю…');
    fetch('/api/admin/monitor/test-mail', { method: 'POST' }).then(r => r.json())
      .then(j => setMailMsg(j.ok ? 'Письмо ушло, проверь почту (и папку «Спам»).' : j.error || 'Не получилось отправить')).catch(() => setMailMsg('Сервер не ответил'));
  };

  return (
    <>
      <div className="card span-12">
        <div className="mon-head">
          <h3>Посещения</h3>
          <div className="tabs" role="tablist">
            {PERIODS.map(([k, l]) => <button key={k} className={period === k ? "active" : ""} role="tab" aria-selected={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
          </div>
        </div>
        <p className="muted small">Свой счётчик сайта: без cookie и сторонних сервисов, IP не сохраняется. Ты сам, боты и браузеры с «Не отслеживать» не считаются.</p>
        <div className="mon-stats">
          <div><b>{num(s.visitors)}</b><span>посетителей</span></div>
          <div><b>{num(s.views)}</b><span>просмотров разделов</span></div>
          <div><b>{pct(s.devices.mobile, devTotal)}%</b><span>с телефона</span></div>
          <div><b>{num(s.who.user)}</b><span>вошедших</span></div>
          <div title={`Половина посетителей дождалась загрузки быстрее этого. На телефоне: ${sec(s.load.mobile.p50)}`}><b>{sec(s.load.desktop.p50 ?? s.load.mobile.p50)}</b><span>загрузка у половины</span></div>
          <div><b>{num(s.nicks.distinct)}</b><span>разных ников</span></div>
        </div>
        <Days days={m.days} />
      </div>

      <div className="card span-6">
        <h3>Разделы</h3>
        <Bars rows={s.sections.slice(0, 12)} total={s.views} label={k => SECTIONS[k] || k} />
      </div>
      <div className="card span-6">
        <h3>Откуда пришли</h3>
        <Bars rows={s.refs} total={s.visitors} />
        <h3 style={{ marginTop: 18 }}>Скорость загрузки</h3>
        <div className="st-kv">
          <span title="Медиана и 75-й перцентиль: у половины и у трёх четвертей посетителей страница загрузилась быстрее">Компьютер (половина / ¾)</span><b>{sec(s.load.desktop.p50)} / {sec(s.load.desktop.p75)}</b>
          <span>Телефон (половина / ¾)</span><b>{sec(s.load.mobile.p50)} / {sec(s.load.mobile.p75)}</b>
        </div>
        <h3 style={{ marginTop: 18 }}>Какие ники открывают</h3>
        <p className="muted small">Твой профиль, кооп, друзья с аккаунтом и скрытые игроки сюда не попадают.</p>
        <Bars rows={s.nicks.top} />
      </div>

      <div className="card span-12">
        <div className="mon-head">
          <h3>Ошибки</h3>
          <span className="muted small">за выбранный период: браузер {num(s.errors.client)}, сервер {num(s.errors.server)}, сбои внешних API {num(s.errors.api)}, ответов с ошибкой 5xx {num(s.s5xx)}</span>
        </div>
        {m.errors.length ? (
          <ul className="mon-errs">
            {m.errors.map(g => (
              <li key={g.fp} className={g.last10m ? 'hot' : ''}>
                <button className="mon-err-top" onClick={() => setOpen(open === g.fp ? null : g.fp)} aria-expanded={open === g.fp}>
                  <span className={`mon-kind ${g.kind}`}>{KIND[g.kind] || g.kind}</span>
                  <span className="mon-err-msg">{g.msg}{g.where && <span className="muted"> · {g.where}</span>}</span>
                  <b>{num(g.count)}×</b>
                  <span className="muted">{ago(g.last)}</span>
                </button>
                {open === g.fp && (
                  <div className="mon-err-body small">
                    {g.where && <div><span className="muted">Где:</span> <code>{g.where}</code></div>}
                    {g.sections.length > 0 && <div><span className="muted">Раздел:</span> {g.sections.map(k => SECTIONS[k] || k).join(', ')}</div>}
                    <div className="muted">Впервые {ago(g.first)}{g.mobile ? ` · с телефона ${g.mobile} раз` : ''}{g.build ? ` · сборка ${g.build}` : ''}{g.last10m ? ` · за 10 минут ${g.last10m} раз` : ''}</div>
                    {g.stack && <pre>{g.stack}</pre>}
                    <button className="btn ghost small" onClick={() => resolve(g.fp)}>Исправлено — убрать из списка</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="muted small">Ошибок нет. Если появятся, здесь будет текст, место и сколько раз повторилась.</p>}
      </div>

      <div className="card span-12">
        <h3>Почта и тревоги</h3>
        <div className="st-kv">
          <span>Почта</span><b className={m.mail.configured ? 'pos' : 'neg'}>{m.mail.configured ? `шлёт на ${m.mail.to}` : 'не настроена'}</b>
          <span>Сводка за сутки</span><b>{m.mail.configured ? `каждый день в 9:00${m.mail.digestDay ? `, последняя ${m.mail.digestDay.split('-').reverse().join('.')}` : ''}` : '—'}</b>
        </div>
        {!m.mail.configured && <p className="muted small">Чтобы письма приходили, впиши в .env на сервере SMTP_USER (адрес Gmail) и SMTP_PASS (пароль приложения Google: myaccount.google.com → Безопасность → Пароли приложений). Без почты тревоги всё равно видны здесь.</p>}
        <p className="muted small">Сразу пишу, если: сервер упал или откатил обновление, ключ Hypixel перестал работать, Hypixel молчит больше 15 минут, новая ошибка повторилась 5 раз за 10 минут, сервер ответил ошибкой 20 раз за 10 минут, кончился дневной лимит ИИ-советчика. Одна и та же тревога — не чаще раза в 3 часа.</p>
        {m.mail.configured && <p><button className="btn ghost small" onClick={testMail}>Отправить проверочное письмо</button>{mailMsg && <span className="muted small" style={{ marginLeft: 10 }}>{mailMsg}</span>}</p>}
        {m.alerts.length > 0 && (
          <ul className="st-log">
            {m.alerts.map(a => (
              <li key={`${a.key}${a.at}`} className="crash">
                <b>{a.mailed ? 'Письмо ушло' : 'Без письма'}</b><span>{a.title}</span><span className="muted">{ago(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
