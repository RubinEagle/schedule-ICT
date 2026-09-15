/**
 * Скачивает xlsx с публичного Яндекс Диска, разбирает расписание и пишет
 * public/data/schedule.json и public/ics/<group>/<variant>.ics.
 *
 *   npm run data                 — скачать с Диска
 *   npm run data -- --file x.xlsx — взять локальный файл (для тестов)
 */
import { mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseWorkbook, type Overrides } from '../shared/parse-xlsx';
import { buildEvents } from '../shared/expand';
import { buildIcs } from '../shared/ics';
import { allVariants, variantKey } from '../shared/variants';
import type { Schedule } from '../shared/types';

const PUBLIC_KEY = 'irXDpn+4Qr58xa4BPqqrRARbezOZYQa0yKV3C6Cf60vvu4V/gX4T5nLmOB6ObPd5q/J6bpmRyOJonT3VoXnDag==';
const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';
const FALLBACK_URL = 'https://yadi.sk/i/lXeVw9BMa5IA8Q';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DATA = path.join(ROOT, 'public', 'data', 'schedule.json');
const OUT_ICS = path.join(ROOT, 'public', 'ics');

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function loadSource(): Promise<{ data: Uint8Array; modified: string; url: string }> {
  const fileArg = process.argv.indexOf('--file');
  if (fileArg >= 0) {
    const p = path.resolve(process.argv[fileArg + 1]);
    const data = new Uint8Array(await readFile(p));
    const { mtime } = await import('node:fs').then((fs) => fs.statSync(p));
    return { data, modified: mtime.toISOString(), url: FALLBACK_URL };
  }
  const q = `public_key=${encodeURIComponent(PUBLIC_KEY)}`;
  const meta = await fetchJson<{ modified?: string; public_url?: string; name?: string }>(`${API}?${q}`);
  const dl = await fetchJson<{ href: string }>(`${API}/download?${q}`);
  const res = await fetch(dl.href);
  if (!res.ok) throw new Error(`Скачивание xlsx → HTTP ${res.status}`);
  const data = new Uint8Array(await res.arrayBuffer());
  console.log(`Скачан «${meta.name}», ${data.byteLength} байт, изменён ${meta.modified}`);
  return { data, modified: meta.modified ?? new Date().toISOString(), url: meta.public_url ?? FALLBACK_URL };
}

async function main() {
  const src = await loadSource();
  const overridesPath = path.join(ROOT, 'data', 'overrides.json');
  const overrides: Overrides = existsSync(overridesPath) ? JSON.parse(await readFile(overridesPath, 'utf8')) : {};

  const parsed = parseWorkbook(src.data, overrides);
  const schedule: Schedule = {
    generatedAt: new Date().toISOString(),
    sourceModified: src.modified,
    sourceUrl: src.url,
    ...parsed,
  };

  // generatedAt не должен приводить к коммиту, если данные не изменились
  if (existsSync(OUT_DATA)) {
    const prev = JSON.parse(await readFile(OUT_DATA, 'utf8')) as Schedule;
    const same = JSON.stringify({ ...prev, generatedAt: '' }) === JSON.stringify({ ...schedule, generatedAt: '' });
    if (same) schedule.generatedAt = prev.generatedAt;
  }

  await mkdir(path.dirname(OUT_DATA), { recursive: true });
  await writeFile(OUT_DATA, JSON.stringify(schedule, null, 1) + '\n');

  await rm(OUT_ICS, { recursive: true, force: true });
  let count = 0;
  const stamp = new Date(schedule.sourceModified);
  for (const group of schedule.groups) {
    const dir = path.join(OUT_ICS, group.id);
    await mkdir(dir, { recursive: true });
    for (const settings of allVariants(group)) {
      const events = buildEvents(group, schedule.weeks, settings);
      const ics = buildIcs(events, {
        name: `Расписание ${group.name}`,
        description: `Расписание группы ${group.name}. Источник: ${schedule.sourceUrl}`,
        stamp,
        url: schedule.sourceUrl,
      });
      await writeFile(path.join(dir, `${variantKey(group, settings)}.ics`), ics);
      count++;
    }
    console.log(`${group.name}: ${group.lessons.length} записей, ${group.slots.length} к.в. со выбором, ${(await readdir(dir)).length} .ics`);
  }
  console.log(`Готово: ${schedule.weeks.length} недель, ${count} файлов .ics`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
