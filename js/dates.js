// Fechas como texto 'YYYY-MM-DD' en hora local: fáciles de comparar y guardar.

const pad = (n) => String(n).padStart(2, '0');

export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export const weekday = (key) => fromKey(key).getDay();

export function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fmt = (opts) => new Intl.DateTimeFormat('es-MX', opts);
const fmtMonth = fmt({ month: 'long', year: 'numeric' });
const fmtWeekday = fmt({ weekday: 'long' });
const fmtLong = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = fmt({ day: 'numeric', month: 'short' });
const fmtClock = fmt({ hour: 'numeric', minute: '2-digit' });

export function monthLabel(year, month) {
  const s = fmtMonth.format(new Date(year, month, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export const weekdayLabel = (key) => fmtWeekday.format(fromKey(key));
export const longLabel = (key) => fmtLong.format(fromKey(key));
export const shortLabel = (key) => fmtShort.format(fromKey(key));
export const clockLabel = (iso) => fmtClock.format(new Date(iso));

export function timeLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return fmtClock.format(new Date(2000, 0, 1, h, m));
}
