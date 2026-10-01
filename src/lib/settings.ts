import type { GroupSettings } from '../../shared/types';
import type { SourceId } from './source';

const KEY = 'schedule-ict:v2';
const LEGACY_KEY = 'schedule-ict:v1';

export type Stored = {
  /** Выбранная группа на вкладке «Из таблицы» */
  group?: string;
  /** Настройки групп отдельно для каждого источника: id групп и курсов по выбору у них разные */
  settings: Record<SourceId, Record<string, GroupSettings>>;
  /** Подсказка про выбор курсов скрыта пользователем */
  nudgeDismissed?: boolean;
};

const empty = (): Stored => ({ settings: { local: {}, table: {} } });

export function loadStored(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Stored>;
      return {
        group: typeof p.group === 'string' ? p.group : undefined,
        settings: { local: p.settings?.local ?? {}, table: p.settings?.table ?? {} },
        nudgeDismissed: p.nudgeDismissed === true,
      };
    }
    // Настройки прошлой версии относились к таблице — переносим их туда
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const p = JSON.parse(legacy) as { group?: unknown; settings?: Record<string, GroupSettings>; nudgeDismissed?: unknown };
      return {
        group: typeof p.group === 'string' ? p.group : undefined,
        settings: { local: {}, table: p.settings ?? {} },
        nudgeDismissed: p.nudgeDismissed === true,
      };
    }
  } catch {
    /* битые данные — начинаем с чистого листа */
  }
  return empty();
}

export function saveStored(s: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим и т.п. — работаем без сохранения */
  }
}
