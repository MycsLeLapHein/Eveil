package com.eveil.alarm

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlin.concurrent.thread
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin

/**
 * Synthesizes Éveil ringtones directly on Android's native USAGE_ALARM stream (STREAM_ALARM),
 * so alarms ring at the dedicated Alarm volume even when Media volume is muted or phone is silent.
 */
object AlarmAudioPlayer {
    @Volatile
    private var isPlaying = false
    private var playbackThread: Thread? = null
    private var activeTrack: AudioTrack? = null
    private var vibrator: Vibrator? = null

    fun start(
        context: Context,
        ringtoneId: String,
        volume: Float = 0.85f,
        crescendo: Boolean = true,
        vibrate: Boolean = true
    ) {
        stop()
        isPlaying = true

        if (vibrate) {
            startVibration(context)
        }

        val sampleRate = 44100
        val cyclePcm = generateCyclePcm(ringtoneId, sampleRate)
        val clampedTarget = volume.coerceIn(0.15f, 1.0f)

        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val format = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(sampleRate)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
            .build()

        val minBuf = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(sampleRate / 2)

        val track = AudioTrack.Builder()
            .setAudioAttributes(attributes)
            .setAudioFormat(format)
            .setBufferSizeInBytes(minBuf * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()

        activeTrack = track
        val initialVol = if (crescendo) 0.12f else clampedTarget
        track.setVolume(initialVol)
        track.play()

        val startTime = System.currentTimeMillis()
        playbackThread = thread(start = true, name = "EveilAlarmAudio") {
            try {
                while (isPlaying) {
                    if (crescendo) {
                        val elapsedSec = (System.currentTimeMillis() - startTime) / 18000f
                        val currentVol = (0.12f + (clampedTarget - 0.12f) * elapsedSec.coerceIn(0f, 1f))
                        try {
                            track.setVolume(currentVol)
                        } catch (_: Exception) {
                        }
                    }
                    track.write(cyclePcm, 0, cyclePcm.size)
                }
            } catch (_: Exception) {
                // Playback interrupted by stop()
            }
        }
    }

    fun playCheckChime() {
        thread(start = true, name = "EveilCheckChime") {
            val sampleRate = 44100
            val totalSamples = (sampleRate * 0.75).toInt()
            val pcm = ShortArray(totalSamples)
            addTone(pcm, sampleRate, 659.25, 0.0, 0.30, 0.35, "sine")
            addTone(pcm, sampleRate, 880.0, 0.20, 0.45, 0.35, "sine")

            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val format = AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build()
            val track = AudioTrack.Builder()
                .setAudioAttributes(attributes)
                .setAudioFormat(format)
                .setBufferSizeInBytes(pcm.size * 2)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()
            try {
                track.write(pcm, 0, pcm.size)
                track.setVolume(0.65f)
                track.play()
                Thread.sleep(820)
            } catch (_: Exception) {
            } finally {
                try {
                    track.stop()
                    track.release()
                } catch (_: Exception) {
                }
            }
        }
    }

    fun stop() {
        isPlaying = false
        try {
            activeTrack?.pause()
            activeTrack?.flush()
            activeTrack?.stop()
            activeTrack?.release()
        } catch (_: Exception) {
        }
        activeTrack = null
        playbackThread = null

        try {
            vibrator?.cancel()
        } catch (_: Exception) {
        }
        vibrator = null
    }

    fun getAlarmVolumePercent(context: Context): Int {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val cur = am.getStreamVolume(AudioManager.STREAM_ALARM)
        val max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM).coerceAtLeast(1)
        return ((cur.toFloat() / max.toFloat()) * 100f).toInt()
    }

    private fun startVibration(context: Context) {
        val vib = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        vibrator = vib
        val pattern = longArrayOf(0, 320, 160, 320, 500)
        val effect = VibrationEffect.createWaveform(pattern, 0)
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .build()
        @Suppress("DEPRECATION")
        vib.vibrate(effect, attrs)
    }

