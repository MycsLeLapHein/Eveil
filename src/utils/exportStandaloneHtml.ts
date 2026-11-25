import { Alarm, SleepLogEntry } from '../types/alarm';

/**
 * Generates a self-contained single-file HTML version of Éveil
 * with recurring alarms, Web Audio ringtones, wake-up challenges, and sleep tracking.
 */
export function downloadStandaloneHtml(alarms: Alarm[], logs: SleepLogEntry[]): void {
  const safeAlarmsJson = JSON.stringify(alarms).replace(/<\/script/gi, '<\\/script');
  const safeLogsJson = JSON.stringify(logs).replace(/<\/script/gi, '<\\/script');

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 108 108'%3E%3Crect width='108' height='108' rx='24' fill='%23FAF9F6'/%3E%3Ccircle cx='54' cy='54' r='30' fill='none' stroke='%23181816' stroke-width='5'/%3E%3Cline x1='54' y1='54' x2='54' y2='33' stroke='%23181816' stroke-width='4.5' stroke-linecap='round'/%3E%3Cline x1='54' y1='54' x2='69' y2='62' stroke='%23C83A1E' stroke-width='4.5' stroke-linecap='round'/%3E%3Ccircle cx='54' cy='54' r='4.5' fill='%23C83A1E'/%3E%3C/svg%3E" />
  <title>Éveil — Réveil autonome</title>
  <style>
    :root { --bg: #FAF9F6; --sub: #F2F0EA; --ink: #181816; --muted: #66645E; --line: rgba(24,24,22,0.12); --accent: #C83A1E; }
    .dark { --bg: #141413; --sub: #1D1C1A; --ink: #F4F3EF; --muted: #9C9A92; --line: rgba(244,243,239,0.12); --accent: #E25134; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--ink); line-height: 1.5; }
    header { max-width: 1120px; margin: 0 auto; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); }
    .brand { font-family: Georgia, serif; font-size: 24px; font-weight: 700; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 24px 80px; display: grid; grid-template-columns: 1fr; gap: 40px; }
    @media (min-width: 900px) { main { grid-template-columns: 5fr 7fr; } }
    .clock { font-family: ui-monospace, monospace; font-size: clamp(48px, 7vw, 82px); font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1; }
    .muted { color: var(--muted); font-size: 13px; }
    button { font: inherit; cursor: pointer; border-radius: 6px; transition: opacity 150ms; }
    .btn-primary { background: var(--accent); color: #FAF9F6; border: none; padding: 10px 18px; font-weight: 500; }
    .btn-ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); padding: 8px 14px; font-size: 13px; }
    .list { border-top: 1px solid var(--line); }
    .row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 0; border-bottom: 1px solid var(--line); }
    .row-time { font-family: ui-monospace, monospace; font-size: 32px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .overlay { position: fixed; inset: 0; background: var(--bg); z-index: 50; display: none; align-items: center; justify-content: center; padding: 24px; }
    .overlay.open { display: flex; }
    .overlay-box { max-width: 480px; width: 100%; border-top: 2px solid var(--accent); padding-top: 24px; }
    input, select { background: var(--sub); color: var(--ink); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; font: inherit; }
  </style>
</head>
<body>
  <header>
    <div class="brand">Éveil</div>
    <div style="display:flex;gap:10px;align-items:center;">
      <select id="themeSelect" aria-label="Thème">
        <option value="system">Système</option>
        <option value="light">Clair</option>
        <option value="dark">Sombre</option>
      </select>
      <button class="btn-primary" id="addBtn">Nouvelle alarme</button>
    </div>
  </header>
  <main>
    <section>
      <div class="clock" id="liveClock">--:--:--</div>
      <p class="muted" id="liveDate" style="margin-top:10px;"></p>
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--line);">
        <h3 style="margin:0 0 8px;font-family:Georgia,serif;">Suivi du sommeil</h3>
        <p class="muted" id="sleepStatus">Prêt pour votre prochaine nuit.</p>
        <button class="btn-ghost" id="sleepBtn" style="margin-top:8px;">Démarrer la nuit</button>
      </div>
    </section>
    <section>
      <h2 style="margin:0 0 16px;font-family:Georgia,serif;">Alarmes programmées</h2>
      <div class="list" id="alarmList"></div>
      <div id="addForm" style="display:none;margin-top:20px;padding:16px;background:var(--sub);border-radius:8px;">
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
          <input type="time" id="newTime" value="07:00" />
          <input type="text" id="newLabel" placeholder="Libellé" value="Réveil" />
          <select id="newMission">
            <option value="math">Calcul mental</option>
            <option value="shake">Secousses / Clics</option>
            <option value="typing">Recopie lucide</option>
            <option value="none">Classique</option>
          </select>
          <select id="newRingtone">
            <option value="aube-carillon">Carillon d'aube</option>
            <option value="braun-bip">Cadran mécanique</option>
            <option value="sirene-intense">Sirène de secours</option>
          </select>
          <button class="btn-primary" id="saveNewBtn">Enregistrer</button>
        </div>
      </div>
    </section>
  </main>

  <div class="overlay" id="ringOverlay">
    <div class="overlay-box">
      <div style="color:var(--accent);font-weight:600;font-size:13px;">ALARME ACTIVE</div>
      <div class="clock" id="ringTime" style="margin:8px 0;"></div>
      <h2 id="ringLabel" style="margin:0 0 18px;font-family:Georgia,serif;"></h2>
      <div id="missionArea"></div>
    </div>
  </div>

  <script>
    const STORAGE_KEY = 'eveil_standalone_alarms_v1';
    const LOGS_KEY = 'eveil_standalone_logs_v1';
    let alarms = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || ${safeAlarmsJson};
    let logs = JSON.parse(localStorage.getItem(LOGS_KEY) || 'null') || ${safeLogsJson};
    let sleepStart = null;
    let audioCtx = null;
    let ringTimer = null;
    let lastTriggeredMin = '';

    function playTone(freq, dur, type) {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.28, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + dur + 0.02);
    }

    function startSound(id) {
      stopSound();
      const cycle = () => {
        if (id === 'sirene-intense') { playTone(980, 0.35, 'sawtooth'); setTimeout(() => playTone(1380, 0.35, 'sawtooth'), 360); }
        else if (id === 'braun-bip') { [0, 160, 320].forEach(d => setTimeout(() => playTone(2048, 0.09, 'square'), d)); }
        else { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 0.45, 'sine'), i * 200)); }
      };
      cycle();
      ringTimer = setInterval(cycle, 1600);
    }
    function stopSound() { if (ringTimer) { clearInterval(ringTimer); ringTimer = null; } }

    function save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    }

    function triggerAlarm(alarm) {
      startSound(alarm.ringtone);
      const ov = document.getElementById('ringOverlay');
      document.getElementById('ringTime').textContent = alarm.time;
      document.getElementById('ringLabel').textContent = alarm.label || 'Réveil';
      const area = document.getElementById('missionArea');
      ov.classList.add('open');

      const finish = () => {
        stopSound();
        ov.classList.remove('open');
        if (alarm.wakeUpCheck) {
          const delayMs = (alarm.wakeUpCheckDelayMin || 3) * 60000;
          setTimeout(() => {
            playTone(659, 0.3, 'sine');
            setTimeout(() => playTone(880, 0.4, 'sine'), 220);
            let left = 60;
            ov.classList.add('open');
            document.getElementById('ringTime').textContent = 'Vérification';
            document.getElementById('ringLabel').textContent = 'Êtes-vous bien réveillé(e) ?';
            const updateCheck = () => {
              area.innerHTML = '<p class="muted">Sans confirmation dans <strong>' + left + ' s</strong>, l\\'alarme repartira.</p><button class="btn-primary" id="wakeOk" style="width:100%;padding:16px;margin-top:12px;">Oui, je suis debout</button>';
              document.getElementById('wakeOk').onclick = () => { clearInterval(chkTimer); ov.classList.remove('open'); };
            };
            updateCheck();
            const chkTimer = setInterval(() => {
              left--;
              if (left <= 0) { clearInterval(chkTimer); triggerAlarm(alarm); }
              else updateCheck();
            }, 1000);
          }, delayMs);
        }
      };

      if (alarm.mission === 'math') {
        const a = 7 + Math.floor(Math.random() * 14);
        const b = 3 + Math.floor(Math.random() * 9);
        const c = 5 + Math.floor(Math.random() * 20);
        const ans = a * b + c;
        area.innerHTML = '<p>Résolvez pour couper : <strong>' + a + ' × ' + b + ' + ' + c + ' = ?</strong></p><input id="mIn" type="number" /><button class="btn-primary" id="mOk" style="margin-left:8px;">Valider</button>';
        document.getElementById('mOk').onclick = () => {
          if (Number(document.getElementById('mIn').value) === ans) finish();
          else document.getElementById('mIn').value = '';
        };
      } else if (alarm.mission === 'shake') {
        let left = 15;
        area.innerHTML = '<button class="btn-primary" id="sBtn" style="width:100%;padding:16px;">Tapoter 15 fois</button>';
        document.getElementById('sBtn').onclick = () => {
          left--;
          if (left <= 0) finish();
          else document.getElementById('sBtn').textContent = 'Encore ' + left + ' impulsions';
        };
      } else if (alarm.mission === 'typing') {
        const phrase = 'Je me lève tout de suite';
        area.innerHTML = '<p>Recopiez : <em>' + phrase + '</em></p><input id="tIn" style="width:100%;margin-bottom:10px;" /><button class="btn-primary" id="tOk">Valider</button>';
        document.getElementById('tOk').onclick = () => {
          if (document.getElementById('tIn').value.trim().toLowerCase() === phrase.toLowerCase()) finish();
        };
      } else {
        area.innerHTML = '<button class="btn-primary" id="cOk" style="width:100%;padding:16px;">Arrêter la sonnerie</button>';
        document.getElementById('cOk').onclick = finish;
      }
    }

    function render() {
      const el = document.getElementById('alarmList');
      el.innerHTML = '';
      alarms.forEach((a) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = '<div><div class="row-time">' + a.time + '</div><div class="muted">' + (a.label || 'Réveil') + ' · ' + a.mission + '</div></div><div style="display:flex;gap:8px;align-items:center;"><button class="btn-ghost" data-test="' + a.id + '">Tester</button><button class="btn-ghost" data-toggle="' + a.id + '">' + (a.enabled ? 'Active' : 'Inactive') + '</button></div>';
        el.appendChild(row);
      });
      el.querySelectorAll('[data-test]').forEach(b => b.onclick = () => triggerAlarm(alarms.find(x => x.id === b.dataset.test)));
      el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
        const t = alarms.find(x => x.id === b.dataset.toggle);
        if (t) { t.enabled = !t.enabled; save(); render(); }
      });
    }

    const themeSelect = document.getElementById('themeSelect');
    const sysMedia = window.matchMedia('(prefers-color-scheme: dark)');
    function applyStandaloneTheme(mode) {
      const dark = mode === 'dark' || (mode === 'system' && sysMedia.matches);
      document.documentElement.classList.toggle('dark', dark);
      localStorage.setItem('eveil_standalone_theme', mode);
    }
    const savedTheme = localStorage.getItem('eveil_standalone_theme') || 'system';
    themeSelect.value = savedTheme;
    applyStandaloneTheme(savedTheme);
    themeSelect.onchange = () => applyStandaloneTheme(themeSelect.value);
    sysMedia.addEventListener('change', () => { if (themeSelect.value === 'system') applyStandaloneTheme('system'); });
    document.getElementById('addBtn').onclick = () => {
      const f = document.getElementById('addForm');
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
    };
    document.getElementById('saveNewBtn').onclick = () => {
      alarms.push({
        id: 'a-' + Date.now(),
        time: document.getElementById('newTime').value || '07:00',
        label: document.getElementById('newLabel').value || 'Réveil',
        enabled: true, days: [1,2,3,4,5],
        mission: document.getElementById('newMission').value,
        ringtone: document.getElementById('newRingtone').value
      });
      save(); render();
      document.getElementById('addForm').style.display = 'none';
    };
    document.getElementById('sleepBtn').onclick = () => {
      if (!sleepStart) {
        sleepStart = Date.now();
        document.getElementById('sleepBtn').textContent = 'Arrêter le suivi';
      } else {
        const mins = Math.max(1, Math.round((Date.now() - sleepStart) / 60000));
        sleepStart = null;
        document.getElementById('sleepBtn').textContent = 'Démarrer la nuit';
        document.getElementById('sleepStatus').textContent = 'Dernière session enregistrée : ' + mins + ' min.';
      }
    };

    setInterval(() => {
      const now = new Date();
      document.getElementById('liveClock').textContent = now.toLocaleTimeString('fr-FR');
      document.getElementById('liveDate').textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (sleepStart) {
        const sec = Math.floor((Date.now() - sleepStart) / 1000);
        document.getElementById('sleepStatus').textContent = 'Sommeil en cours : ' + Math.floor(sec/60) + ' min ' + (sec%60) + ' s';
      }
      const hhmm = now.toTimeString().slice(0, 5);
      const stamp = now.toISOString().slice(0, 16);
      if (now.getSeconds() === 0 && stamp !== lastTriggeredMin) {
        const day = now.getDay();
        const due = alarms.find(a => a.enabled && a.time === hhmm && (!a.days || a.days.length === 0 || a.days.includes(day)));
        if (due) { lastTriggeredMin = stamp; triggerAlarm(due); }
      }
    }, 500);
    render();
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'eveil.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
