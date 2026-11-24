// Маленький SMTP-клиент без зависимостей: только отправка письма на свою почту (отзывы с сайта).
// Gmail: smtp.gmail.com, порт 465 (сразу TLS) или 587 (STARTTLS), вход — почта + пароль приложения.
import net from 'node:net';
import tls from 'node:tls';
import os from 'node:os';
import crypto from 'node:crypto';

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
// Тема и имена файлов не по-английски — кодируем по RFC 2047, иначе почта покажет кракозябры
const encWord = s => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const wrap76 = s => s.replace(/.{1,76}/g, '$&\r\n');
const cleanHeader = s => String(s || '').replace(/[\r\n]+/g, ' ').trim();

/**
 * Читает настройки почты из .env. null — почта не настроена (отзывы только сохраняются на сервере).
 * Два способа отправки:
 *  - SMTP (SMTP_USER + SMTP_PASS) — обычная почта, например Gmail;
 *  - Resend по HTTPS (RESEND_API_KEY) — когда хостинг закрыл серверу почтовые порты 465/587.
 * Если заданы оба, сначала Resend, при ошибке — SMTP. MAIL_TRANSPORT=smtp — только SMTP.
 */
export function smtpConfig(env = process.env) {
  const smtp = smtpOnly(env);
  const key = String(env.RESEND_API_KEY || '').trim();
  if (!key || (smtp && String(env.MAIL_TRANSPORT || '').trim() === 'smtp')) return smtp;
  const to = String(env.MAIL_TO || env.FEEDBACK_TO || env.SMTP_USER || '').trim();
  if (!to) return smtp;
  // Без своего домена Resend шлёт только с onboarding@resend.dev и только на почту, с которой зарегистрирован аккаунт
  const from = String(env.RESEND_FROM || '').trim() || 'onboarding@resend.dev';
  return { transport: 'resend', host: 'api.resend.com', key, to, from, smtp };
}

