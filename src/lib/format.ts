import type { Parity } from '../../shared/types';
import { DAY_NAMES, DAY_SHORT, MONTHS_GEN, parseISODate } from '../../shared/util';

export function formatWeekRange(start: string, end: string): string {
  const a = parseISODate(start);
  const b = parseISODate(end);
  if (a.m === b.m) return `${a.d}–${b.d} ${MONTHS_GEN[a.m - 1]}`;
  return `${a.d} ${MONTHS_GEN[a.m - 1]} – ${b.d} ${MONTHS_GEN[b.m - 1]}`;
}

export function formatDayTitle(iso: string, day: number): string {
  const { d, m } = parseISODate(iso);
  return `${DAY_SHORT[day]}, ${d} ${MONTHS_GEN[m - 1]}`;
}

export function dayName(day: number): string {
  const n = DAY_NAMES[day];
  return n[0].toUpperCase() + n.slice(1);
}

export function dayMonth(iso: string): string {
  const { d, m } = parseISODate(iso);
  return `${d} ${MONTHS_GEN[m - 1]}`;
}

/** «1 октября» для даты без времени, «29 сентября в 09:32» — для момента времени. */
export function formatUpdated(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dayMonth(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export function parityLabel(p: Parity): string {
  return p === 'odd' ? 'по числителю' : p === 'even' ? 'по знаменателю' : 'каждую неделю';
}

/** plural(3, ['пара', 'пары', 'пар']) → «пары» */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b === 1) return forms[0];
  if (b >= 2 && b <= 4) return forms[1];
  return forms[2];
}
