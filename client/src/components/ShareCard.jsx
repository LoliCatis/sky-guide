// Карточка профиля для Discord/ВК: картинка 1200×630 рисуется прямо в браузере (canvas),
// её можно скачать PNG или скопировать в буфер и вставить в чат.
import { useEffect, useRef, useState } from 'react';
import { coins, num, prettyId } from '../api.js';

const W = 1200, H = 630;
const fx = v => (Number(v) || 0).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const FONT = '"Rubik Variable", "Inter Variable", system-ui, sans-serif';

function loadImg(src) {
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Нарисовать карточку. Возвращает Promise, когда аватар и шрифты готовы */
export async function drawShareCard(canvas, { name, member: m, analysis: a }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  try { await document.fonts?.ready; } catch { /* шрифты не важны */ }
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1b1440'); g.addColorStop(0.55, '#121a33'); g.addColorStop(1, '#0b2a2e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Мягкие пятна света, как на сайте
  for (const [x, y, r, c] of [[160, 90, 380, 'rgba(124,92,255,.35)'], [1080, 560, 420, 'rgba(45,212,191,.22)']]) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }

  const head = await loadImg(`/api/head/${m.uuid}?size=128`);
  ctx.save(); roundRect(ctx, 56, 52, 150, 150, 22); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill(); ctx.clip();
  if (head) { ctx.imageSmoothingEnabled = false; ctx.drawImage(head, 56, 52, 150, 150); }
  else { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `700 80px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText((name || '?')[0].toUpperCase(), 131, 157); ctx.textAlign = 'left'; }
  ctx.restore();

  ctx.fillStyle = '#fff'; ctx.font = `700 64px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText(name, 236, 120);
  ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = `500 28px ${FONT}`;
  ctx.fillText(`профиль ${m.profileName}${m.mode?.label && m.gameMode !== 'normal' ? ` · ${m.mode.label}` : ''}`, 238, 166);

  // Уровень SkyBlock — кольцо справа
  const lvl = Math.floor(m.sbLevel || 0), frac = (m.sbLevel || 0) % 1;
  const cx = 1060, cy = 128, R = 74;
  ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#7c5cff'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, frac)); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `700 52px ${FONT}`; ctx.fillText(String(lvl), cx, cy + 16);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `500 18px ${FONT}`; ctx.fillText('уровень SkyBlock', cx, cy + R + 36);
  ctx.textAlign = 'left';

  const sl = Object.values(m.slayers || {}).map(s => s.level ?? 0);
  const tiles = [
    ['Состояние', coins(a?.gear?.networth?.total), 'оценка по рынку', '#f5c542'],
    ['Magical Power', num(m.magicalPower), m.selectedPower ? `сила ${prettyId(m.selectedPower)}` : 'сила не выбрана', '#c879ff'],
    ['Catacombs', String(m.dungeons?.catacombs?.level ?? '—'), `классы ~${fx(m.dungeons?.classAverage)}`, '#ff5e5e'],
    ['Средний скилл', fx(m.skillAverage), '9 основных скиллов', '#4ade80'],
    ['Слееры', sl.join(' / ') || '—', 'зомби · паук · волк · эндер · блейз · вамп', '#fb923c'],
    ['Банк', coins(m.bank), `кошелёк ${coins(m.purse)}`, '#60a5fa'],
  ];
  const tw = 348, th = 150, gx = 24, x0 = 56, y0 = 262;
  tiles.forEach(([label, value, sub, color], i) => {
    const x = x0 + (i % 3) * (tw + gx), y = y0 + Math.floor(i / 3) * (th + 22);
    roundRect(ctx, x, y, tw, th, 18); ctx.fillStyle = 'rgba(255,255,255,.055)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = color; roundRect(ctx, x, y + 22, 5, th - 44, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = `600 20px ${FONT}`; ctx.fillText(label.toUpperCase(), x + 26, y + 42);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${String(value).length > 12 ? 36 : 44}px ${FONT}`; ctx.fillText(String(value).replace(/ /g, ' '), x + 26, y + 96);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = `500 17px ${FONT}`; ctx.fillText(String(sub).replace(/ /g, ' '), x + 26, y + 128, tw - 44);
  });

  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = `500 18px ${FONT}`;
  ctx.fillText(`Hypixel SkyBlock · ${new Date().toLocaleDateString('ru-RU')}`, 56, H - 18);
  ctx.textAlign = 'right'; ctx.fillText('личный трекер прогрессии', W - 56, H - 18); ctx.textAlign = 'left';
}

export default function ShareCard({ name, member, analysis, onClose }) {
  const ref = useRef(null);
  const [msg, setMsg] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => { drawShareCard(ref.current, { name, member, analysis }).then(() => setReady(true)); }, [name, member, analysis]);
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const blob = () => new Promise(res => ref.current.toBlob(res, 'image/png'));
  const download = async () => {
    const url = URL.createObjectURL(await blob());
    const l = document.createElement('a'); l.href = url; l.download = `${name}-${member.profileName}.png`; l.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob() })]);
      setMsg(matchMedia('(pointer: coarse)').matches ? 'Скопировано: вставь картинку в Discord' : 'Скопировано: вставь в Discord через Ctrl+V');
    } catch { setMsg('Браузер не дал скопировать картинку — нажми «Скачать PNG»'); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal card share-modal" role="dialog" aria-modal="true" aria-label="Карточка профиля" onClick={e => e.stopPropagation()}>
        <button className="x-btn modal-x" onClick={onClose} aria-label="Закрыть">×</button>
        <h3 style={{ marginTop: 0 }}>Карточка профиля</h3>
        <canvas ref={ref} className="share-canvas" width={W} height={H} />
        <div className="share-actions">
          <button className="btn" onClick={copy} disabled={!ready}>Копировать картинку</button>
          <button className="btn ghost" onClick={download} disabled={!ready}>Скачать PNG</button>
          {msg && <span className="muted small">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
