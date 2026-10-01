import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseWorkbook } from '../shared/parse-xlsx';
import { localToSchedule } from '../shared/local';
import { diffGroups, findMatchingGroup, isSignificant, titleSimilarity } from '../shared/diff';
import type { Group, Lesson } from '../shared/types';

const table = parseWorkbook(new Uint8Array(readFileSync(new URL('./fixtures/schedule.xlsx', import.meta.url))));
const tableIvt = table.groups.find((g) => g.id === 'ivt-11mo')!;
const local = localToSchedule(JSON.parse(readFileSync(new URL('../data/local-schedule.json', import.meta.url), 'utf8'))).groups[0];

const lesson = (l: Partial<Lesson>): Lesson => ({
  id: `${l.day ?? 0}-${l.pair ?? 1}-${l.parity ?? 'both'}-${l.title ?? 'x'}`,
  day: 0,
  pair: 1,
  start: '09:00',
  end: '10:35',
  parity: 'both',
  kind: 'regular',
  title: 'Предмет',
  ...l,
});
const group = (name: string, lessons: Lesson[]): Group => ({ id: name, name, semesterEnd: '2027-01-08', lessons, slots: [], hasOptional: false });

describe('diffGroups: личное расписание против таблицы', () => {
  const diffs = diffGroups(local, tableIvt);
  const at = (day: number, pair: number) => diffs.filter((d) => d.day === day && d.pair === pair);

  it('выбранный вариант к.в. совпадает, второй вариант отличием не считается', () => {
    expect(at(0, 2)).toEqual([]);
  });

  it('опечатка в названии («математический») не даёт отличия', () => {
    expect(titleSimilarity('Непрерывные математические модели', 'Непрерывные математический модели')).toBeGreaterThan(0.9);
    expect(at(3, 2)).toEqual([]);
  });

  it('перенос: чт 4 пара у вас — в таблице (старой) 3-я, второй вариант того же к.в. не считается', () => {
    const d = diffs.find((x) => x.local?.title.startsWith('Оценка качества'))!;
    expect(d).toMatchObject({ kind: 'moved', day: 3, pair: 3, from: { day: 3, pair: 4, parity: 'both' } });
    expect(d.fields.map((f) => f.field)).not.toContain('time');
    expect(diffs.some((x) => x.table?.title.startsWith('Нейросети'))).toBe(false);
  });

  it('перенос с другой недели и аудиторией: пт ML знаменатель 1 пара → числитель 3 пара', () => {
    const d = diffs.find((x) => x.local?.title === 'Машинное обучение' && x.local.day === 4)!;
    expect(d).toMatchObject({ kind: 'moved', day: 4, pair: 3, parity: 'odd', from: { day: 4, pair: 1, parity: 'even' } });
    expect(d.fields).toEqual([{ field: 'room', local: '216', table: '213' }]);
  });

  it('больше отличий нет', () => {
    expect(diffs.filter(isSignificant).map((d) => d.kind)).toEqual(['moved', 'moved']);
  });
});

describe('diffGroups: виды отличий', () => {
  it('changed / replaced / added / missing', () => {
    const mine = group('Моя', [
      lesson({ day: 0, pair: 1, title: 'Матанализ', room: '101' }),
      lesson({ day: 1, pair: 1, title: 'История' }),
      lesson({ day: 2, pair: 1, title: 'Физкультура' }),
    ]);
    const theirs = group('Их', [
      lesson({ day: 0, pair: 1, title: 'Матанализ', room: '202' }),
      lesson({ day: 1, pair: 1, title: 'Химия' }),
      lesson({ day: 3, pair: 2, title: 'Программирование' }),
    ]);
    const kinds = diffGroups(mine, theirs).map((d) => [d.kind, d.day]);
    expect(kinds).toEqual([
      ['changed', 0],
      ['replaced', 1],
      ['missing', 2],
      ['added', 3],
    ]);
    expect(diffGroups(mine, theirs)[0].fields).toEqual([{ field: 'room', local: '101', table: '202' }]);
  });

  it('невыбранный курс по выбору — not-chosen и в счётчик не входит', () => {
    const mine = group('Моя', []);
    const theirs = group('Их', [lesson({ title: 'Нейросети', kind: 'elective' }), lesson({ day: 1, title: 'Кружок', kind: 'optional' })]);
    const diffs = diffGroups(mine, theirs);
    expect(diffs.map((d) => d.kind)).toEqual(['not-chosen', 'not-chosen']);
    expect(diffs.filter(isSignificant)).toEqual([]);
  });

  it('changed ловит преподавателя, время и формат', () => {
    const mine = group('Моя', [lesson({ title: 'Оценка качества ПО', teacher: 'Хинт', start: '15:00', end: '16:30', online: true })]);
    const theirs = group('Их', [lesson({ title: 'Оценка качества ПО', teacher: 'Волков А.В.' })]);
    expect(diffGroups(mine, theirs)[0].fields.map((f) => f.field)).toEqual(['teacher', 'time', 'online']);
  });

  it('разные отличия по числителю и знаменателю не склеиваются', () => {
    const mine = group('Моя', [lesson({ title: 'Английский', room: '1' })]);
    const theirs = group('Их', [lesson({ title: 'Английский', room: '2', parity: 'odd' }), lesson({ title: 'Английский', room: '3', parity: 'even' })]);
    const diffs = diffGroups(mine, theirs);
    expect(diffs.map((d) => d.parity)).toEqual(['odd', 'even']);
  });

  it('одинаковое отличие в обе недели сворачивается в «каждую неделю»', () => {
    const mine = group('Моя', [lesson({ title: 'Английский', parity: 'odd' }), lesson({ title: 'Английский', parity: 'even' })]);
    const theirs = group('Их', [lesson({ title: 'Английский', teacher: 'Иванов' })]);
    const diffs = diffGroups(mine, theirs);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ kind: 'changed', parity: 'both' });
  });

  it('группа ищется по названию без учёта пробелов и дефисов', () => {
    const mine = group('ИВТ-14МО', []);
    expect(findMatchingGroup(mine, [group('ПИЭ-13МО', []), group('ИВТ 14МО', [])])?.name).toBe('ИВТ 14МО');
  });
});
