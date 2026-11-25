import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, Smartphone } from 'lucide-react';
import { MissionDifficulty, MissionType } from '../types/alarm';

interface MissionChallengeProps {
  mission: MissionType;
  difficulty: MissionDifficulty;
  onComplete: () => void;
  practiceMode?: boolean;
}

interface MathProblem {
  prompt: string;
  answer: number;
}

function generateMathProblem(difficulty: MissionDifficulty): MathProblem {
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  if (difficulty === 'easy') {
    const a = rand(6, 24);
    const b = rand(4, 19);
    const add = Math.random() > 0.35;
    return add
      ? { prompt: `${a} + ${b}`, answer: a + b }
      : { prompt: `${Math.max(a, b)} − ${Math.min(a, b)}`, answer: Math.abs(a - b) };
  }
  if (difficulty === 'medium') {
    const a = rand(4, 14);
    const b = rand(3, 9);
    const c = rand(6, 28);
    return { prompt: `${a} × ${b} + ${c}`, answer: a * b + c };
  }
  const a = rand(11, 23);
  const b = rand(6, 13);
  const c = rand(15, 65);
  return { prompt: `${a} × ${b} − ${c}`, answer: a * b - c };
}

const TYPING_PHRASES: Record<MissionDifficulty, string[]> = {
  easy: [
    'Je me lève tout de suite',
    'Bonne journée qui commence',
    'Un pas hors du lit suffit',
  ],
  medium: [
    'Chaque matin clair mérite un départ net et décidé',
    'Je quitte le lit maintenant pour bien démarrer la journée',
    'Le sommeil est terminé, mon esprit est parfaitement éveillé',
  ],
  hard: [
    'La discipline du matin façonne la tranquillité de toute la journée',
    'Je refuse le bouton rappel et je prends immédiatement le contrôle de ma matinée',
  ],
};

const PHOTO_CHECKPOINTS = [
  { place: 'Lavabo de la salle de bain', code: 'EAU-42' },
  { place: 'Machine à café ou cuisine', code: 'CAFE-19' },
  { place: 'Fenêtre du salon', code: 'JOUR-07' },
];

export const MissionChallenge: React.FC<MissionChallengeProps> = ({
  mission,
  difficulty,
  onComplete,
  practiceMode = false,
}) => {
  if (mission === 'none') {
    return <ClassicHoldMission onComplete={onComplete} practiceMode={practiceMode} />;
  }
  if (mission === 'math') {
    return <MathMission difficulty={difficulty} onComplete={onComplete} />;
  }
  if (mission === 'memory') {
    return <MemoryMission difficulty={difficulty} onComplete={onComplete} />;
  }
  if (mission === 'shake') {
    return <ShakeMission difficulty={difficulty} onComplete={onComplete} />;
  }
  if (mission === 'typing') {
    return <TypingMission difficulty={difficulty} onComplete={onComplete} />;
  }
  return <PhotoCheckpointMission difficulty={difficulty} onComplete={onComplete} />;
};

/* --- 0. Classic Hold-to-Dismiss --- */
const ClassicHoldMission: React.FC<{ onComplete: () => void; practiceMode: boolean }> = ({
  onComplete,
  practiceMode,
}) => {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  const startHold = () => {
    const started = Date.now();
    const duration = 1200;
    timerRef.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        stopHold();
        onComplete();
      }
    }, 24);
  };

  const stopHold = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(0);
  };

  useEffect(() => () => stopHold(), []);

  return (
    <div className="space-y-5">
      <p className="text-sm text-[#66645E] dark:text-[#9C9A92]">
        Maintenez le bouton enfoncé pendant une seconde pour arrêter la sonnerie.
      </p>
      <button
        type="button"
        onMouseDown={startHold}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={startHold}
        onTouchEnd={stopHold}
        className="relative w-full min-h-[56px] overflow-hidden rounded-lg bg-[#C83A1E] text-[#FAF9F6] font-medium text-base tracking-tight select-none transition-transform active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83A1E]"
      >
        <span
          className="absolute inset-y-0 left-0 bg-black/25 transition-[width] duration-75"
          style={{ width: `${progress}%` }}
        />
        <span className="relative z-10">
          {practiceMode ? 'Maintenir pour tester l’arrêt' : 'Maintenir pour couper l’alarme'}
        </span>
      </button>
    </div>
  );
};

