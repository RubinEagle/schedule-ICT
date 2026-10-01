import type { Group, Lesson, LessonKind, PairTime, Parity, Schedule, Week } from './types';
import { DAY_NAMES, DAY_SHORT, addDays, normalizeSpaces, parseISODate, shortHash } from './util';

/**
 * Личное расписание из data/local-schedule.json. Формат задаёт человек, а не парсер,
 * поэтому поля названы по-человечески, а недели, время пар и id вычисляются здесь.
 */
export type LocalLesson = {
  day: string;
  pair: number;
  start_time?: string;
  end_time?: string;
  subject: string;
  teacher?: string;
  room?: string | number;
  week_type: WeekType[] | WeekType;
  /** Курс по выбору */
  optional?: boolean;
  /** Факультатив (ФТД) */
  facultative?: boolean;
  online?: boolean;
  lecture?: boolean;
  note?: string;
  /** ISO-дата, раньше которой занятия нет */
  start_date?: string;
  /** ISO-даты, в которые занятия нет */
  exclude_dates?: string[];
};

type WeekType = 'numerator' | 'denominator';

export type LocalFile = {
  metadata: {
    group: string;
    semester?: string;
    /** Понедельник первой недели семестра (или любой день этой недели) */
    semester_start: string;
    /** Последний учебный день */
    semester_end: string;
    /** Первая неделя — числитель (по умолчанию) или знаменатель */
    first_week?: WeekType;
    updated_at: string;
    days_off?: string[];
  };
  schedule: LocalLesson[];
};

/** Стандартное время пар — как в общей таблице; в субботу третья пара раньше. */
const WEEKDAY_TIMES = [
  ['09:00', '10:35'],
  ['10:45', '12:20'],
  ['13:20', '14:55'],
  ['15:05', '16:40'],
  ['16:50', '18:25'],
];
const SATURDAY_TIMES = [
  ['09:00', '10:35'],
  ['10:45', '12:20'],
  ['12:30', '14:05'],
  ['15:05', '16:40'],
  ['16:50', '18:25'],
];

export const STANDARD_PAIR_TIMES: PairTime[] = [0, 1, 2, 3, 4, 5].flatMap((day) =>
  (day === 5 ? SATURDAY_TIMES : WEEKDAY_TIMES).map(([start, end], i) => ({ day, pair: i + 1, start, end })),
);

