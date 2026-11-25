import { Alarm, AmbientSoundMeta, DayOfWeek, MissionType, RingtoneMeta, SleepLogEntry } from '../types/alarm';

export const DAY_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

export const DAY_SHORT: Record<DayOfWeek, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
  6: 'Sam',
  0: 'Dim',
};

export const DAY_LETTER: Record<DayOfWeek, string> = {
  1: 'L',
  2: 'M',
  3: 'M',
  4: 'J',
  5: 'V',
  6: 'S',
  0: 'D',
};

export const RINGTONES: RingtoneMeta[] = [
  {
    id: 'aube-carillon',
    name: 'Carillon d’aube',
    character: 'Arpège clair de cloches harmoniques, montée régulière',
    intensity: 'Modérée',
    tempoLabel: '92 BPM',
  },
  {
    id: 'braun-bip',
    name: 'Cadran mécanique',
    character: 'Double impulsion quartz sèche, inspirée des réveils de table',
    intensity: 'Modérée',
    tempoLabel: '120 BPM',
  },
  {
    id: 'sirene-intense',
    name: 'Sirène de secours',
    character: 'Double oscillateur perçant conçu pour les sommeils très profonds',
    intensity: 'Forte',
    tempoLabel: '148 BPM',
  },
  {
    id: 'clairiere',
    name: 'Clairière matinale',
    character: 'Accords pentatoniques doux avec résonance feutrée',
    intensity: 'Douce',
    tempoLabel: '72 BPM',
  },
  {
    id: 'radar-pulse',
    name: 'Impulsion radar',
    character: 'Battement net et cadencé à haute lisibilité sonore',
    intensity: 'Forte',
    tempoLabel: '132 BPM',
  },
  {
    id: 'cloche-bronze',
    name: 'Cloche de bronze',
    character: 'Frappe grave et harmoniques métalliques prolongées',
    intensity: 'Modérée',
    tempoLabel: '60 BPM',
  },
  {
    id: 'fanfare-matin',
    name: 'Appel du matin',
    character: 'Motif rythmique cuivré en quinte montante',
    intensity: 'Forte',
    tempoLabel: '116 BPM',
  },
];

export const AMBIENT_SOUNDS: AmbientSoundMeta[] = [
  {
    id: 'pluie-douce',
    name: 'Pluie sur vitre',
    description: 'Bruit rose filtré imitant une averse régulière',
  },
  {
    id: 'bruit-brun',
    name: 'Bruit brun profond',
    description: 'Grondement grave et constant qui masque les bruits extérieurs',
  },
  {
    id: 'vent-nuit',
    name: 'Souffle nocturne',
    description: 'Modulation lente et douce à basse fréquence',
  },
  {
    id: 'bourdon-chaud',
    name: 'Accord de nuit',
    description: 'Nappe harmonique très douce en quinte grave',
  },
];

export const MISSION_LABELS: Record<
  MissionType,
  { name: string; short: string; description: string }
> = {
  none: {
    name: 'Réveil classique',
    short: 'Classique',
    description: 'Arrêt direct par pression maintenue sans épreuve cognitive.',
  },
  math: {
    name: 'Calcul mental',
    short: 'Calcul mental',
    description: 'Résolvez une série d’opérations arithmétiques pour couper la sonnerie.',
  },
  memory: {
    name: 'Mémoire visuelle',
    short: 'Mémoire',
    description: 'Reproduisez l’emplacement des cases illuminées sur la grille.',
  },
  shake: {
    name: 'Secousses actives',
    short: 'Secousses',
    description: 'Secouez l’appareil (ou frappez en rythme sur ordinateur) jusqu’à l’objectif.',
  },
  typing: {
    name: 'Recopie lucide',
    short: 'Recopie',
    description: 'Saisissez intégralement une phrase matinale sans faute ni copier-coller.',
  },
  photo: {
    name: 'Point de passage',
    short: 'Caméra / Code',
    description: 'Capturez votre pièce cible (salle de bain, cuisine) ou validez le code repère.',
  },
};

export const DIFFICULTY_LABELS: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
};