/* --- 1. Math Mission --- */
const MathMission: React.FC<{ difficulty: MissionDifficulty; onComplete: () => void }> = ({
  difficulty,
  onComplete,
}) => {
  const totalSteps = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
  const [step, setStep] = useState(1);
  const [problem, setProblem] = useState<MathProblem>(() => generateMathProblem(difficulty));
  const [input, setInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDigit = (val: string) => {
    setErrorMsg('');
    if (val === 'C') {
      setInput('');
      return;
    }
    if (val === '±') {
      setInput((prev) => (prev.startsWith('-') ? prev.slice(1) : prev ? `-${prev}` : '-'));
      return;
    }
    if (input.length < 6) {
      setInput((prev) => prev + val);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numeric = Number(input);
    if (input.trim() === '' || Number.isNaN(numeric)) {
      setErrorMsg('Entrez une réponse numérique.');
      return;
    }
    if (numeric === problem.answer) {
      if (step >= totalSteps) {
        onComplete();
      } else {
        setStep((s) => s + 1);
        setProblem(generateMathProblem(difficulty));
        setInput('');
        setErrorMsg('');
      }
    } else {
      setErrorMsg('Résultat incorrect, essayez encore.');
      setInput('');
    }
  };

  const padKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '±', '0', 'C'];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-baseline justify-between border-b border-black/10 dark:border-white/10 pb-3">
        <span className="text-sm text-[#66645E] dark:text-[#9C9A92]">Calcul mental</span>
        <span className="font-mono-tabular text-sm font-medium">
          Épreuve {step} / {totalSteps}
        </span>
      </div>

      <div className="text-center py-2">
        <div className="font-mono-tabular text-4xl sm:text-5xl font-semibold tracking-tight">
          {problem.prompt} = ?
        </div>
        <div className="mt-4">
          <input
            type="text"
            inputMode="numeric"
            value={input}
            onChange={(e) => {
              setErrorMsg('');
              setInput(e.target.value.replace(/[^0-9-]/g, ''));
            }}
            placeholder="Votre réponse"
            autoFocus
            className="w-full max-w-[240px] mx-auto block text-center font-mono-tabular text-2xl py-2.5 px-4 bg-transparent border-b-2 border-[#181816]/30 dark:border-[#F4F3EF]/30 focus:border-[#C83A1E] outline-none transition-colors"
          />
          {errorMsg && (
            <p className="mt-2 text-xs font-medium text-[#C83A1E] dark:text-[#F0694D]" role="alert">
              {errorMsg}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
        {padKeys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => handleDigit(k)}
            className="min-h-[46px] rounded-md border border-black/10 dark:border-white/12 font-mono-tabular text-lg font-medium hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all"
          >
            {k}
          </button>
        ))}
      </div>

      <button
        type="submit"
        className="w-full min-h-[48px] rounded-lg bg-[#C83A1E] hover:bg-[#B03118] text-[#FAF9F6] font-medium text-sm transition-colors"
      >
        Valider le calcul
      </button>
    </form>
  );
};

