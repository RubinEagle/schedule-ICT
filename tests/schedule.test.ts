import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseWorkbook } from '../shared/parse-xlsx';
import { buildEvents, filterLessons, findWeek } from '../shared/expand';
import { allVariants, variantKey, normalizeSettings } from '../shared/variants';
import { buildIcs, fold } from '../shared/ics';

const wb = new Uint8Array(readFileSync(new URL('./fixtures/schedule.xlsx', import.meta.url)));
const parsed = parseWorkbook(wb);
const ivt = parsed.groups.find((g) => g.id === 'ivt-11mo')!;
const pie = parsed.groups.find((g) => g.id === 'pie-13mo')!;

describe('parseWorkbook', () => {
  it('недели: 20 штук, чередование числитель/знаменатель с 31.08.2026', () => {
    expect(parsed.weeks).toHaveLength(20);
    expect(parsed.weeks[0]).toMatchObject({ start: '2026-08-31', end: '2026-09-06', parity: 'odd' });
    expect(parsed.weeks[1]).toMatchObject({ start: '2026-09-07', parity: 'even' });
    expect(parsed.weeks[19]).toMatchObject({ start: '2027-01-11', parity: 'even' });
  });

  it('группы и конец семестра', () => {
    expect(ivt.name).toBe('ИВТ-11МО');
    expect(ivt.semesterEnd).toBe('2027-01-08');
    expect(pie.semesterEnd).toBe('2027-01-11');
  });

  it('чётность: одна строка -> odd, объединение на две строки -> both', () => {
    const mon1 = ivt.lessons.find((l) => l.day === 0 && l.pair === 1)!;
    expect(mon1).toMatchObject({ title: 'Машинное обучение', parity: 'odd' });
    const tue2 = ivt.lessons.find((l) => l.day === 1 && l.pair === 2)!;
    expect(tue2).toMatchObject({ title: 'Анализ алгоритмов и сложность вычислений', parity: 'both' });
  });

  it('горизонтальные объединения: общая пара попадает в обе группы', () => {
    expect(pie.lessons.find((l) => l.day === 1 && l.pair === 3)?.title).toBe('Автоматический анализ текстов');
  });

  it('слоты к.в. и суббота с другим временем', () => {
    expect(ivt.slots.map((s) => s.slotId)).toEqual(['d0p2', 'd3p3']);
    expect(pie.slots.map((s) => s.slotId)).toEqual(['d0p5']);
    expect(ivt.hasOptional).toBe(true);
    expect(pie.hasOptional).toBe(false);
  });
});

describe('variants', () => {
  it('ключ default при отсутствии выбора, нормализация неизвестных значений', () => {
    expect(variantKey(ivt, undefined)).toBe('default');
    expect(variantKey(ivt, { electives: { d0p2: 'nope' }, showOptional: true })).toBe('default');
    const opt = ivt.slots[0].options[1].optionId;
    expect(variantKey(ivt, { electives: { d0p2: opt }, showOptional: false })).toBe(`d0p2-${opt}_noopt`);
    expect(normalizeSettings(pie, { electives: {}, showOptional: false }).showOptional).toBe(true);
  });
  it('все комбинации уникальны и покрывают ключи', () => {
    const keys = allVariants(ivt).map((s) => variantKey(ivt, s));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(18);
    expect(allVariants(pie)).toHaveLength(3);
  });
});

describe('expand', () => {
  it('выбор к.в. скрывает второй вариант, факультатив отключается', () => {
    const opt = ivt.slots[0].options[0].optionId;
    const ls = filterLessons(ivt, { electives: { d0p2: opt }, showOptional: false });
    expect(ls.filter((l) => l.slotId === 'd0p2')).toHaveLength(1);
    expect(ls.some((l) => l.kind === 'optional')).toBe(false);
    expect(filterLessons(ivt, undefined).filter((l) => l.slotId === 'd0p2')).toHaveLength(2);
  });

  it('события: нечётная пара только на числителе, конец семестра, исключения и старт', () => {
    const ev = buildEvents(ivt, parsed.weeks, undefined);
    const ml = ev.filter((e) => e.title === 'Машинное обучение' && e.start === '09:00').map((e) => e.date);
    expect(ml[0]).toBe('2026-08-31');
    expect(ml[1]).toBe('2026-09-14');
    expect(ev.every((e) => e.date <= '2027-01-08')).toBe(true);
    // ИВТ: Пт-3 по числителю — последняя возможная 21.12.2026 (04.01.2027 числитель, но 08.01 — пятница в пределах семестра)
    const fri = ev.filter((e) => e.lesson.day === 4).map((e) => e.date);
    expect(fri.at(-1)).toBe('2027-01-08');

    const evp = buildEvents(pie, parsed.weeks, undefined);
    const kv = evp.filter((e) => e.lesson.slotId === 'd0p5').map((e) => e.date);
    expect(kv).not.toContain('2026-09-14');
    expect(kv).toContain('2026-09-21');
    const practice = evp.filter((e) => e.lesson.title.startsWith('Практика')).map((e) => e.date);
    expect(practice[0]).toBe('2026-09-09');
  });

  it('UID стабильны между сборками', () => {
    const a = buildEvents(pie, parsed.weeks, undefined).map((e) => e.uid);
    const b = buildEvents(pie, parsed.weeks, undefined).map((e) => e.uid);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
});

describe('ics', () => {
  it('валидная структура, TZID и фолдинг', () => {
    const ics = buildIcs(buildEvents(pie, parsed.weeks, undefined), { name: 'Тест', stamp: new Date('2026-09-15T08:43:54Z') });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('DTSTART;TZID=Europe/Moscow:20260831T090000');
    expect(ics).toContain('DTSTAMP:20260915T084354Z');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const long = 'SUMMARY:' + 'ы'.repeat(100);
    const folded = fold(long);
    expect(folded.split('\r\n ').join('')).toBe(long);
  });
});
