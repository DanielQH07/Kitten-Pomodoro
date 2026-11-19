const $ = (id) => document.getElementById(id);
const K = window.kitten;

function render() {
  const s = K.get();
  const left = Math.max(0, s.endsAt - Date.now());
  $('time').textContent = s.phase === 'idle' ? '--:--'
    : String(Math.floor(left / 60000)).padStart(2, '0') + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0');
  $('phase').textContent = { idle: 'Đang rảnh', work: 'Đang làm việc', break: 'Đang nghỉ với mèo' }[s.phase] || '';
  // hết giờ thì tự chuyển pha (làm -> nghỉ -> làm)
  if (s.phase !== 'idle' && left === 0) {
    if (s.phase === 'work' && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Hết giờ làm việc!', { body: 'Mèo đang tới. Nghỉ ngơi một chút nhé.' }); } catch (e) {}
    }
    K.startPhase(s.phase === 'work' ? 'break' : 'work');
  }
}

const s0 = K.get();
for (const k of ['workMin', 'breakMin', 'volume']) {
  $(k).value = s0[k];
  $(k).onchange = () => K.set({ [k]: Number($(k).value) });
}
$('catOn').checked = s0.catOn !== false;
$('catOn').onchange = () => K.set({ catOn: $('catOn').checked });
$('start').onclick = () => {
  K.startPhase('work');
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
};
$('stop').onclick = () => K.stop();
$('test').onclick = () => K.startPhase('break');
setInterval(render, 500); render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
