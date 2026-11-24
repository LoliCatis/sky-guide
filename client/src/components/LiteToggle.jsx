import { useLitePref } from '../lite.js';

// Переключатель облегчённого режима: «сам» (телефон и слабые устройства — включён), «включён», «выключен»
export default function LiteToggle() {
  const { pref, lite, auto, set } = useLitePref();
  const title = lite
    ? 'Облегчённый режим включён: фон не двигается, нет размытий и объёмных моделей — сайт быстрее на телефоне'
    : 'Полный режим: живой фон, анимации и 3D-модель игрока';
  return (
    <label className={`lite-toggle ${lite ? 'on' : ''}`} title={title}>
      <span className="lite-dot" aria-hidden="true" />
      <span>Облегчённый режим</span>
      <select value={pref} onChange={e => set(e.target.value)} aria-label="Облегчённый режим">
        <option value="auto">{auto ? 'авто: включён' : 'авто: выключен'}</option>
        <option value="on">включён</option>
        <option value="off">выключен</option>
      </select>
    </label>
  );
}
