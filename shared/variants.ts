import type { Group, GroupSettings } from './types';

export const ALL = 'all';

export function defaultSettings(): GroupSettings {
  return { electives: {}, showOptional: true };
}

/** Убирает выборы для несуществующих слотов/вариантов, чтобы ключ варианта всегда соответствовал реальному файлу. */
export function normalizeSettings(group: Group, settings: Partial<GroupSettings> | undefined): GroupSettings {
  const electives: Record<string, string> = {};
  for (const slot of group.slots) {
    const choice = settings?.electives?.[slot.slotId];
    electives[slot.slotId] = choice && slot.options.some((o) => o.optionId === choice) ? choice : ALL;
  }
  const showOptional = group.hasOptional ? settings?.showOptional !== false : true;
  return { electives, showOptional };
}

/** Детерминированный ключ варианта настроек — имя файла .ics без расширения. */
export function variantKey(group: Group, settings: Partial<GroupSettings> | undefined): string {
  const s = normalizeSettings(group, settings);
  const parts: string[] = [];
  for (const slot of group.slots) {
    const choice = s.electives[slot.slotId];
    if (choice !== ALL) parts.push(`${slot.slotId}-${choice}`);
  }
  if (group.hasOptional && !s.showOptional) parts.push('noopt');
  return parts.length ? parts.join('_') : 'default';
}

export function icsPath(group: Group, settings: Partial<GroupSettings> | undefined): string {
  return `/ics/${group.id}/${variantKey(group, settings)}.ics`;
}

/** Все комбинации настроек группы (для генерации статических .ics). */
export function allVariants(group: Group): GroupSettings[] {
  let combos: Record<string, string>[] = [{}];
  for (const slot of group.slots) {
    const next: Record<string, string>[] = [];
    for (const c of combos) {
      next.push({ ...c, [slot.slotId]: ALL });
      for (const o of slot.options) next.push({ ...c, [slot.slotId]: o.optionId });
    }
    combos = next;
  }
  const result: GroupSettings[] = [];
  for (const electives of combos) {
    result.push({ electives, showOptional: true });
    if (group.hasOptional) result.push({ electives, showOptional: false });
  }
  return result;
}
