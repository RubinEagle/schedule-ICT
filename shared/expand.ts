import type { CalendarEvent, Group, GroupSettings, Lesson, Week } from './types';
import { addDays, shortHash } from './util';
import { ALL, normalizeSettings } from './variants';

/** Занятия группы с учётом настроек (выбранные к.в., факультативы). */
export function filterLessons(group: Group, settings: Partial<GroupSettings> | undefined): Lesson[] {
  const s = normalizeSettings(group, settings);
  return group.lessons.filter((l) => {
    if (l.kind === 'optional' && !s.showOptional) return false;
    if (l.slotId && l.optionId) {
      const choice = s.electives[l.slotId] ?? ALL;
      if (choice !== ALL && choice !== l.optionId) return false;
    }
    return true;
  });
}

/** Дата занятия на данной неделе или null, если на этой неделе его нет. */
export function occurrenceDate(lesson: Lesson, week: Week, group: Group): string | null {
  if (lesson.parity !== 'both' && lesson.parity !== week.parity) return null;
  const date = addDays(week.start, lesson.day);
  if (date > group.semesterEnd) return null;
  if (lesson.startFrom && date < lesson.startFrom) return null;
  if (lesson.excludeDates?.includes(date)) return null;
  return date;
}

export function findWeek(weeks: Week[], dateISO: string): Week | undefined {
  return weeks.find((w) => dateISO >= w.start && dateISO <= w.end);
}

export function buildEvents(group: Group, weeks: Week[], settings: Partial<GroupSettings> | undefined): CalendarEvent[] {
  const lessons = filterLessons(group, settings);
  const events: CalendarEvent[] = [];
  for (const week of weeks) {
    for (const lesson of lessons) {
      const date = occurrenceDate(lesson, week, group);
      if (!date) continue;
      const key = `${group.id}|${date}|${lesson.pair}|${lesson.title}`;
      const summary = lesson.kind === 'elective' ? `к.в. ${lesson.title}` : lesson.kind === 'optional' ? `ФТД ${lesson.title}` : lesson.title;
      const descr: string[] = [];
      if (lesson.teacher) descr.push(lesson.teacher);
      if (lesson.lecture) descr.push('Лекция');
      if (lesson.note) descr.push(lesson.note);
      descr.push(`${lesson.pair} пара · ${group.name}`);
      events.push({
        uid: `${shortHash(key)}${shortHash(`${key}#`)}@schedule-ict`,
        date,
        start: lesson.start,
        end: lesson.end,
        title: summary,
        location: locationOf(lesson),
        description: descr.join('\n'),
        lesson,
      });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return events;
}

export function locationOf(lesson: Lesson): string | undefined {
  if (lesson.room && lesson.online) return `ауд. ${lesson.room} (онлайн)`;
  if (lesson.room) return `ауд. ${lesson.room}`;
  if (lesson.online) return 'онлайн';
  return undefined;
}
