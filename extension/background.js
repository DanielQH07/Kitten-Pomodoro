// Pomodoro state machine. State: {phase:'idle'|'work'|'break', endsAt, work, rest}
const DEFAULTS = { phase: 'idle', endsAt: 0, workMin: 25, breakMin: 5, catOn: true, volume: 0.5 };

async function getState() { return { ...DEFAULTS, ...(await chrome.storage.local.get(null)) }; }

async function startPhase(phase) {
  const s = await getState();
  const min = phase === 'work' ? s.workMin : s.breakMin;
  const endsAt = Date.now() + min * 60000;
  await chrome.storage.local.set({ phase, endsAt });
  chrome.alarms.create('phase-end', { when: endsAt });
}

async function stop() {
  await chrome.storage.local.set({ phase: 'idle', endsAt: 0 });
  chrome.alarms.clear('phase-end');
}

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== 'phase-end') return;
  const s = await getState();
  if (s.phase === 'work') {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: 'Hết giờ làm việc!', message: 'Mèo đang tới. Nghỉ ngơi một chút nhé.' });
    startPhase('break');
  } else if (s.phase === 'break') {
    startPhase('work');
  }
});

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  (async () => {
    if (msg.type === 'start') await startPhase('work');
    else if (msg.type === 'stop') await stop();
    else if (msg.type === 'skip-break') await startPhase('work');
    else if (msg.type === 'test-break') await startPhase('break');
    reply({ ok: true });
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(null);
  await chrome.storage.local.set({ ...DEFAULTS, ...cur });
});
