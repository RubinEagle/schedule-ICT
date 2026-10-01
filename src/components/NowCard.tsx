import type { Group, GroupSettings, Lesson, Week } from '../../shared/types';
import { dayMonth } from '../lib/format';
import { toMinutes, untilText } from '../lib/time';
import { findUpcoming, weekdayOf } from '../lib/upcoming';
import { progress } from './LessonCard';
import { PinIcon, UserIcon } from './Icons';

type Props = { group: Group; settings: GroupSettings; weeks: Week[]; today: string; nowHHMM: string };

/** Главная карточка: что идёт сейчас и что дальше (вплоть до понедельника, если сегодня выходной). */
export function NowCard({ group, settings, weeks, today, nowHHMM }: Props) {
  const { live, next, todayCount } = findUpcoming(group, settings, weeks, today, nowHHMM);
  const off = group.daysOff?.includes(weekdayOf(today)) || weekdayOf(today) === 6;

  if (live.length) {
    const l = live[0];
    const left = toMinutes(l.end) - toMinutes(nowHHMM);
    return (
      <section className="now now--live" aria-live="polite">
        <div className="now__eyebrow">
          <i className="now__pulse" /> Сейчас · {l.pair} пара
        </div>
        <div className="now__title">{titleOf(live)}</div>
        <Details lesson={l} multiple={live.length > 1} />
        <div className="now__progress">
          <span className="now__bar">
            <i style={{ width: `${Math.round(progress(l.start, l.end, nowHHMM) * 100)}%` }} />
          </span>
          <span className="now__left">
            до {l.end} · ещё {left} мин
          </span>
        </div>
        {next && next.offset === 0 && (
          <div className="now__then">
            Дальше в {next.lessons[0].start}: <b>{titleOf(next.lessons)}</b>
            {next.lessons.length === 1 && next.lessons[0].room ? `, ауд. ${next.lessons[0].room}` : ''}
          </div>
        )}
      </section>
    );
  }

  if (!next) return null;
  const l = next.lessons[0];
  const eyebrow =
    next.offset === 0
      ? `Дальше · ${untilText(nowHHMM, l.start)}`
      : todayCount > 0
        ? 'На сегодня всё'
        : off
          ? 'Сегодня выходной'
          : 'Сегодня пар нет';
  return (
    <section className="now">
      <div className="now__eyebrow">{eyebrow}</div>
      <div className="now__when">{whenText(next.offset, next.date, l.start)}</div>
      <div className="now__title">{titleOf(next.lessons)}</div>
      <Details lesson={l} multiple={next.lessons.length > 1} />
    </section>
  );
}

function Details({ lesson, multiple }: { lesson: Lesson; multiple: boolean }) {
  if (multiple) return <div className="now__meta">Варианты в разных аудиториях — выберите свой в настройках</div>;
  if (!lesson.room && !lesson.online && !lesson.teacher) return null;
  return (
    <div className="now__meta">
      {lesson.room || lesson.online ? (
        <span>
          <PinIcon />
          {lesson.room ? `ауд. ${lesson.room}${lesson.online ? ' · онлайн' : ''}` : 'онлайн'}
        </span>
      ) : null}
      {lesson.teacher && (
        <span>
          <UserIcon />
          {lesson.teacher}
        </span>
      )}
    </div>
  );
}

function titleOf(lessons: Lesson[]): string {
  return lessons.length > 1 ? `Курс по выбору · ${lessons.length} варианта` : lessons[0].title;
}

const ON_DAY = ['В понедельник', 'Во вторник', 'В среду', 'В четверг', 'В пятницу', 'В субботу', 'В воскресенье'];

function whenText(offset: number, date: string, start: string): string {
  if (offset === 0) return `Сегодня в ${start}`;
  if (offset === 1) return `Завтра в ${start}`;
  return `${ON_DAY[weekdayOf(date)]}, ${dayMonth(date)}, в ${start}`;
}
