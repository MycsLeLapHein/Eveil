package com.eveil.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

class AlarmForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var ownedAudioSession: Int? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_STOP) {
            AlarmAudioPlayer.stop(ownedAudioSession)
            ownedAudioSession = null
            WatchNotifier.stop(this)
            releaseWakeLock()
            isRunning = false
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        isRunning = true
        val alarmId = intent?.getStringExtra(EXTRA_ALARM_ID) ?: ""
        val label = intent?.getStringExtra(EXTRA_LABEL) ?: "Réveil"
        val ringtone = intent?.getStringExtra(EXTRA_RINGTONE) ?: "aube-carillon"
        val volume = intent?.getFloatExtra(EXTRA_VOLUME, 0.85f) ?: 0.85f
        val crescendo = intent?.getBooleanExtra(EXTRA_CRESCENDO, true) ?: true
        val watchVibration = intent?.getBooleanExtra(EXTRA_WATCH_VIBRATION, true) ?: true

        acquireWakeLock()
        createChannel()

        val fullScreenIntent = Intent(this, MainActivity::class.java).apply {
            this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_ALARM_ID, alarmId)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            alarmId.hashCode(),
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Éveil — $label")
            .setContentText("Terminez votre défi pour couper la sonnerie")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .build()

        startForeground(NOTIFICATION_ID, notification)

        ownedAudioSession = AlarmAudioPlayer.start(
            context = this,
            ringtoneId = ringtone,
            volume = volume,
            crescendo = crescendo,
            vibrate = true
        )

        if (watchVibration) {
            WatchNotifier.startRingingPulses(this, label)
        }

        // Bring UI above other apps & lock screen immediately
        startActivity(fullScreenIntent)

        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        AlarmAudioPlayer.stop(ownedAudioSession)
        ownedAudioSession = null
        releaseWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "Eveil::AlarmWakeLock"
        ).apply {
            acquire(10 * 60 * 1000L)
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {
        }
        wakeLock = null
    }

    private fun createChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Alarmes Éveil",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Déclenchement des alarmes en plein écran"
            setSound(null, null)
            enableVibration(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        @Volatile
        var isRunning: Boolean = false

        const val CHANNEL_ID = "eveil_alarm_channel"
        const val NOTIFICATION_ID = 4201
        const val ACTION_STOP = "com.eveil.alarm.ACTION_STOP"
        const val EXTRA_ALARM_ID = "extra_alarm_id"
        const val EXTRA_LABEL = "extra_label"
        const val EXTRA_RINGTONE = "extra_ringtone"
        const val EXTRA_VOLUME = "extra_volume"
        const val EXTRA_CRESCENDO = "extra_crescendo"
        const val EXTRA_WATCH_VIBRATION = "extra_watch_vibration"

        fun stopIfRunning(context: Context) {
            if (!isRunning) return
            isRunning = false
            try {
                context.stopService(Intent(context, AlarmForegroundService::class.java))
            } catch (_: Exception) {
            }
        }
    }
}