    private fun generateCyclePcm(ringtoneId: String, sr: Int): ShortArray {
        val durationSec = when (ringtoneId) {
            "braun-bip" -> 1.15
            "sirene-intense" -> 1.25
            "clairiere" -> 2.80
            "radar-pulse" -> 1.35
            "cloche-bronze" -> 2.60
            "fanfare-matin" -> 2.00
            else -> 2.20
        }
        val buf = ShortArray((sr * durationSec).toInt())

        when (ringtoneId) {
            "braun-bip" -> {
                listOf(0.0, 0.16, 0.32, 0.48).forEach { t ->
                    addTone(buf, sr, 2048.0, t, 0.09, 0.28, "square")
                }
            }
            "sirene-intense" -> {
                val startIdx = 0
                val endIdx = (sr * 1.12).toInt().coerceAtMost(buf.size)
                var phase = 0.0
                for (i in startIdx until endIdx) {
                    val t = i.toDouble() / sr
                    val freq = if (t < 0.48) {
                        780.0 + (1420.0 - 780.0) * (t / 0.48)
                    } else {
                        1420.0 - (1420.0 - 780.0) * ((t - 0.48) / 0.64).coerceIn(0.0, 1.0)
                    }
                    phase += 2.0 * PI * freq / sr
                    val raw = if (sin(phase) >= 0) 0.38 else -0.38
                    buf[i] = (raw * Short.MAX_VALUE).toInt().toShort()
                }
            }
            "clairiere" -> {
                listOf(392.0, 493.88, 587.33).forEachIndexed { i, f ->
                    addTone(buf, sr, f, i * 0.14, 1.30, 0.22, "sine")
                }
                listOf(440.0, 523.25, 659.25).forEachIndexed { i, f ->
                    addTone(buf, sr, f, 1.20 + i * 0.14, 1.30, 0.22, "sine")
                }
            }
            "radar-pulse" -> {
                listOf(0.0 to 987.77, 0.22 to 987.77, 0.44 to 1318.5).forEach { (t, f) ->
                    addTone(buf, sr, f, t, 0.16, 0.38, "triangle")
                }
            }
            "cloche-bronze" -> {
                addTone(buf, sr, 329.63, 0.0, 2.3, 0.40, "sine")
                addTone(buf, sr, 659.25, 0.0, 1.8, 0.22, "sine")
                addTone(buf, sr, 995.0, 0.0, 1.2, 0.14, "sine")
            }
            "fanfare-matin" -> {
                addTone(buf, sr, 392.0, 0.0, 0.20, 0.30, "triangle")
                addTone(buf, sr, 523.25, 0.22, 0.20, 0.30, "triangle")
                addTone(buf, sr, 659.25, 0.44, 0.22, 0.30, "triangle")
                addTone(buf, sr, 783.99, 0.70, 0.65, 0.34, "triangle")
            }
            else -> {
                // aube-carillon
                listOf(523.25, 659.25, 783.99, 987.77, 1174.66).forEachIndexed { i, f ->
                    addTone(buf, sr, f, i * 0.22, 0.72, 0.30, "sine")
                    addTone(buf, sr, f * 2.0, i * 0.22, 0.35, 0.08, "triangle")
                }
            }
        }
        return buf
    }

    private fun addTone(
        buf: ShortArray,
        sr: Int,
        freq: Double,
        startSec: Double,
        durSec: Double,
        amp: Double,
        wave: String
    ) {
        val startIdx = (startSec * sr).toInt().coerceAtLeast(0)
        val count = (durSec * sr).toInt()
        val endIdx = (startIdx + count).coerceAtMost(buf.size)
        for (i in startIdx until endIdx) {
            val t = (i - startIdx).toDouble() / sr
            val attack = (t / 0.015).coerceIn(0.0, 1.0)
            val decay = exp(-3.8 * (t / durSec))
            val env = attack * decay
            val phase = 2.0 * PI * freq * t
            val sample = when (wave) {
                "square" -> if (sin(phase) >= 0) 1.0 else -1.0
                "triangle" -> (2.0 / PI) * kotlin.math.asin(sin(phase))
                else -> sin(phase)
            }
            val mixed = buf[i].toDouble() + sample * amp * env * Short.MAX_VALUE
            buf[i] = mixed.coerceIn(Short.MIN_VALUE.toDouble(), Short.MAX_VALUE.toDouble()).toInt().toShort()
        }
    }
}
