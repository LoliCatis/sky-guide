import { useSyncExternalStore } from 'react';

// Облегчённый режим: без анимированного фона, бесконечных анимаций, размытий, объёмных голов и живой 3D-модели.
// Сайт выглядит так же (цвета, карточки, иконки), но телефону не нужно перерисовывать экран 60 раз в секунду.
// Выбор: 'auto' (по умолчанию), 'on', 'off'. Хранится в localStorage под ключом sb-lite.
// Первое решение принимает маленький скрипт в index.html — до отрисовки, чтобы страница не «моргала» анимацией.
export const LITE_KEY = 'sb-lite';

// Слабое или мобильное устройство. Логика совпадает со скриптом в client/index.html (там — без модулей, до загрузки сайта)
export function autoLite(w = window) {
  try {
    const n = w.navigator || {}, c = n.connection || {}, mm = q => !!w.matchMedia?.(q).matches;
    if (mm('(prefers-reduced-motion: reduce)')) return true; // человек сам попросил меньше движения
    if (c.saveData || /(^|-)2g$|^3g$/.test(c.effectiveType || '')) return true; // экономия трафика, медленная сеть
    if ((n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 2)) return true;
    return mm('(pointer: coarse)') && mm('(max-width: 900px)'); // телефон или планшет
  } catch { return false; }
}

export function litePref() {
  try { const v = localStorage.getItem(LITE_KEY); return v === 'on' || v === 'off' ? v : 'auto'; } catch { return 'auto'; }
}
export const liteFor = pref => (pref === 'on' ? true : pref === 'off' ? false : autoLite());

const subs = new Set();
const subscribe = f => { subs.add(f); return () => subs.delete(f); };
let current = typeof document !== 'undefined' ? document.documentElement.classList.contains('lite') : false;
export const isLite = () => current;
let version = 0; // меняется при любом выборе в переключателе, даже если режим остался тем же (сам → включён)

export function setLitePref(pref) {
  try { if (pref === 'auto') localStorage.removeItem(LITE_KEY); else localStorage.setItem(LITE_KEY, pref); } catch { /* приватный режим */ }
  current = liteFor(pref);
  version++;
  document.documentElement.classList.toggle('lite', current);
  subs.forEach(f => f());
}

// Хук: включён ли облегчённый режим сейчас (компоненты перерисовываются при переключении)
export function useLite() {
  return useSyncExternalStore(subscribe, isLite, () => false);
}

// Хук для переключателя: выбранная настройка + включён ли режим
export function useLitePref() {
  useSyncExternalStore(subscribe, () => version, () => 0);
  const lite = useLite();
  return { pref: litePref(), lite, auto: autoLite(), set: setLitePref };
}
