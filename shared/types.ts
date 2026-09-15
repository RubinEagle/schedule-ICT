/** Чётность недели: числитель / знаменатель / каждую неделю. */
export type Parity = 'odd' | 'even' | 'both';

export type Week = {
  index: number;
  /** ISO-дата понедельника */
  start: string;
  /** ISO-дата воскресенья */
  end: string;
  parity: 'odd' | 'even';
};

export type LessonKind = 'regular' | 'optional' | 'elective';

export type Lesson = {
  id: string;
  /** 0 = понедельник … 5 = суббота */
  day: number;
  pair: number;
  start: string;
  end: string;
  parity: Parity;
  kind: LessonKind;
  title: string;
  teacher?: string;
  room?: string;
  online?: boolean;
  lecture?: boolean;
  note?: string;
  /** ISO-дата, раньше которой занятие не проводится */
  startFrom?: string;
  /** ISO-даты, в которые занятие отменено */
  excludeDates?: string[];
  slotId?: string;
  optionId?: string;
};

export type ElectiveOption = { optionId: string; title: string };

export type ElectiveSlot = {
  slotId: string;
  day: number;
  pair: number;
  options: ElectiveOption[];
};

export type Group = {
  id: string;
  name: string;
  /** ISO-дата последнего дня семестра */
  semesterEnd: string;
  lessons: Lesson[];
  slots: ElectiveSlot[];
  hasOptional: boolean;
};

/** Стандартное время пары в конкретный день недели (в субботу оно отличается) */
export type PairTime = { day: number; pair: number; start: string; end: string };

export type Schedule = {
  generatedAt: string;
  sourceModified: string;
  sourceUrl: string;
  weeks: Week[];
  pairTimes: PairTime[];
  groups: Group[];
};

/** Настройки одной группы, хранятся в localStorage и определяют вариант .ics */
export type GroupSettings = {
  /** slotId -> optionId | 'all' */
  electives: Record<string, string>;
  showOptional: boolean;
};

export type CalendarEvent = {
  uid: string;
  date: string;
  start: string;
  end: string;
  title: string;
  location?: string;
  description?: string;
  lesson: Lesson;
};
