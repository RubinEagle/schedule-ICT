import type { CalendarEvent } from './types';

export const TZID = 'Europe/Moscow';

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  `X-LIC-LOCATION:${TZID}`,
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0300',
  'TZNAME:MSK',
  'DTSTART:19700101T000000',
  'END:STANDARD',
  'END:VTIMEZONE',
];

export type IcsOptions = {
  name: string;
  description?: string;
  /** Момент изменения источника — идёт в DTSTAMP, чтобы файл не менялся без изменения данных */
  stamp: Date;
  refreshHours?: number;
  url?: string;
};

export function buildIcs(events: CalendarEvent[], opts: IcsOptions): string {
  const refresh = `PT${opts.refreshHours ?? 6}H`;
  const stamp = toUtcStamp(opts.stamp);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//schedule-ict//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    `X-WR-TIMEZONE:${TZID}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${refresh}`,
    `X-PUBLISHED-TTL:${refresh}`,
  ];
  if (opts.description) lines.push(`X-WR-CALDESC:${escapeText(opts.description)}`);
  if (opts.url) lines.push(`URL:${opts.url}`);
  lines.push(...VTIMEZONE);

  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;TZID=${TZID}:${localStamp(ev.date, ev.start)}`);
    lines.push(`DTEND;TZID=${TZID}:${localStamp(ev.date, ev.end)}`);
    lines.push(`SUMMARY:${escapeText(ev.title)}`);
    if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

function localStamp(dateISO: string, hhmm: string): string {
  return `${dateISO.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
}

function toUtcStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Фолдинг строк по 75 октетов (RFC 5545 §3.1) с учётом многобайтовых символов. */
export function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  const limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const max = out.length ? limit - 1 : limit; // строки продолжения начинаются с пробела
    if (curBytes + b > max) {
      out.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
