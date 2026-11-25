import React, { useEffect, useRef, useState } from 'react';
import { Check, Play, Square } from 'lucide-react';
import { AmbientSoundId, RingtoneId } from '../types/alarm';
import { AMBIENT_SOUNDS, RINGTONES } from '../data/defaults';
import { soundEngine } from '../audio/soundEngine';

interface SoundCatalogViewProps {
  defaultRingtone: RingtoneId;
  onSetDefaultRingtone: (id: RingtoneId) => void;
}

export const SoundCatalogView: React.FC<SoundCatalogViewProps> = ({
  defaultRingtone,
  onSetDefaultRingtone,
}) => {
  const [playingRingtone, setPlayingRingtone] = useState<RingtoneId | null>(null);
  const [playingAmbient, setPlayingAmbient] = useState<AmbientSoundId | null>(null);
  const [volume, setVolume] = useState(0.75);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    return () => {
      soundEngine.stopRingtone();
      soundEngine.stopAmbient();
    };
  }, []);

  // Real-time Web Audio AnalyserNode waveform renderer
  useEffect(() => {
    let rafId = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const analyser = soundEngine.getAnalyser();
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          ctx.lineWidth = 2;
          ctx.strokeStyle = playingRingtone || playingAmbient ? '#C83A1E' : 'rgba(130, 128, 120, 0.35)';
          ctx.beginPath();

          if (analyser && (playingRingtone || playingAmbient)) {
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(dataArray);
            const sliceWidth = w / bufferLength;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
              const v = dataArray[i] / 128.0;
              const y = (v * h) / 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
            }
          } else {
            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);
          }
          ctx.stroke();
        }
      }
      rafId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafId);
  }, [playingRingtone, playingAmbient]);

  const toggleRingtone = (id: RingtoneId) => {
    soundEngine.stopAmbient();
    setPlayingAmbient(null);
    if (playingRingtone === id) {
      soundEngine.stopRingtone();
      setPlayingRingtone(null);
    } else {
      soundEngine.startRingtone(id, { volume, crescendo: false });
      setPlayingRingtone(id);
    }
  };

  const toggleAmbient = (id: AmbientSoundId) => {
    soundEngine.stopRingtone();
    setPlayingRingtone(null);
    if (playingAmbient === id) {
      soundEngine.stopAmbient();
      setPlayingAmbient(null);
    } else {
      soundEngine.startAmbient(id, volume * 0.65);
      setPlayingAmbient(id);
    }
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    if (playingAmbient) {
      soundEngine.setAmbientVolume(v * 0.65);
    } else if (playingRingtone) {
      soundEngine.startRingtone(playingRingtone, { volume: v, crescendo: false });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
      {/* Left 4 cols: Live Acoustic Monitor & Volume Control */}
      <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
        <div className="border-b border-black/10 dark:border-white/10 pb-4">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-balance">
            Catalogue sonore
          </h2>
          <p className="mt-1.5 text-sm text-[#66645E] dark:text-[#9C9A92]">
            Toutes les sonneries sont synthétisées localement sans dépendance réseau, garantissant un réveil fiable même hors ligne.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#66645E] dark:text-[#9C9A92]">
            <span>Signal audio en direct</span>
            <span className="font-mono-tabular">
              {playingRingtone
                ? RINGTONES.find((r) => r.id === playingRingtone)?.name
                : playingAmbient
                ? AMBIENT_SOUNDS.find((a) => a.id === playingAmbient)?.name
                : 'En veille'}
            </span>
          </div>
          <div className="rounded-lg bg-[#F2F0EA] dark:bg-[#1D1C1A] border border-black/8 dark:border-white/8 p-3">
            <canvas ref={canvasRef} width={360} height={84} className="w-full h-[84px] block" />
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#66645E] dark:text-[#9C9A92]">Volume d’écoute</span>
            <span className="font-mono-tabular font-medium">{Math.round(volume * 100)} %</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-full eveil-slider"
          />
        </div>
      </aside>

      {/* Right 8 cols: Ruled Lists of Alarm Ringtones & Ambient Sleep Sounds */}
      <div className="lg:col-span-8 space-y-10">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-xl font-semibold">Sonneries de réveil</h3>
            <span className="text-xs text-[#66645E] dark:text-[#9C9A92]">
              {RINGTONES.length} profils acoustiques
            </span>
          </div>

          <div className="divide-y divide-black/10 dark:divide-white/10 border-y border-black/10 dark:border-white/10">
            {RINGTONES.map((r) => {
              const isPlaying = playingRingtone === r.id;
              const isDefault = defaultRingtone === r.id;
              return (
                <div
                  key={r.id}
                  className="py-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleRingtone(r.id)}
                      aria-label={isPlaying ? `Arrêter ${r.name}` : `Écouter ${r.name}`}
                      className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center border transition-colors shrink-0 ${
                        isPlaying
                          ? 'bg-[#C83A1E] border-[#C83A1E] text-[#FAF9F6]'
                          : 'border-black/15 dark:border-white/15 hover:border-[#C83A1E]'
                      }`}
                    >
                      {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div className="min-w-0">
                      <div className="text-base font-medium">{r.name}</div>
                      <div className="text-xs text-[#66645E] dark:text-[#9C9A92] mt-0.5">
                        {r.intensity} · {r.tempoLabel} · {r.character}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSetDefaultRingtone(r.id)}
                    className={`min-h-[40px] px-3.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors ${
                      isDefault
                        ? 'text-[#C83A1E] dark:text-[#E25134]'
                        : 'border border-black/12 dark:border-white/12 text-[#66645E] dark:text-[#9C9A92] hover:text-[#181816] dark:hover:text-[#F4F3EF]'
                    }`}
                  >
                    {isDefault && <Check className="w-3.5 h-3.5" />}
                    {isDefault ? 'Par défaut' : 'Choisir par défaut'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-xl font-semibold">Ambiances d’endormissement</h3>
            <span className="text-xs text-[#66645E] dark:text-[#9C9A92]">
              Utilisables dans le mode suivi
            </span>
          </div>

          <div className="divide-y divide-black/10 dark:divide-white/10 border-y border-black/10 dark:border-white/10">
            {AMBIENT_SOUNDS.map((a) => {
              const isPlaying = playingAmbient === a.id;
              return (
                <div
                  key={a.id}
                  className="py-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleAmbient(a.id)}
                      aria-label={isPlaying ? `Arrêter ${a.name}` : `Écouter ${a.name}`}
                      className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center border transition-colors shrink-0 ${
                        isPlaying
                          ? 'bg-[#C83A1E] border-[#C83A1E] text-[#FAF9F6]'
                          : 'border-black/15 dark:border-white/15 hover:border-[#C83A1E]'
                      }`}
                    >
                      {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div>
                      <div className="text-base font-medium">{a.name}</div>
                      <div className="text-xs text-[#66645E] dark:text-[#9C9A92] mt-0.5">
                        {a.description}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-[#66645E] dark:text-[#9C9A92] shrink-0">
                    {isPlaying ? 'En lecture' : 'Continu'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
