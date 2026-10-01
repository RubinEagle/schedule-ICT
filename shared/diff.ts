import type { Group, Lesson, Parity } from './types';

/**
 * Сравнение личного расписания с распарсенной таблицей по сетке «день × пара × неделя».
 * Даты (start_date, exclude_dates) и примечания не сравниваются — только регулярная сетка.
 */
export type DiffKind =
  /** Тот же предмет, но другой преподаватель / аудитория / время / формат */
  | 'changed'
  /** На этом месте в таблице другой предмет */
  | 'replaced'
  /** В таблице есть пара, у вас на этом месте пусто */
  | 'added'
  /** У вас есть пара, в таблице на этом месте пусто */
  | 'missing'
  /** Тот же предмет, но в таблице в другой день / пару / неделю */
  | 'moved'
  /** В таблице курс по выбору или факультатив, который вы не выбрали — не считается отличием */
  | 'not-chosen';

export type DiffField = { field: 'teacher' | 'room' | 'time' | 'online'; local?: string; table?: string };

export type LessonDiff = {
  kind: DiffKind;
  day: number;
  pair: number;
  parity: Parity;
  local?: Lesson;
  table?: Lesson;
  fields: DiffField[];
  /** Для «перенесли»: где эта пара у вас (day/pair/parity выше — где она в таблице) */
  from?: { day: number; pair: number; parity: Parity };
  /** id занятий таблицы, к которым относится отличие (для пометок на карточках) */
  tableIds: string[];
};

type Week = 'odd' | 'even';

export function diffGroups(local: Group, table: Group): LessonDiff[] {
  const raw: LessonDiff[] = [];
  for (const week of ['odd', 'even'] as Week[]) {
    const keys = new Set<string>();
    const at = (ls: Lesson[]) => {
      const m = new Map<string, Lesson[]>();
      for (const l of ls) {
        if (l.parity !== 'both' && l.parity !== week) continue;
        const k = `${l.day}:${l.pair}`;
        keys.add(k);
        m.set(k, [...(m.get(k) ?? []), l]);
      }
      return m;
    };
    const L = at(local.lessons);
    const T = at(table.lessons);
    for (const k of keys) raw.push(...diffCell(L.get(k) ?? [], T.get(k) ?? [], week));
  }
  return detectMoves(mergeParities(raw)).sort((a, b) => a.day - b.day || a.pair - b.pair || parityOrder(a.parity) - parityOrder(b.parity));
}

function diffCell(ls: Lesson[], ts: Lesson[], week: Week): LessonDiff[] {
  const out: LessonDiff[] = [];
  const freeT = [...ts];
  const freeL: Lesson[] = [];
  const base = (l: Lesson | undefined, t: Lesson | undefined) => ({ day: (l ?? t)!.day, pair: (l ?? t)!.pair, parity: week as Parity, local: l, table: t });

  for (const l of ls) {
    let best = -1;
    let score = 0;
    freeT.forEach((t, i) => {
      const s = titleSimilarity(l.title, t.title);
      if (s > score) (score = s), (best = i);
    });
    if (best < 0 || score < 0.85) {
      freeL.push(l);
      continue;
    }
    const [t] = freeT.splice(best, 1);
    // Остальные варианты того же курса по выбору — не отличие, вы просто выбрали этот
    if (t.slotId) for (let i = freeT.length - 1; i >= 0; i--) if (freeT[i].slotId === t.slotId) freeT.splice(i, 1);
    const fields = compareFields(l, t);
    if (fields.length) out.push({ ...base(l, t), kind: 'changed', fields, tableIds: [t.id] });
  }

  // Непохожие пары на одном месте — «другой предмет». Сначала обычные занятия таблицы.
  freeT.sort((a, b) => Number(a.kind !== 'regular') - Number(b.kind !== 'regular'));
  while (freeL.length && freeT.length) {
    const l = freeL.shift()!;
    const t = freeT.shift()!;
    if (t.slotId) for (let i = freeT.length - 1; i >= 0; i--) if (freeT[i].slotId === t.slotId) freeT.splice(i, 1);
    out.push({ ...base(l, t), kind: 'replaced', fields: [], tableIds: [t.id] });
  }
  for (const l of freeL) out.push({ ...base(l, undefined), kind: 'missing', fields: [], tableIds: [] });
  for (const t of freeT) out.push({ ...base(undefined, t), kind: t.kind === 'regular' ? 'added' : 'not-chosen', fields: [], tableIds: [t.id] });
  return out;
}

