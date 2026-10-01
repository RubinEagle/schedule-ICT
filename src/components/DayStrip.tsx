import type { Week } from '../../shared/types';
import { DAY_SHORT, addDays, parseISODate } from '../../shared/util';

type Props = { week: Week; today: string; activeDay: number; daysWithLessons: Set<number>; onPick: (day: number) => void };

/** Полоска дней недели для телефона: дата, точка, если есть пары, подсветка сегодня и дня на экране. */
export function DayStrip({ week, today, activeDay, daysWithLessons, onPick }: Props) {
  return (
    <div className="daystrip" role="list" aria-label="Дни недели">
      {[0, 1, 2, 3, 4, 5].map((day) => {
        const date = addDays(week.start, day);
        const cls = ['daystrip__day', date === today && 'is-today', date < today && 'is-past', day === activeDay && 'is-active'].filter(Boolean).join(' ');
        return (
          <button key={day} type="button" role="listitem" className={cls} onClick={() => onPick(day)} aria-label={`${DAY_SHORT[day]}, ${parseISODate(date).d}`}>
            <span className="daystrip__name">{DAY_SHORT[day]}</span>
            <span className="daystrip__num">{parseISODate(date).d}</span>
            <span className={`daystrip__dot${daysWithLessons.has(day) ? ' has' : ''}`} />
          </button>
        );
      })}
    </div>
  );
}
