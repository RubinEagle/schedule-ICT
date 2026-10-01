import { useCallback, useEffect, useState } from 'react';
import type { Group, GroupSettings } from '../../shared/types';
import { icsPath, variantKey } from '../../shared/variants';

export type SourceId = 'local' | 'table';

export type Source = {
  id: SourceId;
  label: string;
  path: string;
  dataUrl: string;
  icsPath: (group: Group, settings: GroupSettings) => string;
};

export const SOURCES: Record<SourceId, Source> = {
  local: {
    id: 'local',
    label: 'Локально',
    path: '/',
    dataUrl: '/local/schedule.json',
    icsPath: (group, settings) => `/local/ics/${variantKey(group, settings)}.ics`,
  },
  table: {
    id: 'table',
    label: 'Из таблицы',
    path: '/table/',
    dataUrl: '/data/schedule.json',
    icsPath,
  },
};

export function sourceFromPath(pathname: string = window.location.pathname): SourceId {
  return /^\/table(\/|$)/.test(pathname) ? 'table' : 'local';
}

/**
 * Текущая вкладка по адресу. Переход — через history.pushState, без перезагрузки;
 * при этом / и /table/ — реальные страницы, так что прямые ссылки и F5 тоже работают.
 */
export function useSourceRoute(): [SourceId, (id: SourceId) => void] {
  const [source, setSource] = useState<SourceId>(() => sourceFromPath());

  useEffect(() => {
    const onPop = () => setSource(sourceFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((id: SourceId) => {
    if (sourceFromPath() !== id) window.history.pushState(null, '', SOURCES[id].path);
    setSource(id);
  }, []);

  return [source, navigate];
}
