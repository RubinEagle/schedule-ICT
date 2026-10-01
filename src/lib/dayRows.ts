import type { Group, Lesson, PairTime, Week } from '../../shared/types';
import { occurrenceDate } from '../../shared/expand';

export type DayRow = { type: 'lesson'; lessons: Lesson[]; pair: number } | { type: 'empty'; pair: number; start: string; end: string; leading: boolean };

/**
 * Строки дня для отображения: занятия, сгруппированные по паре (варианты одного к.в. вместе),
 * плюс заглушки для пропущенных пар до последней реальной: до первой пары — «нет пары», между парами — «окно».
 * Хвост после последней пары не показываем.
 */
export function buildDayRows(lessons: Lesson[], day: number, week: Week, group: Group, date: string, pairTimes: PairTime[]): DayRow[] {
  const dayLessons = lessons.filter((l) => l.day === day && occurrenceDate(l, week, group) === date).sort((a, b) => a.pair - b.pair);
  if (!dayLessons.length) return [];

  const byPair = new Map<number, Lesson[]>();
  for (const l of dayLessons) byPair.set(l.pair, [...(byPair.get(l.pair) ?? []), l]);
  const minPair = Math.min(...byPair.keys());
  const maxPair = Math.max(...byPair.keys());
  const times = pairTimes.filter((p) => p.day === day);

  const rows: DayRow[] = [];
  for (let pair = 1; pair <= maxPair; pair++) {
    const ls = byPair.get(pair);
    if (ls) {
      rows.push({ type: 'lesson', lessons: ls, pair });
      continue;
    }
    const t = times.find((p) => p.pair === pair) ?? pairTimes.find((p) => p.pair === pair);
    if (t) rows.push({ type: 'empty', pair, start: t.start, end: t.end, leading: pair < minPair });
  }
  return rows;
}
