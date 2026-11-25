package com.eveil.alarm

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Emits dedicated non-ongoing, non-local-only HIGH-importance notifications designed
 * to be bridged over Bluetooth to Amazfit (Zepp), Garmin, Samsung Galaxy Watch,
 * Xiaomi Mi Fitness, Fitbit, Huawei Health, and Wear OS smartwatches.
 *
 * Ongoing foreground-service notifications are ignored by most smartwatch companion apps;
 * posting a separate bridgeable alert notification with periodic pulses ensures reliable
 * wrist vibration until the wake-up mission is completed.
 */
object WatchNotifier {
    const val WATCH_CHANNEL_ID = "eveil_watch_alert_channel"
    private const val WATCH_NOTIFICATION_ID = 4202
    private const val PULSE_INTERVAL_MS = 12_000L

    private val handler = Handler(Looper.getMainLooper())
    private var pulseRunnable: Runnable? = null
    private var pulseCount = 0

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        val existing = manager.getNotificationChannel(WATCH_CHANNEL_ID)
        if (existing != null) return

        val channel = NotificationChannel(
            WATCH_CHANNEL_ID,
            "Vibration montre connectée",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Relais d’alarme vers montre connectée (Amazfit, Garmin, Samsung, Wear OS)"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 450, 180, 450, 180, 450)
            // Keep sound null on this channel since AlarmAudioPlayer already plays on USAGE_ALARM
            setSound(null, null)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }

    fun startRingingPulses(context: Context, label: String) {
        stop(context)
        val appCtx = context.applicationContext
        ensureChannel(appCtx)
        pulseCount = 0

        val runnable = object : Runnable {
            override fun run() {
                pulseCount += 1
                val subtitle = if (pulseCount == 1) {
                    "Alarme en cours — terminez votre défi"
                } else {
                    "Alarme toujours active (rappel #$pulseCount)"
                }
                postWatchNotification(appCtx, "Éveil · $label", subtitle)
                handler.postDelayed(this, PULSE_INTERVAL_MS)
            }
        }
        pulseRunnable = runnable
        handler.post(runnable)
    }

    fun sendSinglePulse(context: Context, title: String, body: String) {
        val appCtx = context.applicationContext
        ensureChannel(appCtx)
        postWatchNotification(appCtx, title, body)
    }

    fun stop(context: Context) {
        pulseRunnable?.let { handler.removeCallbacks(it) }
        pulseRunnable = null
        pulseCount = 0
        try {
            NotificationManagerCompat.from(context.applicationContext).cancel(WATCH_NOTIFICATION_ID)
        } catch (_: Exception) {
        }
    }

    private fun postWatchNotification(context: Context, title: String, body: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }

        // Cancel before reposting so Zepp / Garmin / Wearable treats each pulse as a fresh wrist alert
        val nm = NotificationManagerCompat.from(context)
        nm.cancel(WATCH_NOTIFICATION_ID)

        val wearableExtender = NotificationCompat.WearableExtender()
            .setHintScreenTimeout(NotificationCompat.WearableExtender.SCREEN_TIMEOUT_LONG)

        val notification = NotificationCompat.Builder(context, WATCH_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(false)
            .setLocalOnly(false)
            .setOnlyAlertOnce(false)
            .setAutoCancel(true)
            .setVibrate(longArrayOf(0, 450, 180, 450, 180, 450))
            .setWhen(System.currentTimeMillis())
            .extend(wearableExtender)
            .build()

        try {
            nm.notify(WATCH_NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {
            // Ignored if notification permission revoked
        }
    }
}
