import type { Group } from '../../shared/types';

export function GroupTabs({ groups, value, onChange }: { groups: Group[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist" aria-label="Группа">
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          role="tab"
          aria-selected={g.id === value}
          className={`tabs__tab${g.id === value ? ' is-active' : ''}`}
          onClick={() => onChange(g.id)}
        >
          {g.name}
        </button>
      ))}
    </div>
  );
}
