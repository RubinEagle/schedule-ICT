import { forwardRef } from 'react';
import type { Group, GroupSettings, PairTime, Week } from '../../shared/types';
import { filterLessons } from '../../shared/expand';
import { addDays } from '../../shared/util';
import { buildDayRows } from '../lib/dayRows';
import { formatDayTitle } from '../lib/format';
import { LessonCard, ElectiveChoiceCard, EmptyPairCard } from './LessonCard';

type Props = {
  group: Group;
  week: Week;
  settings: GroupSettings;
  pairTimes: PairTime[];
  today: string;
  nowHHMM: string;
  onOpenSettings: () => void;
  dayRefs: React.MutableRefObject<(HTMLElement | null)[]>;
};

export const DAYS = [0, 1, 2, 3, 4, 5];

export function DayList({ group, week, settings, pairTimes, today, nowHHMM, onOpenSettings, dayRefs }: Props) {
  const lessons = filterLessons(group, settings);
  const semesterOver = week.start > group.semesterEnd;

  return (
    <section className="days">
      {semesterOver && <p className="notice">Семестр у группы {group.name} закончился {formatDayTitle(group.semesterEnd, dayOf(group.semesterEnd))}.</p>}
      {DAYS.map((day) => {
        const date = addDays(week.start, day);
        const rows = buildDayRows(lessons, day, week, group, date, pairTimes);
        return (
          <DayCard
            key={day}
            ref={(el) => {
              dayRefs.current[day] = el;
            }}
            day={day}
            date={date}
            isToday={date === today}
            isPast={date < today}
            rows={rows}
            today={today}
            nowHHMM={nowHHMM}
            onOpenSettings={onOpenSettings}
          />
        );
      })}
    </section>
  );
}

type DayCardProps = {
  day: number;
  date: string;
  isToday: boolean;
  isPast: boolean;
  rows: ReturnType<typeof buildDayRows>;
  today: string;
  nowHHMM: string;
  onOpenSettings: () => void;
};

const DayCard = forwardRef<HTMLElement, DayCardProps>(function DayCard({ day, date, isToday, isPast, rows, today, nowHHMM, onOpenSettings }, ref) {
  return (
    <article ref={ref} id={`day-${day}`} className={`day${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}`}>
      <h2 className="day__title">
        {formatDayTitle(date, day)}
        {isToday && <span className="day__today">сегодня</span>}
      </h2>
      {rows.length === 0 ? (
        <p className="day__empty">
          <span className="day__empty-icon" aria-hidden="true">
            ☕
          </span>
          Пар нет
        </p>
      ) : (
        <ul className="day__list">
          {rows.map((row) =>
            row.type === 'empty' ? (
              <EmptyPairCard key={`e${row.pair}`} pair={row.pair} start={row.start} end={row.end} date={date} today={today} nowHHMM={nowHHMM} />
            ) : row.lessons.length > 1 && row.lessons[0].slotId ? (
              <ElectiveChoiceCard key={`s${row.pair}`} lessons={row.lessons} date={date} today={today} nowHHMM={nowHHMM} onChoose={onOpenSettings} />
            ) : (
              row.lessons.map((l) => <LessonCard key={l.id} lesson={l} date={date} today={today} nowHHMM={nowHHMM} />)
            ),
          )}
        </ul>
      )}
    </article>
  );
});

function dayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}
