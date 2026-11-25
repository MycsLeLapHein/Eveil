import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Alarm } from '../types/alarm';
import { DIFFICULTY_LABELS, MISSION_LABELS, RINGTONES } from '../data/defaults';
import { MissionChallenge } from './MissionChallenge';

interface RingingOverlayProps {
  alarm: Alarm;
  snoozeCount: number;
  onDismiss: (solveSeconds: number) => void;
  onSnooze: () => void;
  onToggleMuteTemporary?: () => void;
  isMuted?: boolean;
}

export const RingingOverlay: React.FC<RingingOverlayProps> = ({
  alarm,
  snoozeCount,
  onDismiss,
  onSnooze,
  onToggleMuteTemporary,
  isMuted = false,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 500);
    return () => window.clearInterval(id);
  }, []);

  const ringtoneName = RINGTONES.find((r) => r.id === alarm.ringtone)?.name ?? alarm.ringtone;
  const canSnooze =
    alarm.snoozeMinutes > 0 && (alarm.maxSnoozes === 0 || snoozeCount < alarm.maxSnoozes);
  const remainingSnoozes =
    alarm.maxSnoozes === 0 ? null : Math.max(0, alarm.maxSnoozes - snoozeCount);

  const timeFormatted = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleComplete = () => {
    const solveSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    onDismiss(solveSeconds);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#FAF9F6] dark:bg-[#141413] text-[#181816] dark:text-[#F4F3EF] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Alarme active : ${alarm.label}`}
    >
      <div className="min-h-full max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left 5 cols: Time & Alarm Context */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
            <span className="text-sm font-medium text-[#C83A1E] dark:text-[#E25134]">
              Alarme en cours
            </span>
            {onToggleMuteTemporary && (
              <button
                type="button"
                onClick={onToggleMuteTemporary}
                className="min-h-[40px] px-3 rounded-md text-xs font-medium text-[#66645E] dark:text-[#9C9A92] hover:text-[#181816] dark:hover:text-[#F4F3EF] inline-flex items-center gap-1.5 border border-black/10 dark:border-white/12 transition-colors"
                title="Couper le son pendant 10 s pour réfléchir"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {isMuted ? 'Son en pause' : 'Pause audio'}
              </button>
            )}
          </div>

          <div>
            <div className="font-mono-tabular text-6xl sm:text-7xl lg:text-8xl font-semibold tracking-tight leading-none">
              {timeFormatted}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-4 text-balance">
              {alarm.label || 'Réveil'}
            </h1>
            <p className="mt-2 text-sm text-[#66645E] dark:text-[#9C9A92]">
              {MISSION_LABELS[alarm.mission].name}
              {alarm.mission !== 'none' ? ` · ${DIFFICULTY_LABELS[alarm.difficulty]}` : ''} ·{' '}
              {ringtoneName}
              {alarm.crescendo ? ' · Crescendo' : ''}
            </p>
          </div>

          {canSnooze ? (
            <div className="pt-4 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={onSnooze}
                className="w-full sm:w-auto min-h-[46px] px-5 rounded-lg border border-black/20 dark:border-white/20 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
              >
                Rappel {alarm.snoozeMinutes} min
                {remainingSnoozes !== null ? ` (${remainingSnoozes} restant${remainingSnoozes > 1 ? 's' : ''})` : ''}
              </button>
            </div>
          ) : (
            <p className="pt-4 border-t border-black/10 dark:border-white/10 text-xs text-[#66645E] dark:text-[#9C9A92]">
              {alarm.snoozeMinutes === 0
                ? 'Le rappel est désactivé sur cette alarme. Terminez le défi pour couper le son.'
                : 'Limite de rappels atteinte. Terminez le défi pour arrêter l’alarme.'}
            </p>
          )}
        </div>

        {/* Right 7 cols: Active Mission */}
        <div className="lg:col-span-7 border-t lg:border-t-0 lg:border-l border-black/10 dark:border-white/10 pt-8 lg:pt-0 lg:pl-12">
          <MissionChallenge
            mission={alarm.mission}
            difficulty={alarm.difficulty}
            onComplete={handleComplete}
          />
        </div>
      </div>
    </div>
  );
};