export const LOCAL_GROUP_ID = 'local';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export function localToSchedule(raw: unknown): Schedule {
  const errors: string[] = [];
  const file = raw as Partial<LocalFile>;
  const meta = file?.metadata;
  if (!meta || typeof meta !== 'object') throw new Error('local-schedule.json: нет раздела metadata');
  if (!Array.isArray(file.schedule)) throw new Error('local-schedule.json: нет массива schedule');

  const groupName = typeof meta.group === 'string' ? normalizeSpaces(meta.group) : '';
  if (!groupName) errors.push('metadata.group: укажите название группы');
  for (const key of ['semester_start', 'semester_end', 'updated_at'] as const) {
    if (typeof meta[key] !== 'string' || !ISO_RE.test(meta[key]!.slice(0, 10))) errors.push(`metadata.${key}: нужна дата в формате ГГГГ-ММ-ДД`);
  }
  if (meta.first_week && meta.first_week !== 'numerator' && meta.first_week !== 'denominator') errors.push('metadata.first_week: numerator или denominator');

  const daysOff: number[] = [];
  for (const d of meta.days_off ?? []) {
    const day = dayIndex(d);
    if (day < 0) errors.push(`metadata.days_off: неизвестный день «${d}»`);
    else daysOff.push(day);
  }

  const lessons: Lesson[] = [];
  const ids = new Set<string>();
  file.schedule.forEach((l, i) => {
    const where = `Занятие №${i + 1}${l?.subject ? ` («${l.subject}»)` : ''}`;
    const err = (msg: string) => errors.push(`${where}: ${msg}`);
    const day = dayIndex(l?.day);
    if (day < 0) return err(`неизвестный день «${l?.day}»`);
    if (!Number.isInteger(l.pair) || l.pair < 1 || l.pair > 8) return err(`номер пары должен быть от 1 до 8, а не «${l.pair}»`);
    const title = typeof l.subject === 'string' ? normalizeSpaces(l.subject) : '';
    if (!title) return err('не указан subject');

    const parity = parityOf(l.week_type);
    if (!parity) return err('week_type: укажите ["numerator"], ["denominator"] или оба');

    const std = STANDARD_PAIR_TIMES.find((p) => p.day === day && p.pair === l.pair);
    const start = l.start_time ? normTime(l.start_time) : std?.start;
    const end = l.end_time ? normTime(l.end_time) : std?.end;
    if (!start || !end) return err('время не распознано — укажите start_time и end_time в формате ЧЧ:ММ');
    if (start >= end) return err(`время начала ${start} не раньше конца ${end}`);

    if (l.optional && l.facultative) return err('занятие не может быть одновременно optional и facultative');
    const kind: LessonKind = l.facultative ? 'optional' : l.optional ? 'elective' : 'regular';

    let id = `${LOCAL_GROUP_ID}-d${day}p${l.pair}-${parity}-${shortHash(title)}`;
    while (ids.has(id)) id += '_';
    ids.add(id);

    const lesson: Lesson = { id, day, pair: l.pair, start, end, parity, kind, title };
    if (l.teacher && normalizeSpaces(l.teacher)) lesson.teacher = normalizeSpaces(l.teacher);
    if (l.room !== undefined && l.room !== null && String(l.room).trim()) lesson.room = String(l.room).trim();
    if (l.online) lesson.online = true;
    if (l.lecture) lesson.lecture = true;
    if (l.note && normalizeSpaces(l.note)) lesson.note = normalizeSpaces(l.note);
    if (l.start_date) {
      if (!ISO_RE.test(l.start_date)) return err('start_date: нужна дата ГГГГ-ММ-ДД');
      lesson.startFrom = l.start_date;
    }
    if (l.exclude_dates?.length) {
      if (l.exclude_dates.some((d) => !ISO_RE.test(d))) return err('exclude_dates: нужны даты ГГГГ-ММ-ДД');
      lesson.excludeDates = [...l.exclude_dates];
    }
    lessons.push(lesson);
  });

  if (errors.length) throw new Error(`Ошибки в data/local-schedule.json:\n  ${errors.join('\n  ')}`);

  const semesterEnd = meta.semester_end!.slice(0, 10);
  const weeks = buildWeeks(meta.semester_start!.slice(0, 10), semesterEnd, meta.first_week ?? 'numerator');
  if (!weeks.length) throw new Error('local-schedule.json: semester_end раньше semester_start');

  lessons.sort((a, b) => a.day - b.day || a.pair - b.pair || a.parity.localeCompare(b.parity));
  const group: Group = {
    id: LOCAL_GROUP_ID,
    name: groupName,
    semesterEnd,
    lessons,
    slots: [],
    hasOptional: lessons.some((l) => l.kind === 'optional'),
  };
  if (daysOff.length) group.daysOff = [...new Set(daysOff)].sort();

  return {
    generatedAt: meta.updated_at!,
    sourceModified: meta.updated_at!,
    sourceUrl: '',
    weeks,
    pairTimes: STANDARD_PAIR_TIMES,
    groups: [group],
  };
}

function buildWeeks(start: string, end: string, first: WeekType): Week[] {
  const { y, m, d } = parseISODate(start);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  let monday = addDays(start, -weekday);
  const weeks: Week[] = [];
  const firstParity = first === 'numerator' ? 'odd' : 'even';
  while (monday <= end) {
    const odd = weeks.length % 2 === 0 ? firstParity === 'odd' : firstParity !== 'odd';
    weeks.push({ index: weeks.length, start: monday, end: addDays(monday, 6), parity: odd ? 'odd' : 'even' });
    monday = addDays(monday, 7);
  }
  return weeks;
}

function dayIndex(value: unknown): number {
  if (typeof value !== 'string') return -1;
  const v = value.trim().toLowerCase();
  const full = DAY_NAMES.findIndex((n) => n === v);
  const idx = full >= 0 ? full : DAY_SHORT.findIndex((n) => n.toLowerCase() === v);
  return idx >= 0 && idx <= 5 ? idx : -1;
}

function parityOf(value: LocalLesson['week_type'] | undefined): Parity | null {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const num = list.includes('numerator');
  const den = list.includes('denominator');
  if (list.some((w) => w !== 'numerator' && w !== 'denominator')) return null;
  if (num && den) return 'both';
  if (num) return 'odd';
  if (den) return 'even';
  return null;
}

function normTime(t: string): string | undefined {
  const m = String(t).trim().match(TIME_RE);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return undefined;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}
