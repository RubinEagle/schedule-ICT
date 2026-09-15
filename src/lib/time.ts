import { useEffect, useState } from 'react';

/** Текущее время, обновляется раз в 30 секунд и при возврате на вкладку. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 30_000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return now;
}

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesWord(n: number): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return `${n} минут`;
  if (b === 1) return `${n} минута`;
  if (b >= 2 && b <= 4) return `${n} минуты`;
  return `${n} минут`;
}

export function untilText(fromHHMM: string, toHHMM: string): string {
  const diff = toMinutes(toHHMM) - toMinutes(fromHHMM);
  if (diff < 60) return `через ${minutesWord(diff)}`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m ? `через ${h} ч ${m} мин` : `через ${h} ч`;
}
