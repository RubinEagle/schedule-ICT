import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GroupSettings, Schedule } from '../shared/types';
import { filterLessons, findWeek, occurrenceDate } from '../shared/expand';
import { normalizeSettings } from '../shared/variants';
import { addDays, todayISO } from '../shared/util';
import { loadStored, saveStored } from './lib/settings';
import { useSchedule } from './lib/useSchedule';
import { hhmm, useNow } from './lib/time';
import { GroupTabs } from './components/GroupTabs';
import { WeekNav } from './components/WeekNav';
import { DayList } from './components/DayList';
import { DayStrip } from './components/DayStrip';
import { NowBanner } from './components/NowBanner';
import { ElectiveNudge } from './components/ElectiveNudge';
import { SettingsSheet, type SheetSection } from './components/SettingsSheet';
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
  const [nudgeDismissed, setNudgeDismissed] = useState(stored.nudgeDismissed ?? false);
  const [sheet, setSheet] = useState<{ open: boolean; section: SheetSection }>({ open: false, section: 'settings' });

  const now = useNow();
  const today = todayISO(now);
  const nowHHMM = hhmm(now);

  const group = schedule.groups.find((g) => g.id === groupId) ?? schedule.groups[0];
  const settings = useMemo(() => normalizeSettings(group, allSettings[group.id]), [group, allSettings]);

  const currentWeek = findWeek(schedule.weeks, today);
  const initialWeekIndex = currentWeek ? currentWeek.index : today < schedule.weeks[0].start ? 0 : schedule.weeks.length - 1;
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const week = schedule.weeks[weekIndex];
  const isCurrentWeek = currentWeek?.index === weekIndex;
  const todayDay = (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getDay() + 6) % 7;

  useEffect(() => {
    saveStored({ group: groupId, settings: allSettings, nudgeDismissed });
  }, [groupId, allSettings, nudgeDismissed]);

  const updateSettings = (next: GroupSettings) => setAllSettings((prev) => ({ ...prev, [group.id]: next }));
  const openSheet = (section: SheetSection) => setSheet({ open: true, section });

  // Дни с парами на этой неделе — для точек в полоске дней
  const daysWithLessons = useMemo(() => {
    const ls = filterLessons(group, settings);
    const set = new Set<number>();
    for (let d = 0; d < 6; d++) {
      const date = addDays(week.start, d);
      if (ls.some((l) => l.day === d && occurrenceDate(l, week, group) === date)) set.add(d);
    }
    return set;
  }, [group, settings, week]);

  // Прокрутка к дню (полоска дней на телефоне, автопрокрутка к сегодня)
  const dayRefs = useRef<(HTMLElement | null)[]>([]);
  const scrollToDay = useCallback((day: number, behavior: ScrollBehavior = 'smooth') => {
    const el = dayRefs.current[day];
    if (!el) return;
    const offset = (document.querySelector('.header') as HTMLElement | null)?.offsetHeight ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - offset - 8;
    window.scrollTo({ top: Math.max(0, top), behavior });
  }, []);

  const isMobile = () => window.matchMedia('(max-width: 899px)').matches;
  useEffect(() => {
    if (isCurrentWeek && isMobile() && todayDay <= 5) scrollToDay(todayDay, 'auto');
    else window.scrollTo({ top: 0 });
  }, [weekIndex, group.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Свайп влево/вправо по расписанию листает недели; стрелки на клавиатуре — тоже
  const touch = useRef<{ x: number; y: number } | null>(null);
  const changeWeek = (delta: number) => setWeekIndex((i) => Math.min(schedule.weeks.length - 1, Math.max(0, i + delta)));
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) changeWeek(dx < 0 ? 1 : -1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet.open || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') changeWeek(-1);
      if (e.key === 'ArrowRight') changeWeek(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet.open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <header className="header">
        <div className="header__row">
          <h1 className="header__title">Расписание</h1>
          <div className="header__actions">
            <button type="button" className="icon-btn" onClick={() => openSheet('calendar')} aria-label="Подписка на календарь">
              <CalendarIcon />
              <span className="icon-btn__label">Календарь</span>
            </button>
            <button type="button" className="icon-btn" onClick={() => openSheet('settings')} aria-label="Настройки">
              <GearIcon />
              <span className="icon-btn__label">Настройки</span>
            </button>
          </div>
        </div>
        <GroupTabs groups={schedule.groups} value={group.id} onChange={setGroupId} />
        <div className="header__mobile">
          <DayStrip week={week} today={today} daysWithLessons={daysWithLessons} onPick={(d) => scrollToDay(d)} />
        </div>
      </header>

      <main className="main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <WeekNav weeks={schedule.weeks} index={weekIndex} currentIndex={currentWeek?.index} onChange={setWeekIndex} />
        {isCurrentWeek && <NowBanner group={group} week={week} settings={settings} today={today} nowHHMM={nowHHMM} todayDay={todayDay} />}
        <ElectiveNudge group={group} settings={settings} dismissed={nudgeDismissed} onOpen={() => openSheet('settings')} onDismiss={() => setNudgeDismissed(true)} />
        <DayList
          group={group}
          week={week}
          settings={settings}
          pairTimes={schedule.pairTimes}
          today={today}
          nowHHMM={nowHHMM}
          onOpenSettings={() => openSheet('settings')}
          dayRefs={dayRefs}
        />
        <p className="hint">Листайте недели свайпом или стрелками ← →</p>
      </main>

      <Footer schedule={schedule} />

      <SettingsSheet
        open={sheet.open}
        section={sheet.section}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
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

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
