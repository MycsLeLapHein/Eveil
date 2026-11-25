package com.eveil.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val serviceIntent = Intent(context, AlarmForegroundService::class.java).apply {
            putExtra(
                AlarmForegroundService.EXTRA_ALARM_ID,
                intent.getStringExtra(AlarmForegroundService.EXTRA_ALARM_ID)
            )
            putExtra(
                AlarmForegroundService.EXTRA_LABEL,
                intent.getStringExtra(AlarmForegroundService.EXTRA_LABEL)
            )
            putExtra(
                AlarmForegroundService.EXTRA_RINGTONE,
                intent.getStringExtra(AlarmForegroundService.EXTRA_RINGTONE)
            )
            putExtra(
                AlarmForegroundService.EXTRA_VOLUME,
                intent.getFloatExtra(AlarmForegroundService.EXTRA_VOLUME, 0.85f)
            )
            putExtra(
                AlarmForegroundService.EXTRA_CRESCENDO,
                intent.getBooleanExtra(AlarmForegroundService.EXTRA_CRESCENDO, true)
            )
        }
        ContextCompat.startForegroundService(context, serviceIntent)
    }
}
