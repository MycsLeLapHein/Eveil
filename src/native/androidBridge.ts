import { Alarm, RingtoneId } from '../types/alarm';
import { getNextOccurrence } from '../data/defaults';

export interface AndroidPermissionStatus {
  overlay: boolean;
  exactAlarm: boolean;
  battery: boolean;
  notifications: boolean;
  alarmVolumePercent: number;
}

interface EveilAndroidNative {
  getPermissionsJson: () => string;
  requestOverlayPermission: () => void;
  requestExactAlarmPermission: () => void;
  requestIgnoreBatteryOptimization: () => void;
  requestNotificationPermission: () => void;
  startAlarmSound: (
    ringtoneId: string,
    volume: number,
    crescendo: boolean,
    vibrate: boolean
  ) => void;
  stopAlarmSound: () => void;
  playCheckChime: () => void;
  syncScheduledAlarms: (alarmsJson: string) => void;
  setSystemBarsTheme?: (isDark: boolean) => void;
  getSystemAccentHex?: (isDark: boolean) => string;
}

declare global {
  interface Window {
    EveilAndroid?: EveilAndroidNative;
    __eveilNativeTriggerAlarm?: (alarmId: string) => void;
  }
}

export function isAndroidApk(): boolean {
  return typeof window !== 'undefined' && typeof window.EveilAndroid !== 'undefined';
}

export function getAndroidPermissions(): AndroidPermissionStatus | null {
  if (!isAndroidApk()) return null;
  try {
    return JSON.parse(window.EveilAndroid!.getPermissionsJson()) as AndroidPermissionStatus;
  } catch {
    return null;
  }
}

export function requestOverlayPermission(): void {
  window.EveilAndroid?.requestOverlayPermission();
}

export function requestExactAlarmPermission(): void {
  window.EveilAndroid?.requestExactAlarmPermission();
}

export function requestBatteryExemption(): void {
  window.EveilAndroid?.requestIgnoreBatteryOptimization();
}

export function requestNotificationPermission(): void {
  window.EveilAndroid?.requestNotificationPermission();
}

export function syncAlarmsWithAndroid(
  alarms: Alarm[],
  snoozeOverride?: { alarmId: string; resumeAt: number } | null
): void {
  if (!isAndroidApk()) return;
  const now = new Date();
  const payload = alarms
    .filter((a) => a.enabled)
    .map((a) => {
      const nextDate = getNextOccurrence(a, now);
      let triggerAtMs = nextDate ? nextDate.getTime() : 0;
      if (snoozeOverride && snoozeOverride.alarmId === a.id && snoozeOverride.resumeAt > Date.now()) {
        triggerAtMs = snoozeOverride.resumeAt;
      }
      return {
        id: a.id,
        label: a.label,
        ringtone: a.ringtone,
        volume: a.volume,
        crescendo: a.crescendo,
        triggerAtMs,
      };
    })
    .filter((item) => item.triggerAtMs > Date.now());

  try {
    window.EveilAndroid!.syncScheduledAlarms(JSON.stringify(payload));
  } catch {
    // Ignore bridge serialization errors
  }
}

export function startNativeAlarmSound(
  ringtoneId: RingtoneId,
  volume: number,
  crescendo: boolean,
  vibrate: boolean
): boolean {
  if (!isAndroidApk()) return false;
  window.EveilAndroid!.startAlarmSound(ringtoneId, volume, crescendo, vibrate);
  return true;
}

export function stopNativeAlarmSound(): boolean {
  if (!isAndroidApk()) return false;
  window.EveilAndroid!.stopAlarmSound();
  return true;
}

export function playNativeCheckChime(): boolean {
  if (!isAndroidApk()) return false;
  window.EveilAndroid!.playCheckChime();
  return true;
}

export function syncAndroidSystemBars(isDark: boolean): void {
  window.EveilAndroid?.setSystemBarsTheme?.(isDark);
}

export function getAndroidSystemAccent(isDark: boolean): string | null {
  try {
    const hex = window.EveilAndroid?.getSystemAccentHex?.(isDark);
    if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
    return null;
  } catch {
    return null;
  }
}
