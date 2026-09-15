import { useEffect, useMemo, useState } from 'react';
import type { Group, GroupSettings, Schedule } from '../shared/types';
import { findWeek } from '../shared/expand';
import { normalizeSettings } from '../shared/variants';
import { todayISO } from '../shared/util';
import { loadStored, saveStored } from './lib/settings';
import { useSchedule } from './lib/useSchedule';
import { GroupTabs } from './components/GroupTabs';
import { WeekNav } from './components/WeekNav';
import { DayList } from './components/DayList';
import { SettingsSheet } from './components/SettingsSheet';
import { Footer } from './components/Footer';

export function App() {
  const state = useSchedule();
  return (
    <div className="app">
      {state.status === 'loading' && <Skeleton />}
      {state.status === 'error' && (
        <main className="center">
          <h1>Расписание</h1>
          <p className="error">Не удалось загрузить данные ({state.message}). Обновите страницу позже.</p>
        </main>
      )}
      {state.status === 'ready' && <Loaded schedule={state.data} />}
    </div>
  );
}

function Loaded({ schedule }: { schedule: Schedule }) {
  const stored = useMemo(loadStored, []);
  const [groupId, setGroupId] = useState(() => (schedule.groups.some((g) => g.id === stored.group) ? stored.group! : schedule.groups[0].id));
  const [allSettings, setAllSettings] = useState<Record<string, GroupSettings>>(stored.settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [today, setToday] = useState(todayISO);

  const group = schedule.groups.find((g) => g.id === groupId) ?? schedule.groups[0];
  const settings = useMemo(() => normalizeSettings(group, allSettings[group.id]), [group, allSettings]);

  const currentWeek = findWeek(schedule.weeks, today);
  const initialWeekIndex = currentWeek ? currentWeek.index : today < schedule.weeks[0].start ? 0 : schedule.weeks.length - 1;
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const week = schedule.weeks[weekIndex];

  useEffect(() => {
    saveStored({ group: groupId, settings: allSettings });
  }, [groupId, allSettings]);

  // Обновляем «сегодня» при возврате на вкладку (страница может висеть открытой сутками)
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && setToday(todayISO());
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const updateSettings = (next: GroupSettings) => setAllSettings((prev) => ({ ...prev, [group.id]: next }));

  return (
    <>
      <header className="header">
        <div className="header__row">
          <h1 className="header__title">Расписание</h1>
          <button type="button" className="icon-btn" aria-label="Настройки и календарь" onClick={() => setSettingsOpen(true)}>
            <GearIcon />
            <span className="icon-btn__label">Настройки</span>
          </button>
        </div>
        <GroupTabs groups={schedule.groups} value={group.id} onChange={setGroupId} />
      </header>

      <main className="main">
        <WeekNav
          weeks={schedule.weeks}
          index={weekIndex}
          currentIndex={currentWeek?.index}
          onChange={setWeekIndex}
        />
        <DayList group={group} week={week} settings={settings} today={today} onOpenSettings={() => setSettingsOpen(true)} />
      </main>

      <Footer schedule={schedule} />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        group={group}
        settings={settings}
        onChange={updateSettings}
      />
    </>
  );
}

function Skeleton() {
  return (
    <main className="center" aria-busy="true">
      <h1>Расписание</h1>
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </main>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export type { Group };
