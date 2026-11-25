package com.eveil.alarm

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader
import android.graphics.Color
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var pendingAlarmIdToTrigger: String? = null
    private var webReady = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Allow Activity to wake screen and appear above lock screen when alarm fires
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            km.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    webReady = true
                    flushPendingTrigger()
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    request.grant(request.resources)
                }
            }

            addJavascriptInterface(EveilAndroidBridge(), "EveilAndroid")
        }

        setContentView(webView)
        handleIncomingIntent(intent)
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        if (webReady) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new Event('eveil-android-permissions-updated'))",
                null
            )
        }
    }

    private fun handleIncomingIntent(intent: Intent?) {
        val alarmId = intent?.getStringExtra(AlarmForegroundService.EXTRA_ALARM_ID)
        if (!alarmId.isNullOrEmpty()) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            pendingAlarmIdToTrigger = alarmId
            flushPendingTrigger()
        }
    }

    private fun flushPendingTrigger() {
        val id = pendingAlarmIdToTrigger ?: return
        if (!webReady) return
        pendingAlarmIdToTrigger = null
        val escaped = JSONObject.quote(id)
        runOnUiThread {
            webView.evaluateJavascript(
                "window.__eveilNativeTriggerAlarm && window.__eveilNativeTriggerAlarm($escaped);",
                null
            )
        }
    }

    inner class EveilAndroidBridge {
        @JavascriptInterface
        fun getPermissionsJson(): String {
            val canOverlay = Settings.canDrawOverlays(this@MainActivity)
            val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                am.canScheduleExactAlarms()
            } else true
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            val ignoringBattery = pm.isIgnoringBatteryOptimizations(packageName)
            val notifications = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else true
            val alarmVol = AlarmAudioPlayer.getAlarmVolumePercent(this@MainActivity)

            return JSONObject().apply {
                put("overlay", canOverlay)
                put("exactAlarm", canExact)
                put("battery", ignoringBattery)
                put("notifications", notifications)
                put("alarmVolumePercent", alarmVol)
            }.toString()
        }

        @JavascriptInterface
        fun requestOverlayPermission() {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        }

        @JavascriptInterface
        fun requestExactAlarmPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val intent = Intent(
                    Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:$packageName")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(intent)
            }
        }

        @JavascriptInterface
        fun requestIgnoreBatteryOptimization() {
            @SuppressLint("BatteryLife")
            val intent = Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:$packageName")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ActivityCompat.requestPermissions(
                    this@MainActivity,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    1001
                )
            }
        }

        @JavascriptInterface
        fun startAlarmSound(ringtoneId: String, volume: Float, crescendo: Boolean, vibrate: Boolean) {
            runOnUiThread {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
            AlarmAudioPlayer.start(this@MainActivity, ringtoneId, volume, crescendo, vibrate)
        }

        @JavascriptInterface
        fun stopAlarmSound() {
            AlarmAudioPlayer.stop()
            val stopIntent = Intent(this@MainActivity, AlarmForegroundService::class.java).apply {
                action = AlarmForegroundService.ACTION_STOP
            }
            startService(stopIntent)
            runOnUiThread {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }

        @JavascriptInterface
        fun playCheckChime() {
            AlarmAudioPlayer.playCheckChime()
        }

        @JavascriptInterface
        fun syncScheduledAlarms(alarmsJson: String) {
            AlarmScheduler.syncAll(this@MainActivity, alarmsJson)
        }

        @JavascriptInterface
        fun setSystemBarsTheme(isDark: Boolean) {
            runOnUiThread {
                val bgColor = Color.parseColor(if (isDark) "#141413" else "#FAF9F6")
                window.statusBarColor = bgColor
                window.navigationBarColor = bgColor
                val controller = WindowCompat.getInsetsController(window, window.decorView)
                controller.isAppearanceLightStatusBars = !isDark
                controller.isAppearanceLightNavigationBars = !isDark
            }
        }

        @JavascriptInterface
        fun getSystemAccentHex(isDark: Boolean): String {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val resId = if (isDark) {
                    android.R.color.system_accent1_300
                } else {
                    android.R.color.system_accent1_600
                }
                val colorInt = ContextCompat.getColor(this@MainActivity, resId)
                String.format("#%06X", 0xFFFFFF and colorInt)
            } else {
                ""
            }
        }
    }
}
