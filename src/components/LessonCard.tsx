import type { Lesson } from '../../shared/types';
import { locationOf } from '../../shared/expand';

function isOver(lesson: Lesson, date: string, today: string): boolean {
  if (date < today) return true;
  if (date > today) return false;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return lesson.end <= hhmm;
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

export function LessonCard({ lesson, date, today }: { lesson: Lesson; date: string; today: string }) {
  const over = isOver(lesson, date, today);
  const loc = locationOf(lesson);
  return (
    <li className={`lesson${over ? ' is-over' : ''}`}>
      <div className="lesson__time">
        <span className="lesson__start">{lesson.start}</span>
        <span className="lesson__end">{lesson.end}</span>
        <span className="lesson__pair">{lesson.pair} пара</span>
      </div>
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

export function ElectiveChoiceCard({ lessons, date, today, onChoose }: { lessons: Lesson[]; date: string; today: string; onChoose: () => void }) {
  const first = lessons[0];
  const over = isOver(first, date, today);
  return (
    <li className={`lesson lesson--choice${over ? ' is-over' : ''}`}>
      <div className="lesson__time">
        <span className="lesson__start">{first.start}</span>
        <span className="lesson__end">{first.end}</span>
        <span className="lesson__pair">{first.pair} пара</span>
      </div>
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
