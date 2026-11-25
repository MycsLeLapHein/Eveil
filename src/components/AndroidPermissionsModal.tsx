import React, { useEffect, useState } from 'react';
import { Check, Smartphone, X } from 'lucide-react';
import {
  AndroidPermissionStatus,
  getAndroidPermissions,
  isAndroidApk,
  requestBatteryExemption,
  requestExactAlarmPermission,
  requestNotificationPermission,
  requestOverlayPermission,
} from '../native/androidBridge';

interface AndroidPermissionsModalProps {
  onClose: () => void;
}

export const AndroidPermissionsModal: React.FC<AndroidPermissionsModalProps> = ({ onClose }) => {
  const nativeMode = isAndroidApk();
  const [perms, setPerms] = useState<AndroidPermissionStatus | null>(() => getAndroidPermissions());

  useEffect(() => {
    if (!nativeMode) return;
    const refresh = () => setPerms(getAndroidPermissions());
    window.addEventListener('eveil-android-permissions-updated', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('eveil-android-permissions-updated', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [nativeMode]);

  const rows = [
    {
      key: 'overlay',
      title: 'Afficher au-dessus des autres applications',
      detail: 'SYSTEM_ALERT_WINDOW · Ouvre le défi de réveil par-dessus toutes les apps et l’écran verrouillé.',
      granted: perms?.overlay ?? false,
      action: requestOverlayPermission,
    },
    {
      key: 'exactAlarm',
      title: 'Alarmes et rappels exacts',
      detail: 'SCHEDULE_EXACT_ALARM · Garantit le déclenchement à la seconde près via AlarmManager.',
      granted: perms?.exactAlarm ?? false,
      action: requestExactAlarmPermission,
    },
    {
      key: 'battery',
      title: 'Rester actif sans restriction batterie',
      detail: 'IGNORE_BATTERY_OPTIMIZATIONS · Empêche Android de fermer Éveil pendant la nuit.',
      granted: perms?.battery ?? false,
      action: requestBatteryExemption,
    },
    {
      key: 'notifications',
      title: 'Notifications plein écran',
      detail: 'POST_NOTIFICATIONS · Maintient le service d’alarme prioritaire au premier plan.',
      granted: perms?.notifications ?? false,
      action: requestNotificationPermission,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-[#FAF9F6] dark:bg-[#141413] text-[#181816] dark:text-[#F4F3EF] border border-black/12 dark:border-white/12 p-6 sm:p-7 space-y-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Configuration Android APK"
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#C83A1E] dark:text-[#E25134]">
              <Smartphone className="w-3.5 h-3.5" />
              {nativeMode ? 'Application Android (.apk) active' : 'Projet Android (.apk) prêt pour GitHub'}
            </div>
            <h2 className="font-display text-2xl font-semibold mt-1">
              Autorisations et canal Alarme
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/8"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dedicated Alarm Audio Channel info */}
        <div className="pb-4 border-b border-black/10 dark:border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Canal audio système Alarme (USAGE_ALARM)</span>
            <span className="font-mono-tabular text-xs font-medium text-[#C83A1E] dark:text-[#E25134]">
              {nativeMode && perms
                ? `Volume Alarme : ${perms.alarmVolumePercent} %`
                : 'Intégré dans l’APK'}
            </span>
          </div>
          <p className="text-xs text-[#66645E] dark:text-[#9C9A92]">
            Dans l’APK Android, les 7 sonneries sont synthétisées sur le flux natif STREAM_ALARM : elles sonnent au volume Alarme même si le volume Média est coupé ou le téléphone en silencieux.
          </p>
        </div>

        {/* Permissions Checklist */}
        <div className="divide-y divide-black/10 dark:divide-white/10 border-b border-black/10 dark:border-white/10">
          {rows.map((row) => (
            <div key={row.key} className="py-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium">{row.title}</div>
                <div className="text-xs text-[#66645E] dark:text-[#9C9A92] mt-0.5">{row.detail}</div>
              </div>
              {nativeMode ? (
                row.granted ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#181816] dark:text-[#F4F3EF] shrink-0">
                    <Check className="w-3.5 h-3.5 text-[#C83A1E]" />
                    Autorisé
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={row.action}
                    className="min-h-[38px] px-3.5 rounded-md bg-[#C83A1E] hover:bg-[#B03118] text-[#FAF9F6] text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                  >
                    Autoriser
                  </button>
                )
              ) : (
                <span className="text-xs text-[#66645E] dark:text-[#9C9A92] whitespace-nowrap shrink-0">
                  Demandé sur Android
                </span>
              )}
            </div>
          ))}
        </div>

        {!nativeMode && (
          <div className="space-y-2 text-xs text-[#66645E] dark:text-[#9C9A92]">
            <p className="font-medium text-[#181816] dark:text-[#F4F3EF]">
              Comment obtenir votre fichier .apk depuis GitHub :
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Poussez ce dépôt sur GitHub (le dossier <code className="font-mono-tabular">android/</code> et le workflow Actions sont inclus).</li>
              <li>Ouvrez l’onglet <strong>Actions</strong> sur GitHub puis le workflow <strong>Build Éveil Android APK</strong>.</li>
              <li>Téléchargez l’artefact <strong>eveil-android-apk</strong> et installez <code className="font-mono-tabular">app-debug.apk</code> sur votre téléphone Android.</li>
            </ol>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 rounded-md border border-black/15 dark:border-white/15 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
