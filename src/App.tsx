import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GroupSettings, Schedule, Week } from '../shared/types';
import { diffGroups, findMatchingGroup, isSignificant, type LessonDiff } from '../shared/diff';
import { filterLessons, findWeek, occurrenceDate } from '../shared/expand';
import { normalizeSettings } from '../shared/variants';
import { addDays, todayISO } from '../shared/util';
import { loadStored, saveStored } from './lib/settings';
import { useSchedule } from './lib/useSchedule';
import { SOURCES, useSourceRoute, type Source, type SourceId } from './lib/source';
import { hhmm, useNow } from './lib/time';
import { GroupTabs } from './components/GroupTabs';
import { WeekNav } from './components/WeekNav';
import { DayList } from './components/DayList';
import { DayStrip } from './components/DayStrip';
import { NowCard } from './components/NowCard';
import { DiffPanel } from './components/DiffPanel';
import { ElectiveNudge } from './components/ElectiveNudge';
import { SettingsSheet } from './components/SettingsSheet';
import { CalendarSync } from './components/CalendarSync';
import { Footer } from './components/Footer';
import { BottomNav } from './components/BottomNav';
import { GearIcon } from './components/Icons';

type DiffInfo = { tableGroupId: string; diffs: LessonDiff[]; count: number };

export function App() {
  const [source, navigate] = useSourceRoute();
  // Таблица нужна и на локальной вкладке — чтобы посчитать отличия для бейджа
  const local = useSchedule(SOURCES.local.dataUrl);
  const table = useSchedule(SOURCES.table.dataUrl);
  const state = source === 'local' ? local : table;

  const stored = useMemo(loadStored, []);
  const [tableGroup, setTableGroup] = useState(stored.group);
  const [settings, setSettings] = useState(stored.settings);
  const [nudgeDismissed, setNudgeDismissed] = useState(stored.nudgeDismissed ?? false);
  // Неделя общая для обеих вкладок; null — текущая
  const [weekStart, setWeekStart] = useState<string | null>(null);

  useEffect(() => {
    saveStored({ group: tableGroup, settings, nudgeDismissed });
  }, [tableGroup, settings, nudgeDismissed]);

  const localData = local.status === 'ready' ? local.data : undefined;
  const tableData = table.status === 'ready' ? table.data : undefined;
  const diff = useMemo<DiffInfo | null>(() => {
    const lg = localData?.groups[0];
    const tg = lg && tableData ? findMatchingGroup(lg, tableData.groups) : undefined;
    if (!lg || !tg) return null;
    const diffs = diffGroups(lg, tg);
    return { tableGroupId: tg.id, diffs, count: diffs.filter(isSignificant).length };
  }, [localData, tableData]);

  useEffect(() => {
    document.title = source === 'local' ? `${localData?.groups[0]?.name ?? 'Расписание'} · моё расписание` : 'Расписание из таблицы';
  }, [source, localData]);

  const showDiff = () => {
    if (diff) setTableGroup(diff.tableGroupId);
    navigate('table');
  };

  return (
    <div className="app">
      {state.status === 'loading' && <Skeleton />}
      {state.status === 'error' && <ErrorView source={source} message={state.message} />}
      {state.status === 'ready' && (
        <SchedulePage
          key={source}
          source={SOURCES[source]}
          schedule={state.data}
          groupId={source === 'table' ? tableGroup : undefined}
          onGroupChange={setTableGroup}
          allSettings={settings[source]}
          onSettingsChange={(groupId, s) => setSettings((prev) => ({ ...prev, [source]: { ...prev[source], [groupId]: s } }))}
          nudgeDismissed={nudgeDismissed}
          onNudgeDismiss={() => setNudgeDismissed(true)}
          weekStart={weekStart}
          onWeekStart={setWeekStart}
          diff={diff}
          onShowDiff={showDiff}
        />
      )}
      <BottomNav source={source} onNavigate={navigate} diffCount={diff?.count ?? 0} />
    </div>
  );
}

type PageProps = {
  source: Source;
  schedule: Schedule;
  groupId?: string;
  onGroupChange: (id: string) => void;
  allSettings: Record<string, GroupSettings>;
  onSettingsChange: (groupId: string, s: GroupSettings) => void;
  nudgeDismissed: boolean;
  onNudgeDismiss: () => void;
  weekStart: string | null;
  onWeekStart: (start: string | null) => void;
  diff: DiffInfo | null;
  onShowDiff: () => void;
};

