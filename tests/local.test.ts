import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { localToSchedule, type LocalFile } from '../shared/local';
import { buildEvents } from '../shared/expand';
import { allVariants, variantKey } from '../shared/variants';

const raw = JSON.parse(readFileSync(new URL('../data/local-schedule.json', import.meta.url), 'utf8')) as LocalFile;
const schedule = localToSchedule(raw);
const group = schedule.groups[0];

const minimal = (lessons: Partial<LocalFile['schedule'][number]>[], meta: Partial<LocalFile['metadata']> = {}): LocalFile =>
  ({
    metadata: { group: 'Тест', semester_start: '2026-08-31', semester_end: '2026-09-20', updated_at: '2026-09-01', ...meta },
    schedule: lessons.map((l) => ({ day: 'Понедельник', pair: 1, subject: 'Предмет', week_type: ['numerator', 'denominator'], ...l })),
  }) as LocalFile;

describe('localToSchedule на data/local-schedule.json', () => {
  it('недели от 31.08.2026 до недели с концом семестра, первая — числитель', () => {
    expect(schedule.weeks[0]).toMatchObject({ start: '2026-08-31', end: '2026-09-06', parity: 'odd' });
    expect(schedule.weeks[1]).toMatchObject({ start: '2026-09-07', parity: 'even' });
    const last = schedule.weeks[schedule.weeks.length - 1];
    expect(last.start <= group.semesterEnd && group.semesterEnd <= last.end).toBe(true);
    schedule.weeks.forEach((w, i) => expect(w.parity).toBe(i % 2 === 0 ? 'odd' : 'even'));
  });

  it('группа, выходные и ФТД', () => {
    expect(group).toMatchObject({ id: 'local', name: 'ИВТ-14МО', semesterEnd: '2027-01-08', hasOptional: true, slots: [] });
    expect(group.daysOff).toEqual([2, 5]);
  });

  it('week_type → parity, optional → к.в., facultative → ФТД', () => {
    const mon1 = group.lessons.find((l) => l.day === 0 && l.pair === 1)!;
    expect(mon1).toMatchObject({ title: 'Машинное обучение', parity: 'odd', kind: 'regular', room: '309' });
    expect(group.lessons.find((l) => l.day === 0 && l.pair === 2)).toMatchObject({ kind: 'elective', parity: 'both' });
    expect(group.lessons.find((l) => l.day === 0 && l.pair === 5)).toMatchObject({ kind: 'optional' });
    expect(group.lessons.find((l) => l.day === 4 && l.pair === 1)).toMatchObject({ parity: 'even', room: '216' });
  });

  it('своё время пары сохраняется', () => {
    expect(group.lessons.find((l) => l.day === 3 && l.pair === 4)).toMatchObject({ start: '15:00', end: '16:30', online: true });
  });

  it('варианты календаря: с ФТД и без', () => {
    const keys = allVariants(group).map((s) => variantKey(group, s));
    expect(keys).toEqual(['default', 'noopt']);
    const all = buildEvents(group, schedule.weeks, { electives: {}, showOptional: true });
    const noopt = buildEvents(group, schedule.weeks, { electives: {}, showOptional: false });
    expect(all.length).toBeGreaterThan(noopt.length);
    expect(noopt.some((e) => e.title.startsWith('ФТД'))).toBe(false);
    expect(new Set(all.map((e) => e.uid)).size).toBe(all.length);
    expect(all.every((e) => e.date <= group.semesterEnd)).toBe(true);
  });
});

describe('localToSchedule: разбор полей и ошибки', () => {
  it('время по умолчанию берётся из стандартной сетки, в субботу своё', () => {
    const s = localToSchedule(minimal([{ pair: 3 }, { day: 'Суббота', pair: 3 }, { day: 'пт', pair: 2 }]));
    const [mon, fri, sat] = s.groups[0].lessons;
    expect(mon).toMatchObject({ start: '13:20', end: '14:55' });
    expect(fri).toMatchObject({ day: 4, start: '10:45' });
    expect(sat).toMatchObject({ day: 5, start: '12:30', end: '14:05' });
  });

  it('start_date, exclude_dates и note', () => {
    const s = localToSchedule(minimal([{ start_date: '2026-09-09', exclude_dates: ['2026-09-14'], note: 'с 9.09' }]));
    expect(s.groups[0].lessons[0]).toMatchObject({ startFrom: '2026-09-09', excludeDates: ['2026-09-14'], note: 'с 9.09' });
  });

  it('первая неделя может быть знаменателем', () => {
    const s = localToSchedule(minimal([{}], { first_week: 'denominator' }));
    expect(s.weeks.map((w) => w.parity)).toEqual(['even', 'odd', 'even']);
  });

  it('понятные ошибки: день, неделя, время', () => {
    expect(() => localToSchedule(minimal([{ day: 'Пнд' }]))).toThrow(/Занятие №1.*неизвестный день «Пнд»/);
    expect(() => localToSchedule(minimal([{ week_type: [] }]))).toThrow(/week_type/);
    expect(() => localToSchedule(minimal([{ pair: 7 }]))).toThrow(/start_time и end_time/);
    expect(() => localToSchedule(minimal([{ start_time: '12:00', end_time: '11:00' }]))).toThrow(/не раньше конца/);
    expect(() => localToSchedule(minimal([{}], { semester_start: '1.09.2026' }))).toThrow(/semester_start/);
  });
});
