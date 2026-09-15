import type { GroupSettings } from '../../shared/types';

const KEY = 'schedule-ict:v1';

export type Stored = {
  group?: string;
  settings: Record<string, GroupSettings>;
};

export function loadStored(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { settings: {} };
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return { group: typeof parsed.group === 'string' ? parsed.group : undefined, settings: parsed.settings ?? {} };
  } catch {
    return { settings: {} };
  }
}

export function saveStored(s: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим и т.п. — работаем без сохранения */
  }
}
