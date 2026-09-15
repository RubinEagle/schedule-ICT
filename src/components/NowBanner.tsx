import type { Group, GroupSettings, Week } from '../../shared/types';
import { filterLessons, occurrenceDate, locationOf } from '../../shared/expand';
import { untilText } from '../lib/time';

type Props = { group: Group; week: Week; settings: GroupSettings; today: string; nowHHMM: string; todayDay: number };

/** Что происходит сейчас: идущая пара, следующая пара или «на сегодня всё». Показывается только на текущей неделе. */
export function NowBanner({ group, week, settings, today, nowHHMM, todayDay }: Props) {
  if (todayDay > 5) return null;
  const lessons = filterLessons(group, settings)
    .filter((l) => l.day === todayDay && occurrenceDate(l, week, group) === today)
    .sort((a, b) => a.pair - b.pair);

  if (!lessons.length) {
    return (
      <div className="now now--free">
        <span className="now__label">Сегодня</span>
        <span className="now__text">пар нет, можно выдохнуть</span>
      </div>
    );
  }

  const current = lessons.filter((l) => l.start <= nowHHMM && nowHHMM < l.end);
  if (current.length) {
    const l = current[0];
    const more = current.length > 1 ? ` (+${current.length - 1})` : '';
    return (
      <div className="now now--live">
        <span className="now__label">Сейчас</span>
        <span className="now__text">
          <b>{l.title}</b>
          {more}
          {locationOf(l) ? ` · ${locationOf(l)}` : ''} · до {l.end}
        </span>
      </div>
    );
  }

  const next = lessons.find((l) => l.start > nowHHMM);
  if (next) {
    const same = lessons.filter((l) => l.pair === next.pair);
    return (
      <div className="now">
        <span className="now__label">Дальше</span>
        <span className="now__text">
          <b>{same.length > 1 ? `Курс по выбору (${same.length} варианта)` : next.title}</b>
          {locationOf(next) && same.length === 1 ? ` · ${locationOf(next)}` : ''} · в {next.start}, {untilText(nowHHMM, next.start)}
        </span>
      </div>
    );
  }

  return (
    <div className="now now--free">
      <span className="now__label">Сегодня</span>
      <span className="now__text">пары закончились</span>
    </div>
  );
}
