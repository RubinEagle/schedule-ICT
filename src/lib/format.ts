import { DAY_SHORT, MONTHS_GEN, parseISODate } from '../../shared/util';

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

export function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export function pairWord(n: number): string {
  return `${n} пара`;
}
