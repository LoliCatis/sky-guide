// Мини-график цены Bazaar в карточке предмета: область по цене продажи, периоды сутки/неделя/месяц/всё
// и кнопка «Открыть на рынке» (полный биржевой график в разделе «Рынок»).
import { useEffect, useRef, useState } from 'react';
import { createChart, AreaSeries, LineSeries, ColorType, LineStyle } from 'lightweight-charts';
import { api } from '../../api.js';
import { fmtPrice, toBars, tickLabel } from './TradingChart.jsx';
import './chart.css';

const PERIODS = [['1d', 'Сутки', '5m', 288], ['7d', 'Неделя', '1h', 168], ['30d', 'Месяц', '1h', 720], ['all', 'Всё время', '1d', 3000]];

export default function MiniChart({ id, onOpenMarket }) {
  const [period, setPeriod] = useState(() => localStorage.getItem('sb-mini-period') || '7d');
  const [data, setData] = useState(null);
  const box = useRef(null), chart = useRef(null), ser = useRef(null);
  const p = PERIODS.find(x => x[0] === period) || PERIODS[1];

  useEffect(() => {
    let alive = true;
    setData(null);
    api(`/market/candles/${encodeURIComponent(id)}?tf=${p[2]}&limit=${p[3]}`).then(r => alive && setData(r)).catch(() => alive && setData({ candles: [] }));
    return () => { alive = false; };
  }, [id, period]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8b90b0', fontSize: 10, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,.04)' } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: true, tickMarkFormatter: tickLabel },
      localization: { locale: 'ru-RU', priceFormatter: fmtPrice, timeFormatter: t => new Date(t * 1000).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
      handleScroll: false, handleScale: false,
    });
    chart.current = c;
    ser.current = {
      sell: c.addSeries(AreaSeries, { lineColor: '#f5c542', topColor: 'rgba(245,197,66,.3)', bottomColor: 'rgba(245,197,66,.02)', lineWidth: 2, priceLineVisible: false }),
      buy: c.addSeries(LineSeries, { color: '#22d3ee', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }),
    };
    return () => { c.remove(); chart.current = null; };
  }, []);

  useEffect(() => {
    if (!data?.candles || !ser.current) return;
    const sell = toBars(data.candles, 'sell'), buy = toBars(data.candles, 'buy');
    ser.current.sell.setData(sell.map(b => ({ time: b.time, value: b.close })));
    ser.current.buy.setData(buy.map(b => ({ time: b.time, value: b.close })));
    chart.current?.applyOptions({ timeScale: { timeVisible: p[2] !== '1d' } });
    chart.current?.timeScale().fitContent();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = data?.candles || [];
  const first = list[0]?.[5], last = list[list.length - 1]?.[8];
  const pct = first > 0 && last > 0 ? (last / first - 1) * 100 : null;
  return (
    <div className="mc">
      <div className="mc-top">
        <div className="tc-seg" role="group" aria-label="Период">
          {PERIODS.map(([v, l]) => <button key={v} type="button" className={period === v ? 'on' : ''} aria-pressed={period === v} onClick={() => { setPeriod(v); try { localStorage.setItem('sb-mini-period', v); } catch { /* приватный режим */ } }}>{l}</button>)}
        </div>
        {pct != null && <span className={`mc-chg ${pct >= 0 ? 'green' : 'red'}`} title="Изменение цены продажи за период">{pct > 0 ? '+' : ''}{pct.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%</span>}
      </div>
      <div className="mc-stage">
        <div className="tc-canvas" ref={box} />
        {!data && <div className="tc-over"><div className="spinner" /></div>}
        {data && !list.length && <div className="tc-over muted small">История цены ещё копится</div>}
      </div>
      <div className="mc-top">
        <span className="muted tiny"><span className="tc-sell">━ продажа</span> · <span className="tc-buy">┅ покупка</span> · <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="link">TradingView</a></span>
        <button type="button" className="chip" onClick={onOpenMarket}>📈 Открыть на рынке →</button>
      </div>
    </div>
  );
}
