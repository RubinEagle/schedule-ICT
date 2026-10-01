import { useEffect, useState } from 'react';
import type { Group, GroupSettings } from '../../shared/types';
import { ALL } from '../../shared/variants';
import type { Source } from '../lib/source';
import { CalendarIcon, CheckIcon, CopyIcon } from './Icons';

type Props = { source: Source; group: Group; settings: GroupSettings; onOpenSettings?: () => void };

/** Подписка на календарь — в конце страницы, своя для каждого источника. */
export function CalendarSync({ source, group, settings, onOpenSettings }: Props) {
  const path = source.icsPath(group, settings);
  const host = window.location.host;
  const httpsUrl = `${window.location.protocol}//${host}${path}`;
  const webcalUrl = `webcal://${host}${path}`;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [path]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
    } catch {
      window.prompt('Скопируйте ссылку', httpsUrl);
    }
  };

  const summary = [source.id === 'local' ? 'Личное расписание' : `Группа ${group.name}`];
  for (const slot of group.slots) {
    const choice = settings.electives[slot.slotId] ?? ALL;
    summary.push(choice === ALL ? 'все варианты к.в.' : (slot.options.find((o) => o.optionId === choice)?.title ?? 'к.в.'));
  }
  if (group.hasOptional) summary.push(settings.showOptional ? 'с факультативами' : 'без факультативов');

  return (
    <section className="sync" aria-labelledby="sync-title">
      <div className="sync__icon">
        <CalendarIcon size={26} />
      </div>
      <h2 id="sync-title" className="sync__title">
        Расписание в календаре телефона
      </h2>
      <p className="sync__text">{summary.join(' · ')}. Календарь обновится сам, когда поменяется расписание.</p>
      <div className="sync__actions">
        <a className="btn btn--primary btn--lg" href={webcalUrl}>
          <CalendarIcon />
          Синхронизировать календарь
        </a>
        <button type="button" className="btn btn--ghost" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
        </button>
      </div>
      <details className="sync__help">
        <summary>Google Calendar и Android</summary>
        <ol>
          <li>Скопируйте ссылку кнопкой выше.</li>
          <li>В Google Calendar на компьютере: «Другие календари» → «+» → «Добавить по URL».</li>
          <li>Вставьте ссылку и нажмите «Добавить календарь». На телефоне он появится после синхронизации.</li>
        </ol>
        <p>Google обновляет подписки раз в несколько часов, Apple Calendar — по настройке «Автообновление» в свойствах календаря.</p>
      </details>
      {onOpenSettings && (
        <p className="sync__note">
          Подписка учитывает{' '}
          <button type="button" className="link-btn" onClick={onOpenSettings}>
            настройки
          </button>
          . Если поменяете их, подпишитесь заново, а старый календарь удалите.
        </p>
      )}
    </section>
  );
}
