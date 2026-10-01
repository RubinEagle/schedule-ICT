/**
 * Собирает личное расписание из data/local-schedule.json в
 * public/local/schedule.json и public/local/ics/<variant>.ics.
 * Запускается перед dev и build, результат в git не хранится.
 *
 *   npm run local
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { localToSchedule } from '../shared/local';
import { buildEvents } from '../shared/expand';
import { buildIcs } from '../shared/ics';
import { allVariants, variantKey } from '../shared/variants';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'data', 'local-schedule.json');
const OUT = path.join(ROOT, 'public', 'local');

async function main() {
  const schedule = localToSchedule(JSON.parse(await readFile(SRC, 'utf8')));
  const group = schedule.groups[0];

  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'ics'), { recursive: true });
  await writeFile(path.join(OUT, 'schedule.json'), JSON.stringify(schedule) + '\n');

  const stamp = new Date(`${schedule.sourceModified.slice(0, 10)}T00:00:00Z`);
  const variants = allVariants(group);
  for (const settings of variants) {
    const ics = buildIcs(buildEvents(group, schedule.weeks, settings), {
      name: `Моё расписание ${group.name}`,
      description: `Личное расписание группы ${group.name}`,
      stamp,
    });
    await writeFile(path.join(OUT, 'ics', `${variantKey(group, settings)}.ics`), ics);
  }
  console.log(`Локальное расписание ${group.name}: ${group.lessons.length} занятий, ${schedule.weeks.length} недель, ${variants.length} .ics`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
