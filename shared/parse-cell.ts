import { normalizeSpaces, toISODate } from './util';
import type { LessonKind } from './types';

export type ParsedOption = {
  title: string;
  teacher?: string;
  room?: string;
  online?: boolean;
  lecture?: boolean;
  note?: string;
};

export type ParsedCell = {
  kind: LessonKind;
  options: ParsedOption[];
  note?: string;
  startFrom?: string;
  excludeDates?: string[];
};

export type YearContext = {
  /** Год, в котором начинается семестр */
  startYear: number;
  /** Год, в котором заканчивается семестр */
  endYear: number;
  /** Месяц (1-12), с которого начинается семестр */
  startMonth: number;
};

const RE_ELECTIVE = /^к\.?\s*в\.?\s*[-–—]?\s*\d*\s*[:.]?\s*/i;
const RE_OPTIONAL = /^ФТД(?![а-яё])\.?\s*/i;
const RE_TEACHER_INITIALS = /^[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.?$/;
const RE_TEACHER_FULL = /^[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s*\(.*\))?$/;
const RE_TEACHER_SINGLE = /^[А-ЯЁ][а-яё]{2,}$/;
const RE_ROOM = /ауд\.?\s*№?\s*([0-9]+[а-яА-Яa-zA-Z0-9/-]*)/i;
const RE_ONLINE = /онлайн|дистанционно|online/i;
const RE_DATE = /(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/;
const RE_LECTURE = /\(\s*л\s*\)/i;

function resolveYear(month: number, ctx: YearContext): number {
  return month >= ctx.startMonth ? ctx.startYear : ctx.endYear;
}

function dateFromMatch(m: RegExpMatchArray, ctx: YearContext): string {
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = m[3] ? Number(m[3]) : resolveYear(mo, ctx);
  if (y < 100) y += 2000;
  return toISODate(y, mo, d);
}

function isRoomLine(line: string): boolean {
  return RE_ROOM.test(line) || /^(онлайн|дистанционно|online)(?![а-яёa-z])/i.test(line);
}

function isDateNote(line: string): boolean {
  return RE_DATE.test(line) && !RE_ROOM.test(line);
}

type Block = { lines: string[] };

/**
 * Разбирает текст ячейки расписания в структуру: вид занятия, варианты (для к.в. их может быть несколько),
 * заметки и даты-исключения. Эвристики подобраны под формат таблицы ЯрГУ (см. tests/parse-cell.test.ts).
 */
export function parseCell(raw: string, ctx: YearContext): ParsedCell | null {
  const lines = raw.replace(/\r/g, '').split('\n').map((l) => normalizeSpaces(l));
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (!lines.length) return null;

  let kind: LessonKind = 'regular';
  if (RE_OPTIONAL.test(lines[0])) {
    kind = 'optional';
    lines[0] = lines[0].replace(RE_OPTIONAL, '');
  } else if (RE_ELECTIVE.test(lines[0])) {
    kind = 'elective';
    lines[0] = lines[0].replace(RE_ELECTIVE, '');
  }

  const cellNotes: string[] = [];
  const excludeDates: string[] = [];
  let startFrom: string | undefined;

  // Разбиение на блоки-варианты. Для обычной пары всё, что после аудитории, уходит в заметку.
  const blocks: Block[] = [];
  let cur: Block = { lines: [] };
  let curHasRoom = false;
  const flush = () => {
    if (cur.lines.length) blocks.push(cur);
    cur = { lines: [] };
    curHasRoom = false;
  };

  for (const line of lines) {
    if (line === '') {
      if (kind === 'elective') flush();
      continue;
    }
    if (isDateNote(line)) {
      cellNotes.push(line);
      continue;
    }
    if (kind === 'elective') {
      if (RE_ELECTIVE.test(line)) {
        flush();
        const rest = line.replace(RE_ELECTIVE, '');
        if (rest) cur.lines.push(rest);
        continue;
      }
      if (curHasRoom) flush();
      cur.lines.push(line);
      if (isRoomLine(line)) curHasRoom = true;
    } else {
      cur.lines.push(line);
    }
  }
  flush();

  for (const n of cellNotes) {
    const m = n.match(RE_DATE);
    if (!m) continue;
    const iso = dateFromMatch(m, ctx);
    if (/^с\s/i.test(n) || /^начиная/i.test(n)) startFrom = iso;
    else if (/не\s+будет|отмен|нет\s+пар/i.test(n)) excludeDates.push(iso);
  }

  const options = blocks.map((b) => parseBlock(b.lines)).filter((o): o is ParsedOption => !!o && !!o.title);
  if (!options.length) {
    // Ячейка без названия (например, только заметка) — считаем занятием с текстом заметки.
    if (cellNotes.length) return { kind, options: [{ title: cellNotes.join('. ') }], note: undefined, startFrom, excludeDates: excludeDates.length ? excludeDates : undefined };
    return null;
  }

  return {
    kind,
    options,
    note: cellNotes.length ? cellNotes.join('. ') : undefined,
    startFrom,
    excludeDates: excludeDates.length ? excludeDates : undefined,
  };
}

function parseBlock(lines: string[]): ParsedOption | null {
  const titleParts: string[] = [];
  const noteParts: string[] = [];
  let teacher: string | undefined;
  let room: string | undefined;
  let online = false;
  let lecture = false;
  let seenRoom = false;

  for (const line0 of lines) {
    let line = line0;
    if (RE_LECTURE.test(line)) {
      lecture = true;
      line = normalizeSpaces(line.replace(RE_LECTURE, ''));
      if (!line) continue;
    }
    const roomMatch = line.match(RE_ROOM);
    if (roomMatch) {
      room = roomMatch[1];
      if (RE_ONLINE.test(line)) online = true;
      seenRoom = true;
      continue;
    }
    if (/^(онлайн|дистанционно|online)(?![а-яёa-z])/i.test(line)) {
      online = true;
      seenRoom = true;
      const rest = normalizeSpaces(line.replace(/^(онлайн|дистанционно|online)(?![а-яёa-z])[.,]?/i, ''));
      if (rest) noteParts.push(rest);
      continue;
    }
    if (seenRoom) {
      noteParts.push(line);
      continue;
    }
    if (!teacher && (RE_TEACHER_INITIALS.test(line) || RE_TEACHER_FULL.test(line))) {
      teacher = line;
      continue;
    }
    if (!teacher && titleParts.length && RE_TEACHER_SINGLE.test(line)) {
      teacher = line;
      continue;
    }
    if (teacher) {
      // Текст после преподавателя, но до аудитории — заметка.
      noteParts.push(line);
      continue;
    }
    const tail = line.match(/\s+((?:наука\s+)?онлайн)$/i);
    if (tail) {
      online = true;
      line = normalizeSpaces(line.slice(0, -tail[0].length));
      if (/наука/i.test(tail[1])) noteParts.push('Платформа «Наука онлайн»');
    }
    titleParts.push(line);
  }

  const title = normalizeSpaces(titleParts.join(' '));
  if (!title) return null;
  return {
    title,
    teacher,
    room,
    online: online || undefined,
    lecture: lecture || undefined,
    note: noteParts.length ? noteParts.join('. ') : undefined,
  };
}
