export const DAY_NAMES = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
export const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ISO-дата (YYYY-MM-DD) без учёта таймзоны. */
export function toISODate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseISODate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

/** Прибавить дни к ISO-дате (арифметика в UTC, чтобы не ловить DST). */
export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseISODate(iso);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  const dt = new Date(t);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function excelSerialToISO(serial: number): string {
  const t = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const dt = new Date(t);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Сегодняшняя дата в виде ISO в локальной таймзоне устройства. */
export function todayISO(now: Date = new Date()): string {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Короткий стабильный хэш (FNV-1a, 32 бит) в hex — одинаково работает в Node и браузере. */
export function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function formatDateRu(iso: string, withYear = false): string {
  const { y, m, d } = parseISODate(iso);
  return `${d} ${MONTHS_GEN[m - 1]}${withYear ? ` ${y}` : ''}`;
}
