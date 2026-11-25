package com.eveil.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject

object AlarmScheduler {
    private const val PREFS_NAME = "eveil_native_alarms"
    private const val KEY_LIST = "scheduled_json"

    fun syncAll(context: Context, alarmsJson: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val previousRaw = prefs.getString(KEY_LIST, "[]") ?: "[]"

        // Cancel previous pending intents
        try {
            val prevArr = JSONArray(previousRaw)
            for (i in 0 until prevArr.length()) {
                val obj = prevArr.getJSONObject(i)
                cancelPendingIntent(context, obj.optString("id"))
            }
        } catch (_: Exception) {
        }

        prefs.edit().putString(KEY_LIST, alarmsJson).apply()
        scheduleFromJson(context, alarmsJson)
    }

    fun rescheduleAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_LIST, "[]") ?: "[]"
        scheduleFromJson(context, raw)
    }

    private fun scheduleFromJson(context: Context, raw: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = System.currentTimeMillis()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val obj: JSONObject = arr.getJSONObject(i)
                val id = obj.optString("id")
                val triggerAt = obj.optLong("triggerAtMs", 0L)
                if (id.isEmpty() || triggerAt <= now) continue

                val intent = Intent(context, AlarmReceiver::class.java).apply {
                    putExtra(AlarmForegroundService.EXTRA_ALARM_ID, id)
                    putExtra(AlarmForegroundService.EXTRA_LABEL, obj.optString("label", "Réveil"))
                    putExtra(AlarmForegroundService.EXTRA_RINGTONE, obj.optString("ringtone", "aube-carillon"))
                    putExtra(AlarmForegroundService.EXTRA_VOLUME, obj.optDouble("volume", 0.85).toFloat())
                    putExtra(AlarmForegroundService.EXTRA_CRESCENDO, obj.optBoolean("crescendo", true))
                }

                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    id.hashCode(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val showIntent = PendingIntent.getActivity(
                    context,
                    id.hashCode() + 1,
                    Intent(context, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val info = AlarmManager.AlarmClockInfo(triggerAt, showIntent)
                alarmManager.setAlarmClock(info, pendingIntent)
            }
        } catch (_: Exception) {
        }
    }

    private fun cancelPendingIntent(context: Context, id: String) {
        if (id.isEmpty()) return
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AlarmReceiver::class.java)
        val pi = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pi != null) {
            alarmManager.cancel(pi)
            pi.cancel()
        }
    }
}
