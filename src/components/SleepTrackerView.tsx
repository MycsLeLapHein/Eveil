import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Mic, MicOff, Moon, Play, Plus, Square, Trash2 } from 'lucide-react';
import {
  ActiveSleepSession,
  Alarm,
  AmbientSoundId,
  SleepLogEntry,
} from '../types/alarm';
import {
  AMBIENT_SOUNDS,
  formatDurationFrench,
  MISSION_LABELS,
} from '../data/defaults';
import { soundEngine } from '../audio/soundEngine';

interface SleepTrackerViewProps {
  logs: SleepLogEntry[];
  alarms: Alarm[];
  activeSession: ActiveSleepSession | null;
  onStartSession: (ambient: AmbientSoundId | null, micEnabled: boolean) => void;
  onUpdateSessionPeaks: (peaks: number) => void;
  onEndSession: (quality: SleepLogEntry['quality']) => void;
  onAddManualLog: (entry: SleepLogEntry) => void;
  onDeleteLog: (id: string) => void;
  onExportHtml: () => void;
}

export const SleepTrackerView: React.FC<SleepTrackerViewProps> = ({
  logs,
  alarms,
  activeSession,
  onStartSession,
  onUpdateSessionPeaks,
  onEndSession,
  onAddManualLog,
  onDeleteLog,
  onExportHtml,
}) => {
  const [selectedAmbient, setSelectedAmbient] = useState<AmbientSoundId | null>('pluie-douce');
  const [ambientTimerMin, setAmbientTimerMin] = useState<number>(30);
  const [micRequested, setMicRequested] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [endingQuality, setEndingQuality] = useState<SleepLogEntry['quality']>('reposé');
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Manual log state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualBed, setManualBed] = useState('23:15');
  const [manualWake, setManualWake] = useState('06:50');
  const [manualQuality, setManualQuality] = useState<SleepLogEntry['quality']>('reposé');

  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number | null>(null);
  const lastPeakRef = useRef<number>(0);
  const peaksCountRef = useRef<number>(activeSession?.soundPeaks ?? 0);

  useEffect(() => {
    peaksCountRef.current = activeSession?.soundPeaks ?? 0;
  }, [activeSession?.soundPeaks]);

  // Live session elapsed timer
  useEffect(() => {
    if (!activeSession) {
      setElapsedSec(0);
      return;
    }
    const tick = () => {
      setElapsedSec(Math.floor((Date.now() - activeSession.startedAt) / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeSession]);

  // Ambient sleep timer auto-fade
  useEffect(() => {
    if (!activeSession || !activeSession.ambientSound || ambientTimerMin <= 0) return;
    const timeout = window.setTimeout(() => {
      soundEngine.stopAmbient();
    }, ambientTimerMin * 60_000);
    return () => window.clearTimeout(timeout);
  }, [activeSession, ambientTimerMin]);

  // Optional real microphone level monitoring during sleep session
  const stopMicMonitor = () => {
    if (micRafRef.current !== null) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current) {
      void micCtxRef.current.close();
      micCtxRef.current = null;
    }
    setMicLevel(0);
  };

  useEffect(() => {
    if (!activeSession || !activeSession.micMonitoring) {
      stopMicMonitor();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        micCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const sample = () => {
          if (cancelled) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const level = Math.min(100, Math.round(rms * 280));
          setMicLevel(level);
          const now = Date.now();
          if (level > 42 && now - lastPeakRef.current > 4000) {
            lastPeakRef.current = now;
            peaksCountRef.current += 1;
            onUpdateSessionPeaks(peaksCountRef.current);
          }
          micRafRef.current = requestAnimationFrame(sample);
        };
        sample();
      } catch {
        setMicError('Accès au microphone refusé : le suivi reste actif sans détection sonore.');
      }
    })();

    return () => {
      cancelled = true;
      stopMicMonitor();
    };
  }, [activeSession?.startedAt, activeSession?.micMonitoring]);

  const handleLaunchSleep = () => {
    setMicError('');
    if (selectedAmbient) {
      soundEngine.startAmbient(selectedAmbient, 0.42);
    }
    onStartSession(selectedAmbient, micRequested);
  };

  const handleFinishSleep = () => {
    soundEngine.stopAmbient();
    stopMicMonitor();
    setShowEndConfirm(false);
    onEndSession(endingQuality);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const [bh, bm] = manualBed.split(':').map(Number);
    const [wh, wm] = manualWake.split(':').map(Number);
    let mins = wh * 60 + wm - (bh * 60 + bm);
    if (mins <= 0) mins += 24 * 60;
    onAddManualLog({
      id: `log-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      bedtime: manualBed,
      wakeTime: manualWake,
      durationMinutes: mins,
      quality: manualQuality,
      missionUsed: 'none',
      missionSolveSeconds: 0,
      snoozeCount: 0,
      soundPeaks: 0,
    });
    setShowManualForm(false);
  };

  // Summary metrics
  const recentSeven = useMemo(() => logs.slice(0, 7).reverse(), [logs]);
  const stats = useMemo(() => {
    if (logs.length === 0) {
      return { avgMin: 0, noSnoozeRate: 0, avgSolve: 0, totalNights: 0 };
    }
    const slice = logs.slice(0, 7);
    const avgMin = Math.round(slice.reduce((acc, l) => acc + l.durationMinutes, 0) / slice.length);
    const noSnooze = slice.filter((l) => l.snoozeCount === 0).length;
    const withMission = slice.filter((l) => l.missionSolveSeconds > 0);
    const avgSolve =
      withMission.length > 0
        ? Math.round(withMission.reduce((a, b) => a + b.missionSolveSeconds, 0) / withMission.length)
        : 0;
    return {
      avgMin,
      noSnoozeRate: Math.round((noSnooze / slice.length) * 100),
      avgSolve,
      totalNights: logs.length,
    };
  }, [logs]);

  const elapsedFormatted = useMemo(() => {
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    const s = elapsedSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}`;
  }, [elapsedSec]);

  const activeAlarmsCount = alarms.filter((a) => a.enabled).length;

  return (
    <div className="space-y-12">
      {/* Top 40/60 Asymmetric Split: Live Bedside Sleep Session vs Weekly Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        {/* Left 5 cols (40%): Mode Nuit & Suivi en direct */}
        <section className="lg:col-span-5 space-y-6">
          <div className="border-b border-black/10 dark:border-white/10 pb-4">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-balance">
              Mode de suivi nocturne
            </h2>
            <p className="mt-1.5 text-sm text-[#66645E] dark:text-[#9C9A92]">
              Chronométrez votre nuit, lancez un fond sonore minuté et enregistrez les pics ambiants.
            </p>
          </div>

          {activeSession ? (
            <div className="space-y-6 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-[#C83A1E] dark:text-[#E25134]">
                  Suivi en cours
                </span>
                <span className="text-xs text-[#66645E] dark:text-[#9C9A92] font-mono-tabular">
                  Début {new Date(activeSession.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="font-mono-tabular text-5xl sm:text-6xl font-semibold tracking-tight">
                {elapsedFormatted}
              </div>

              {activeSession.micMonitoring && (
                <div className="space-y-2 pt-2 border-t border-black/8 dark:border-white/8">
                  <div className="flex items-center justify-between text-xs text-[#66645E] dark:text-[#9C9A92]">
                    <span>Niveau sonore ambiant (micro)</span>
                    <span className="font-mono-tabular">
                      {activeSession.soundPeaks} pic{activeSession.soundPeaks > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#C83A1E] transition-[width] duration-100"
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                </div>
              )}

              {micError && (
                <p className="text-xs text-[#66645E] dark:text-[#9C9A92]">{micError}</p>
              )}

              {!showEndConfirm ? (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEndConfirm(true)}
                    className="min-h-[46px] px-5 rounded-lg bg-[#C83A1E] hover:bg-[#B03118] text-[#FAF9F6] text-sm font-medium inline-flex items-center gap-2 transition-colors"
                  >
                    <Square className="w-4 h-4" />
                    Arrêter le suivi
                  </button>
                  {activeSession.ambientSound && (
                    <button
                      type="button"
                      onClick={() => soundEngine.stopAmbient()}
                      className="min-h-[46px] px-4 rounded-lg border border-black/15 dark:border-white/15 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      Couper le fond sonore
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pt-4 border-t border-black/10 dark:border-white/10">
                  <p className="text-sm font-medium">Comment vous sentez-vous au réveil ?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['reposé', 'correct', 'fatigué'] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setEndingQuality(q)}
                        className={`min-h-[42px] rounded-md text-xs font-medium capitalize transition-colors ${
                          endingQuality === q
                            ? 'bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413]'
                            : 'border border-black/12 dark:border-white/12 text-[#66645E] dark:text-[#9C9A92]'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleFinishSleep}
                      className="min-h-[44px] px-5 rounded-md bg-[#C83A1E] text-[#FAF9F6] text-sm font-medium"
                    >
                      Enregistrer la nuit
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEndConfirm(false)}
                      className="min-h-[44px] px-4 rounded-md border border-black/15 dark:border-white/15 text-sm"
                    >
                      Continuer
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Ambient selector */}
              <div className="space-y-2.5">
                <span className="block text-xs font-medium text-[#66645E] dark:text-[#9C9A92]">
                  Ambiance d’endormissement
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAmbient(null)}
                    className={`min-h-[42px] px-3 rounded-md text-left text-xs font-medium transition-colors ${
                      selectedAmbient === null
                        ? 'bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413]'
                        : 'border border-black/12 dark:border-white/12 text-[#66645E] dark:text-[#9C9A92]'
                    }`}
                  >
                    Silence complet
                  </button>
                  {AMBIENT_SOUNDS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedAmbient(s.id)}
                      className={`min-h-[42px] px-3 rounded-md text-left text-xs font-medium transition-colors ${
                        selectedAmbient === s.id
                          ? 'bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413]'
                          : 'border border-black/12 dark:border-white/12 text-[#66645E] dark:text-[#9C9A92]'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {selectedAmbient && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#66645E] dark:text-[#9C9A92]">Minuterie d’extinction</span>
                  <div className="flex items-center gap-1">
                    {[15, 30, 60, 0].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setAmbientTimerMin(m)}
                        className={`px-2.5 py-1 rounded font-medium ${
                          ambientTimerMin === m
                            ? 'bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413]'
                            : 'border border-black/10 dark:border-white/10 text-[#66645E] dark:text-[#9C9A92]'
                        }`}
                      >
                        {m === 0 ? 'Continu' : `${m} min`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center justify-between gap-4 py-2 border-y border-black/8 dark:border-white/8 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  {micRequested ? (
                    <Mic className="w-4 h-4 text-[#C83A1E]" />
                  ) : (
                    <MicOff className="w-4 h-4 text-[#66645E] dark:text-[#9C9A92]" />
                  )}
                  <div>
                    <div className="text-sm font-medium">Détection des pics sonores</div>
                    <div className="text-xs text-[#66645E] dark:text-[#9C9A92]">
                      Analyse locale via microphone, aucun enregistrement envoyé
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={micRequested}
                  onChange={(e) => setMicRequested(e.target.checked)}
                  className="w-5 h-5 accent-[#C83A1E] cursor-pointer"
                />
              </label>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleLaunchSleep}
                  className="min-h-[48px] px-5 rounded-lg bg-[#C83A1E] hover:bg-[#B03118] text-[#FAF9F6] text-sm font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <Moon className="w-4 h-4" />
                  Démarrer la nuit
                </button>
                <span className="text-xs text-[#66645E] dark:text-[#9C9A92]">
                  {activeAlarmsCount} alarme{activeAlarmsCount > 1 ? 's' : ''} armée{activeAlarmsCount > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Right 7 cols (60%): Metrics + 7-Night SVG Bar Chart */}
        <section className="lg:col-span-7 lg:border-l border-black/10 dark:border-white/10 lg:pl-10 space-y-8">
          {/* 4-column unboxed metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pb-6 border-b border-black/10 dark:border-white/10">
            <div>
              <div className="text-xs text-[#66645E] dark:text-[#9C9A92]">Durée moyenne</div>
              <div className="font-mono-tabular text-2xl font-semibold mt-1">
                {formatDurationFrench(stats.avgMin)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#66645E] dark:text-[#9C9A92]">Réveils sans rappel</div>
              <div className="font-mono-tabular text-2xl font-semibold mt-1">{stats.noSnoozeRate} %</div>
            </div>
            <div>
              <div className="text-xs text-[#66645E] dark:text-[#9C9A92]">Temps de défi moyen</div>
              <div className="font-mono-tabular text-2xl font-semibold mt-1">
                {stats.avgSolve > 0 ? `${stats.avgSolve} s` : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#66645E] dark:text-[#9C9A92]">Nuits suivies</div>
              <div className="font-mono-tabular text-2xl font-semibold mt-1">{stats.totalNights}</div>
            </div>
          </div>

          {/* 7-Night Sleep Bar Chart */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-xl font-semibold">Rythme des 7 dernières nuits</h3>
              <span className="text-xs text-[#66645E] dark:text-[#9C9A92]">Repère : 8 h 00</span>
            </div>

            {recentSeven.length === 0 ? (
              <p className="py-10 text-sm text-[#66645E] dark:text-[#9C9A92]">
                Aucune nuit enregistrée pour le moment. Lancez un suivi ou ajoutez une nuit manuellement.
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox="0 0 560 190"
                  className="w-full min-w-[360px] h-auto"
                  role="img"
                  aria-label="Graphique des durées de sommeil des 7 dernières nuits"
                >
                  {/* 8h target line (y = 44 for 8h out of 10h scale) */}
                  <line
                    x1="12"
                    y1="48"
                    x2="548"
                    y2="48"
                    stroke="currentColor"
                    strokeOpacity="0.22"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <line
                    x1="12"
                    y1="154"
                    x2="548"
                    y2="154"
                    stroke="currentColor"
                    strokeOpacity="0.14"
                    strokeWidth="1"
                  />

                  {recentSeven.map((entry, idx) => {
                    const colWidth = 536 / Math.max(1, recentSeven.length);
                    const barWidth = Math.min(40, colWidth * 0.48);
                    const x = 12 + idx * colWidth + (colWidth - barWidth) / 2;
                    const hours = Math.min(10, entry.durationMinutes / 60);
                    const barHeight = Math.max(8, (hours / 10) * 132);
                    const y = 154 - barHeight;
                    const shortDay = new Date(`${entry.date}T12:00:00`).toLocaleDateString('fr-FR', {
                      weekday: 'short',
                    });
                    const isRested = entry.quality === 'reposé';

                    return (
                      <g key={entry.id}>
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          rx="3"
                          fill={isRested ? '#C83A1E' : 'currentColor'}
                          fillOpacity={isRested ? 0.92 : 0.28}
                        />
                        <text
                          x={x + barWidth / 2}
                          y={y - 7}
                          textAnchor="middle"
                          fontSize="11"
                          fill="currentColor"
                          fillOpacity="0.72"
                          className="font-mono-tabular"
                        >
                          {(entry.durationMinutes / 60).toFixed(1)}h
                        </text>
                        <text
                          x={x + barWidth / 2}
                          y="174"
                          textAnchor="middle"
                          fontSize="11"
                          fill="currentColor"
                          fillOpacity="0.58"
                        >
                          {shortDay}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Full-Width Ruled Log Table & Standalone HTML Export */}
      <section className="border-t border-black/10 dark:border-white/10 pt-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl font-semibold">Journal des réveils</h3>
            <p className="text-xs text-[#66645E] dark:text-[#9C9A92] mt-0.5">
              Historique local enregistré automatiquement après chaque réveil ou session de suivi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowManualForm((v) => !v)}
              className="min-h-[42px] px-4 rounded-md border border-black/15 dark:border-white/15 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une nuit
            </button>
            <button
              type="button"
              onClick={onExportHtml}
              className="min-h-[42px] px-4 rounded-md bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413] text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter en eveil.html autonome
            </button>
          </div>
        </div>

        {showManualForm && (
          <form
            onSubmit={handleManualSubmit}
            className="p-4 bg-[#F2F0EA] dark:bg-[#1D1C1A] rounded-lg flex flex-wrap items-end gap-4"
          >
            <div>
              <label className="block text-xs text-[#66645E] dark:text-[#9C9A92] mb-1">Coucher</label>
              <input
                type="time"
                value={manualBed}
                onChange={(e) => setManualBed(e.target.value)}
                className="min-h-[40px] px-3 rounded border border-black/15 dark:border-white/15 bg-transparent font-mono-tabular text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[#66645E] dark:text-[#9C9A92] mb-1">Réveil</label>
              <input
                type="time"
                value={manualWake}
                onChange={(e) => setManualWake(e.target.value)}
                className="min-h-[40px] px-3 rounded border border-black/15 dark:border-white/15 bg-transparent font-mono-tabular text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[#66645E] dark:text-[#9C9A92] mb-1">Ressenti</label>
              <select
                value={manualQuality}
                onChange={(e) => setManualQuality(e.target.value as SleepLogEntry['quality'])}
                className="min-h-[40px] px-3 rounded border border-black/15 dark:border-white/15 bg-[#FAF9F6] dark:bg-[#141413] text-sm"
              >
                <option value="reposé">Reposé</option>
                <option value="correct">Correct</option>
                <option value="fatigué">Fatigué</option>
              </select>
            </div>
            <button
              type="submit"
              className="min-h-[40px] px-4 rounded-md bg-[#C83A1E] text-[#FAF9F6] text-xs font-medium"
            >
              Enregistrer
            </button>
          </form>
        )}

        <div className="divide-y divide-black/10 dark:divide-white/10 border-y border-black/10 dark:border-white/10">
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-mono-tabular font-medium w-28">
                  {new Date(`${entry.date}T12:00:00`).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
                <span className="font-mono-tabular text-base font-semibold">
                  {formatDurationFrench(entry.durationMinutes)}
                </span>
                <span className="text-xs text-[#66645E] dark:text-[#9C9A92] font-mono-tabular">
                  {entry.bedtime} → {entry.wakeTime}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-[#66645E] dark:text-[#9C9A92]">
                <span className="capitalize text-[#181816] dark:text-[#F4F3EF] font-medium">
                  {entry.quality}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {MISSION_LABELS[entry.missionUsed].short}
                  {entry.missionSolveSeconds > 0 ? ` (${entry.missionSolveSeconds} s)` : ''}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {entry.snoozeCount === 0
                    ? 'Sans rappel'
                    : `${entry.snoozeCount} rappel${entry.snoozeCount > 1 ? 's' : ''}`}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteLog(entry.id)}
                  aria-label="Supprimer cette entrée"
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:text-[#C83A1E] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
