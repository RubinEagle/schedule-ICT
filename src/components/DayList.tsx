import { forwardRef } from 'react';
import type { Group, GroupSettings, PairTime, Week } from '../../shared/types';
import type { LessonDiff } from '../../shared/diff';
import { filterLessons } from '../../shared/expand';
import { DAY_SHORT, addDays } from '../../shared/util';
import { buildDayRows, type DayRow } from '../lib/dayRows';
import { dayMonth, dayName, plural } from '../lib/format';
import { weekdayOf } from '../lib/upcoming';
import { LessonCard, ElectiveChoiceCard, EmptyPairCard } from './LessonCard';
import { CoffeeIcon, SunIcon } from './Icons';

type Props = {
  group: Group;
  week: Week;
  settings: GroupSettings;
  pairTimes: PairTime[];
  today: string;
  nowHHMM: string;
  onOpenSettings: () => void;
  dayRefs: React.MutableRefObject<(HTMLElement | null)[]>;
  diffById?: Map<string, LessonDiff>;
  /** Прошедшие дни текущей недели свёрнуты (только на телефоне, см. CSS) */
  pastCollapsed?: boolean;
  onShowPast?: () => void;
};

export const DAYS = [0, 1, 2, 3, 4, 5];

export function DayList({ group, week, settings, pairTimes, today, nowHHMM, onOpenSettings, dayRefs, diffById, pastCollapsed, onShowPast }: Props) {
  const lessons = filterLessons(group, settings);
  const semesterOver = week.start > group.semesterEnd;
  const diffOf = (id: string) => diffById?.get(id);
  const pastDays = DAYS.filter((d) => addDays(week.start, d) < today);
  const collapse = !!pastCollapsed && pastDays.length > 0 && pastDays.length < DAYS.length;

  return (
    <section className={`days${collapse ? ' days--collapse-past' : ''}`}>
      {collapse && (
        <button type="button" className="days__past" onClick={onShowPast}>
          <span>
            {pastDays.length === 1 ? 'Прошёл' : 'Прошли'} {pastDays.map((d) => DAY_SHORT[d].toLowerCase()).join(', ')}
          </span>
          <span className="days__past-action">показать</span>
        </button>
      )}
      {semesterOver && (
        <p className="notice">
          Семестр у группы {group.name} закончился {dayMonth(group.semesterEnd)} ({dayName(weekdayOf(group.semesterEnd)).toLowerCase()}).
        </p>
      )}
      {DAYS.map((day) => {
        const date = addDays(week.start, day);
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
            isOff={!!group.daysOff?.includes(day)}
            rows={buildDayRows(lessons, day, week, group, date, pairTimes)}
            today={today}
            nowHHMM={nowHHMM}
            onOpenSettings={onOpenSettings}
            diffOf={diffOf}
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
  isOff: boolean;
  rows: DayRow[];
  today: string;
  nowHHMM: string;
  onOpenSettings: () => void;
  diffOf: (id: string) => LessonDiff | undefined;
};

const DayCard = forwardRef<HTMLElement, DayCardProps>(function DayCard({ day, date, isToday, isPast, isOff, rows, today, nowHHMM, onOpenSettings, diffOf }, ref) {
  const count = rows.filter((r) => r.type === 'lesson').length;
  const empty = rows.length === 0;
  return (
    <article ref={ref} id={`day-${day}`} className={`day${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}${empty ? ' is-empty' : ''}`}>
      <header className="day__head">
        <h2 className="day__name">{dayName(day)}</h2>
        <span className="day__date">{dayMonth(date)}</span>
        {isToday && <span className="day__today">сегодня</span>}
        {!empty && (
          <span className="day__count">
            {count} {plural(count, ['пара', 'пары', 'пар'])}
          </span>
        )}
      </header>
      {empty ? (
        <p className="day__empty">
          {isOff ? <SunIcon size={18} /> : <CoffeeIcon size={18} />}
          {isOff ? 'Выходной' : 'Пар нет'}
        </p>
      ) : (
        <ol className="timeline">
          {rows.map((row) =>
            row.type === 'empty' ? (
              <EmptyPairCard key={`e${row.pair}`} pair={row.pair} start={row.start} end={row.end} leading={row.leading} date={date} today={today} nowHHMM={nowHHMM} />
            ) : row.lessons.length > 1 && row.lessons[0].slotId ? (
              <ElectiveChoiceCard key={`s${row.pair}`} lessons={row.lessons} date={date} today={today} nowHHMM={nowHHMM} onChoose={onOpenSettings} diffOf={diffOf} />
            ) : (
              row.lessons.map((l) => <LessonCard key={l.id} lesson={l} date={date} today={today} nowHHMM={nowHHMM} diff={diffOf(l.id)} />)
            ),
          )}
        </ol>
      )}
    </article>
  );
});