function SchedulePage({ source, schedule, groupId, onGroupChange, allSettings, onSettingsChange, nudgeDismissed, onNudgeDismiss, weekStart, onWeekStart, diff, onShowDiff }: PageProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const now = useNow();
  const today = todayISO(now);
  const nowHHMM = hhmm(now);

  const group = schedule.groups.find((g) => g.id === groupId) ?? schedule.groups[0];
  const settings = useMemo(() => normalizeSettings(group, allSettings[group.id]), [group, allSettings]);
  const hasSettings = group.slots.length > 0 || group.hasOptional;
  const openSettings = () => setSheetOpen(true);

  const { weeks } = schedule;
  const currentWeek = findWeek(weeks, today);
  const defaultIndex = currentWeek ? currentWeek.index : today < weeks[0].start ? 0 : weeks.length - 1;
  const weekIndex = weekStart ? indexOfWeek(weeks, weekStart) : defaultIndex;
  const week = weeks[weekIndex];
  const isCurrentWeek = currentWeek?.index === weekIndex;
  const setWeekIndex = (i: number) => {
    const next = Math.min(weeks.length - 1, Math.max(0, i));
    onWeekStart(next === currentWeek?.index ? null : weeks[next].start);
  };
  const weekIndexRef = useRef(weekIndex);
  weekIndexRef.current = weekIndex;
  const changeWeek = (delta: number) => setWeekIndex(weekIndexRef.current + delta);

  // Отличия от личного расписания — только на вкладке таблицы и для той же группы
  const pageDiff = source.id === 'table' && diff && diff.tableGroupId === group.id ? diff.diffs : null;
  const diffById = useMemo(() => {
    const m = new Map<string, LessonDiff>();
    for (const d of pageDiff ?? []) if (isSignificant(d)) for (const id of d.tableIds) m.set(id, d);
    return m;
  }, [pageDiff]);

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
  const stickyHeight = () => (document.querySelector('.stickybar') as HTMLElement | null)?.offsetHeight ?? 0;
  const scrollToDay = useCallback((day: number, behavior: ScrollBehavior = 'smooth') => {
    const el = dayRefs.current[day];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - stickyHeight() - 10;
    window.scrollTo({ top: Math.max(0, top), behavior });
  }, []);

  // На телефоне прошедшие дни текущей недели свёрнуты, так что сегодня сразу под карточкой «Сейчас»
  const [showPast, setShowPast] = useState(false);
  const pastCollapsed = isCurrentWeek && !showPast;
  useEffect(() => {
    setShowPast(false);
    window.scrollTo({ top: 0 });
  }, [weekIndex, group.id]);
  const pickDay = (day: number) => {
    if (pastCollapsed && addDays(week.start, day) < today) {
      setShowPast(true);
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToDay(day)));
    } else scrollToDay(day);
  };

  // Какой день сейчас на экране — подсвечиваем его в полоске дней
  const [activeDay, setActiveDay] = useState(-1);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const line = stickyHeight() + 40;
        let active = -1;
        let first = -1;
        dayRefs.current.forEach((el, i) => {
          if (!el || el.offsetParent === null) return; // свёрнутый день
          if (first < 0) first = i;
          if (el.getBoundingClientRect().top <= line) active = i;
        });
        setActiveDay(active < 0 ? Math.max(first, 0) : active);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [weekIndex, group.id, showPast]);

  // Свайп влево/вправо по расписанию листает недели; стрелки на клавиатуре — тоже
  const touch = useRef<{ x: number; y: number } | null>(null);
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
      if (sheetOpen || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') changeWeek(-1);
      if (e.key === 'ArrowRight') changeWeek(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLocal = source.id === 'local';

  return (
    <>
      <header className="top">
        <div className="top__heading">
          <span className="top__eyebrow">{isLocal ? 'Моё расписание' : 'Из общей таблицы'}</span>
          <h1 className="top__title">{isLocal ? group.name : 'Расписание групп'}</h1>
        </div>
        {!isLocal && schedule.groups.length > 1 && (
          <div className="top__tabs">
            <GroupTabs groups={schedule.groups} value={group.id} onChange={onGroupChange} />
          </div>
        )}
        {hasSettings && (
          <button type="button" className="icon-btn top__settings" onClick={openSettings} aria-label="Настройки">
            <GearIcon />
            <span className="icon-btn__label">Настройки</span>
          </button>
        )}
      </header>

      <div className="stickybar">
        <div className="stickybar__inner">
          <WeekNav weeks={weeks} index={weekIndex} currentIndex={currentWeek?.index} onChange={setWeekIndex} />
          <DayStrip week={week} today={today} activeDay={activeDay} daysWithLessons={daysWithLessons} onPick={pickDay} />
        </div>
      </div>

      <main className="main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {(isCurrentWeek || pageDiff || !nudgeDismissed) && (
          <div className="main__cards">
            {isCurrentWeek && <NowCard group={group} settings={settings} weeks={weeks} today={today} nowHHMM={nowHHMM} />}
            {pageDiff && <DiffPanel diffs={pageDiff} />}
            <ElectiveNudge group={group} settings={settings} dismissed={nudgeDismissed} onOpen={openSettings} onDismiss={onNudgeDismiss} />
          </div>
        )}
        <DayList
          group={group}
          week={week}
          settings={settings}
          pairTimes={schedule.pairTimes}
          today={today}
          nowHHMM={nowHHMM}
          onOpenSettings={openSettings}
          dayRefs={dayRefs}
          diffById={pageDiff ? diffById : undefined}
          pastCollapsed={pastCollapsed}
          onShowPast={() => setShowPast(true)}
        />
        <p className="hint">Свайп влево или вправо листает недели</p>
        <CalendarSync source={source} group={group} settings={settings} onOpenSettings={hasSettings ? openSettings : undefined} />
        <Footer source={source.id} schedule={schedule} diffCount={diff?.count ?? 0} onShowDiff={onShowDiff} />
      </main>

      <SettingsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} group={group} settings={settings} onChange={(s) => onSettingsChange(group.id, s)} />
    </>
  );
}

function indexOfWeek(weeks: Week[], start: string): number {
  const i = weeks.findIndex((w) => w.start >= start);
  return i < 0 ? weeks.length - 1 : i;
}

function Skeleton() {
  return (
    <main className="main" aria-busy="true">
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--card" />
      <div className="skeleton" />
      <div className="skeleton" />
    </main>
  );
}

function ErrorView({ source, message }: { source: SourceId; message: string }) {
  return (
    <main className="main">
      <div className="error-card">
        <h1>Не удалось загрузить расписание</h1>
        <p>
          {source === 'local' ? 'Личное расписание' : 'Данные таблицы'} не загрузились ({message}). Проверьте интернет и обновите страницу.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          Обновить
        </button>
      </div>
    </main>
  );
}
