import type { Lesson } from '../../shared/types';
import type { LessonDiff } from '../../shared/diff';
import { DAY_SHORT } from '../../shared/util';
import { toMinutes } from '../lib/time';
import { PinIcon, UserIcon } from './Icons';

export type TimeState = 'past' | 'now' | 'future';

export function timeState(start: string, end: string, date: string, today: string, nowHHMM: string): TimeState {
  if (date < today) return 'past';
  if (date > today) return 'future';
  if (nowHHMM >= end) return 'past';
  if (nowHHMM >= start) return 'now';
  return 'future';
}

export function progress(start: string, end: string, nowHHMM: string): number {
  const a = toMinutes(start);
  const b = toMinutes(end);
  return Math.min(1, Math.max(0, (toMinutes(nowHHMM) - a) / (b - a)));
}

function Tags({ lesson, withKind = true }: { lesson: Lesson; withKind?: boolean }) {
  return (
    <>
      {withKind && lesson.kind === 'elective' && <span className="tag tag--elective">к.в.</span>}
      {withKind && lesson.kind === 'optional' && <span className="tag tag--optional">ФТД</span>}
      {lesson.lecture && <span className="tag">лекция</span>}
      {lesson.online && <span className="tag tag--online">онлайн</span>}
    </>
  );
}

function Meta({ lesson }: { lesson: Lesson }) {
  const loc = lesson.room ? `ауд. ${lesson.room}` : undefined;
  if (!lesson.teacher && !loc) return null;
  return (
    <div className="tl__meta">
      {loc && (
        <span className="tl__room">
          <PinIcon />
          {loc}
        </span>
      )}
      {lesson.teacher && (
        <span>
          <UserIcon />
          {lesson.teacher}
        </span>
      )}
    </div>
  );
}

function Time({ start, end }: { start: string; end: string }) {
  return (
    <div className="tl__time">
      <span className="tl__start">{start}</span>
      <span className="tl__end">{end}</span>
    </div>
  );
}

function Rail() {
  return (
    <div className="tl__rail" aria-hidden="true">
      <i className="tl__dot" />
    </div>
  );
}

function NowBar({ start, end, nowHHMM }: { start: string; end: string; nowHHMM: string }) {
  const left = toMinutes(end) - toMinutes(nowHHMM);
  return (
    <div className="tl__now">
      <span className="tl__now-label">идёт · ещё {left} мин</span>
      <span className="tl__bar">
        <i style={{ width: `${Math.round(progress(start, end, nowHHMM) * 100)}%` }} />
      </span>
    </div>
  );
}

/** Пометка на карточке таблицы: чем эта пара отличается от личного расписания. */
export function DiffMark({ diff }: { diff: LessonDiff }) {
  let text: string;
  if (diff.kind === 'changed') {
    text = diff.fields
      .map((f) => (f.field === 'room' ? (f.local ? `ауд. ${f.local}` : 'без аудитории') : f.field === 'teacher' ? f.local || 'без преподавателя' : f.local))
      .join(', ');
    text = `у вас: ${text}`;
  } else if (diff.kind === 'moved' && diff.from) {
    const f = diff.from;
    text = `у вас эта пара: ${DAY_SHORT[f.day].toLowerCase()}, ${f.pair} пара${f.parity === 'both' ? '' : ` ${f.parity === 'odd' ? 'по числителю' : 'по знаменателю'}`}`;
  } else if (diff.kind === 'replaced') text = `у вас здесь «${diff.local?.title}»`;
  else if (diff.kind === 'added') text = 'этой пары нет в вашем расписании';
  else return null;
  return (
    <div className="tl__diff">
      <b>≠</b> {text}
    </div>
  );
}

type CardProps = { lesson: Lesson; date: string; today: string; nowHHMM: string; diff?: LessonDiff };

export function LessonCard({ lesson, date, today, nowHHMM, diff }: CardProps) {
  const state = timeState(lesson.start, lesson.end, date, today, nowHHMM);
  return (
    <li className={`tl tl--${lesson.kind} is-${state}${diff ? ' has-diff' : ''}`}>
      <Time start={lesson.start} end={lesson.end} />
      <Rail />
      <div className="tl__card">
        <div className="tl__top">
          <span className="tl__pair">{lesson.pair} пара</span>
          <Tags lesson={lesson} />
        </div>
        <div className="tl__title">{lesson.title}</div>
        <Meta lesson={lesson} />
        {lesson.note && <div className="tl__note">{lesson.note}</div>}
        {diff && <DiffMark diff={diff} />}
        {state === 'now' && <NowBar start={lesson.start} end={lesson.end} nowHHMM={nowHHMM} />}
      </div>
    </li>
  );
}

type ChoiceProps = { lessons: Lesson[]; date: string; today: string; nowHHMM: string; onChoose: () => void; diffOf: (id: string) => LessonDiff | undefined };

export function ElectiveChoiceCard({ lessons, date, today, nowHHMM, onChoose, diffOf }: ChoiceProps) {
  const first = lessons[0];
  const state = timeState(first.start, first.end, date, today, nowHHMM);
  return (
    <li className={`tl tl--elective tl--choice is-${state}`}>
      <Time start={first.start} end={first.end} />
      <Rail />
      <div className="tl__card">
        <div className="tl__top">
          <span className="tl__pair">{first.pair} пара</span>
          <span className="tag tag--elective">к.в. · {lessons.length} варианта</span>
          <button type="button" className="tl__choose" onClick={onChoose}>
            Выбрать
          </button>
        </div>
        <ul className="tl__options">
          {lessons.map((l) => {
            const diff = diffOf(l.id);
            return (
              <li key={l.id}>
                <div className="tl__title">
                  {l.title} <Tags lesson={l} withKind={false} />
                </div>
                <Meta lesson={l} />
                {l.note && <div className="tl__note">{l.note}</div>}
                {diff && <DiffMark diff={diff} />}
              </li>
            );
          })}
        </ul>
        {state === 'now' && <NowBar start={first.start} end={first.end} nowHHMM={nowHHMM} />}
      </div>
    </li>
  );
}

type EmptyProps = { pair: number; start: string; end: string; leading: boolean; date: string; today: string; nowHHMM: string };

export function EmptyPairCard({ pair, start, end, leading, date, today, nowHHMM }: EmptyProps) {
  const state = timeState(start, end, date, today, nowHHMM);
  const label = leading ? 'Нет пары' : 'Окно';
  return (
    <li className={`tl tl--gap is-${state}`} aria-label={`${pair} пара: ${label.toLowerCase()}`}>
      <Time start={start} end={end} />
      <Rail />
      <div className="tl__card">
        <span className="tl__pair">{pair} пара</span>
        <span>{label}</span>
      </div>
    </li>
  );
}