function smtpOnly(env) {
  const user = String(env.SMTP_USER || '').trim();
  const pass = String(env.SMTP_PASS || '').replace(/\s+/g, ''); // пароль приложения Google копируют с пробелами
  if (!user || !pass) return null;
  const host = String(env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(env.SMTP_PORT) || 465;
  const to = String(env.MAIL_TO || env.FEEDBACK_TO || user).trim();
  // Без шифрования — только для проверок на этом же компьютере (тесты)
  const plain = env.SMTP_INSECURE_LOCAL === '1' && /^(127\.0\.0\.1|localhost)$/.test(host);
  return { transport: 'smtp', host, port, user, pass, to, from: String(env.SMTP_FROM || user).trim(), secure: plain ? 'none' : port === 465 ? 'tls' : 'starttls' };
}

/** Собирает письмо: текст + (необязательно) вложения { name, type, data: Buffer } */
export function buildMessage({ from, to, subject, text, attachments = [], date = new Date() }) {
  const id = `<${crypto.randomUUID()}@skyblock-tracker>`;
  const head = [
    `From: ${encWord('SkyBlock трекер')} <${cleanHeader(from)}>`,
    `To: <${cleanHeader(to)}>`,
    `Subject: ${encWord(cleanHeader(subject))}`,
    `Date: ${date.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0',
  ];
  const body = wrap76(b64(text));
  if (!attachments.length) {
    return [...head, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', body].join('\r\n');
  }
  const bnd = `sb-${crypto.randomBytes(12).toString('hex')}`;
  const parts = [`--${bnd}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', body];
  for (const a of attachments) {
    const name = encWord(cleanHeader(a.name));
    parts.push(`--${bnd}`, `Content-Type: ${a.type}; name="${name}"`, 'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${name}"`, '', wrap76(a.data.toString('base64')));
  }
  parts.push(`--${bnd}--`, '');
  return [...head, `Content-Type: multipart/mixed; boundary="${bnd}"`, '', ...parts].join('\r\n');
}

/** Диалог с SMTP-сервером: ждём ответ с нужным кодом на каждую команду */
function session(socket, timeoutMs) {
  let buf = '', waiter = null, failed = null;
  const onData = d => { buf += d.toString('utf8'); check(); };
  const check = () => {
    if (!waiter) return;
    // Ответ закончен, когда пришла строка «код пробел …» (многострочные — «код-…»)
    // Последний кусок без \r\n — строка ещё не дошла целиком (TCP режет ответы как угодно): его не смотрим
    const lines = buf.split('\r\n');
    const end = lines.slice(0, -1).findIndex(l => /^\d{3} /.test(l) || /^\d{3}$/.test(l));
    if (end < 0) return;
    const reply = lines.slice(0, end + 1).join('\n');
    buf = lines.slice(end + 1).join('\r\n');
    const w = waiter; waiter = null; clearTimeout(w.t);
    w.resolve({ code: Number(reply.slice(0, 3)), text: reply });
  };
  const fail = e => { failed = e; if (waiter) { const w = waiter; waiter = null; clearTimeout(w.t); w.reject(e); } };
  const attach = s => { s.on('data', onData); s.on('error', fail); s.on('close', () => fail(new Error('Почтовый сервер закрыл соединение'))); };
  attach(socket);
  return {
    swap(s) { socket.removeListener('data', onData); attach(s); socket = s; },
    read() {
      if (failed) return Promise.reject(failed);
      return new Promise((resolve, reject) => {
        waiter = { resolve, reject, t: setTimeout(() => fail(new Error('Почтовый сервер не ответил вовремя')), timeoutMs) };
        check();
      });
    },
    async cmd(line, ok) {
      if (line != null) socket.write(line + '\r\n');
      const r = await this.read();
      if (!ok.includes(r.code)) {
        const e = new Error(r.code === 535 ? 'Почта не пустила: неверный логин или пароль приложения (SMTP_USER / SMTP_PASS)' : `Почтовый сервер ответил: ${r.text.slice(0, 200)}`);
        e.smtpCode = r.code; throw e;
      }
      return r;
    },
    end() { try { socket.end(); } catch { /* уже закрыто */ } },
  };
}

/** Отправляет письмо. cfg — из smtpConfig(); msg — { subject, text, attachments } */
export async function sendMail(cfg, msg, opts = {}) {
  if (cfg.transport !== 'resend') return smtpSend(cfg, msg, opts);
  try {
    await resendSend(cfg, msg, opts);
  } catch (e) {
    if (!cfg.smtp) throw e;
    try { await smtpSend(cfg.smtp, msg, opts); } catch (e2) { throw new Error(`${e.message}; запасная отправка по SMTP: ${e2.message}`); }
  }
}

/** Отправка через Resend (HTTPS, порт 443 — его хостинги не закрывают) */
async function resendSend(cfg, msg, { timeoutMs = 20_000, fetchImpl = fetch } = {}) {
  const body = {
    from: `${cleanHeader('SkyBlock трекер')} <${cleanHeader(cfg.from).replace(/^.*<|>.*$/g, '')}>`,
    to: [cleanHeader(cfg.to)],
    subject: cleanHeader(msg.subject),
    text: msg.text,
  };
  if (msg.attachments?.length) body.attachments = msg.attachments.map(a => ({ filename: cleanHeader(a.name), content: a.data.toString('base64') }));
  let r;
  try {
    r = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error(`Resend недоступен: ${String(e.message || e).slice(0, 120)}`);
  }
  if (r.ok) return;
  let detail = '';
  try { const j = await r.json(); detail = String(j.message || j.name || ''); } catch { /* не JSON */ }
  const e = new Error(r.status === 401 || r.status === 403
    ? `Resend не пустил (${r.status}): проверь RESEND_API_KEY и что MAIL_TO — та же почта, на которую зарегистрирован Resend. ${detail}`.trim()
    : `Resend ответил ${r.status}: ${detail}`.slice(0, 200));
  e.status = r.status;
  throw e;
}

async function smtpSend(cfg, msg, { timeoutMs = 20_000 } = {}) {
  const raw = buildMessage({ from: cfg.from, to: cfg.to, ...msg });
  const connect = () => new Promise((resolve, reject) => {
    const s = cfg.secure === 'tls'
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }, () => resolve(s))
      : net.connect({ host: cfg.host, port: cfg.port }, () => resolve(s));
    s.once('error', reject);
    s.setTimeout(timeoutMs, () => s.destroy(new Error('Почтовый сервер не ответил вовремя')));
  });
  const sock = await connect();
  const c = session(sock, timeoutMs);
  const me = os.hostname().replace(/[^A-Za-z0-9.-]/g, '') || 'localhost';
  try {
    await c.cmd(null, [220]);
    await c.cmd(`EHLO ${me}`, [250]);
    if (cfg.secure === 'starttls') {
      await c.cmd('STARTTLS', [220]);
      const secured = await new Promise((resolve, reject) => {
        const t = tls.connect({ socket: sock, servername: cfg.host }, () => resolve(t));
        t.once('error', reject);
      });
      c.swap(secured);
      await c.cmd(`EHLO ${me}`, [250]);
    }
    await c.cmd('AUTH LOGIN', [334]);
    await c.cmd(b64(cfg.user), [334]);
    await c.cmd(b64(cfg.pass), [235]);
    await c.cmd(`MAIL FROM:<${cleanHeader(cfg.from)}>`, [250]);
    await c.cmd(`RCPT TO:<${cleanHeader(cfg.to)}>`, [250, 251]);
    await c.cmd('DATA', [354]);
    // Строка из одной точки закончила бы письмо раньше времени — удваиваем точку в начале строк
    await c.cmd(raw.replace(/\r\n\./g, '\r\n..') + '\r\n.', [250]);
    await c.cmd('QUIT', [221]).catch(() => {});
  } finally {
    c.end();
  }
}
