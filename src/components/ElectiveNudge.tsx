import type { Group, GroupSettings } from '../../shared/types';
import { ALL } from '../../shared/variants';

type Props = { group: Group; settings: GroupSettings; dismissed: boolean; onOpen: () => void; onDismiss: () => void };

/** Подсказка, пока пользователь не выбрал курсы по выбору. */
export function ElectiveNudge({ group, settings, dismissed, onOpen, onDismiss }: Props) {
  const unset = group.slots.filter((s) => (settings.electives[s.slotId] ?? ALL) === ALL);
  if (dismissed || !unset.length) return null;
  return (
    <div className="nudge" role="status">
      <span className="nudge__text">
        У группы {group.name} {unset.length === 1 ? 'есть курс по выбору' : `${unset.length} курса по выбору`}. Выберите свои, чтобы в расписании и календаре остались только они.
      </span>
      <div className="nudge__actions">
        <button type="button" className="btn btn--small btn--primary" onClick={onOpen}>
          Выбрать
        </button>
        <button type="button" className="btn btn--small" onClick={onDismiss} aria-label="Скрыть подсказку">
          Позже
        </button>
      </div>
    </div>
  );
}
