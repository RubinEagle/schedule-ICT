import { useEffect, useState } from 'react';
import type { Group, GroupSettings } from '../../shared/types';
import { icsPath } from '../../shared/variants';

export function SubscribeBlock({ group, settings }: { group: Group; settings: GroupSettings }) {
  const path = icsPath(group, settings);
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

  const isApple = /iPhone|iPad|Macintosh/i.test(navigator.userAgent);

  return (
    <section className="subscribe">
      <h3 className="subscribe__title">Календарь на телефоне</h3>
      <p className="muted subscribe__hint">
        Подписка формируется с учётом настроек выше и обновляется сама, когда меняется расписание. Если поменяете выбор курса — подпишитесь заново по новой ссылке и удалите старую.
      </p>
      <a className="btn btn--primary" href={webcalUrl}>
        {isApple ? 'Добавить в Календарь' : 'Подписаться (webcal)'}
      </a>
      <div className="subscribe__url">
        <input className="subscribe__input" readOnly value={httpsUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Ссылка на календарь" />
        <button type="button" className="btn" onClick={copy}>
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <details className="subscribe__help">
        <summary>Как добавить в Google Calendar / Android</summary>
        <ol>
          <li>Скопируйте ссылку выше.</li>
          <li>В Google Calendar на компьютере: «Другие календари» → «+» → «Добавить по URL».</li>
          <li>Вставьте ссылку и нажмите «Добавить календарь». На Android он появится после синхронизации.</li>
        </ol>
        <p className="muted">Google обновляет подписки раз в несколько часов, Apple Calendar — по настройке «Автообновление» в свойствах календаря.</p>
      </details>
    </section>
  );
}
