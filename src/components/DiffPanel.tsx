import { useState } from 'react';
import { isSignificant, type DiffField, type DiffKind, type LessonDiff } from '../../shared/diff';
import { DAY_SHORT } from '../../shared/util';
import { parityLabel, plural } from '../lib/format';
import { CheckIcon, ChevronDown, DiffIcon } from './Icons';

const KIND_LABEL: Record<DiffKind, string> = {
  changed: 'Изменилось',
  replaced: 'Другой предмет',
  added: 'Нет у вас',
  missing: 'Нет в таблице',
  moved: 'Перенесли',
  'not-chosen': 'Не выбран',
};

const FIELD_LABEL: Record<DiffField['field'], string> = {
  teacher: 'Преподаватель',
  room: 'Аудитория',
  time: 'Время',
  online: 'Формат',
};

/** Сводка отличий таблицы от личного расписания (только на вкладке «Из таблицы»). */
export function DiffPanel({ diffs }: { diffs: LessonDiff[] }) {
  const [open, setOpen] = useState(false);
  const significant = diffs.filter(isSignificant);
  const notChosen = diffs.filter((d) => !isSignificant(d));
  const notChosenText = notChosen.map((d) => `${d.table?.title} (${DAY_SHORT[d.day].toLowerCase()}, ${d.pair} пара)`).join('; ');

  if (!significant.length) {
    return (
      <div className="diff diff--ok">
        <span className="diff__icon">
          <CheckIcon />
        </span>
        <span className="diff__summary">
          <b>Совпадает с вашим расписанием</b>
          {notChosen.length > 0 && <span>Кроме невыбранных курсов: {notChosenText}</span>}
        </span>
      </div>
    );
  }

  const n = significant.length;
  return (
    <section className={`diff${open ? ' is-open' : ''}`}>
      <button type="button" className="diff__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="diff__icon">
          <DiffIcon size={18} />
        </span>
        <span className="diff__summary">
          <b>
            {n} {plural(n, ['отличие', 'отличия', 'отличий'])} от вашего расписания
          </b>
          <span>{open ? 'слева — у вас, справа — в таблице' : 'Нажмите, чтобы посмотреть'}</span>
        </span>
        <ChevronDown className="diff__chevron" />
      </button>
      {open && (
        <>
          <ul className="diff__list">
            {significant.map((d, i) => (
              <DiffItem key={i} d={d} />
            ))}
          </ul>
          {notChosen.length > 0 && <p className="diff__muted">Курсы по выбору, которых нет у вас: {notChosenText}</p>}
        </>
      )}
    </section>
  );
}

function placeText(p: { day: number; pair: number; parity: LessonDiff['parity'] }): string {
  return `${DAY_SHORT[p.day].toLowerCase()}, ${p.pair} пара${p.parity === 'both' ? '' : `, ${parityLabel(p.parity)}`}`;
}

function DiffItem({ d }: { d: LessonDiff }) {
  const rows = d.fields.map((f) => ({ label: FIELD_LABEL[f.field], local: f.local, table: f.table }));
  if (d.kind === 'moved' && d.from) rows.unshift({ label: 'Когда', local: placeText(d.from), table: placeText(d) });
  return (
    <li className={`diff__item diff__item--${d.kind}`}>
      <div className="diff__when">
        {DAY_SHORT[d.day]} · {d.pair} пара · {parityLabel(d.parity)}
        <span className="diff__kind">{KIND_LABEL[d.kind]}</span>
      </div>
      {d.kind === 'replaced' ? (
        <div className="diff__title">
          <span className="diff__old">{d.local?.title}</span> → <span className="diff__new">{d.table?.title}</span>
        </div>
      ) : (
        <div className="diff__title">{d.local?.title ?? d.table?.title}</div>
      )}
      {rows.length > 0 && (
        <ul className="diff__fields">
          {rows.map((r) => (
            <li key={r.label}>
              <span className="diff__field">{r.label}</span>
              <span className="diff__old">{r.local || '—'}</span>
              <span className="diff__arrow">→</span>
              <span className="diff__new">{r.table || '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
