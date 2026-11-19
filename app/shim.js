// Giả lập chrome.* (storage + runtime) trên localStorage để dùng lại nguyên extension/content.js trong app web.
(() => {
  const KEY = 'kitten-pomodoro-state';
  const DEFAULTS = { phase: 'idle', endsAt: 0, workMin: 25, breakMin: 5, catOn: true, volume: 0.5 };
  let data;
  try { data = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { data = { ...DEFAULTS }; }
  const listeners = [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };

  async function set(obj) {
    const ch = {};
    for (const k in obj) { if (data[k] !== obj[k]) ch[k] = { oldValue: data[k], newValue: obj[k] }; data[k] = obj[k]; }
    save();
    if (Object.keys(ch).length) listeners.forEach((f) => f(ch));
  }
  window.kitten = {
    get: () => ({ ...data }),
    set,
    startPhase(phase) {
      const min = phase === 'work' ? data.workMin : data.breakMin;
      return set({ phase, endsAt: Date.now() + min * 60000 });
    },
    stop: () => set({ phase: 'idle', endsAt: 0 }),
  };
  window.chrome = {
    runtime: {
      id: 'shim', getURL: (p) => p,
      sendMessage: (m) => { if (m.type === 'skip-break') window.kitten.startPhase('work'); },
    },
    storage: { local: { get: async () => ({ ...data }), set }, onChanged: { addListener: (f) => listeners.push(f) } },
  };
})();
