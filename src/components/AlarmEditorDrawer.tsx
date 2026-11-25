import React, { useEffect, useState } from 'react';
import { Play, Square, Trash2, X } from 'lucide-react';
import { Alarm, DayOfWeek, MissionDifficulty, MissionType, RingtoneId } from '../types/alarm';
import {
  DAY_LETTER,
  DAY_ORDER,
  DIFFICULTY_LABELS,
  MISSION_LABELS,
  RINGTONES,
} from '../data/defaults';
import { soundEngine } from '../audio/soundEngine';

interface AlarmEditorDrawerProps {
  alarm: Alarm | null;
  isNew: boolean;
  onSave: (alarm: Alarm) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export const AlarmEditorDrawer: React.FC<AlarmEditorDrawerProps> = ({
  alarm,
  isNew,
  onSave,
  onDelete,
  onClose,
}) => {
  const [draft, setDraft] = useState<Alarm | null>(alarm);
  const [previewingId, setPreviewingId] = useState<RingtoneId | null>(null);

  useEffect(() => {
    setDraft(alarm);
    return () => {
      soundEngine.stopRingtone();
    };
  }, [alarm]);

  if (!draft) return null;

  const [hoursStr, minutesStr] = draft.time.split(':');

  const updateTime = (nextH: number, nextM: number) => {
    const h = ((nextH % 24) + 24) % 24;
    const m = ((nextM % 60) + 60) % 60;
    setDraft({
      ...draft,
      time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
    });
  };

  const setInOneMinute = () => {
    const d = new Date(Date.now() + 60_000);
    updateTime(d.getHours(), d.getMinutes());
  };

  const toggleDay = (day: DayOfWeek) => {
    const exists = draft.days.includes(day);
    const days = exists ? draft.days.filter((d) => d !== day) : [...draft.days, day];
    setDraft({ ...draft, days });
  };

  const togglePreview = (id: RingtoneId) => {
    if (previewingId === id) {
      soundEngine.stopRingtone();
      setPreviewingId(null);
    } else {
      soundEngine.startRingtone(id, { volume: draft.volume, crescendo: false });
      setPreviewingId(id);
    }
  };

  const handleClose = () => {
    soundEngine.stopRingtone();
    setPreviewingId(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.stopRingtone();
    setPreviewingId(null);
    onSave({
      ...draft,
      label: draft.label.trim() || 'Réveil',
    });
  };

  const missions: MissionType[] = ['math', 'memory', 'shake', 'typing', 'photo', 'none'];
  const difficulties: MissionDifficulty[] = ['easy', 'medium', 'hard'];

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-[2px]"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-xl h-full bg-[#FAF9F6] dark:bg-[#141413] text-[#181816] dark:text-[#F4F3EF] border-l border-black/10 dark:border-white/10 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'Nouvelle alarme' : 'Modifier l’alarme'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 dark:border-white/10 shrink-0">
          <h2 className="font-display text-2xl font-semibold">
            {isNew ? 'Nouvelle alarme' : 'Modifier l’alarme'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form id="alarm-editor-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Time Picker */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Heure de déclenchement</label>
              <button
                type="button"
                onClick={setInOneMinute}
                className="text-xs font-medium text-[#C83A1E] dark:text-[#E25134] underline underline-offset-4 hover:opacity-80"
              >
                Régler dans +1 min
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={23}
                value={hoursStr}
                onChange={(e) => updateTime(Number(e.target.value || 0), Number(minutesStr))}
                aria-label="Heures"
                className="w-28 text-center font-mono-tabular text-5xl font-semibold py-2 bg-[#F2F0EA] dark:bg-[#1D1C1A] rounded-lg border border-black/10 dark:border-white/10 focus:border-[#C83A1E] outline-none"
              />
              <span className="font-mono-tabular text-4xl text-[#66645E] dark:text-[#9C9A92]">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={minutesStr}
                onChange={(e) => updateTime(Number(hoursStr), Number(e.target.value || 0))}
                aria-label="Minutes"
                className="w-28 text-center font-mono-tabular text-5xl font-semibold py-2 bg-[#F2F0EA] dark:bg-[#1D1C1A] rounded-lg border border-black/10 dark:border-white/10 focus:border-[#C83A1E] outline-none"
              />
            </div>
          </section>

          {/* Label */}
          <section className="space-y-2 border-t border-black/10 dark:border-white/10 pt-6">
            <label htmlFor="alarm-label" className="block text-sm font-medium">
              Libellé
            </label>
            <input
              id="alarm-label"
              type="text"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Ex. Réveil travail, Sport, Train…"
              className="w-full min-h-[44px] px-3.5 rounded-md bg-transparent border border-black/15 dark:border-white/15 focus:border-[#C83A1E] outline-none text-sm"
            />
          </section>

          {/* Recurrence */}
          <section className="space-y-3 border-t border-black/10 dark:border-white/10 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Récurrence</span>
              <div className="flex items-center gap-3 text-xs text-[#66645E] dark:text-[#9C9A92]">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, days: [1, 2, 3, 4, 5] })}
                  className="hover:text-[#181816] dark:hover:text-[#F4F3EF] underline-offset-4 hover:underline"
                >
                  Semaine
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, days: [6, 0] })}
                  className="hover:text-[#181816] dark:hover:text-[#F4F3EF] underline-offset-4 hover:underline"
                >
                  Week-end
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, days: [1, 2, 3, 4, 5, 6, 0] })}
                  className="hover:text-[#181816] dark:hover:text-[#F4F3EF] underline-offset-4 hover:underline"
                >
                  Tous
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, days: [] })}
                  className="hover:text-[#181816] dark:hover:text-[#F4F3EF] underline-offset-4 hover:underline"
                >
                  Une fois
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_ORDER.map((day) => {
                const active = draft.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={active}
                    className={`min-h-[44px] rounded-md text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413]'
                        : 'border border-black/12 dark:border-white/12 text-[#66645E] dark:text-[#9C9A92] hover:border-black/35 dark:hover:border-white/35'
                    }`}
                  >
                    {DAY_LETTER[day]}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Wake-up Mission */}
          <section className="space-y-4 border-t border-black/10 dark:border-white/10 pt-6">
            <span className="block text-sm font-medium">Défi de réveil</span>
            <div className="divide-y divide-black/8 dark:divide-white/8 border-y border-black/10 dark:border-white/10">
              {missions.map((m) => {
                const selected = draft.mission === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDraft({ ...draft, mission: m })}
                    className={`w-full text-left py-3 px-2 flex items-start justify-between gap-4 transition-colors ${
                      selected ? 'bg-[#F2F0EA] dark:bg-[#1D1C1A]' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium">{MISSION_LABELS[m].name}</div>
                      <div className="text-xs text-[#66645E] dark:text-[#9C9A92] mt-0.5">
                        {MISSION_LABELS[m].description}
                      </div>
                    </div>
                    <span
                      className={`mt-1 w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                        selected
                          ? 'border-[#C83A1E] bg-[#C83A1E]'
                          : 'border-black/25 dark:border-white/25'
                      }`}
                    >
                      {selected && <span className="w-1.5 h-1.5 rounded-full bg-[#FAF9F6]" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {draft.mission !== 'none' && (
              <div className="flex items-center justify-between gap-4 pt-1">
                <span className="text-xs text-[#66645E] dark:text-[#9C9A92]">Difficulté du défi</span>
                <div className="flex items-center gap-1 p-1 rounded-md bg-[#F2F0EA] dark:bg-[#1D1C1A]">
                  {difficulties.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDraft({ ...draft, difficulty: d })}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                        draft.difficulty === d
                          ? 'bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413]'
                          : 'text-[#66645E] dark:text-[#9C9A92]'
                      }`}
                    >
                      {DIFFICULTY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Ringtone & Audio */}
          <section className="space-y-4 border-t border-black/10 dark:border-white/10 pt-6">
            <span className="block text-sm font-medium">Sonnerie et volume</span>
            <div className="divide-y divide-black/8 dark:divide-white/8 border-y border-black/10 dark:border-white/10">
              {RINGTONES.map((r) => {
                const selected = draft.ringtone === r.id;
                const playing = previewingId === r.id;
                return (
                  <div
                    key={r.id}
                    className={`py-2.5 px-2 flex items-center justify-between gap-3 ${
                      selected ? 'bg-[#F2F0EA] dark:bg-[#1D1C1A]' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, ringtone: r.id })}
                      className="flex-1 text-left min-h-[40px]"
                    >
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-[#66645E] dark:text-[#9C9A92]">
                        {r.intensity} · {r.character}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePreview(r.id)}
                      aria-label={playing ? `Arrêter ${r.name}` : `Écouter ${r.name}`}
                      className="min-w-[40px] min-h-[40px] rounded-md border border-black/12 dark:border-white/12 flex items-center justify-center hover:border-[#C83A1E] transition-colors shrink-0"
                    >
                      {playing ? (
                        <Square className="w-3.5 h-3.5 text-[#C83A1E]" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#66645E] dark:text-[#9C9A92]">Volume cible</span>
                <span className="font-mono-tabular font-medium">{Math.round(draft.volume * 100)} %</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={draft.volume}
                onChange={(e) => setDraft({ ...draft, volume: Number(e.target.value) })}
                className="w-full eveil-slider"
              />
              <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
                <div>
                  <div className="text-sm font-medium">Volume progressif (Crescendo)</div>
                  <div className="text-xs text-[#66645E] dark:text-[#9C9A92]">
                    Monte graduellement en 18 secondes pour éviter le sursaut
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={draft.crescendo}
                  onChange={(e) => setDraft({ ...draft, crescendo: e.target.checked })}
                  className="w-5 h-5 accent-[#C83A1E] cursor-pointer"
                />
              </label>
            </div>
          </section>

          {/* Snooze & Wake-Up Check */}
          <section className="space-y-5 border-t border-black/10 dark:border-white/10 pt-6">
            <div className="space-y-2.5">
              <span className="block text-sm font-medium">Rappel (Snooze)</span>
              <div className="grid grid-cols-5 gap-1.5">
                {[0, 3, 5, 10, 15].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDraft({ ...draft, snoozeMinutes: mins })}
                    className={`min-h-[40px] rounded-md text-xs font-medium transition-colors ${
                      draft.snoozeMinutes === mins
                        ? 'bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413]'
                        : 'border border-black/12 dark:border-white/12 text-[#66645E] dark:text-[#9C9A92]'
                    }`}
                  >
                    {mins === 0 ? 'Aucun' : `${mins} min`}
                  </button>
                ))}
              </div>
              {draft.snoozeMinutes > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-[#66645E] dark:text-[#9C9A92]">Nombre maximal de rappels</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 0].map((lim) => (
                      <button
                        key={lim}
                        type="button"
                        onClick={() => setDraft({ ...draft, maxSnoozes: lim })}
                        className={`px-2.5 py-1 rounded text-xs font-medium ${
                          draft.maxSnoozes === lim
                            ? 'bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413]'
                            : 'text-[#66645E] dark:text-[#9C9A92] border border-black/10 dark:border-white/10'
                        }`}
                      >
                        {lim === 0 ? 'Illimité' : `${lim}×`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-black/8 dark:border-white/8 space-y-3">
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium">Vérification de réveil</div>
                  <div className="text-xs text-[#66645E] dark:text-[#9C9A92]">
                    Redéclenche l’alarme si vous ne confirmez pas être levé(e) après l’arrêt
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={draft.wakeUpCheck}
                  onChange={(e) => setDraft({ ...draft, wakeUpCheck: e.target.checked })}
                  className="w-5 h-5 accent-[#C83A1E] cursor-pointer"
                />
              </label>

              {draft.wakeUpCheck && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#66645E] dark:text-[#9C9A92]">Délai avant contrôle</span>
                  <div className="flex items-center gap-1">
                    {[1, 3, 5, 10].map((delay) => (
                      <button
                        key={delay}
                        type="button"
                        onClick={() => setDraft({ ...draft, wakeUpCheckDelayMin: delay })}
                        className={`px-2.5 py-1 rounded font-medium ${
                          draft.wakeUpCheckDelayMin === delay
                            ? 'bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413]'
                            : 'border border-black/10 dark:border-white/10 text-[#66645E] dark:text-[#9C9A92]'
                        }`}
                      >
                        {delay} min
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-3 shrink-0 bg-[#FAF9F6] dark:bg-[#141413]">
          {!isNew && onDelete ? (
            <button
              type="button"
              onClick={() => {
                soundEngine.stopRingtone();
                onDelete(draft.id);
              }}
              className="min-h-[44px] px-3.5 rounded-md text-xs font-medium text-[#C83A1E] hover:bg-[#C83A1E]/10 inline-flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] px-4 rounded-md border border-black/15 dark:border-white/15 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="alarm-editor-form"
              className="min-h-[44px] px-5 rounded-md bg-[#C83A1E] hover:bg-[#B03118] text-[#FAF9F6] text-sm font-medium transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
