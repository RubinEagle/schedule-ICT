import { SOURCES, type SourceId } from '../lib/source';
import { plural } from '../lib/format';
import { HomeIcon, TableIcon } from './Icons';

type Props = { source: SourceId; onNavigate: (id: SourceId) => void; diffCount: number };

/** Переключатель источника внизу экрана. Обычные ссылки: открываются в новой вкладке и работают без JS. */
export function BottomNav({ source, onNavigate, diffCount }: Props) {
  const items: { id: SourceId; icon: React.ReactNode }[] = [
    { id: 'local', icon: <HomeIcon /> },
    { id: 'table', icon: <TableIcon /> },
  ];
  return (
    <nav className="bottomnav" aria-label="Источник расписания">
      <div className="bottomnav__inner">
        {items.map(({ id, icon }) => {
          const active = id === source;
          return (
            <a
              key={id}
              href={SOURCES[id].path}
              className={`bottomnav__item${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                onNavigate(id);
              }}
            >
              {icon}
              <span>{SOURCES[id].label}</span>
              {id === 'table' && diffCount > 0 && (
                <b className="bottomnav__badge" title={`${diffCount} ${plural(diffCount, ['отличие', 'отличия', 'отличий'])} от вашего расписания`}>
                  {diffCount}
                </b>
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