export const DEFAULT_ALARMS: Alarm[] = [
  {
    id: 'alarm-semaine',
    time: '06:45',
    label: 'Réveil semaine',
    enabled: true,
    days: [1, 2, 3, 4, 5],
    mission: 'math',
    difficulty: 'medium',
    ringtone: 'aube-carillon',
    volume: 0.85,
    crescendo: true,
    snoozeMinutes: 5,
    maxSnoozes: 2,
    wakeUpCheck: true,
    wakeUpCheckDelayMin: 3,
  },
  {
    id: 'alarm-sport',
    time: '06:10',
    label: 'Course matinale',
    enabled: false,
    days: [2, 4],
    mission: 'shake',
    difficulty: 'medium',
    ringtone: 'sirene-intense',
    volume: 0.95,
    crescendo: false,
    snoozeMinutes: 0,
    maxSnoozes: 0,
    wakeUpCheck: true,
    wakeUpCheckDelayMin: 5,
  },
  {
    id: 'alarm-weekend',
    time: '08:30',
    label: 'Matinée calme',
    enabled: true,
    days: [6, 0],
    mission: 'memory',
    difficulty: 'easy',
    ringtone: 'clairiere',
    volume: 0.7,
    crescendo: true,
    snoozeMinutes: 10,
    maxSnoozes: 3,
    wakeUpCheck: false,
    wakeUpCheckDelayMin: 5,
  },
  {
    id: 'alarm-rdv',
    time: '07:15',
    label: 'Train Paris-Lyon',
    enabled: false,
    days: [],
    mission: 'typing',
    difficulty: 'hard',
    ringtone: 'braun-bip',
    volume: 0.9,
    crescendo: true,
    snoozeMinutes: 5,
    maxSnoozes: 1,
    wakeUpCheck: true,
    wakeUpCheckDelayMin: 2,
  },
];

function getPastDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_SLEEP_LOGS: SleepLogEntry[] = [
  {
    id: 'log-6',
    date: getPastDateString(6),
    bedtime: '23:20',
    wakeTime: '06:48',
    durationMinutes: 448,
    quality: 'reposé',
    missionUsed: 'math',
    missionSolveSeconds: 24,
    snoozeCount: 0,
    soundPeaks: 2,
  },
  {
    id: 'log-5',
    date: getPastDateString(5),
    bedtime: '23:55',
    wakeTime: '06:55',
    durationMinutes: 420,
    quality: 'correct',
    missionUsed: 'math',
    missionSolveSeconds: 38,
    snoozeCount: 1,
    soundPeaks: 4,
  },
  {
    id: 'log-4',
    date: getPastDateString(4),
    bedtime: '22:50',
    wakeTime: '06:45',
    durationMinutes: 475,
    quality: 'reposé',
    missionUsed: 'math',
    missionSolveSeconds: 19,
    snoozeCount: 0,
    soundPeaks: 1,
  },
  {
    id: 'log-3',
    date: getPastDateString(3),
    bedtime: '00:35',
    wakeTime: '07:02',
    durationMinutes: 387,
    quality: 'fatigué',
    missionUsed: 'shake',
    missionSolveSeconds: 42,
    snoozeCount: 2,
    soundPeaks: 6,
  },
  {
    id: 'log-2',
    date: getPastDateString(2),
    bedtime: '23:10',
    wakeTime: '08:25',
    durationMinutes: 555,
    quality: 'reposé',
    missionUsed: 'memory',
    missionSolveSeconds: 27,
    snoozeCount: 0,
    soundPeaks: 2,
  },
  {
    id: 'log-1',
    date: getPastDateString(1),
    bedtime: '23:30',
    wakeTime: '08:30',
    durationMinutes: 540,
    quality: 'reposé',
    missionUsed: 'memory',
    missionSolveSeconds: 21,
    snoozeCount: 0,
    soundPeaks: 3,
  },
];

export function formatDaysSummary(days: DayOfWeek[]): string {
  if (days.length === 0) return 'Une seule fois';
  if (days.length === 7) return 'Tous les jours';
  const sorted = [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  const weekdays: DayOfWeek[] = [1, 2, 3, 4, 5];
  const weekend: DayOfWeek[] = [6, 0];
  if (sorted.length === 5 && weekdays.every((d, i) => sorted[i] === d)) {
    return 'Lun – Ven';
  }
  if (sorted.length === 2 && weekend.every((d, i) => sorted[i] === d)) {
    return 'Sam – Dim';
  }
  return sorted.map((d) => DAY_SHORT[d]).join(', ');
}

export function getNextOccurrence(alarm: Alarm, fromDate: Date = new Date()): Date | null {
  if (!alarm.enabled) return null;
  const [hStr, mStr] = alarm.time.split(':');
  const hours = Number(hStr);
  const minutes = Number(mStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(fromDate);
    candidate.setSeconds(0, 0);
    candidate.setDate(fromDate.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);

    if (candidate.getTime() <= fromDate.getTime()) continue;

    if (alarm.days.length === 0) {
      return candidate;
    }
    const day = candidate.getDay() as DayOfWeek;
    if (alarm.days.includes(day)) {
      return candidate;
    }
  }
  return null;
}

export function formatDurationFrench(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m.toString().padStart(2, '0')}`;
}

export function formatCountdownFrench(targetDate: Date, now: Date): string {
  const diffMs = Math.max(0, targetDate.getTime() - now.getTime());
  const totalSec = Math.ceil(diffMs / 1000);
  if (totalSec < 60) {
    return `dans ${totalSec} s`;
  }
  const totalMin = Math.ceil(totalSec / 60);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} j`);
  if (hours > 0) parts.push(`${hours} h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins} min`);
  return `dans ${parts.join(' ')}`;
}
