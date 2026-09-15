import { useEffect, useRef } from 'react';
import type { Group, GroupSettings } from '../../shared/types';
import { ALL } from '../../shared/variants';
import { DAY_SHORT } from '../../shared/util';
import { SubscribeBlock } from './SubscribeBlock';

type Props = { open: boolean; onClose: () => void; group: Group; settings: GroupSettings; onChange: (s: GroupSettings) => void };

export function SettingsSheet({ open, onClose, group, settings, onChange }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  const setElective = (slotId: string, value: string) => onChange({ ...settings, electives: { ...settings.electives, [slotId]: value } });

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet__inner">
        <div className="sheet__head">
          <h2 className="sheet__title">Настройки · {group.name}</h2>
          <button type="button" className="icon-btn icon-btn--plain" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {group.slots.length === 0 && !group.hasOptional && <p className="muted">У этой группы нет курсов по выбору и факультативов — настраивать нечего.</p>}

        {group.slots.map((slot) => {
          const teacherOf = (optionId: string) => group.lessons.find((l) => l.slotId === slot.slotId && l.optionId === optionId)?.teacher;
          const value = settings.electives[slot.slotId] ?? ALL;
          return (
            <fieldset key={slot.slotId} className="field">
              <legend className="field__legend">
                Курс по выбору · {DAY_SHORT[slot.day]}, {slot.pair} пара
              </legend>
              {slot.options.map((o) => (
                <label key={o.optionId} className="radio">
                  <input type="radio" name={`${group.id}-${slot.slotId}`} checked={value === o.optionId} onChange={() => setElective(slot.slotId, o.optionId)} />
                  <span className="radio__text">
                    <span>{o.title}</span>
                    {teacherOf(o.optionId) && <span className="muted"> · {teacherOf(o.optionId)}</span>}
                  </span>
                </label>
              ))}
              <label className="radio">
                <input type="radio" name={`${group.id}-${slot.slotId}`} checked={value === ALL} onChange={() => setElective(slot.slotId, ALL)} />
                <span className="radio__text muted">Показывать оба</span>
              </label>
            </fieldset>
          );
        })}

        {group.hasOptional && (
          <fieldset className="field">
            <legend className="field__legend">Факультативы</legend>
            <label className="radio">
              <input type="checkbox" checked={settings.showOptional} onChange={(e) => onChange({ ...settings, showOptional: e.target.checked })} />
              <span className="radio__text">Показывать факультативы (ФТД)</span>
            </label>
          </fieldset>
        )}

        <SubscribeBlock group={group} settings={settings} />
      </div>
    </dialog>
  );
}
