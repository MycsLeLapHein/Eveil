import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlarmClock,
  Brain,
  Check,
  Download,
  Monitor,
  Moon,
  Pencil,
  Play,
  Plus,
  Smartphone,
  Sun,
  Volume2,
} from 'lucide-react';
import {
  ActiveSleepSession,
  ActiveSnooze,
  Alarm,
  AmbientSoundId,
  AppTab,
  PendingWakeUpCheck,
  RingtoneId,
  SleepLogEntry,
} from './types/alarm';
import {
  DEFAULT_ALARMS,
  DEFAULT_SLEEP_LOGS,
  DIFFICULTY_LABELS,
  formatCountdownFrench,
  formatDaysSummary,
  getNextOccurrence,
  MISSION_LABELS,
  RINGTONES,
} from './data/defaults';
import { soundEngine } from './audio/soundEngine';
import { AlarmEditorDrawer } from './components/AlarmEditorDrawer';
import { RingingOverlay } from './components/RingingOverlay';
import { SleepTrackerView } from './components/SleepTrackerView';
import { SoundCatalogView } from './components/SoundCatalogView';
import { MissionLabView } from './components/MissionLabView';
import { AndroidPermissionsModal } from './components/AndroidPermissionsModal';
import { downloadStandaloneHtml } from './utils/exportStandaloneHtml';
import {
  getAndroidPermissions,
  getAndroidSystemAccent,
  isAndroidApk,
  syncAlarmsWithAndroid,
  syncAndroidSystemBars,
} from './native/androidBridge';

type ThemeMode = 'light' | 'dark' | 'system';