function compareFields(l: Lesson, t: Lesson): DiffField[] {
  const fields: DiffField[] = [];
  if (norm(l.teacher) !== norm(t.teacher)) fields.push({ field: 'teacher', local: l.teacher, table: t.teacher });
  if (normRoom(l.room) !== normRoom(t.room)) fields.push({ field: 'room', local: l.room, table: t.room });
  if (l.start !== t.start || l.end !== t.end) fields.push({ field: 'time', local: `${l.start}–${l.end}`, table: `${t.start}–${t.end}` });
  if (!!l.online !== !!t.online) fields.push({ field: 'online', local: l.online ? 'онлайн' : 'очно', table: t.online ? 'онлайн' : 'очно' });
  return fields;
}

/** Одинаковые отличия в числитель и знаменатель сворачиваются в одно «каждую неделю». */
function mergeParities(diffs: LessonDiff[]): LessonDiff[] {
  const sig = (d: LessonDiff) => JSON.stringify([d.kind, d.day, d.pair, d.local?.title, d.table?.title, d.fields]);
  const byKey = new Map<string, LessonDiff>();
  const out: LessonDiff[] = [];
  for (const d of diffs) {
    const s = sig(d);
    const prev = byKey.get(s);
    if (prev && prev.parity !== d.parity) {
      prev.parity = 'both';
      prev.tableIds = [...new Set([...prev.tableIds, ...d.tableIds])];
      continue;
    }
    byKey.set(s, d);
    out.push(d);
  }
  return out;
}

/** «Нет в таблице» + «нет у вас» с тем же предметом — это одна перенесённая пара, а не два отличия. */
function detectMoves(diffs: LessonDiff[]): LessonDiff[] {
  let out = [...diffs];
  for (const m of diffs) {
    if (m.kind !== 'missing' || !m.local) continue;
    const candidates = out.filter((d) => (d.kind === 'added' || d.kind === 'not-chosen') && d.table && titleSimilarity(d.table.title, m.local!.title) >= 0.85);
    if (!candidates.length) continue;
    const a = candidates.find((d) => d.day === m.day) ?? candidates[0];
    const t = a.table!;
    const moved: LessonDiff = {
      kind: 'moved',
      day: a.day,
      pair: a.pair,
      parity: a.parity,
      local: m.local,
      table: t,
      from: { day: m.day, pair: m.pair, parity: m.parity },
      // время меняется вместе с парой, отдельно его не показываем
      fields: compareFields(m.local, t).filter((f) => f.field !== 'time'),
      tableIds: a.tableIds,
    };
    out = out.filter((d) => d !== m && d !== a);
    // остальные варианты того же курса по выбору на новом месте — не отличие
    if (t.slotId) out = out.filter((d) => !(d.kind === 'not-chosen' && d.table?.slotId === t.slotId && d.day === a.day && d.pair === a.pair));
    out.push(moved);
  }
  return out;
}

function parityOrder(p: Parity): number {
  return p === 'both' ? 0 : p === 'odd' ? 1 : 2;
}

/** Группа таблицы с тем же названием, что у личного расписания («ИВТ-14МО»). */
export function findMatchingGroup(local: Group, groups: Group[]): Group | undefined {
  const key = (s: string) => s.toUpperCase().replace(/Ё/g, 'Е').replace(/[\s\-–—_.]/g, '');
  return groups.find((g) => key(g.name) === key(local.name));
}

export function isSignificant(d: LessonDiff): boolean {
  return d.kind !== 'not-chosen';
}

function norm(s: string | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function normRoom(s: string | undefined): string {
  return norm(s).replace(/^(ауд|аудитория|каб)\s*/, '');
}

export function titleSimilarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (Math.min(x.length, y.length) >= 10 && (x.includes(y) || y.includes(x))) return 0.9;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
