import { useEffect, useState } from 'react';
import type { Schedule } from '../../shared/types';

export type ScheduleState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: Schedule };

export function useSchedule(): ScheduleState {
  const [state, setState] = useState<ScheduleState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetch('/data/schedule.json', { cache: 'no-cache' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as Schedule;
      })
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch((e: Error) => !cancelled && setState({ status: 'error', message: e.message }));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
