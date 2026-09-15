import * as XLSX from 'xlsx';
import type { ElectiveSlot, Group, Lesson, Parity, Schedule, Week } from './types';
import { parseCell, type ParsedCell, type ParsedOption, type YearContext } from './parse-cell';
import { DAY_NAMES, excelSerialToISO, normalizeSpaces, parseISODate, shortHash } from './util';

export type GroupConfig = { id: string; match: RegExp };

/**
 * Группы, которые попадают на сайт. id — стабильный ключ (URL .ics, localStorage), имя берётся из заголовка таблицы.
 * В таблице группу ИВТ-11МО 15.09.2026 переименовали в ИВТ-14МО, поэтому допускаем оба варианта.
 */
export const GROUPS: GroupConfig[] = [
  { id: 'ivt-11mo', match: /^ИВТ-1[14]МО/i },
  { id: 'pie-13mo', match: /^ПИЭ-13МО/i },
];

export type Override = Partial<Pick<ParsedCell, 'kind' | 'note' | 'startFrom' | 'excludeDates'>> & {
  options?: ParsedOption[];
  /** Полностью убрать занятие из расписания */
  remove?: boolean;
};
export type Overrides = Record<string, Override>;

const SHEET_NAME = /бакалавры и магистры/i;

type Merge = { s: { r: number; c: number }; e: { r: number; c: number } };