/* --- 2. Visual Memory Grid Mission --- */
const MemoryMission: React.FC<{ difficulty: MissionDifficulty; onComplete: () => void }> = ({
  difficulty,
  onComplete,
}) => {
  const gridSize = difficulty === 'hard' ? 4 : 3;
  const totalCells = gridSize * gridSize;
  const targetCount = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;
  const totalRounds = difficulty === 'easy' ? 2 : 3;

  const generatePattern = useCallback(() => {
    const pool = Array.from({ length: totalCells }, (_, i) => i);
    const chosen: number[] = [];
    while (chosen.length < targetCount) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(pool.splice(idx, 1)[0]);
    }
    return chosen;
  }, [totalCells, targetCount]);

  const [round, setRound] = useState(1);
  const [pattern, setPattern] = useState<number[]>(() => generatePattern());
  const [phase, setPhase] = useState<'memorize' | 'recall'>('memorize');
  const [selected, setSelected] = useState<number[]>([]);
  const [mistakeCell, setMistakeCell] = useState<number | null>(null);

  useEffect(() => {
    setPhase('memorize');
    setSelected([]);
    setMistakeCell(null);
    const timeout = window.setTimeout(() => {
      setPhase('recall');
    }, difficulty === 'hard' ? 1700 : 2100);
    return () => window.clearTimeout(timeout);
  }, [pattern, difficulty]);

  const handleCellClick = (index: number) => {
    if (phase !== 'recall' || selected.includes(index)) return;
    if (pattern.includes(index)) {
      const next = [...selected, index];
      setSelected(next);
      if (next.length === pattern.length) {
        if (round >= totalRounds) {
          onComplete();
        } else {
          setRound((r) => r + 1);
          window.setTimeout(() => setPattern(generatePattern()), 350);
        }
      }
    } else {
      setMistakeCell(index);
      window.setTimeout(() => {
        setPattern(generatePattern());
      }, 650);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between border-b border-black/10 dark:border-white/10 pb-3">
        <span className="text-sm text-[#66645E] dark:text-[#9C9A92]">
          {phase === 'memorize' ? 'Mémorisez les cases allumées…' : 'Touchez les cases mémorisées'}
        </span>
        <span className="font-mono-tabular text-sm font-medium">
          Manche {round} / {totalRounds}
        </span>
      </div>

      <div
        className="grid gap-2.5 max-w-[280px] mx-auto"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalCells }, (_, i) => {
          const isTarget = pattern.includes(i);
          const isPicked = selected.includes(i);
          const isWrong = mistakeCell === i;
          const highlighted = (phase === 'memorize' && isTarget) || isPicked;

          return (
            <button
              key={i}
              type="button"
              disabled={phase === 'memorize'}
              onClick={() => handleCellClick(i)}
              aria-label={`Case ${i + 1}`}
              className={`aspect-square min-h-[56px] rounded-md border transition-all duration-150 ${
                isWrong
                  ? 'bg-[#181816] dark:bg-[#F4F3EF] border-transparent scale-95'
                  : highlighted
                  ? 'bg-[#C83A1E] border-[#C83A1E]'
                  : 'bg-[#F2F0EA] dark:bg-[#22211F] border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30'
              }`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-[#66645E] dark:text-[#9C9A92]">
        <span>
          Restantes : <strong className="font-mono-tabular">{pattern.length - selected.length}</strong>
        </span>
        <button
          type="button"
          onClick={() => setPattern(generatePattern())}
          className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-[#181816] dark:hover:text-[#F4F3EF]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Revoir un motif
        </button>
      </div>
    </div>
  );
};

/* --- 3. Shake / Kinetic Tap Mission --- */
const ShakeMission: React.FC<{ difficulty: MissionDifficulty; onComplete: () => void }> = ({
  difficulty,
  onComplete,
}) => {
  const goal = difficulty === 'easy' ? 15 : difficulty === 'medium' ? 25 : 40;
  const [count, setCount] = useState(0);
  const [motionActive, setMotionActive] = useState(false);
  const lastShakeRef = useRef(0);

  const registerPulse = useCallback(() => {
    setCount((prev) => {
      const next = prev + 1;
      if (next >= goal) {
        window.setTimeout(() => onComplete(), 120);
      }
      return Math.min(goal, next);
    });
  }, [goal, onComplete]);

  useEffect(() => {
    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
      const now = Date.now();
      if (magnitude > 19 && now - lastShakeRef.current > 210) {
        lastShakeRef.current = now;
        setMotionActive(true);
        registerPulse();
      }
    };
    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [registerPulse]);

  const pct = Math.round((count / goal) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between border-b border-black/10 dark:border-white/10 pb-3">
        <span className="text-sm text-[#66645E] dark:text-[#9C9A92]">
          {motionActive ? 'Accéléromètre actif — secouez fermement' : 'Secouez le téléphone ou tapotez vite'}
        </span>
        <span className="font-mono-tabular text-sm font-medium">
          {count} / {goal}
        </span>
      </div>

      <div className="py-2 text-center space-y-4">
        <div className="font-mono-tabular text-6xl font-semibold tracking-tight">{goal - count}</div>
        <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#C83A1E] transition-[width] duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={registerPulse}
        className="w-full min-h-[60px] rounded-lg bg-[#C83A1E] hover:bg-[#B03118] text-[#FAF9F6] font-medium text-base inline-flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform select-none"
      >
        <Smartphone className="w-5 h-5" />
        Impulsion manuelle ({pct}%)
      </button>
    </div>
  );
};

/* --- 4. Lucidity Typing Mission --- */
const TypingMission: React.FC<{ difficulty: MissionDifficulty; onComplete: () => void }> = ({
  difficulty,
  onComplete,
}) => {
  const targetPhrase = useMemo(() => {
    const list = TYPING_PHRASES[difficulty];
    return list[Math.floor(Math.random() * list.length)];
  }, [difficulty]);

  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typed.trim().toLowerCase() === targetPhrase.toLowerCase()) {
      onComplete();
    } else {
      setError('La phrase ne correspond pas exactement. Vérifiez les accents et espaces.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-baseline justify-between border-b border-black/10 dark:border-white/10 pb-3">
        <span className="text-sm text-[#66645E] dark:text-[#9C9A92]">Recopie lucide</span>
        <span className="font-mono-tabular text-xs text-[#66645E] dark:text-[#9C9A92]">
          {typed.length} / {targetPhrase.length} car.
        </span>
      </div>

      <p className="font-display text-xl sm:text-2xl leading-snug select-none">
        « {targetPhrase} »
      </p>

      <div>
        <textarea
          rows={2}
          value={typed}
          onPaste={(e) => e.preventDefault()}
          onChange={(e) => {
            setError('');
            setTyped(e.target.value);
          }}
          placeholder="Recopiez la phrase ci-dessus…"
          className="w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent p-3 text-base focus:border-[#C83A1E] outline-none resize-none"
          autoFocus
        />
        {error && (
          <p className="mt-1.5 text-xs font-medium text-[#C83A1E] dark:text-[#F0694D]" role="alert">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="w-full min-h-[48px] rounded-lg bg-[#C83A1E] hover:bg-[#B03118] text-[#FAF9F6] font-medium text-sm transition-colors"
      >
        Confirmer la phrase
      </button>
    </form>
  );
};

/* --- 5. Photo / Checkpoint Code Mission --- */
const PhotoCheckpointMission: React.FC<{ difficulty: MissionDifficulty; onComplete: () => void }> = ({
  difficulty,
  onComplete,
}) => {
  const checkpoint = useMemo(() => {
    const idx = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 1 : 2;
    return PHOTO_CHECKPOINTS[idx];
  }, [difficulty]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<'idle' | 'active' | 'denied'>('idle');
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraState('active');
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 60);
    } catch {
      setCameraState('denied');
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    onComplete();
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInput.trim().toUpperCase() === checkpoint.code) {
      onComplete();
    } else {
      setError(`Saisissez le code repère exact : ${checkpoint.code}`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="border-b border-black/10 dark:border-white/10 pb-3">
        <p className="text-sm text-[#66645E] dark:text-[#9C9A92]">Point de passage matinal</p>
        <p className="font-display text-xl mt-1">{checkpoint.place}</p>
      </div>

      {cameraState === 'active' ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
          <button
            type="button"
            onClick={handleCapture}
            className="w-full min-h-[48px] rounded-lg bg-[#C83A1E] text-[#FAF9F6] font-medium text-sm inline-flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Capturer le point de passage
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={startCamera}
            className="w-full min-h-[48px] rounded-lg border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Ouvrir la caméra pour valider
          </button>

          {cameraState === 'denied' && (
            <p className="text-xs text-[#66645E] dark:text-[#9C9A92]">
              Caméra indisponible sur cet appareil. Utilisez la validation par code repère ci-dessous.
            </p>
          )}

          <form onSubmit={handleCodeSubmit} className="pt-3 border-t border-black/10 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#66645E] dark:text-[#9C9A92]">
              <span>Ou validez votre code repère</span>
              <span className="font-mono-tabular font-semibold text-[#181816] dark:text-[#F4F3EF]">
                {checkpoint.code}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => {
                  setError('');
                  setCodeInput(e.target.value);
                }}
                placeholder={checkpoint.code}
                className="flex-1 min-h-[44px] rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 font-mono-tabular text-sm uppercase focus:border-[#C83A1E] outline-none"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-md bg-[#C83A1E] text-[#FAF9F6] text-sm font-medium whitespace-nowrap shrink-0"
              >
                Valider
              </button>
            </div>
            {error && (
              <p className="text-xs font-medium text-[#C83A1E] dark:text-[#F0694D]" role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
