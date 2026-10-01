import type { Schedule } from '../../shared/types';
import type { SourceId } from '../lib/source';
import { formatUpdated, plural } from '../lib/format';
import { ExternalIcon } from './Icons';

type Props = { source: SourceId; schedule: Schedule; diffCount: number; onShowDiff: () => void };

export function Footer({ source, schedule, diffCount, onShowDiff }: Props) {
  return (
    <footer className="footer">
      {source === 'local' ? (
        <>
          <span>Личное расписание · обновлено {formatUpdated(schedule.sourceModified)}</span>
          {diffCount > 0 && (
            <button type="button" className="link-btn" onClick={onShowDiff}>
              В таблице {diffCount} {plural(diffCount, ['отличие', 'отличия', 'отличий'])} →
            </button>
          )}
        </>
      ) : (
        <>
          <span>Таблица от {formatUpdated(schedule.sourceModified)} · проверяется по воскресеньям</span>
          {schedule.sourceUrl && (
            <a href={schedule.sourceUrl} target="_blank" rel="noopener noreferrer">
              Исходная таблица <ExternalIcon />
            </a>
          )}
        </>
      )}
    </footer>
  );
}
