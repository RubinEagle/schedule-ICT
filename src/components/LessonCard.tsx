import type { Lesson } from '../../shared/types';
import { locationOf } from '../../shared/expand';
import { toMinutes } from '../lib/time';

export type TimeState = 'past' | 'now' | 'future';

export function timeState(start: string, end: string, date: string, today: string, nowHHMM: string): TimeState {
  if (date < today) return 'past';
  if (date > today) return 'future';
  if (nowHHMM >= end) return 'past';
  if (nowHHMM >= start) return 'now';
  return 'future';
}

function progress(start: string, end: string, nowHHMM: string): number {
  const a = toMinutes(start);
  const b = toMinutes(end);
  return Math.min(1, Math.max(0, (toMinutes(nowHHMM) - a) / (b - a)));
}

function Badges({ lesson }: { lesson: Lesson }) {
  return (
    <>
      {lesson.kind === 'elective' && <span className="tag tag--elective">к.в.</span>}
      {lesson.kind === 'optional' && <span className="tag tag--optional">ФТД</span>}
      {lesson.lecture && <span className="tag">лекция</span>}
      {lesson.online && <span className="tag tag--online">онлайн</span>}
    </>
  );
}

function TimeCol({ start, end, pair, state, nowHHMM, nowLabel = 'идёт' }: { start: string; end: string; pair: number; state: TimeState; nowHHMM: string; nowLabel?: string }) {
  return (
    <div className="lesson__time">
      <span className="lesson__start">{start}</span>
      <span className="lesson__end">{end}</span>
      {state === 'now' ? (
        <span className="lesson__now" title="Сейчас">
          {nowLabel}
          <i className="lesson__progress" style={{ width: `${Math.round(progress(start, end, nowHHMM) * 100)}%` }} />
        </span>
      ) : (
        <span className="lesson__pair">{pair} пара</span>
      )}
    </div>
  );
}

type CardProps = { lesson: Lesson; date: string; today: string; nowHHMM: string };

export function LessonCard({ lesson, date, today, nowHHMM }: CardProps) {
  const state = timeState(lesson.start, lesson.end, date, today, nowHHMM);
  const loc = locationOf(lesson);
  return (
    <li className={`lesson is-${state}`}>
      <TimeCol start={lesson.start} end={lesson.end} pair={lesson.pair} state={state} nowHHMM={nowHHMM} />
      <div className="lesson__body">
        <div className="lesson__title">
          {lesson.title} <Badges lesson={lesson} />
        </div>
        <div className="lesson__meta">
          {lesson.teacher && <span>{lesson.teacher}</span>}
          {loc && <span className="lesson__room">{loc}</span>}
        </div>
        {lesson.note && <div className="lesson__note">{lesson.note}</div>}
      </div>
    </li>
  );
}

export function ElectiveChoiceCard({ lessons, date, today, nowHHMM, onChoose }: { lessons: Lesson[]; date: string; today: string; nowHHMM: string; onChoose: () => void }) {
  const first = lessons[0];
  const state = timeState(first.start, first.end, date, today, nowHHMM);
  return (
    <li className={`lesson lesson--choice is-${state}`}>
      <TimeCol start={first.start} end={first.end} pair={first.pair} state={state} nowHHMM={nowHHMM} />
      <div className="lesson__body">
        <div className="lesson__choice-head">
          <span className="tag tag--elective">к.в.</span>
          <span>Курс по выбору</span>
          <button type="button" className="link-btn" onClick={onChoose}>
            выбрать
          </button>
        </div>
        <ul className="lesson__options">
          {lessons.map((l) => {
            const loc = locationOf(l);
            return (
              <li key={l.id}>
                <div className="lesson__title">
                  {l.title} {l.lecture && <span className="tag">лекция</span>} {l.online && <span className="tag tag--online">онлайн</span>}
                </div>
                <div className="lesson__meta">
                  {l.teacher && <span>{l.teacher}</span>}
                  {loc && <span className="lesson__room">{loc}</span>}
                </div>
                {l.note && <div className="lesson__note">{l.note}</div>}
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

export function EmptyPairCard({ pair, start, end, date, today, nowHHMM }: { pair: number; start: string; end: string; date: string; today: string; nowHHMM: string }) {
  const state = timeState(start, end, date, today, nowHHMM);
  return (
    <li className={`lesson lesson--empty is-${state}`} aria-label={`${pair} пара: нет пары`}>
      <TimeCol start={start} end={end} pair={pair} state={state} nowHHMM={nowHHMM} nowLabel="окно" />
      <div className="lesson__body lesson__body--empty">Нет пары</div>
    </li>
  );
}
