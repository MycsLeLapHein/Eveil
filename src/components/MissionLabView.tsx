import React, { useState } from 'react';
import { Volume2, X } from 'lucide-react';
import { MissionDifficulty, MissionType, RingtoneId } from '../types/alarm';
import { DIFFICULTY_LABELS, MISSION_LABELS } from '../data/defaults';
import { MissionChallenge } from './MissionChallenge';
import { soundEngine } from '../audio/soundEngine';

interface MissionLabViewProps {
  defaultRingtone: RingtoneId;
}

const PLAYABLE_MISSIONS: {
  id: MissionType;
  number: string;
  cognitiveType: string;
  tip: string;
}[] = [
  {
    id: 'math',
    number: '01',
    cognitiveType: 'Logique rapide',
    tip: 'Idéal pour réveiller le cortex préfrontal en 20 à 40 secondes.',
  },
  {
    id: 'memory',
    number: '02',
    cognitiveType: 'Mémoire spatiale',
    tip: 'Exige une attention visuelle continue sur plusieurs manches.',
  },
  {
    id: 'shake',
    number: '03',
    cognitiveType: 'Activation physique',
    tip: 'Utilise l’accéléromètre sur mobile ou le rythme de frappe sur ordinateur.',
  },
  {
    id: 'typing',
    number: '04',
    cognitiveType: 'Lucidité verbale',
    tip: 'Copier-coller bloqué : impossible de valider les yeux mi-clos.',
  },
  {
    id: 'photo',
    number: '05',
    cognitiveType: 'Déplacement hors du lit',
    tip: 'Oblige à rejoindre une autre pièce (caméra ou code repère).',
  },
];

export const MissionLabView: React.FC<MissionLabViewProps> = ({ defaultRingtone }) => {
  const [difficulty, setDifficulty] = useState<MissionDifficulty>('medium');
  const [withSound, setWithSound] = useState(false);
  const [practicing, setPracticing] = useState<MissionType | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [practiceStart, setPracticeStart] = useState<number>(0);

  const startPractice = (m: MissionType) => {
    setLastResult(null);
    setPracticing(m);
    setPracticeStart(Date.now());
    if (withSound) {
      soundEngine.startRingtone(defaultRingtone, { volume: 0.55, crescendo: false });
    }
  };

  const closePractice = () => {
    soundEngine.stopRingtone();
    setPracticing(null);
  };

  const handleComplete = () => {
    const secs = Math.max(1, Math.round((Date.now() - practiceStart) / 1000));
    const finishedName = practicing ? MISSION_LABELS[practicing].name : '';
    soundEngine.stopRingtone();
    setPracticing(null);
    setLastResult(`${finishedName} réussi en ${secs} s (${DIFFICULTY_LABELS[difficulty]}).`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
      {/* Left 4 cols: Controls & Explanation */}
      <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
        <div className="border-b border-black/10 dark:border-white/10 pb-4">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-balance">
            Défis de réveil
          </h2>
          <p className="mt-1.5 text-sm text-[#66645E] dark:text-[#9C9A92]">
            Testez chaque épreuve avant de l’assigner à vos alarmes matinales. Une alarme ne s’éteint qu’une fois le défi accompli.
          </p>
        </div>

        <div className="space-y-3">
          <span className="block text-xs font-medium text-[#66645E] dark:text-[#9C9A92]">
            Niveau d’essai
          </span>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-md bg-[#F2F0EA] dark:bg-[#1D1C1A]">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`min-h-[38px] rounded text-xs font-medium transition-colors ${
                  difficulty === d
                    ? 'bg-[#181816] text-[#FAF9F6] dark:bg-[#F4F3EF] dark:text-[#141413]'
                    : 'text-[#66645E] dark:text-[#9C9A92]'
                }`}
              >
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 py-3 border-y border-black/10 dark:border-white/10 cursor-pointer">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-[#66645E] dark:text-[#9C9A92]" />
            <span className="text-sm">Jouer la sonnerie pendant l’essai</span>
          </div>
          <input
            type="checkbox"
            checked={withSound}
            onChange={(e) => setWithSound(e.target.checked)}
            className="w-5 h-5 accent-[#C83A1E] cursor-pointer"
          />
        </label>

        {lastResult && (
          <p className="text-sm font-medium text-[#C83A1E] dark:text-[#E25134]">{lastResult}</p>
        )}
      </aside>

      {/* Right 8 cols: Full-width editorial ruled list */}
      <div className="lg:col-span-8 divide-y divide-black/10 dark:divide-white/10 border-y border-black/10 dark:border-white/10">
        {PLAYABLE_MISSIONS.map((item) => (
          <div
            key={item.id}
            className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
          >
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-baseline gap-3">
                <span className="font-mono-tabular text-xs text-[#66645E] dark:text-[#9C9A92]">
                  {item.number}.
                </span>
                <h3 className="font-display text-xl font-semibold">
                  {MISSION_LABELS[item.id].name}
                </h3>
                <span className="text-xs text-[#66645E] dark:text-[#9C9A92]">
                  · {item.cognitiveType}
                </span>
              </div>
              <p className="text-sm text-[#66645E] dark:text-[#9C9A92] pl-7">
                {MISSION_LABELS[item.id].description} {item.tip}
              </p>
            </div>

            <button
              type="button"
              onClick={() => startPractice(item.id)}
              className="min-h-[44px] px-4 rounded-md border border-black/15 dark:border-white/15 hover:border-[#C83A1E] hover:text-[#C83A1E] dark:hover:text-[#E25134] text-sm font-medium whitespace-nowrap shrink-0 transition-colors self-start sm:self-center"
            >
              Essayer ce défi
            </button>
          </div>
        ))}
      </div>

      {/* Practice Modal */}
      {practicing && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={closePractice}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-[#FAF9F6] dark:bg-[#141413] text-[#181816] dark:text-[#F4F3EF] border border-black/12 dark:border-white/12 p-6 sm:p-7 space-y-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Essai : ${MISSION_LABELS[practicing].name}`}
          >
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div>
                <h3 className="font-display text-xl font-semibold">
                  Essai : {MISSION_LABELS[practicing].name}
                </h3>
                <p className="text-xs text-[#66645E] dark:text-[#9C9A92]">
                  Niveau {DIFFICULTY_LABELS[difficulty]}
                </p>
              </div>
              <button
                type="button"
                onClick={closePractice}
                aria-label="Fermer l’essai"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/8"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <MissionChallenge
              mission={practicing}
              difficulty={difficulty}
              onComplete={handleComplete}
              practiceMode
            />
          </div>
        </div>
      )}
    </div>
  );
};
