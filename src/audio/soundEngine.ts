import { AmbientSoundId, RingtoneId } from '../types/alarm';
import {
  playNativeCheckChime,
  startNativeAlarmSound,
  stopNativeAlarmSound,
} from '../native/androidBridge';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private alarmInterval: number | null = null;
  private alarmActive = false;
  private activeRingtone: RingtoneId | null = null;
  private vibrateInterval: number | null = null;

  private ambientNodes: AudioNode[] = [];
  private ambientGain: GainNode | null = null;
  private activeAmbient: AmbientSoundId | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getActiveRingtone(): RingtoneId | null {
    return this.activeRingtone;
  }

  public getActiveAmbient(): AmbientSoundId | null {
    return this.activeAmbient;
  }

  public startRingtone(
    id: RingtoneId,
    options: { volume?: number; crescendo?: boolean; vibrate?: boolean } = {}
  ): void {
    this.stopRingtone();
    const targetVolume = Math.min(1, Math.max(0.15, options.volume ?? 0.8));

    // Inside Android APK: route directly to native USAGE_ALARM (STREAM_ALARM)
    if (
      startNativeAlarmSound(
        id,
        targetVolume,
        Boolean(options.crescendo),
        Boolean(options.vibrate)
      )
    ) {
      this.alarmActive = true;
      this.activeRingtone = id;
      return;
    }

    const ctx = this.ensureContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);

    if (options.crescendo) {
      this.masterGain.gain.setValueAtTime(0.08, now);
      this.masterGain.gain.linearRampToValueAtTime(targetVolume, now + 18);
    } else {
      this.masterGain.gain.setValueAtTime(targetVolume, now);
    }

    this.alarmActive = true;
    this.activeRingtone = id;

    const triggerPattern = () => {
      if (!this.alarmActive || !this.ctx || !this.masterGain) return;
      this.scheduleRingtoneCycle(id, this.ctx, this.masterGain);
    };

    const cycleMs = this.getCycleDurationMs(id);
    triggerPattern();
    this.alarmInterval = window.setInterval(triggerPattern, cycleMs);

    if (options.vibrate && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const pulse = () => {
        try {
          navigator.vibrate([260, 140, 260, 400]);
        } catch {
          // Ignore vibrate errors on unsupported devices
        }
      };
      pulse();
      this.vibrateInterval = window.setInterval(pulse, 1400);
    }
  }

  public stopRingtone(): void {
    this.alarmActive = false;
    this.activeRingtone = null;
    stopNativeAlarmSound();
    if (this.alarmInterval !== null) {
      window.clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    if (this.vibrateInterval !== null) {
      window.clearInterval(this.vibrateInterval);
      this.vibrateInterval = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore
      }
    }
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(0.0001, now, 0.04);
    }
  }

  public playCheckChime(): void {
    if (playNativeCheckChime()) return;
    const ctx = this.ensureContext();
    if (!this.masterGain) return;
    const now = ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.55, now);
    this.scheduleTone(ctx, this.masterGain, 659.25, 0, 0.32, 'sine', 0.35);
    this.scheduleTone(ctx, this.masterGain, 880.0, 0.2, 0.45, 'sine', 0.35);
  }

  public startAmbient(id: AmbientSoundId, volume = 0.45): void {
    this.stopAmbient();
    const ctx = this.ensureContext();
    if (!this.analyser) return;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(Math.min(0.8, Math.max(0.05, volume)), ctx.currentTime + 1.8);
    gain.connect(this.analyser);
    this.ambientGain = gain;
    this.activeAmbient = id;

    const nodes: AudioNode[] = [gain];

    if (id === 'pluie-douce' || id === 'bruit-brun' || id === 'vent-nuit') {
      const bufferSize = ctx.sampleRate * 3;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      if (id === 'bruit-brun') {
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.4;
        }
      } else {
        // Pink-ish noise for rain and wind
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
          b6 = white * 0.115926;
        }
      }

      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      if (id === 'pluie-douce') {
        filter.type = 'bandpass';
        filter.frequency.value = 1150;
        filter.Q.value = 0.55;
      } else if (id === 'bruit-brun') {
        filter.type = 'lowpass';
        filter.frequency.value = 340;
      } else {
        filter.type = 'lowpass';
        filter.frequency.value = 520;
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.14;
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();
        nodes.push(lfo, lfoGain);
      }

      source.connect(filter);
      filter.connect(gain);
      source.start();
      nodes.push(source, filter);
    } else if (id === 'bourdon-chaud') {
      const freqs = [130.81, 196.0, 261.63]; // C3, G3, C4 gentle fifth drone
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 480;
      filter.connect(gain);
      nodes.push(filter);

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.value = f;
        oscGain.gain.value = idx === 0 ? 0.35 : 0.15;
        osc.connect(oscGain);
        oscGain.connect(filter);
        osc.start();
        nodes.push(osc, oscGain);
      });
    }

    this.ambientNodes = nodes;
  }

  public setAmbientVolume(volume: number): void {
    if (this.ctx && this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(
        Math.min(0.8, Math.max(0.05, volume)),
        this.ctx.currentTime,
        0.15
      );
    }
  }

  public stopAmbient(): void {
    this.activeAmbient = null;
    if (this.ctx && this.ambientGain) {
      const now = this.ctx.currentTime;
      try {
        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.setTargetAtTime(0.0001, now, 0.15);
      } catch {
        // Ignore
      }
    }
    const oldNodes = this.ambientNodes;
    this.ambientNodes = [];
    this.ambientGain = null;
    window.setTimeout(() => {
      oldNodes.forEach((node) => {
        try {
          if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
            (node as OscillatorNode).stop();
          }
          node.disconnect();
        } catch {
          // Ignore already stopped nodes
        }
      });
    }, 350);
  }

  private getCycleDurationMs(id: RingtoneId): number {
    switch (id) {
      case 'aube-carillon':
        return 2200;
      case 'braun-bip':
        return 1150;
      case 'sirene-intense':
        return 1250;
      case 'clairiere':
        return 2800;
      case 'radar-pulse':
        return 1350;
      case 'cloche-bronze':
        return 2600;
      case 'fanfare-matin':
        return 2000;
    }
  }

  private scheduleTone(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startOffset: number,
    duration: number,
    type: OscillatorType,
    peakGain: number
  ): void {
    const start = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peakGain, start + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env);
    env.connect(dest);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  private scheduleRingtoneCycle(id: RingtoneId, ctx: AudioContext, dest: AudioNode): void {
    switch (id) {
      case 'aube-carillon': {
        // Warm rising bell arpeggio: C5, E5, G5, B5, D6
        const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
        notes.forEach((freq, i) => {
          this.scheduleTone(ctx, dest, freq, i * 0.22, 0.72, 'sine', 0.32);
          this.scheduleTone(ctx, dest, freq * 2, i * 0.22, 0.35, 'triangle', 0.08);
        });
        break;
      }
      case 'braun-bip': {
        // Crisp Dieter Rams / Braun twin quartz pulse
        [0, 0.16, 0.32, 0.48].forEach((offset) => {
          this.scheduleTone(ctx, dest, 2048, offset, 0.09, 'square', 0.22);
        });
        break;
      }
      case 'sirene-intense': {
        // Alarmy-grade insistent alternating dual siren
        const start = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const env = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'square';

        osc1.frequency.setValueAtTime(780, start);
        osc1.frequency.linearRampToValueAtTime(1420, start + 0.48);
        osc1.frequency.linearRampToValueAtTime(780, start + 0.96);

        osc2.frequency.setValueAtTime(785, start);
        osc2.frequency.linearRampToValueAtTime(1428, start + 0.48);
        osc2.frequency.linearRampToValueAtTime(785, start + 0.96);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2600;

        env.gain.setValueAtTime(0.001, start);
        env.gain.linearRampToValueAtTime(0.28, start + 0.05);
        env.gain.setValueAtTime(0.28, start + 0.92);
        env.gain.exponentialRampToValueAtTime(0.0001, start + 1.12);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(env);
        env.connect(dest);

        osc1.start(start);
        osc2.start(start);
        osc1.stop(start + 1.15);
        osc2.stop(start + 1.15);
        break;
      }
      case 'clairiere': {
        // Soft pentatonic chord progression
        const chord1 = [392.0, 493.88, 587.33];
        const chord2 = [440.0, 523.25, 659.25];
        chord1.forEach((f, i) => {
          this.scheduleTone(ctx, dest, f, i * 0.14, 1.35, 'sine', 0.2);
        });
        chord2.forEach((f, i) => {
          this.scheduleTone(ctx, dest, f, 1.2 + i * 0.14, 1.35, 'sine', 0.2);
        });
        break;
      }
      case 'radar-pulse': {
        // Sharp rhythmic sonar ping
        [0, 0.22, 0.44].forEach((offset, idx) => {
          const freq = idx === 2 ? 1318.5 : 987.77;
          this.scheduleTone(ctx, dest, freq, offset, 0.16, 'triangle', 0.38);
          this.scheduleTone(ctx, dest, freq * 1.5, offset, 0.1, 'sine', 0.14);
        });
        break;
      }
      case 'cloche-bronze': {
        // Resonant bronze horological bell strike (inharmonic partials)
        const partials = [
          { f: 329.63, g: 0.38, d: 2.3 },
          { f: 659.25, g: 0.22, d: 1.8 },
          { f: 995.0, g: 0.14, d: 1.2 },
          { f: 1412.0, g: 0.08, d: 0.7 },
        ];
        partials.forEach((p) => {
          this.scheduleTone(ctx, dest, p.f, 0, p.d, 'sine', p.g);
        });
        break;
      }
      case 'fanfare-matin': {
        // Bright brassy reveille motif: G4, C5, E5, G5
        const steps = [
          { f: 392.0, t: 0, d: 0.2 },
          { f: 523.25, t: 0.22, d: 0.2 },
          { f: 659.25, t: 0.44, d: 0.22 },
          { f: 783.99, t: 0.7, d: 0.65 },
        ];
        steps.forEach((s) => {
          this.scheduleTone(ctx, dest, s.f, s.t, s.d, 'sawtooth', 0.16);
          this.scheduleTone(ctx, dest, s.f, s.t, s.d, 'triangle', 0.24);
        });
        break;
      }
    }
  }
}

export const soundEngine = new SoundEngine();
