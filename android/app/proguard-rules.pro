# Keep JavaScript interface methods invoked from WebView
-keepclassmembers class com.eveil.alarm.MainActivity$EveilAndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}
