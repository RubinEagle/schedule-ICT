import { useEffect, useState } from 'react';
import type { Schedule } from '../../shared/types';

export type ScheduleState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: Schedule };

// Кэш на время жизни страницы: переключение вкладок не перезагружает данные и не мигает скелетоном
const loaded = new Map<string, Schedule>();
const pending = new Map<string, Promise<Schedule>>();

function load(url: string): Promise<Schedule> {
  let p = pending.get(url);
  if (!p) {
    p = fetch(url, { cache: 'no-cache' }).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as Schedule;
      loaded.set(url, data);
      return data;
    });
    p.catch(() => pending.delete(url));
    pending.set(url, p);
  }
  return p;
}

export function useSchedule(url: string): ScheduleState {
  const [state, setState] = useState<ScheduleState>(() => {
    const data = loaded.get(url);
    return data ? { status: 'ready', data } : { status: 'loading' };
  });
  useEffect(() => {
    let cancelled = false;
    const data = loaded.get(url);
    if (data) {
      setState({ status: 'ready', data });
      return;
    }
    setState({ status: 'loading' });
    load(url)
      .then((d) => !cancelled && setState({ status: 'ready', data: d }))
      .catch((e: Error) => !cancelled && setState({ status: 'error', message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}
