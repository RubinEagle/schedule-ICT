import type { Week } from '../../shared/types';
import { formatWeekRange } from '../lib/format';

type Props = { weeks: Week[]; index: number; currentIndex?: number; onChange: (i: number) => void };

export function WeekNav({ weeks, index, currentIndex, onChange }: Props) {
  const week = weeks[index];
  const isCurrent = currentIndex === index;
  return (
    <nav className="weeknav" aria-label="Неделя">
      <button type="button" className="weeknav__arrow" disabled={index <= 0} onClick={() => onChange(index - 1)} aria-label="Предыдущая неделя">
        ‹
      </button>
      <div className="weeknav__center">
        <div className="weeknav__range">{formatWeekRange(week.start, week.end)}</div>
        <div className="weeknav__meta">
          <span className={`badge badge--${week.parity}`}>{week.parity === 'odd' ? 'числитель' : 'знаменатель'}</span>
          <span className="weeknav__num">{isCurrent ? 'текущая' : `${index + 1}-я`} неделя</span>
          {!isCurrent && currentIndex !== undefined && (
            <button type="button" className="link-btn" onClick={() => onChange(currentIndex)}>
              Сегодня
            </button>
          )}
        </div>
      </div>
      <button type="button" className="weeknav__arrow" disabled={index >= weeks.length - 1} onClick={() => onChange(index + 1)} aria-label="Следующая неделя">
        ›
      </button>
    </nav>
  );
}
