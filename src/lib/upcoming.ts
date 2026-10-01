import type { Group, GroupSettings, Lesson, Week } from '../../shared/types';
import { filterLessons, findWeek, occurrenceDate } from '../../shared/expand';
import { addDays, parseISODate } from '../../shared/util';

export type Upcoming = {
  /** Пары, которые идут прямо сейчас (несколько — если это варианты к.в.) */
  live: Lesson[];
  /** Ближайшая следующая пара (все варианты одной пары) и её дата */
  next?: { date: string; offset: number; lessons: Lesson[] };
  todayCount: number;
};

export function weekdayOf(iso: string): number {
  const { y, m, d } = parseISODate(iso);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function lessonsOn(lessons: Lesson[], group: Group, weeks: Week[], date: string): Lesson[] {
  const week = findWeek(weeks, date);
  const day = weekdayOf(date);
  if (!week || day > 5) return [];
  return lessons.filter((l) => l.day === day && occurrenceDate(l, week, group) === date).sort((a, b) => a.start.localeCompare(b.start) || a.pair - b.pair);
}

/** Что идёт сейчас и что будет дальше — ищем до двух недель вперёд, чтобы в выходные показать понедельник. */
export function findUpcoming(group: Group, settings: GroupSettings, weeks: Week[], today: string, nowHHMM: string): Upcoming {
  const lessons = filterLessons(group, settings);
  const todays = lessonsOn(lessons, group, weeks, today);
  const live = todays.filter((l) => l.start <= nowHHMM && nowHHMM < l.end);
  for (let offset = 0; offset < 15; offset++) {
    const date = addDays(today, offset);
    const candidates = (offset === 0 ? todays : lessonsOn(lessons, group, weeks, date)).filter((l) => offset > 0 || l.start > nowHHMM);
    if (candidates.length) {
      const first = candidates[0];
      return { live, todayCount: todays.length, next: { date, offset, lessons: candidates.filter((l) => l.pair === first.pair && l.start === first.start) } };
    }
  }
  return { live, todayCount: todays.length };
}