const ALARMS_KEY = 'eveil_alarms_v1';
const LOGS_KEY = 'eveil_sleep_logs_v1';
const THEME_KEY = 'eveil_theme_mode_v2';
const DEFAULT_RINGTONE_KEY = 'eveil_default_ringtone_v1';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('alarms');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    loadJson<ThemeMode>(THEME_KEY, 'system')
  );
  const [alarms, setAlarms] = useState<Alarm[]>(() => loadJson<Alarm[]>(ALARMS_KEY, DEFAULT_ALARMS));
  const [sleepLogs, setSleepLogs] = useState<SleepLogEntry[]>(() =>
    loadJson<SleepLogEntry[]>(LOGS_KEY, DEFAULT_SLEEP_LOGS)
  );
  const [defaultRingtone, setDefaultRingtone] = useState<RingtoneId>(() =>
    loadJson<RingtoneId>(DEFAULT_RINGTONE_KEY, 'aube-carillon')
  );

  const [now, setNow] = useState<Date>(() => new Date());
  const [editingAlarm, setEditingAlarm] = useState<{ alarm: Alarm; isNew: boolean } | null>(null);

  // Active ringing alarm state
  const [ringingState, setRingingState] = useState<{
    alarm: Alarm;
    snoozeCount: number;
    isTest: boolean;
  } | null>(null);
  const [ringMuted, setRingMuted] = useState(false);

  // Snooze & Wake-Up Check state
  const [activeSnooze, setActiveSnooze] = useState<ActiveSnooze | null>(null);
  const [pendingCheck, setPendingCheck] = useState<PendingWakeUpCheck | null>(null);
  const [wakeCheckModal, setWakeCheckModal] = useState<{
    check: PendingWakeUpCheck;
    secondsLeft: number;
  } | null>(null);

  // Active sleep tracking session
  const [sleepSession, setSleepSession] = useState<ActiveSleepSession | null>(null);

  // Android APK permissions modal
  const [showAndroidModal, setShowAndroidModal] = useState(false);

  // Toast notice (quiet inline feedback)
  const [notice, setNotice] = useState<string | null>(null);

  const lastTriggeredStampRef = useRef<string>('');
  const muteRestoreTimerRef = useRef<number | null>(null);

  // Sync theme mode (Clair / Sombre / Système) with OS prefers-color-scheme & Android system bars/accent
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = themeMode === 'dark' || (themeMode === 'system' && media.matches);
      const root = document.documentElement;
      root.classList.toggle('dark', isDark);

      // Update browser/PWA theme-color meta tag
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', isDark ? '#141413' : '#FAF9F6');
      }

      // Sync Android status/nav bars & optional Android 12+ Material You system color
      syncAndroidSystemBars(isDark);
      const nativeAccent = themeMode === 'system' ? getAndroidSystemAccent(isDark) : null;
      if (nativeAccent) {
        root.style.setProperty('--accent', nativeAccent);
      } else {
        root.style.removeProperty('--accent');
      }
    };

    applyTheme();
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify(themeMode));
    } catch {
      // Ignore storage quota errors
    }

    if (themeMode === 'system') {
      media.addEventListener('change', applyTheme);
      return () => media.removeEventListener('change', applyTheme);
    }
  }, [themeMode]);

  useEffect(() => {
    try {
      localStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
    } catch {
      // Ignore
    }
  }, [alarms]);

  useEffect(() => {
    try {
      localStorage.setItem(LOGS_KEY, JSON.stringify(sleepLogs));
    } catch {
      // Ignore
    }
  }, [sleepLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(DEFAULT_RINGTONE_KEY, JSON.stringify(defaultRingtone));
    } catch {
      // Ignore
    }
  }, [defaultRingtone]);

  // Sync alarms with native Android AlarmManager whenever alarms or snooze change
  useEffect(() => {
    syncAlarmsWithAndroid(
      alarms,
      activeSnooze ? { alarmId: activeSnooze.alarmId, resumeAt: activeSnooze.resumeAt } : null
    );
  }, [alarms, activeSnooze]);

  // Prompt missing Android overlay/exact-alarm permissions on first APK launch
  useEffect(() => {
    if (!isAndroidApk()) return;
    const status = getAndroidPermissions();
    if (status && (!status.overlay || !status.exactAlarm || !status.battery)) {
      setShowAndroidModal(true);
    }
  }, []);

  // Receive background alarm trigger from Android MainActivity over lock screen / other apps
  useEffect(() => {
    window.__eveilNativeTriggerAlarm = (alarmId: string) => {
      const target = alarms.find((a) => a.id === alarmId) ?? alarms[0];
      if (!target) return;
      if (target.days.length === 0) {
        setAlarms((prev) =>
          prev.map((a) => (a.id === target.id ? { ...a, enabled: false } : a))
        );
      }
      setRingingState({ alarm: target, snoozeCount: 0, isTest: false });
      setRingMuted(false);
    };
    return () => {
      delete window.__eveilNativeTriggerAlarm;
    };
  }, [alarms]);

  const showNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => {
      setNotice((curr) => (curr === text ? null : curr));
    }, 4000);
  };

  const launchAlarm = (alarm: Alarm, snoozeCount = 0, isTest = false) => {
    soundEngine.stopAmbient();
    setRingMuted(false);
    soundEngine.startRingtone(alarm.ringtone, {
      volume: alarm.volume,
      crescendo: alarm.crescendo,
      vibrate: true,
      watchVibration: alarm.watchVibration ?? true,
      label: alarm.label,
    });
    setRingingState({ alarm, snoozeCount, isTest });
  };

  // Master 1-second horological clock & scheduler
  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current);

      // 1. Check active snooze expiry
      if (activeSnooze && !ringingState && current.getTime() >= activeSnooze.resumeAt) {
        const targetAlarm = alarms.find((a) => a.id === activeSnooze.alarmId);
        setActiveSnooze(null);
        if (targetAlarm) {
          launchAlarm(targetAlarm, activeSnooze.snoozeCount, false);
        }
        return;
      }

      // 2. Check pending Wake-Up Check trigger
      if (pendingCheck && !wakeCheckModal && !ringingState && current.getTime() >= pendingCheck.checkAt) {
        const triggered = pendingCheck;
        setPendingCheck(null);
        soundEngine.playCheckChime();
        setWakeCheckModal({ check: triggered, secondsLeft: 60 });
        return;
      }

      // 3. Check scheduled recurring & one-time alarms at second 0
      const hhmm = `${current.getHours().toString().padStart(2, '0')}:${current
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      const minuteStamp = `${current.toDateString()}-${hhmm}`;

      if (!ringingState && current.getSeconds() <= 1 && minuteStamp !== lastTriggeredStampRef.current) {
        const today = current.getDay();
        const due = alarms.find(
          (a) =>
            a.enabled &&
            a.time === hhmm &&
            (a.days.length === 0 || a.days.includes(today as 0 | 1 | 2 | 3 | 4 | 5 | 6))
        );
        if (due) {
          lastTriggeredStampRef.current = minuteStamp;
          if (due.days.length === 0) {
            setAlarms((prev) =>
              prev.map((a) => (a.id === due.id ? { ...a, enabled: false } : a))
            );
          }
          launchAlarm(due, 0, false);
        }
      }
    };

    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [alarms, activeSnooze, pendingCheck, wakeCheckModal, ringingState]);

  // Wake-Up Check 60-second countdown
  useEffect(() => {
    if (!wakeCheckModal) return;
    if (wakeCheckModal.secondsLeft <= 0) {
      const target = alarms.find((a) => a.id === wakeCheckModal.check.alarmId);
      setWakeCheckModal(null);
      if (target) {
        launchAlarm(target, 0, false);
      }
      return;
    }
    const t = window.setTimeout(() => {
      setWakeCheckModal((prev) =>
        prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null
      );
    }, 1000);
    return () => window.clearTimeout(t);
  }, [wakeCheckModal, alarms]);

  // Next active alarm calculation
  const nextAlarmInfo = useMemo(() => {
    let earliest: { alarm: Alarm; date: Date } | null = null;
    for (const alarm of alarms) {
      const d = getNextOccurrence(alarm, now);
      if (d && (!earliest || d.getTime() < earliest.date.getTime())) {
        earliest = { alarm, date: d };
      }
    }
    return earliest;
  }, [alarms, now]);

  const sortedAlarms = useMemo(
    () => [...alarms].sort((a, b) => a.time.localeCompare(b.time)),
    [alarms]
  );

  // Handlers
  const openNewAlarm = () => {
    const suggested: Alarm = {
      id: `alarm-${Date.now()}`,
      time: '07:00',
      label: 'Réveil',
      enabled: true,
      days: [1, 2, 3, 4, 5],
      mission: 'math',
      difficulty: 'medium',
      ringtone: defaultRingtone,
      volume: 0.85,
      crescendo: true,
      snoozeMinutes: 5,
      maxSnoozes: 2,
      wakeUpCheck: true,
      wakeUpCheckDelayMin: 3,
      watchVibration: true,
    };
    setEditingAlarm({ alarm: suggested, isNew: true });
  };

  const createQuickOneMinAlarm = () => {
    const target = new Date(Date.now() + 62_000);
    const hhmm = `${target.getHours().toString().padStart(2, '0')}:${target
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    const quick: Alarm = {
      id: `alarm-${Date.now()}`,
      time: hhmm,
      label: 'Alarme rapide (+1 min)',
      enabled: true,
      days: [],
      mission: 'math',
      difficulty: 'easy',
      ringtone: defaultRingtone,
      volume: 0.75,
      crescendo: true,
      snoozeMinutes: 3,
      maxSnoozes: 1,
      wakeUpCheck: false,
      wakeUpCheckDelayMin: 1,
    };
    setAlarms((prev) => [...prev, quick]);
    showNotice(`Alarme rapide programmée pour ${hhmm}.`);
  };

  const handleSaveAlarm = (saved: Alarm) => {
    setAlarms((prev) => {
      const exists = prev.some((a) => a.id === saved.id);
      if (exists) {
        return prev.map((a) => (a.id === saved.id ? saved : a));
      }
      return [...prev, saved];
    });
    setEditingAlarm(null);
    showNotice(`Alarme « ${saved.label} » enregistrée à ${saved.time}.`);
  };

  const handleDeleteAlarm = (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
    setEditingAlarm(null);
    showNotice('Alarme supprimée.');
  };

  const toggleAlarmEnabled = (id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const handleDismissAlarm = (solveSeconds: number) => {
    if (!ringingState) return;
    if (muteRestoreTimerRef.current !== null) {
      window.clearTimeout(muteRestoreTimerRef.current);
      muteRestoreTimerRef.current = null;
    }
    soundEngine.stopRingtone();
    const { alarm, snoozeCount, isTest } = ringingState;
    setRingingState(null);
    setRingMuted(false);

    // Log wake-up into sleep tracking history if a real sleep session was running or real alarm
    if (sleepSession) {
      const start = new Date(sleepSession.startedAt);
      const end = new Date();
      const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
      const newLog: SleepLogEntry = {
        id: `log-${Date.now()}`,
        date: end.toISOString().slice(0, 10),
        bedtime: start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        wakeTime: end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        durationMinutes,
        quality: snoozeCount === 0 ? 'reposé' : 'correct',
        missionUsed: alarm.mission,
        missionSolveSeconds: solveSeconds,
        snoozeCount,
        soundPeaks: sleepSession.soundPeaks,
      };
      setSleepLogs((prev) => [newLog, ...prev]);
      setSleepSession(null);
    } else if (!isTest) {
      const end = new Date();
      const approxBed = new Date(end.getTime() - 450 * 60_000);
      const newLog: SleepLogEntry = {
        id: `log-${Date.now()}`,
        date: end.toISOString().slice(0, 10),
        bedtime: approxBed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        wakeTime: end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        durationMinutes: 450,
        quality: snoozeCount === 0 ? 'reposé' : 'correct',
        missionUsed: alarm.mission,
        missionSolveSeconds: solveSeconds,
        snoozeCount,
        soundPeaks: 0,
      };
      setSleepLogs((prev) => [newLog, ...prev]);
    }

    // Arm Wake-Up Check if configured
    if (alarm.wakeUpCheck) {
      const delayMs = alarm.wakeUpCheckDelayMin * 60_000;
      setPendingCheck({
        alarmId: alarm.id,
        alarmLabel: alarm.label,
        checkAt: Date.now() + delayMs,
        ringtone: alarm.ringtone,
        volume: alarm.volume,
      });
      showNotice(
        `Défi réussi en ${solveSeconds} s. Vérification de réveil armée dans ${alarm.wakeUpCheckDelayMin} min.`
      );
    } else {
      showNotice(`Alarme arrêtée après ${solveSeconds} s.`);
    }
  };

  const handleSnoozeAlarm = () => {
    if (!ringingState) return;
    if (muteRestoreTimerRef.current !== null) {
      window.clearTimeout(muteRestoreTimerRef.current);
      muteRestoreTimerRef.current = null;
    }
    soundEngine.stopRingtone();
    const { alarm, snoozeCount } = ringingState;
    setRingingState(null);
    setRingMuted(false);

    const nextSnoozeCount = snoozeCount + 1;
    const resumeAt = Date.now() + alarm.snoozeMinutes * 60_000;
    setActiveSnooze({
      alarmId: alarm.id,
      alarmLabel: alarm.label,
      resumeAt,
      snoozeCount: nextSnoozeCount,
    });
    showNotice(`Rappel programmé dans ${alarm.snoozeMinutes} min.`);
  };

  const handleToggleTempMute = () => {
    if (!ringingState) return;
    if (ringMuted) {
      if (muteRestoreTimerRef.current !== null) {
        window.clearTimeout(muteRestoreTimerRef.current);
        muteRestoreTimerRef.current = null;
      }
      soundEngine.startRingtone(ringingState.alarm.ringtone, {
        volume: ringingState.alarm.volume,
        crescendo: false,
      });
      setRingMuted(false);
    } else {
      soundEngine.stopRingtone();
      setRingMuted(true);
      muteRestoreTimerRef.current = window.setTimeout(() => {
        setRingMuted(false);
        soundEngine.startRingtone(ringingState.alarm.ringtone, {
          volume: ringingState.alarm.volume,
          crescendo: false,
        });
      }, 10_000);
    }
  };

  // Sleep session handlers
  const handleStartSleepSession = (ambient: AmbientSoundId | null, micEnabled: boolean) => {
    setSleepSession({
      startedAt: Date.now(),
      targetWakeTime: nextAlarmInfo?.alarm.time ?? null,
      ambientSound: ambient,
      micMonitoring: micEnabled,
      soundPeaks: 0,
    });
    showNotice('Mode suivi nocturne démarré.');
  };

  const handleEndSleepSession = (quality: SleepLogEntry['quality']) => {
    if (!sleepSession) return;
    const start = new Date(sleepSession.startedAt);
    const end = new Date();
    const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
    const entry: SleepLogEntry = {
      id: `log-${Date.now()}`,
      date: end.toISOString().slice(0, 10),
      bedtime: start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      wakeTime: end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      durationMinutes,
      quality,
      missionUsed: 'none',
      missionSolveSeconds: 0,
      snoozeCount: 0,
      soundPeaks: sleepSession.soundPeaks,
    };
    setSleepLogs((prev) => [entry, ...prev]);
    setSleepSession(null);
    showNotice('Nuit enregistrée dans le journal.');
  };

  const handleExportHtml = () => {
    downloadStandaloneHtml(alarms, sleepLogs);
    showNotice('Fichier autonome eveil.html téléchargé.');
  };

  const navItems: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: 'alarms', label: 'Alarmes', icon: <AlarmClock className="w-5 h-5" /> },
    { id: 'missions', label: 'Défis', icon: <Brain className="w-5 h-5" /> },
    { id: 'tracking', label: 'Suivi', icon: <Moon className="w-5 h-5" /> },
    { id: 'sounds', label: 'Sonneries', icon: <Volume2 className="w-5 h-5" /> },
  ];

  const clockHM = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const clockSec = now.getSeconds().toString().padStart(2, '0');
  const dateFrench = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#181816] dark:bg-[#141413] dark:text-[#F4F3EF] transition-colors duration-200">
      {/* Top Bar Contract: Exactly 3 zones (Wordmark — 4 Nav Links — 1 Primary Action) */}
      <header className="sticky top-0 z-30 bg-[#FAF9F6]/92 dark:bg-[#141413]/92 backdrop-blur-md border-b border-black/10 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('alarms')}
            className="font-display text-2xl font-bold tracking-tight whitespace-nowrap shrink-0"
          >
            Éveil
          </button>

          {/* Zone 2: 4 clean single-line navigation links */}
          <nav
            aria-label="Navigation principale"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors duration-150 ${
                    active
                      ? 'border-[var(--accent)] text-[#181816] dark:text-[#F4F3EF]'
                      : 'border-transparent text-[#66645E] dark:text-[#9C9A92] hover:text-[#181816] dark:hover:text-[#F4F3EF]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={openNewAlarm}
              className="min-h-[42px] px-4 rounded-md bg-[var(--accent)] hover:opacity-90 text-[#FAF9F6] text-sm font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-opacity duration-150"
            >
              <Plus className="w-4 h-4" />
              Nouvelle alarme
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 py-8 sm:py-12 pb-24 md:pb-16">
        {/* Quiet inline feedback line */}
        {notice && (
          <div
            role="status"
            className="mb-8 pb-3 border-b border-[#C83A1E]/30 flex items-center justify-between gap-4 text-sm"
          >
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs text-[#66645E] dark:text-[#9C9A92] underline underline-offset-4"
            >
              Fermer
            </button>
          </div>
        )}

        {activeTab === 'alarms' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            {/* Left 40% (5 cols): Live Horological Clock & Control Anchor */}
            <aside className="lg:col-span-5 space-y-8 lg:sticky lg:top-24">
              <div className="space-y-3">
                <p className="text-sm capitalize text-[#66645E] dark:text-[#9C9A92]">
                  {dateFrench}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono-tabular text-6xl sm:text-7xl xl:text-[5.25rem] font-semibold tracking-tight leading-none">
                    {clockHM}
                  </span>
                  <span className="font-mono-tabular text-2xl sm:text-3xl text-[#66645E] dark:text-[#9C9A92]">
                    {clockSec}
                  </span>
                </div>
              </div>

              {/* Next Alarm Countdown */}
              <div className="border-t border-black/10 dark:border-white/10 pt-5 space-y-2">
                {activeSnooze ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[#C83A1E] dark:text-[#E25134]">
                      Rappel actif · {activeSnooze.alarmLabel}
                    </div>
                    <p className="text-base font-medium font-mono-tabular">
                      Reprise {formatCountdownFrench(new Date(activeSnooze.resumeAt), now)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSnooze(null);
                        showNotice('Rappel annulé.');
                      }}
                      className="text-xs underline underline-offset-4 text-[#66645E] dark:text-[#9C9A92] hover:text-[#181816] dark:hover:text-[#F4F3EF]"
                    >
                      Annuler le rappel
                    </button>
                  </div>
                ) : nextAlarmInfo ? (
                  <div className="space-y-1">
                    <div className="text-xs text-[#66645E] dark:text-[#9C9A92]">Prochain réveil</div>
                    <div className="text-lg font-medium">
                      <span className="font-mono-tabular font-semibold">
                        {nextAlarmInfo.alarm.time}
                      </span>{' '}
                      · {nextAlarmInfo.alarm.label}
                    </div>
                    <div className="text-sm text-[#66645E] dark:text-[#9C9A92] font-mono-tabular">
                      Sonne {formatCountdownFrench(nextAlarmInfo.date, now)}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#66645E] dark:text-[#9C9A92]">
                    Aucune alarme active pour le moment.
                  </p>
                )}

                {pendingCheck && (
                  <div className="pt-3 mt-3 border-t border-black/8 dark:border-white/8 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#C83A1E] dark:text-[#E25134] font-medium">
                      Vérification de réveil {formatCountdownFrench(new Date(pendingCheck.checkAt), now)}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const triggered = pendingCheck;
                          setPendingCheck(null);
                          soundEngine.playCheckChime();
                          setWakeCheckModal({ check: triggered, secondsLeft: 60 });
                        }}
                        className="underline underline-offset-4 text-[#181816] dark:text-[#F4F3EF]"
                      >
                        Vérifier maintenant
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingCheck(null)}
                        className="underline underline-offset-4 text-[#66645E] dark:text-[#9C9A92]"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Workspace Controls (Theme 3-way, Quick +1 min, Export, Android APK) */}
              <div className="border-t border-black/10 dark:border-white/10 pt-5 space-y-4">
                <div className="space-y-2">
                  <span className="block text-xs text-[#66645E] dark:text-[#9C9A92]">
                    Apparence
                  </span>
                  <div
                    role="group"
                    aria-label="Choix du thème"
                    className="grid grid-cols-3 gap-1 p-1 rounded-md bg-[#F2F0EA] dark:bg-[#1D1C1A]"
                  >
                    {(
                      [
                        { id: 'light', label: 'Clair', icon: <Sun className="w-3.5 h-3.5" /> },
                        { id: 'dark', label: 'Sombre', icon: <Moon className="w-3.5 h-3.5" /> },
                        { id: 'system', label: 'Système', icon: <Monitor className="w-3.5 h-3.5" /> },
                      ] as const
                    ).map((opt) => {
                      const selected = themeMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setThemeMode(opt.id)}
                          aria-pressed={selected}
                          className={`min-h-[38px] px-2.5 rounded text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                            selected
                              ? 'bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413]'
                              : 'text-[#66645E] dark:text-[#9C9A92] hover:text-[#181816] dark:hover:text-[#F4F3EF]'
                          }`}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={createQuickOneMinAlarm}
                    className="min-h-[42px] px-3.5 rounded-md border border-black/15 dark:border-white/15 text-xs font-medium hover:border-[#C83A1E] transition-colors whitespace-nowrap"
                  >
                    Alarme rapide +1 min
                  </button>
                  <button
                    type="button"
                    onClick={handleExportHtml}
                    className="min-h-[42px] px-3.5 rounded-md border border-black/15 dark:border-white/15 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exporter .html
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAndroidModal(true)}
                    className="min-h-[42px] px-3.5 rounded-md border border-black/15 dark:border-white/15 text-xs font-medium inline-flex items-center gap-1.5 hover:border-[#C83A1E] transition-colors whitespace-nowrap"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Mode Android (.apk)
                  </button>
                </div>

                {sleepSession && (
                  <div className="pt-2 text-xs text-[#66645E] dark:text-[#9C9A92] flex items-center justify-between">
                    <span>Suivi nocturne en cours</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('tracking')}
                      className="text-[#C83A1E] dark:text-[#E25134] underline underline-offset-4 font-medium"
                    >
                      Ouvrir le suivi
                    </button>
                  </div>
                )}
              </div>
            </aside>

            {/* Right 60% (7 cols): Full-Width Ruled Alarm List */}
            <section className="lg:col-span-7 space-y-4">
              <div className="flex items-baseline justify-between pb-2">
                <h1 className="font-display text-2xl sm:text-3xl font-semibold">
                  Vos alarmes
                </h1>
                <span className="text-xs text-[#66645E] dark:text-[#9C9A92] font-mono-tabular">
                  {alarms.filter((a) => a.enabled).length} / {alarms.length} actives
                </span>
              </div>

              {sortedAlarms.length === 0 ? (
                <div className="border-y border-black/10 dark:border-white/10 py-14 text-center space-y-4">
                  <p className="text-sm text-[#66645E] dark:text-[#9C9A92]">
                    Aucune alarme enregistrée. Créez votre premier réveil récurrent.
                  </p>
                  <button
                    type="button"
                    onClick={openNewAlarm}
                    className="min-h-[44px] px-5 rounded-md bg-[#C83A1E] text-[#FAF9F6] text-sm font-medium"
                  >
                    Créer une alarme
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-black/10 dark:divide-white/10 border-y border-black/10 dark:border-white/10">
                  {sortedAlarms.map((alarm) => {
                    const ringName =
                      RINGTONES.find((r) => r.id === alarm.ringtone)?.name ?? alarm.ringtone;
                    const missionLabel =
                      alarm.mission === 'none'
                        ? MISSION_LABELS.none.short
                        : `${MISSION_LABELS[alarm.mission].short} (${DIFFICULTY_LABELS[alarm.difficulty]})`;

                    return (
                      <article
                        key={alarm.id}
                        className={`py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-opacity duration-150 ${
                          alarm.enabled ? 'opacity-100' : 'opacity-55'
                        }`}
                      >
                        {/* Alarm time & clean unboxed metadata */}
                        <div
                          onClick={() => setEditingAlarm({ alarm, isNew: false })}
                          className="flex-1 min-w-0 cursor-pointer group"
                        >
                          <div className="flex items-baseline gap-3.5">
                            <span className="font-mono-tabular text-4xl sm:text-[2.65rem] font-semibold tracking-tight leading-none group-hover:text-[#C83A1E] dark:group-hover:text-[#E25134] transition-colors">
                              {alarm.time}
                            </span>
                            <span className="text-base font-medium truncate">
                              {alarm.label}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#66645E] dark:text-[#9C9A92]">
                            <span className="text-[#181816] dark:text-[#F4F3EF] font-medium">
                              {formatDaysSummary(alarm.days)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{missionLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span>{ringName}</span>
                            {alarm.snoozeMinutes > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Rappel {alarm.snoozeMinutes} min</span>
                              </>
                            )}
                            {alarm.wakeUpCheck && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Vérif. réveil</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action controls: Test, Edit, Tactile Switch */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => launchAlarm(alarm, 0, true)}
                            title="Déclencher maintenant pour tester la sonnerie et le défi"
                            className="min-h-[42px] px-3 rounded-md border border-black/12 dark:border-white/12 text-xs font-medium inline-flex items-center gap-1.5 hover:border-[#C83A1E] hover:text-[#C83A1E] dark:hover:text-[#E25134] transition-colors whitespace-nowrap"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Tester
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAlarm({ alarm, isNew: false })}
                            aria-label={`Modifier ${alarm.label}`}
                            className="min-w-[42px] min-h-[42px] rounded-md border border-black/12 dark:border-white/12 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Tactile Braun-style toggle switch */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={alarm.enabled}
                            aria-label={`${alarm.enabled ? 'Désactiver' : 'Activer'} ${alarm.label}`}
                            onClick={() => toggleAlarmEnabled(alarm.id)}
                            className={`relative ml-1 w-12 h-7 rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                              alarm.enabled
                                ? 'bg-[var(--accent)]'
                                : 'bg-black/15 dark:bg-white/18'
                            }`}
                          >
                            <span
                              className={`block w-5 h-5 rounded-full bg-[#FAF9F6] transition-transform duration-150 ${
                                alarm.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'missions' && <MissionLabView defaultRingtone={defaultRingtone} />}

        {activeTab === 'tracking' && (
          <SleepTrackerView
            logs={sleepLogs}
            alarms={alarms}
            activeSession={sleepSession}
            onStartSession={handleStartSleepSession}
            onUpdateSessionPeaks={(peaks) =>
              setSleepSession((prev) => (prev ? { ...prev, soundPeaks: peaks } : null))
            }
            onEndSession={handleEndSleepSession}
            onAddManualLog={(entry) => {
              setSleepLogs((prev) => [entry, ...prev]);
              showNotice('Nuit ajoutée au journal.');
            }}
            onDeleteLog={(id) => {
              setSleepLogs((prev) => prev.filter((l) => l.id !== id));
            }}
            onExportHtml={handleExportHtml}
          />
        )}

        {activeTab === 'sounds' && (
          <SoundCatalogView
            defaultRingtone={defaultRingtone}
            onSetDefaultRingtone={(id) => {
              setDefaultRingtone(id);
              const name = RINGTONES.find((r) => r.id === id)?.name ?? id;
              showNotice(`« ${name} » définie comme sonnerie par défaut.`);
            }}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Thumb Navigation (<= 64px height to respect 15% mobile sticky cap) */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FAF9F6]/95 dark:bg-[#141413]/95 backdrop-blur-md border-t border-black/10 dark:border-white/10"
      >
        <div className="grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'text-[var(--accent)]'
                    : 'text-[#66645E] dark:text-[#9C9A92]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Alarm Editor Slide-over Drawer */}
      {editingAlarm && (
        <AlarmEditorDrawer
          alarm={editingAlarm.alarm}
          isNew={editingAlarm.isNew}
          onSave={handleSaveAlarm}
          onDelete={handleDeleteAlarm}
          onClose={() => setEditingAlarm(null)}
        />
      )}

      {/* Full-Screen Active Alarm & Mission Overlay */}
      {ringingState && (
        <RingingOverlay
          alarm={ringingState.alarm}
          snoozeCount={ringingState.snoozeCount}
          onDismiss={handleDismissAlarm}
          onSnooze={handleSnoozeAlarm}
          onToggleMuteTemporary={handleToggleTempMute}
          isMuted={ringMuted}
        />
      )}

      {/* Alarmy Wake-Up Check Confirmation Modal */}
      {wakeCheckModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Vérification de réveil"
        >
          <div className="w-full max-w-md rounded-xl bg-[#FAF9F6] dark:bg-[#141413] text-[#181816] dark:text-[#F4F3EF] border border-black/12 dark:border-white/12 p-7 space-y-5">
            <div className="text-xs font-medium text-[#C83A1E] dark:text-[#E25134]">
              Vérification de réveil · {wakeCheckModal.check.alarmLabel}
            </div>
            <h2 className="font-display text-2xl font-semibold text-balance">
              Êtes-vous bien réveillé(e) ?
            </h2>
            <p className="text-sm text-[#66645E] dark:text-[#9C9A92]">
              Sans confirmation de votre part dans{' '}
              <strong className="font-mono-tabular text-[#181816] dark:text-[#F4F3EF]">
                {wakeCheckModal.secondsLeft} s
              </strong>
              , l’alarme se redéclenchera automatiquement.
            </p>
            <button
              type="button"
              onClick={() => {
                setWakeCheckModal(null);
                showNotice('Réveil confirmé. Bonne journée.');
              }}
              className="w-full min-h-[50px] rounded-lg bg-[#C83A1E] hover:bg-[#B03118] text-[#FAF9F6] text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Check className="w-4 h-4" />
              Oui, je suis debout
            </button>
          </div>
        </div>
      )}
      {/* Android APK Permissions & Build Guide Modal */}
      {showAndroidModal && (
        <AndroidPermissionsModal onClose={() => setShowAndroidModal(false)} />
      )}
    </div>
  );
}