class Sheet {
  private mergeAt = new Map<string, Merge>();
  constructor(private ws: XLSX.WorkSheet) {
    for (const m of (ws['!merges'] ?? []) as Merge[]) {
      for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) this.mergeAt.set(`${r}:${c}`, m);
    }
  }
  get range() {
    return XLSX.utils.decode_range(this.ws['!ref'] ?? 'A1:A1');
  }
  merge(r: number, c: number): Merge | undefined {
    return this.mergeAt.get(`${r}:${c}`);
  }
  /** Адрес ячейки, в которой лежит значение (левый верхний угол объединения). */
  anchor(r: number, c: number): { r: number; c: number } {
    const m = this.merge(r, c);
    return m ? { r: m.s.r, c: m.s.c } : { r, c };
  }
  raw(r: number, c: number): XLSX.CellObject | undefined {
    const a = this.anchor(r, c);
    return this.ws[XLSX.utils.encode_cell(a)] as XLSX.CellObject | undefined;
  }
  text(r: number, c: number): string {
    const cell = this.raw(r, c);
    if (!cell || cell.v === undefined || cell.v === null) return '';
    return String(cell.v);
  }
  num(r: number, c: number): number | undefined {
    const cell = this.raw(r, c);
    if (!cell) return undefined;
    if (typeof cell.v === 'number') return cell.v;
    if (cell.v instanceof Date) return (cell.v.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
    const n = Number(String(cell.v).replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
}

export type ParseResult = Omit<Schedule, 'generatedAt' | 'sourceModified' | 'sourceUrl'>;

export function parseWorkbook(data: ArrayBuffer | Uint8Array, overrides: Overrides = {}): ParseResult {
  const wb = XLSX.read(data, { type: data instanceof Uint8Array ? 'buffer' : 'array', cellDates: false });
  const sheetName = wb.SheetNames.find((n) => SHEET_NAME.test(n)) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('Не найден лист с расписанием');
  const sheet = new Sheet(ws);
  const range = sheet.range;

  // --- Заголовки групп (первая строка)
  const headerRow = 0;
  const groupCols: { cfg: GroupConfig; col: number; name: string; semesterEnd: string }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const t = sheet.text(headerRow, c).trim();
    if (!t) continue;
    for (const cfg of GROUPS) {
      if (cfg.match.test(t)) {
        const semMatch = t.match(/до\s+(\d{1,2})\.(\d{1,2})\.(\d{2,4})/i);
        if (!semMatch) throw new Error(`У группы «${t}» не найдена дата конца семестра`);
        let y = Number(semMatch[3]);
        if (y < 100) y += 2000;
        const semesterEnd = `${y}-${semMatch[2].padStart(2, '0')}-${semMatch[1].padStart(2, '0')}`;
        groupCols.push({ cfg, col: c, name: normalizeSpaces(t.split('\n')[0]), semesterEnd });
      }
    }
  }
  for (const cfg of GROUPS) {
    if (!groupCols.some((g) => g.cfg.id === cfg.id)) throw new Error(`Группа ${cfg.id} не найдена в заголовке таблицы`);
  }

  // --- Недели: колонки A/B (числитель) и C/D (знаменатель)
  const weeksRaw: Week[] = [];
  for (let r = 0; r <= range.e.r; r++) {
    const a = sheet.num(r, 0);
    const b = sheet.num(r, 1);
    const c = sheet.num(r, 2);
    const d = sheet.num(r, 3);
    if (a && b && a > 40000 && b > 40000) weeksRaw.push({ index: 0, start: excelSerialToISO(a), end: excelSerialToISO(b), parity: 'odd' });
    if (c && d && c > 40000 && d > 40000) weeksRaw.push({ index: 0, start: excelSerialToISO(c), end: excelSerialToISO(d), parity: 'even' });
  }
  const seen = new Set<string>();
  const weeks = weeksRaw
    .filter((w) => (seen.has(w.start) ? false : (seen.add(w.start), true)))
    .sort((x, y) => x.start.localeCompare(y.start))
    .map((w, i) => ({ ...w, index: i }));
  if (weeks.length < 2) throw new Error('Не удалось прочитать список недель (колонки A–D)');

  const first = parseISODate(weeks[0].start);
  const last = parseISODate(weeks[weeks.length - 1].end);
  const yearCtx: YearContext = { startYear: first.y, endYear: last.y, startMonth: first.m };

  // --- Пары: строки, где в колонке F есть номер и время
  const DAY_COL = 4;
  const TIME_COL = 5;
  const pairRows: { r: number; day: number; pair: number; start: string; end: string }[] = [];
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const f = sheet.text(r, TIME_COL);
    const anchor = sheet.anchor(r, TIME_COL);
    if (!f || anchor.r !== r) continue;
    const m = f.match(/(\d)\D+?(\d{1,2}:\d{2})\D+?(\d{1,2}:\d{2})/);
    if (!m) continue;
    const dayText = sheet.text(r, DAY_COL).trim().toLowerCase();
    const day = DAY_NAMES.findIndex((n) => dayText.startsWith(n));
    if (day < 0) continue;
    pairRows.push({ r, day, pair: Number(m[1]), start: normTime(m[2]), end: normTime(m[3]) });
  }
  if (!pairRows.length) throw new Error('Не найдено ни одной пары (колонка F)');

  // --- Занятия по группам
  const groups: Group[] = groupCols.map((g) => {
    const lessons: Lesson[] = [];
    const slots: ElectiveSlot[] = [];

    for (const p of pairRows) {
      const top = sheet.text(p.r, g.col);
      const bottom = sheet.text(p.r + 1, g.col);
      const topAnchor = sheet.anchor(p.r, g.col);
      const bottomAnchor = sheet.anchor(p.r + 1, g.col);
      const topMerge = sheet.merge(p.r, g.col);
      const coversBoth = !!topMerge && topMerge.s.r <= p.r && topMerge.e.r >= p.r + 1 && topAnchor.r === bottomAnchor.r && topAnchor.c === bottomAnchor.c;

      const entries: { text: string; parity: Parity }[] = [];
      if (coversBoth) entries.push({ text: top, parity: 'both' });
      else if (top.trim() && bottom.trim() && normalizeSpaces(top) === normalizeSpaces(bottom)) entries.push({ text: top, parity: 'both' });
      else {
        if (top.trim()) entries.push({ text: top, parity: 'odd' });
        if (bottom.trim()) entries.push({ text: bottom, parity: 'even' });
      }

      for (const e of entries) {
        let parsed = parseCell(e.text, yearCtx);
        const ov = overrides[`${g.cfg.id}/${p.day}/${p.pair}`] ?? overrides[`${g.cfg.id}/${p.day}/${p.pair}/${e.parity}`];
        if (ov?.remove) continue;
        if (ov) parsed = applyOverride(parsed, ov);
        if (!parsed) continue;

        const slotId = `d${p.day}p${p.pair}`;
        const isSlot = parsed.kind === 'elective' && parsed.options.length > 1;
        if (isSlot && !slots.some((s) => s.slotId === slotId)) {
          slots.push({ slotId, day: p.day, pair: p.pair, options: parsed.options.map((o) => ({ optionId: optionIdOf(o.title), title: o.title })) });
        }
        for (const o of parsed.options) {
          const title = o.title;
          const lesson: Lesson = {
            id: `${g.cfg.id}-${slotId}-${e.parity}-${shortHash(title)}`,
            day: p.day,
            pair: p.pair,
            start: p.start,
            end: p.end,
            parity: e.parity,
            kind: parsed.kind,
            title,
          };
          if (o.teacher) lesson.teacher = o.teacher;
          if (o.room) lesson.room = o.room;
          if (o.online) lesson.online = true;
          if (o.lecture) lesson.lecture = true;
          const note = [o.note, parsed.note].filter(Boolean).join('. ');
          if (note) lesson.note = note;
          if (parsed.startFrom) lesson.startFrom = parsed.startFrom;
          if (parsed.excludeDates?.length) lesson.excludeDates = parsed.excludeDates;
          if (isSlot) {
            lesson.slotId = slotId;
            lesson.optionId = optionIdOf(title);
          }
          lessons.push(lesson);
        }
      }
    }

    lessons.sort((a, b) => a.day - b.day || a.pair - b.pair || a.parity.localeCompare(b.parity));
    slots.sort((a, b) => a.day - b.day || a.pair - b.pair);
    return {
      id: g.cfg.id,
      name: g.name,
      semesterEnd: g.semesterEnd,
      lessons,
      slots,
      hasOptional: lessons.some((l) => l.kind === 'optional'),
    };
  });

  for (const gr of groups) {
    if (!gr.lessons.length) throw new Error(`У группы ${gr.name} не найдено ни одного занятия — возможно, структура таблицы изменилась`);
  }

  return { weeks, groups };
}

export function optionIdOf(title: string): string {
  return shortHash(normalizeSpaces(title).toLowerCase());
}

function normTime(t: string): string {
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${m}`;
}

function applyOverride(parsed: ParsedCell | null, ov: Override): ParsedCell | null {
  const base: ParsedCell = parsed ?? { kind: 'regular', options: [] };
  return {
    kind: ov.kind ?? base.kind,
    options: ov.options ?? base.options,
    note: ov.note !== undefined ? ov.note || undefined : base.note,
    startFrom: ov.startFrom ?? base.startFrom,
    excludeDates: ov.excludeDates ?? base.excludeDates,
  };
}
