import type { Schedule } from '../../shared/types';
import { formatUpdated } from '../lib/format';

export function Footer({ schedule }: { schedule: Schedule }) {
  return (
    <footer className="footer">
      <span>Данные обновлены {formatUpdated(schedule.sourceModified)}</span>
      <a href={schedule.sourceUrl} target="_blank" rel="noopener noreferrer">
        Исходная таблица
      </a>
    </footer>
  );
}
