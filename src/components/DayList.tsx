import { useEffect, useRef } from 'react';
import type { Group, GroupSettings, Lesson, Week } from '../../shared/types';
import { filterLessons, occurrenceDate } from '../../shared/expand';
import { addDays } from '../../shared/util';
import { formatDayTitle } from '../lib/format';
import { LessonCard, ElectiveChoiceCard } from './LessonCard';

type Props = { group: Group; week: Week; settings: GroupSettings; today: string; onOpenSettings: () => void };

const DAYS = [0, 1, 2, 3, 4, 5];

export function DayList({ group, week, settings, today, onOpenSettings }: Props) {
  const lessons = filterLessons(group, settings);
  const todayRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // На телефоне прокручиваем к сегодняшнему дню, если он на этой неделе
    if (todayRef.current && window.matchMedia('(max-width: 899px)').matches) {
      const top = todayRef.current.getBoundingClientRect().top + window.scrollY - 140;
      if (top > 0) window.scrollTo({ top, behavior: 'smooth' });
    }
  }, [week.index, group.id]);

  const semesterOver = week.start > group.semesterEnd;

  return (
    <section className="days">
      {semesterOver && <p className="notice">Семестр у группы {group.name} закончился {formatDayTitle(group.semesterEnd, dayOf(group.semesterEnd))}.</p>}
      {DAYS.map((day) => {
        const date = addDays(week.start, day);
        const isToday = date === today;
        const isPast = date < today;
        const dayLessons = lessons
          .filter((l) => l.day === day && occurrenceDate(l, week, group) === date)
          .sort((a, b) => a.pair - b.pair);
        const groups = groupByPair(dayLessons);
        return (
          <article key={day} ref={isToday ? todayRef : undefined} className={`day${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}`}>
            <h2 className="day__title">
              {formatDayTitle(date, day)}
              {isToday && <span className="day__today">сегодня</span>}
            </h2>
            {groups.length === 0 ? (
              <p className="day__empty">Пар нет</p>
            ) : (
              <ul className="day__list">
                {groups.map((g) =>
                  g.length > 1 && g[0].slotId ? (
                    <ElectiveChoiceCard key={`${g[0].pair}-slot`} lessons={g} date={date} today={today} onChoose={onOpenSettings} />
                  ) : (
                    g.map((l) => <LessonCard key={l.id} lesson={l} date={date} today={today} />)
                  ),
                )}
              </ul>
            )}
          </article>
        );
      })}
    </section>
  );
}

function dayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Объединяет варианты одного к.в. (один slotId) в группу; остальные пары — по одной. */
function groupByPair(lessons: Lesson[]): Lesson[][] {
  const out: Lesson[][] = [];
  const bySlot = new Map<string, Lesson[]>();
  for (const l of lessons) {
    if (l.slotId) {
      const arr = bySlot.get(l.slotId);
      if (arr) {
        arr.push(l);
        continue;
      }
      const fresh = [l];
      bySlot.set(l.slotId, fresh);
      out.push(fresh);
    } else out.push([l]);
  }
  return out;
}
