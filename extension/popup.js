const $ = (id) => document.getElementById(id);
const send = (type) => chrome.runtime.sendMessage({ type });
let st = {};
function render() {
  const left = Math.max(0, st.endsAt - Date.now());
  $('time').textContent = st.phase === 'idle' ? '--:--'
    : String(Math.floor(left / 60000)).padStart(2, '0') + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0');
  $('phase').textContent = { idle: 'Đang rảnh', work: 'Đang làm việc', break: 'Đang nghỉ với mèo' }[st.phase] || '';
}
async function load() {
  st = await chrome.storage.local.get(null);
  for (const k of ['workMin', 'breakMin', 'volume']) $(k).value = st[k];
  $('catOn').checked = st.catOn !== false;
  render();
}
$('start').onclick = () => send('start').then(load);
$('stop').onclick = () => send('stop').then(load);
$('test').onclick = () => send('test-break').then(() => window.close());
for (const k of ['workMin', 'breakMin', 'volume'])
  $(k).onchange = () => chrome.storage.local.set({ [k]: Number($(k).value) });
$('catOn').onchange = () => chrome.storage.local.set({ catOn: $('catOn').checked });
chrome.storage.onChanged.addListener(load);
setInterval(render, 500);
load();
