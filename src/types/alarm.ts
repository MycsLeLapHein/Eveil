export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Dimanche, 1 = Lundi ... 6 = Samedi

export type MissionType =
  | 'none'
  | 'math'
  | 'memory'
  | 'shake'
  | 'typing'
  | 'photo';

export type MissionDifficulty = 'easy' | 'medium' | 'hard';

export type RingtoneId =
  | 'aube-carillon'
  | 'braun-bip'
  | 'sirene-intense'
  | 'clairiere'
  | 'radar-pulse'
  | 'cloche-bronze'
  | 'fanfare-matin';

export type AmbientSoundId =
  | 'pluie-douce'
  | 'bruit-brun'
  | 'vent-nuit'
  | 'bourdon-chaud';

export interface Alarm {
  id: string;
  time: string; // "HH:MM"
  label: string;
  enabled: boolean;
  days: DayOfWeek[]; // Empty = one-time alarm
  mission: MissionType;
  difficulty: MissionDifficulty;
  ringtone: RingtoneId;
  volume: number; // 0.2 to 1.0
  crescendo: boolean;
  snoozeMinutes: number; // 0 = disabled
  maxSnoozes: number; // 0 = unlimited, else 1..5
  wakeUpCheck: boolean; // Alarmy Wake-Up Check after dismissal
  wakeUpCheckDelayMin: number; // Minutes after dismissal before check triggers
  watchVibration?: boolean; // Relay vibration pulses to Amazfit / Garmin / Samsung / Wear OS smartwatches
  photoTargetColor?: string; // Optional reference color/label for photo/code mission
}

export interface RingtoneMeta {
  id: RingtoneId;
  name: string;
  character: string;
  intensity: 'Douce' | 'Modérée' | 'Forte';
  tempoLabel: string;
}

export interface AmbientSoundMeta {
  id: AmbientSoundId;
  name: string;
  description: string;
}

export interface SleepLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  bedtime: string; // HH:MM
  wakeTime: string; // HH:MM
  durationMinutes: number;
  quality: 'reposé' | 'correct' | 'fatigué';
  missionUsed: MissionType;
  missionSolveSeconds: number;
  snoozeCount: number;
  soundPeaks: number; // Detected sound events during tracked sleep
  notes?: string;
}

export interface ActiveSleepSession {
  startedAt: number; // epoch ms
  targetWakeTime: string | null;
  ambientSound: AmbientSoundId | null;
  micMonitoring: boolean;
  soundPeaks: number;
}

export interface ActiveSnooze {
  alarmId: string;
  alarmLabel: string;
  resumeAt: number; // epoch ms
  snoozeCount: number;
}

export interface PendingWakeUpCheck {
  alarmId: string;
  alarmLabel: string;
  checkAt: number; // epoch ms when modal opens
  ringtone: RingtoneId;
  volume: number;
}

export type AppTab = 'alarms' | 'missions' | 'tracking' | 'sounds';
