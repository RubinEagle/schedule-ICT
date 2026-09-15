import { describe, expect, it } from 'vitest';
import { parseCell } from '../shared/parse-cell';

const ctx = { startYear: 2026, endYear: 2027, startMonth: 8 };

describe('parseCell', () => {
  it('обычная пара: название, преподаватель, аудитория', () => {
    const p = parseCell('Машинное обучение\nБыстров Л.Ю.\nауд. 309', ctx)!;
    expect(p.kind).toBe('regular');
    expect(p.options).toEqual([{ title: 'Машинное обучение', teacher: 'Быстров Л.Ю.', room: '309', online: undefined, lecture: undefined, note: undefined }]);
  });

  it('аудитория без пробела и лекция', () => {
    const p = parseCell('Математический анализ (л)\nМорозов А.Н.\nауд.216', ctx)!;
    expect(p.options[0]).toMatchObject({ title: 'Математический анализ', lecture: true, room: '216' });
  });

  it('ФТД -> optional', () => {
    const p = parseCell('ФТД Современные редакторские технологии\nШабаршин В.А.\nауд. 215', ctx)!;
    expect(p.kind).toBe('optional');
    expect(p.options[0].title).toBe('Современные редакторские технологии');
  });

  it('к.в. с двумя вариантами через пустую строку', () => {
    const p = parseCell(
      'к.в. - 2\nСовременные сетевые технологии \nКоновалов Е.В.\nауд. 201\n\nТехнологии функционального программирования в современных информационных системах \nВасильев А.М.\nауд.223',
      ctx,
    )!;
    expect(p.kind).toBe('elective');
    expect(p.options.map((o) => o.title)).toEqual(['Современные сетевые технологии', 'Технологии функционального программирования в современных информационных системах']);
    expect(p.options[1]).toMatchObject({ teacher: 'Васильев А.М.', room: '223' });
  });

  it('к.в. с двумя вариантами подряд, преподаватель одним словом, онлайн в аудитории', () => {
    const p = parseCell('к.в.-1 \nОценка качества программного обеспечения\nХинт\nауд. 304 (онлайн)\nНейросети и нерокомпьютеры\nКоновалов Е.В.\nауд. 204', ctx)!;
    expect(p.options).toHaveLength(2);
    expect(p.options[0]).toMatchObject({ title: 'Оценка качества программного обеспечения', teacher: 'Хинт', room: '304', online: true });
    expect(p.options[1]).toMatchObject({ title: 'Нейросети и нерокомпьютеры', teacher: 'Коновалов Е.В.', room: '204' });
  });

  it('к.в. с повторным маркером, полным ФИО, онлайн и заметкой об отмене', () => {
    const p = parseCell(
      'к.в. Управление ИТ-проектами\nЕрофеев Александр Александрович (ПравоТех)\nонлайн\nк.в. Математические методы и модели принятия решения Наука онлайн\n14.09 пары не будет',
      ctx,
    )!;
    expect(p.kind).toBe('elective');
    expect(p.options).toHaveLength(2);
    expect(p.options[0]).toMatchObject({ title: 'Управление ИТ-проектами', teacher: 'Ерофеев Александр Александрович (ПравоТех)', online: true });
    expect(p.options[1]).toMatchObject({ title: 'Математические методы и модели принятия решения', online: true });
    expect(p.excludeDates).toEqual(['2026-09-14']);
    expect(p.note).toBe('14.09 пары не будет');
  });

  it('к.в. с одним вариантом', () => {
    const p = parseCell('к.в.\nПромышленная разработка \nПолетаев А.Ю.\n ауд.223', ctx)!;
    expect(p.kind).toBe('elective');
    expect(p.options).toEqual([{ title: 'Промышленная разработка', teacher: 'Полетаев А.Ю.', room: '223', online: undefined, lecture: undefined, note: undefined }]);
  });

  it('дата начала «с 9.09.2026»', () => {
    const p = parseCell('Практика в НПО Криста\nс 9.09.2026', ctx)!;
    expect(p.options[0].title).toBe('Практика в НПО Криста');
    expect(p.startFrom).toBe('2026-09-09');
  });

  it('год для дат без года берётся из семестра', () => {
    expect(parseCell('Пара\n12.01 пары не будет', ctx)!.excludeDates).toEqual(['2027-01-12']);
    expect(parseCell('Пара\n12.10 пары не будет', ctx)!.excludeDates).toEqual(['2026-10-12']);
  });

  it('пустая ячейка -> null', () => {
    expect(parseCell('  \n ', ctx)).toBeNull();
  });
});
