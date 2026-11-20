// Kitten Pomodoro v2 — engine mèo dùng clip WebM trong suốt (MiniMax H3). Bản xem thử chạy trên localhost / điện thoại.
// Mô hình: mèo ở 1 trong các TƯ THẾ (stand/sit/lie/belly/held); mỗi CLIP đi từ tư thế này sang tư thế khác.
(() => {
  const FW = 1344, FH = 768, AX = 580, FEET = 716;           // khung clip; điểm neo (giữa thân, chân) trong khung
  const CAT_LEN = 940, CAT_H = 536;                          // thân mèo đứng (px trong khung)
  const MODE = document.documentElement.dataset.mode || 'web', FREE_AUDIO = MODE === 'overlay' || !!window.Capacitor;      // cửa sổ trong suốt / app Android: tự phát được tiếng
  const SMALL = Math.min(innerWidth, innerHeight) < 600;
  const BOT = () => 0, HV = () => innerHeight;
  const ROAM = (SMALL ? 0.22 : 0.3) * 1.15, SPEED = 95;      // to hơn bản trước 15%
  const EDGE_ANGLE = { 0: 0, 1: -90, 3: 90 };
  const POSE_OF = { stand_right: 'stand', stand_left: 'stand', sit_front: 'sit', lie_side: 'lie', belly_up: 'belly', held: 'held', walk: 'stand' };
  const POSE_IMG = { stand: 'stand_right', sit: 'sit_front', lie: 'lie_side', belly: 'belly_up', held: 'held' };
  const BOTTOM = { stand: 716, sit: 724, lie: 668, belly: 612 };
  const HEAD = { stand: [1000, 250], sit: [560, 230], lie: [1080, 380], belly: [300, 430], held: [640, 140] };   // vị trí đầu trong khung (để đặt biểu cảm)
  const GRIP = [644, 70];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm180 = (a) => ((a + 540) % 360) - 180;
  const now_ = () => performance.now();
  const $ = (s) => document.querySelector(s);

  const stage = $('#stage'), catEl = $('#cat'), shadow = $('#shadow'), dim = $('#dim'), bubble = $('#bubble');
  const probe = document.createElement('canvas'); probe.width = 168; probe.height = 96;
  const pctx = probe.getContext('2d', { willReadFrequently: true });

  const S = window.KS;
  let state = S.get(), blocking = false, tool = 'hand';
  const ptr = { x: innerWidth / 2, y: innerHeight / 2, t: -1e9, vx: 0, vy: 0, inside: false, down: false, jab: 0, touch: false };

  // ---------- Thống kê / độ thân thiết ----------
  const BKEY = 'kitten2-bond';
  let bond; try { bond = { xp: 0, pets: 0, catches: 0, treats: 0, ...JSON.parse(localStorage.getItem(BKEY) || '{}') }; } catch (e) { bond = { xp: 0, pets: 0, catches: 0, treats: 0 }; }
  let session = { pets: 0, catches: 0, treats: 0, belly: 0 };
  const level = () => Math.floor(Math.sqrt(bond.xp / 8)) + 1;          // Lv2 = 8xp, Lv3 = 32xp, Lv4 = 72xp...
  const lvXp = (l) => 8 * (l - 1) * (l - 1);
  function gain(xp) {
    const before = level(); bond.xp += xp;
    try { localStorage.setItem(BKEY, JSON.stringify(bond)); } catch (e) {}
    renderBond();
    if (level() > before) { toast(`Mèo thân với bạn hơn rồi! ❤ Lv ${level()}`); const [x, y] = headScreen(); hearts(x, y, 7); meow(true); }
  }
  function renderBond() {
    const l = level(), a = lvXp(l), b = lvXp(l + 1);
    if (window.KS_bond) window.KS_bond();
    $('#bondLv').textContent = 'Lv ' + l; $('#bondBar').style.width = Math.round(100 * (bond.xp - a) / (b - a)) + '%';
  }
  let toastTimer = 0;
  function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms); }

  // ---------- Âm thanh ----------
  const A = { ac: null, master: null, buf: {}, purr: null, music: null, last: {}, purrGain: 1 };
  const SOUNDS = ['meow1', 'meow2', 'meow3', 'meow4', 'meow5', 'purr', 'scratch', 'hiss', 'chirp1', 'chirp2', 'trill1', 'trill2',
    'thump', 'swish1', 'swish2', 'rustle1', 'rustle2', 'music'];
  function audio() {
    if (!A.ac) {
      if (!FREE_AUDIO && !(navigator.userActivation && navigator.userActivation.hasBeenActive)) return null;
      A.ac = new AudioContext(); A.master = A.ac.createGain(); A.master.connect(A.ac.destination);
      SOUNDS.forEach((n) => fetch(`sounds/${n}.mp3`).then((r) => r.arrayBuffer()).then((b) => A.ac.decodeAudioData(b)).then((d) => {
        A.buf[n] = d; if (n === 'purr' && A.wantPurr) purr(true); if (n === 'music' && state.music && blocking) musicOn(true);
      }).catch(() => {}));
    }
    A.master.gain.value = state.volume;
    if (A.ac.state === 'suspended') A.ac.resume().catch(() => {});
    return A.ac;
  }
  function sfx(name, gain = 1, rate = 1, minGap = 0) {
    const ac = audio(); if (!ac || ac.state !== 'running') return;
    const n = now_(); if (minGap && n - (A.last[name] || 0) < minGap) return; A.last[name] = n;
    const b = A.buf[name]; if (!b) return;
    const src = ac.createBufferSource(); src.buffer = b; src.playbackRate.value = rate * rnd(0.96, 1.04);
    const g = ac.createGain(); g.gain.value = gain; src.connect(g).connect(A.master); src.start();
  }
  const meow = (loud) => sfx(pick(['meow1', 'meow2', 'meow3', 'meow4', 'meow5']), loud ? 1.15 : 0.6, 1, loud ? 700 : 7000);
  function loopSound(key, name, on, gain, fade) {
    const ac = audio();
    if (on) {
      if (A[key] || !ac || !A.buf[name]) return;
      const src = ac.createBufferSource(); src.buffer = A.buf[name]; src.loop = true;
      const g = ac.createGain(); g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(gain, ac.currentTime + fade);
      src.connect(g).connect(A.master); src.start(); A[key] = { src, g };
    } else if (A[key] && ac) {
      const { src, g } = A[key]; A[key] = null;
      g.gain.cancelScheduledValues(ac.currentTime); g.gain.setValueAtTime(g.gain.value, ac.currentTime);
      g.gain.linearRampToValueAtTime(0, ac.currentTime + fade);
      setTimeout(() => { try { src.stop(); } catch (e) {} }, fade * 1000 + 100);
    }
  }
  const purr = (on) => { A.wantPurr = on; loopSound('purr', 'purr', on, 1.0, on ? 1.2 : 1.0); };
  function purrLouder() {      // xoa liên tục: gừ to dần
    A.purrGain = Math.min(1.8, A.purrGain + 0.15); A.purrBoostUntil = now_() + 6000;
    if (A.purr && A.ac) A.purr.g.gain.setTargetAtTime(A.purrGain, A.ac.currentTime, 0.3);
    updatePurr();
  }
  const musicOn = (on) => loopSound('music', 'music', on, 0.9, 3);

  // ---------- Tải clip ----------
  const clips = {}, posesImg = {}, variants = {};
  let layerZ = 1, curLayer = null;
  const mkLayer = (el) => { el.className = 'layer'; el.style.opacity = 0; catEl.appendChild(el); return el; };
  async function loadAll() {
    const man = await (await fetch('clips/manifest.json')).json();
    const pending = [];
    for (const [id, m] of Object.entries(man)) {
      const v = mkLayer(document.createElement('video'));
      v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; pending.push([v, `clips/${id}.webm`]);
      if (m.zoom && m.zoom !== 1) { v.style.transformOrigin = `${AX}px ${FEET}px`; v.style.transform = `scale(${m.zoom})`; }
      clips[id] = { id, meta: m, el: v, dur: m.dur, zoom: m.zoom || 1, from: POSE_OF[m.start] || 'stand', to: POSE_OF[m.end] || 'stand' };
      const base = m.variant_of || id; (variants[base] = variants[base] || []).push(id);
    }
    for (const [name, file] of Object.entries(POSE_IMG)) {
      const i = mkLayer(new Image()); i.src = `clips/pose_${file}.webp`; i.classList.add('pose'); posesImg[name] = i;
    }
    // Tải trọn từng clip thành blob (không giữ 36 kết nối mở, tua tức thì, chạy tốt cả trên điện thoại)
    let done = 0; const queue = pending.slice();
    await Promise.all(Array.from({ length: 6 }, async () => {
      for (let it; (it = queue.shift());) {
        try { it[0].src = URL.createObjectURL(await (await fetch(it[1])).blob()); } catch (err) { it[0].src = it[1]; }
        $('#loading').textContent = `Đang tải clip ${++done}/${pending.length}…`;
      }
    }));
    $('#loading').textContent = '';
  }
  const vid = (id) => pick(variants[id] || [id]);        // chọn ngẫu nhiên 1 trong các bản (seed) của clip
  function show(el) {
    if (curLayer === el) return;
    const prev = curLayer; curLayer = el;
    el.style.zIndex = ++layerZ; el.style.opacity = 1;
    if (prev) { prev.style.opacity = 0; if (prev.tagName === 'VIDEO') prev.pause(); }     // đổi lớp tức thì (không chồng 2 con mèo)
  }

  // ---------- Mèo ----------
  const cat = { mode: 'idle', pose: 'stand', edge: 0, u: 200, dir: 1, scale: ROAM, px: 0, py: 0, angle: 0, started: false,
    idleT: 0, idleDur: 1, clip: null, clipEl: null, cues: [], onend: null, move: null, walkT: 0, walkFor: 5, wantFloor: false,
    wallTop: 0, jump: null, held: null, heldSince: 0, flipSign: 1, turnA: null, hop: 0, fast: false, energy: 100, restUntil: 0,
    last: {}, pets: [], noticed: false };
  let lastT = now_();
  const floorY = (vh) => (cat.floor ? cat.shelfY : vh);      // tầng 0: đáy màn hình, tầng 1: "kệ" vô hình ở nửa trên
  const anchor = (e, u, vw, vh) => (e === 0 ? [u, floorY(vh)] : e === 1 ? [vw, vh - u] : [0, u]);
  const upDir = () => (cat.edge === 1 ? 1 : -1);
  const catW = () => CAT_LEN * cat.scale, catH = () => CAT_H * cat.scale;
  const cd = (k, s) => { const n = now_(); if (n - (cat.last[k] || 0) < s * 1000) return false; cat.last[k] = n; return true; };

  function setPose(p) {
    cat.mode = 'idle'; cat.pose = p; cat.idleT = 0; cat.clip = null; cat.clipEl = null; cat.onend = null; cat.move = null; cat.fast = false;
    cat.idleDur = { stand: rnd(1.2, 3), sit: rnd(3, 6), lie: rnd(9, 16), belly: rnd(4, 7), held: 99 }[p];
    if (target() && (p === 'stand' || p === 'sit')) cat.idleDur = 0.12;
    if (p === 'lie' && clips.sleep) {        // ngủ: video thở đều lặp lại thay cho ảnh tĩnh
      const el = clips.sleep.el; el.loop = true; el.playbackRate = 1; cat.clip = 'sleep'; cat.clipEl = el;
      if (el.paused) el.play().then(() => { if (cat.clipEl === el) show(el); }).catch(() => show(posesImg.lie)); else show(el);
    } else show(posesImg[p]);
    updatePurr();
  }
  // phát clip; o: {cues:[[giây,fn]], move(t), onend, rate, loop}
  function play(id, o = {}) {
    const c = clips[id]; if (!c) return setPose(cat.pose);
    cat.mode = 'clip'; cat.clip = id; cat.clipEl = c.el; cat.cues = (o.cues || []).map(([t, fn]) => [t, fn, false]);
    cat.onend = o.onend || (() => setPose(c.to)); cat.move = o.move || null; cat.clipDur = c.dur; cat.pose = c.to; cat.loop = !!o.loop;
    const el = c.el; el.loop = !!o.loop; el.playbackRate = o.rate || 1;
    try { el.currentTime = o.start || 0; } catch (e) {}
    el.play().then(() => {
      if (el.requestVideoFrameCallback) el.requestVideoFrameCallback(() => { if (cat.clipEl === el) show(el); });
      else setTimeout(() => { if (cat.clipEl === el) show(el); }, 60);
    }).catch(() => { if (cat.clipEl === el) setPose(c.to); });
    updatePurr();
  }
  const cue = (id, name, frac) => { const c = clips[id]; return c && c.meta.cues && c.meta.cues[name] != null ? c.meta.cues[name] : c ? c.dur * frac : 0; };

  function updatePurr() {
    const c = cat.clip || '';
    const want = (blocking && cat.pose === 'sit' && cat.mode === 'idle' && cat.idleT > 1) || /^(pet|pet_sit|knead|belly_kick|headbutt)/.test(c) ||
      (cat.mode === 'idle' && (cat.pose === 'lie' || cat.pose === 'belly')) || now_() < (A.purrBoostUntil || 0);
    if (want !== !!A.wantPurr) { if (!want) A.purrGain = 1; purr(want); }
  }

  // ---------- Hiệu ứng ----------
  const fx = (cls, x, y, css = '', life = 1200, txt = '') => {
    const d = document.createElement('div'); d.className = 'fx ' + cls; d.textContent = txt;
    d.style.cssText = `left:${x}px;top:${y}px;${css}`; stage.appendChild(d); setTimeout(() => d.remove(), life); return d;
  };
  function hearts(x, y, n = 3) {
    for (let i = 0; i < n; i++) fx('heart', x - 12 + (i - (n - 1) / 2) * 22, y - 20, `animation-delay:${i * 0.1}s;--dx:${(i - (n - 1) / 2) * 16}px`, 1700, ['❤', '💗', '💕'][i % 3]);
  }
  function dust(x, y, n = 7, dir = 0) {
    const k = Math.max(0.6, cat.scale / ROAM);
    for (let i = 0; i < n; i++) {
      const d = dir || (i % 2 ? 1 : -1);
      fx('dust', x + rnd(-10, 10) * k, y - 4, `--dx:${d * rnd(20, 60) * k}px;--dy:${-rnd(4, 22) * k}px;width:${rnd(10, 22) * k}px;height:${rnd(10, 22) * k}px`, 800);
    }
  }
  function sparkle(x, y) { for (let i = 0; i < 7; i++) fx('spark', x, y, `--dx:${rnd(-80, 80)}px;--dy:${rnd(-80, 20)}px;animation-delay:${i * 0.04}s`, 1000, pick(['✨', '⭐', '✨'])); }
  function shake() { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
  function frameToScreen(fx_, fy_) {
    const a = cat.angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), k = cat.scale;
    const x = (fx_ - AX) * k * cat.flipSign, y = (fy_ - FEET) * k;
    return [cat.px + x * c - y * s, cat.py + cat.hop + x * s + y * c];
  }
  function screenToFrame(sx, sy) {
    const a = cat.angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = sx - cat.px, dy = sy - cat.py - cat.hop;
    return [((dx * c + dy * s) / cat.scale) * (cat.flipSign < 0 ? -1 : 1) + AX, (-dx * s + dy * c) / cat.scale + FEET];
  }
  const feetScreen = () => frameToScreen(AX, BOTTOM[cat.pose] || FEET);
  const headScreen = () => frameToScreen(...(HEAD[cat.pose] || HEAD.stand));
  function landFx(strong = 1) { const [x, y] = feetScreen(); dust(x, y, 6 + 3 * strong); sfx('thump', 0.7 + 0.3 * strong); if (blocking && strong > 0.5) shake(); }
  // biểu cảm trên đầu (❗ ❤ 💤 😾 …)
  const moodEl = $('#mood'); let moodUntil = 0;
  function mood(e, ms = 1400) { moodEl.textContent = e; moodEl.classList.remove('pop'); void moodEl.offsetWidth; moodEl.classList.add('pop'); moodUntil = now_() + ms; }

  // ---------- Hộp bao + vùng chạm ----------
  let probeCache = null;
  function probeCat() {
    if (!curLayer) return null;
    const key = curLayer.tagName === 'VIDEO' ? curLayer.currentTime : -1, n = now_();
    if (probeCache && probeCache.el === curLayer && probeCache.key === key && n - probeCache.t < 120) return probeCache.p;
    const p = probeRaw(); probeCache = { el: curLayer, key, t: n, p }; return p;
  }
  function probeRaw() {
    try {
      const z = (curLayer.tagName === 'VIDEO' && clips[cat.clip] && clips[cat.clip].el === curLayer && clips[cat.clip].zoom) || 1;
      pctx.clearRect(0, 0, 168, 96); pctx.drawImage(curLayer, (AX - AX * z) / 8, (FEET - FEET * z) / 8, 168 * z, 96 * z);
      const d = pctx.getImageData(0, 0, 168, 96).data;
      let x0 = 168, x1 = 0, y0 = 96, y1 = 0;
      for (let y = 0; y < 96; y++) for (let x = 0; x < 168; x++) if (d[(y * 168 + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 > x0 ? { d, x0: x0 * 8, x1: x1 * 8, y0: y0 * 8, y1: y1 * 8 } : null;
    } catch (e) { return null; }
  }
  // 'head' | 'body' | 'tail' | null
  function zoneAt(x, y, pad = 1) {
    const [lx, ly] = screenToFrame(x, y);
    if (lx < 0 || ly < 0 || lx >= FW || ly >= FH) return null;      // ngoài khung mèo: khỏi dò ảnh (rẻ, gọi được ở mỗi lần di chuột)
    const p = probeCat(); if (!p) return null;
    const px = (lx / 8) | 0, py = (ly / 8) | 0; let hit = false;
    for (let j = -pad; j <= pad && !hit; j++) for (let i = -pad; i <= pad; i++) {
      const xx = px + i, yy = py + j; if (xx >= 0 && yy >= 0 && xx < 168 && yy < 96 && p.d[(yy * 168 + xx) * 4 + 3] > 40) { hit = true; break; }
    }
    if (!hit) return null;
    const bw = p.x1 - p.x0, bh = p.y1 - p.y0, pose = cat.pose;
    if (pose === 'sit') {
      if (ly < p.y0 + 0.42 * bh && Math.abs(lx - 560) < 0.3 * bw) return 'head';
      return lx < p.x0 + 0.3 * bw && ly > p.y0 + 0.7 * bh ? 'tail' : 'body';
    }
    if (pose === 'lie') return lx > p.x1 - 0.36 * bw ? 'head' : lx < p.x0 + 0.22 * bw ? 'tail' : 'body';
    if (pose === 'belly' || pose === 'held') return 'body';
    if (lx > p.x1 - 0.34 * bw && ly < p.y0 + 0.62 * bh) return 'head';
    return lx < p.x0 + 0.26 * bw ? 'tail' : 'body';
  }

  // ---------- Di chuyển trên cạnh màn hình ----------
  function moveAlong(dist, W, vw, vh) {
    cat.u += cat.dir * dist;
    if (cat.edge === 0) {
      const lo = cat.exit || cat.enter ? -W : Math.min(W * 0.36, vw / 2), hi = vw - lo;          // cho phép thò 1 phần ra ngoài mép
      if (cat.u >= hi) { cat.u = hi; return 'end'; }
      if (cat.u <= lo) { cat.u = lo; return 'end'; }
      return null;
    }
    const lo = Math.min(W / 2, vh / 2), top = Math.max(lo, Math.min(cat.wallTop, vh - lo));
    let h = cat.edge === 1 ? cat.u : vh - cat.u, res = null;
    if (h >= top) { h = top; res = 'top'; } else if (h <= lo) { h = lo; res = 'bottom'; }
    cat.u = cat.edge === 1 ? h : vh - h; return res;
  }
  function startJump(edge, u, dir, vw, vh, H, floor = 0, shelfY = cat.shelfY) {
    let [x, y] = anchor(edge, u, vw, vh); if (edge === 0) y = floor ? shelfY : vh;
    const up = Math.max(0, cat.py - y);
    cat.jump = { t: 0, dur: 0.6 + Math.min(0.35, up / 1400), from: { x: cat.px, y: cat.py, a: cat.angle }, to: { edge, u, dir, x, y, a: EDGE_ANGLE[edge], floor, shelfY }, arc: Math.max(60, H * 0.45) + up * 0.25 };
    cat.mode = 'jump'; cat.dir = dir; cat.turnA = null; playWalkLoop(1); meow(false);
  }
  const jumpToWall = (vw, vh, W, H) => { const e = cat.dir > 0 ? 1 : 3, lo = Math.min(W / 2, vh / 2); cat.wallTop = Math.max(W + 40, vh * rnd(0.4, 0.8)); startJump(e, e === 1 ? lo : vh - lo, e === 1 ? 1 : -1, vw, vh, H); };
  const jumpToFloor = (vw, vh, W, H) => { const r = cat.edge === 1, lo = Math.min(W / 2, vw / 2); startJump(0, r ? vw - lo - 0.15 * W : lo + 0.15 * W, r ? -1 : 1, vw, vh, H); };

  // quay trái/phải: nhảy nhẹ một cái và lật hướng (0,3 giây)
  function turnTo(d) {
    if (!d || d === cat.dir || cat.turnA) return false;
    if (clips.turn && cat.mode === 'idle' && cat.pose === 'stand' && cat.edge === 0) {     // có clip quay đầu thật (H3) thì dùng
      play('turn', { rate: target() ? 2 : 1.4, onend: () => { cat.dir = d; setPose('stand'); } }); return true;
    }
    cat.turnA = { t: 0, dur: 0.3, from: cat.dir }; cat.dir = d;
    if (cat.edge === 0 && cat.mode !== 'held') { const [x, y] = feetScreen(); dust(x, y, 3); }
    return true;
  }
  function playWalkLoop(rate) {
    const c = clips.walk; if (!c) return;
    cat.clip = 'walk'; cat.clipEl = c.el; c.el.loop = true; c.el.playbackRate = rate;
    if (c.el.paused) c.el.play().catch(() => {});
    show(c.el); cat.cues = []; cat.loop = true;
  }
  function startWalk(dir, fast = false) {
    cat.mode = 'walk'; cat.pose = 'stand'; cat.walkT = 0; cat.walkFor = rnd(4, 10); cat.fast = fast;
    cat.onend = null; cat.move = null; if (dir && dir !== cat.dir) turnTo(dir);
    playWalkLoop(fast ? 1.8 : 1); updatePurr();
  }

  // ---------- Hành động ----------
  const tired = (n) => { cat.energy = Math.max(0, cat.energy - n); };
  const ACT = {
    standToSit: (then) => play('stand_to_sit', { rate: target() ? 1.6 : 1, onend: () => { setPose('sit'); then && then(); } }),
    sitToStand: (then) => play('sit_to_stand', { rate: target() ? 1.7 : 1, onend: () => { setPose('stand'); then && then(); } }),
    lieDown: (then) => play('lie_down', { onend: () => { setPose('lie'); then && then(); } }),
    getUp: () => play('get_up', { rate: target() ? 1.9 : 1 }),
    groom: () => play('groom'),
    knead: () => play('knead', { cues: [[0.5, () => mood('💗', 1600)]] }),
    watch: () => play('watch_track', { cues: [[0.4, () => sfx(pick(['chirp1', 'chirp2']), 0.7, 1, 4000)]] }),
    swat: () => { tired(3); play('swat', { cues: [[cue('swat', 'swish', 0.3), () => sfx('swish2', 1)]] }); },
    bite: (onBite) => { tired(3); play('catch_bite', { cues: [[cue('catch_bite', 'bite', 0.65), () => { const [x, y] = frameToScreen(AX + 120, 650); sparkle(x, y); sfx(pick(['trill1', 'trill2']), 0.9); onBite && onBite(); }]] }); },
    headbutt: () => play('headbutt', { cues: [[0.5, () => meow(false)], [1.2, () => { const [x, y] = headScreen(); hearts(x, y, 2); }]] }),
    reach: () => { tired(4); play('reach_up', { cues: [[cue('reach_up', 'swish', 0.3), () => sfx('swish1', 0.8)], [0.2, () => sfx(pick(['chirp1', 'chirp2']), 0.7, 1, 3000)]] }); },
    scratch: () => play('scratch', { cues: [[0.25, () => sfx('hiss', 0.45, 1, 1500)], [cue('scratch', 'swish', 0.4), () => sfx('swish2', 0.8)]] }),
    crouchPounce: (getX) => { if (Math.random() < 0.35) return ACT.pounce(getX); play(vid('crouch_wiggle'), { rate: 1.3, cues: [[0.3, () => mood('❗', 900)]], onend: () => ACT.pounce(getX) }); },
    pounce: (getX) => {
      const id = vid('pounce'); if (!clips[id]) return setPose('stand');
      tired(12);
      const tx = typeof getX === 'function' ? getX() : getX;
      const dx = tx == null ? cat.dir * catW() * 0.5 : tx - cat.px;
      if (Math.sign(dx) && Math.sign(dx) !== cat.dir) { cat.dir = Math.sign(dx); }
      const dist = clamp(dx, -catW() * 1.6, catW() * 1.6), t0 = cue(id, 'move0', 0.3), t1 = cue(id, 'move1', 0.5), u0 = cat.u;
      play(id, {
        cues: [[cue(id, 'swish', 0.3), () => { sfx('swish1', 1); meow(false); }], [cue(id, 'thump', 0.5), () => { landFx(0.7); caught(); }]],
        move: (t) => { const p = clamp((t - t0) / (t1 - t0), 0, 1), e = p * p * (3 - 2 * p); cat.u = u0 + dist * e; },
      });
    },
    run: (tx, after) => {   // phi nhanh tới tx (tua nhanh clip run)
      const id = vid('run'); if (!clips[id]) return startWalk(Math.sign(tx - cat.px), true);
      tired(8);
      const dx = tx - cat.px; cat.dir = Math.sign(dx) || cat.dir;
      const dist = Math.sign(dx) * Math.min(Math.abs(dx), catW() * 4), u0 = cat.u, dur = clips[id].dur;
      let lastDust = 0;
      play(id, { rate: 1.3, onend: after || null,
        move: (t) => { const p = clamp(t / dur, 0, 1), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; cat.u = u0 + dist * e;
          if (t - lastDust > 0.18 && p > 0.1 && p < 0.9) { lastDust = t; const [x, y] = feetScreen(); dust(x - cat.dir * catW() * 0.3, y, 2, -cat.dir); } } });
    },
    // ăn: mèo đứng cúi xuống ăn (clip eat); chưa có clip thì ngồi xuống rồi ngoạm
    eat: (onEat) => clips.eat ? play('eat', { cues: [[clips.eat.dur * 0.35, () => { sfx(pick(['trill1', 'trill2']), 0.7); onEat && onEat(); }]] })
      : ACT.standToSit(() => ACT.bite(onEat)),
    // meme (hành động ngẫu nhiên): đi vài bước rồi ngồi xuống như trong clip meme
    meme: () => {
      const c = clips.meme; if (!c) return ACT.standToSit();
      const ws = c.meta.walk_sec || 3.8, sp = SPEED * Math.pow(cat.scale / ROAM, 0.6); let lt = 0;
      play('meme', { move: (t) => { const d = Math.max(0, Math.min(t, ws) - lt); lt = Math.min(t, ws);
        const W = catW(), lo = Math.min(W * 0.36, innerWidth / 2); cat.u = clamp(cat.u + cat.dir * sp * d, lo, innerWidth - lo); } });
    },
    bellyRoll: () => play('belly_roll', { cues: [[cue('belly_roll', 'thump', 0.45), () => sfx('thump', 0.5)], [1.5, () => mood('💗', 1500)]] }),
    bellyKick: (n = 2) => { let k = 0; const go = () => play('belly_kick', { onend: () => { if (++k < n) go(); else setPose('belly'); }, cues: [[0.2, () => meow(false)]] }); go(); },
    bellyReturn: () => play('belly_return', { rate: target() ? 1.8 : 1 }),
    zoomies: (n = 3) => {   // chạy loạn: phi qua lại vài lần
      mood('⚡', 1000); meow(true); cat.zoom = true;
      const vw = innerWidth; let k = 0;
      const go = () => {
        if (k++ >= n || target()) { cat.zoom = false; return setPose('stand'); }
        const goal = cat.u < vw / 2 ? rnd(vw * 0.65, vw * 0.9) : rnd(vw * 0.1, vw * 0.35);
        if (Math.sign(goal - cat.u) !== cat.dir) turnTo(Math.sign(goal - cat.u));
        setTimeout(() => ACT.run(goal, () => { setPose('stand'); cat.idleDur = 99; setTimeout(go, 250); }), 320);
      };
      go();
    },
  };
  // nhảy lên kệ ở nửa trên màn hình / nhảy xuống đáy
  function hopLevel(floor, toward) {
    const vw = innerWidth, vh = HV(), W = catW(), H = catH();
    if (cat.edge !== 0 || cat.mode === 'held' || cat.mode === 'fall') return false;
    if (cat.pose === 'sit') { ACT.sitToStand(() => hopLevel(floor, toward)); return true; }
    if (cat.pose !== 'stand') return false;
    const lo = Math.min(W * 0.36, vw / 2), dir = toward != null ? (Math.sign(toward - cat.u) || cat.dir) : cat.dir;
    const u = clamp(toward != null ? toward : cat.u + dir * W * rnd(0.5, 0.9), lo, vw - lo);
    const shelfY = floor ? clamp(cat.wantShelf || vh * rnd(0.36, 0.5), H * 1.15, vh * 0.55) : cat.shelfY;
    if (Math.sign(u - cat.u) && Math.sign(u - cat.u) !== cat.dir) cat.dir = Math.sign(u - cat.u);
    cat.wantShelf = 0; setPose('stand'); sfx(pick(['swish1', 'swish2']), 0.6); if (Math.random() < 0.4) meow(false);
    startJump(0, u, cat.dir, vw, vh, H, floor, shelfY); cat.jump.level = true; cat.u = u;
    return true;
  }
  function caught() {   // vồ xong: rơi gần đồ chơi -> bắt được
    const tg = target(); if (!tg || tg.kind === 'treat') return;
    if (Math.abs(tg.x - cat.px) < catW() * 0.7) {
      sparkle(tg.x, tg.y); sfx(pick(['trill1', 'trill2']), 0.9); toyHide = now_() + 900;
      session.catches++; bond.catches++; gain(3);
      const c = ++combo.n; combo.t = now_(); toast(c > 1 ? `Bắt được! x${c} 🔥` : 'Bắt được! ✨', 1600);
    }
  }
  const combo = { n: 0, t: 0 };
  let toyHide = 0;

  // ---------- Đồ chơi: laser / cần câu / bánh thưởng ----------
  const toyActive = () => (tool === 'laser' || tool === 'feather') && ptr.inside && now_() - ptr.t < (ptr.touch ? 6000 : 5000);
  function target() {
    if (treats.length) { const t = treats[0]; return { x: t.x, y: HV() - 10, kind: 'treat' }; }
    if (!toyActive()) return null;
    if (tool === 'laser') return { x: ptr.x, y: ptr.y, kind: 'laser' };
    return { x: wand.fx, y: wand.fy, kind: 'feather' };
  }
  function toyDecide(tg) {
    if (cat.edge !== 0) { cat.wantFloor = true; return false; }
    if (cat.turnA) return true;
    const dx = tg.x - cat.px, adx = Math.abs(dx), face = Math.sign(dx) || cat.dir, W = catW();
    const rel = (cat.py - tg.y) / catH(), feather = tg.kind === 'feather', moving = now_() - ptr.t < 600;
    if (!cat.noticed) { cat.noticed = true; mood('❗', 900); sfx(pick(['chirp1', 'chirp2']), 0.7, 1, 3000); }
    {
      const vh = HV(), want = tg.kind === 'treat' || tg.y > vh * 0.55 ? 0 : 1;
      if (want !== (cat.floor || 0) && cd('hop', 2.5)) { cat.wantShelf = want ? tg.y + catH() * 0.9 : 0; if (hopLevel(want, tg.x - face * W * 0.45)) return true; }
    }
    if (tg.kind === 'treat') {            // đi bộ tới chỗ cá rồi cúi xuống ăn
      if (cat.pose === 'sit') { ACT.sitToStand(); return true; }
      if (face !== cat.dir && adx > W * 0.15) { turnTo(face); return true; }
      if (adx > W * 0.4) { startWalk(face, adx > W * 1.8); return true; }
      ACT.eat(eatTreat); return true;
    }
    if (cat.energy < 20 && now_() > cat.restUntil) {     // mệt: nằm nghỉ, xoa đầu cho mau lại sức
      cat.restUntil = now_() + 15000; mood('💤', 2000);
      if (cat.pose === 'stand') ACT.lieDown(); else ACT.sitToStand(() => ACT.lieDown()); return true;
    }
    if (now_() < cat.restUntil) return false;
    if (cat.pose === 'sit') {
      if (feather && ptr.jab && now_() - ptr.jab < 500 && adx < W * 0.9 && cd('act', 1.2)) { ptr.jab = 0; ACT.bite(); return true; }
      if (rel > 0.6 || adx > W * 0.9) { ACT.sitToStand(); return true; }
      if (adx < W * 0.8 && cd('act', 1.6)) { Math.random() < 0.6 ? ACT.swat() : ACT.watch(); return true; }
      if (moving && cd('watch', 3)) { ACT.watch(); return true; }
      return false;
    }
    if (cat.pose !== 'stand') return false;
    if (face !== cat.dir && adx > W * 0.2) { turnTo(face); return true; }
    if (adx > W * 2.2) { ACT.run(tg.x - face * W * 0.5); return true; }
    if (adx > W * 0.95) { startWalk(face, true); return true; }
    if (!cd('act', 0.6)) return false;
    const tx = () => (target() ? target().x : null);
    if (feather && rel > 0.8) { ACT.reach(); return true; }
    if (feather && ptr.jab && now_() - ptr.jab < 500) { ptr.jab = 0; ACT.pounce(tx); return true; }
    if (!feather || rel < 0.4) { ACT.crouchPounce(tx); return true; }
    const r = Math.random(); r < 0.4 ? ACT.headbutt() : r < 0.7 ? ACT.crouchPounce(tx) : ACT.standToSit(); return true;
  }
  // có bánh / đồ chơi mới: clip rảnh rỗi đang chạy được tua nhanh để mèo phản ứng sớm (không cắt ngang hình)
  function hurry() {
    if (cat.mode === 'clip' && cat.clipEl && !cat.loop && /^(groom|watch|knead|meme|headbutt|stand_to_sit|sit_to_stand|lie_down|get_up|belly|pet|scratch)/.test(cat.clip || ''))
      cat.clipEl.playbackRate = Math.max(cat.clipEl.playbackRate, 2.2);
    if (cat.mode === 'idle') cat.idleT = cat.idleDur;
  }
  // bánh thưởng
  const treats = []; let treatsLeft = 3;
  function dropTreat(x, y) {
    if (treatsLeft <= 0) { toast('Hết bánh cho giờ nghỉ này rồi 🐟', 1800); return; }
    treatsLeft--; renderTreat();
    const el = document.createElement('div'); el.className = 'treat'; el.textContent = '🐟'; stage.appendChild(el);
    treats.push({ x: clamp(x, 40, innerWidth - 40), y, vy: 0, el, landed: false });
    hurry();
  }
  function eatTreat() {
    const t = treats.shift(); if (!t) return;
    t.el.remove(); session.treats++; bond.treats++; gain(2); meow(true); const [x, y] = headScreen(); hearts(x, y, 4);
    cat.energy = Math.min(100, cat.energy + 25);
  }
  const renderTreat = () => { $('#treatN').textContent = treatsLeft; };

  // ---------- AI khi rảnh ----------
  function weighted(list) {
    const t = list.reduce((s, [w]) => s + w, 0); let r = Math.random() * t;
    for (const [w, fn] of list) { if ((r -= w) <= 0) return fn(); }
  }
  function decide() {
    if (cat.wantFloor && cat.edge !== 0) return startWalk();
    const tg = target();
    if (tg && (cat.pose === 'stand' || cat.pose === 'sit')) { if (toyDecide(tg)) return; setPose(cat.pose); cat.idleDur = 0.2; return; }
    if (!tg) cat.noticed = false;
    if (tg && (cat.pose === 'lie' || cat.pose === 'belly') && (tg.kind === 'treat' ? cd('wake', 1.5) : cd('wakeF', 4) && Math.random() < 0.5)) {   // có bánh / cần câu: dậy
      mood('❗', 900); return cat.pose === 'belly' ? ACT.bellyReturn() : ACT.getUp();
    }
    const here = blocking, idleUser = now_() - ptr.t > 9000;
    if (cat.pose === 'stand') {
      if (blocking && cat.edge !== 0) return startWalk();
      weighted([[here ? 40 : 50, () => startWalk(Math.random() < 0.5 ? 1 : -1)], [here ? (cat.floor ? 14 : 12) : 0, () => hopLevel(cat.floor ? 0 : 1) || setPose('stand')], [here ? 35 : 12, () => ACT.standToSit(() => meow(here))],
        [here ? 8 : 5, () => ACT.lieDown()], [7, ACT.headbutt], [5, ACT.reach], [8, () => ACT.crouchPounce(null)],
        [here ? 0 : 6, () => { turnTo(-cat.dir); setPose('stand'); }],
        [clips.meme ? 5 : 0, ACT.meme], [cat.energy > 60 ? 4 : 0, () => ACT.zoomies(here ? 2 : 3)], [here && idleUser ? 10 : 0, askAttention]]);
    } else if (cat.pose === 'sit') {
      weighted([[26, ACT.groom], [14, ACT.watch], [8, ACT.swat], [5, () => ACT.bite()], [here ? 6 : 24, () => ACT.sitToStand()], [18, () => setPose('sit')],
        [here && idleUser ? 12 : 0, askAttention]]);
    } else if (cat.pose === 'lie') {
      if (now_() < cat.restUntil) return setPose('lie');
      weighted([[30, ACT.knead], [here ? 10 : 25, ACT.getUp], [40, () => setPose('lie')]]);
    } else if (cat.pose === 'belly') ACT.bellyReturn();
  }
  function askAttention() {   // mèo đòi chơi khi bạn để yên lâu
    if (!cd('ask', 25)) return setPose(cat.pose);
    meow(true); mood('🐾', 2000);
    setPose(cat.pose); cat.idleDur = 3;
  }

  // ---------- Xoa đầu / chạm ----------
  function petAt(x, y, stroke) {
    hearts(x, y, stroke ? 2 : 3); purrLouder(); session.pets++; bond.pets++; gain(1);
    cat.energy = Math.min(100, cat.energy + 6);
    const n = now_(); cat.pets = cat.pets.filter((t) => n - t < 12000); cat.pets.push(n);
    if (Math.random() < 0.35) meow(false);
    if (cat.mode === 'held' || cat.turnA) return;
    if (cat.mode === 'clip' && /^(pet|headbutt|knead|belly|lie_down|stand_to_sit|sit_to_stand)/.test(cat.clip)) return;   // đang hưởng thụ thì để yên
    if (cat.mode !== 'idle' && cat.mode !== 'walk' && !(cat.mode === 'clip' && /^(groom|watch|swat)/.test(cat.clip))) return;
    const k = cat.pets.length;
    if (cat.pose === 'stand' || cat.mode === 'walk') {
      cat.pose = 'stand';
      if (k >= 7 && level() >= 2 && Math.random() < 0.5) { mood('💗', 1800); return ACT.lieDown(() => ACT.bellyRoll()); }
      if (k >= 3 && Math.random() < 0.45) return ACT.headbutt();
      play(vid('pet'));
    } else if (cat.pose === 'sit') {
      if (k >= 6 && Math.random() < 0.3) return ACT.groom();
      play('pet_sit');
    } else if (cat.pose === 'lie') { if (k >= 2 && cat.mode === 'idle') ACT.knead(); }
    else if (cat.pose === 'belly') { if (cat.mode === 'idle') { session.belly++; ACT.bellyKick(1 + (Math.random() < 0.5)); } }
  }
  function touchCat(x, y, zone) {
    if (cat.mode === 'held') return;
    if (cat.pose === 'belly') { if (cat.mode === 'idle') { session.belly++; gain(2); hearts(x, y, 2); ACT.bellyKick(2); } return; }
    if (zone === 'head') return petAt(x, y);
    const busy = cat.mode !== 'idle' && cat.mode !== 'walk';
    if (zone === 'tail') {                         // chạm đuôi: mèo quay lại cào
      sfx('hiss', 0.4, 1, 1500);
      if (busy) return;
      if (cat.pose === 'sit') return ACT.swat();
      if (cat.pose === 'lie') return ACT.getUp();
      return ACT.scratch();
    }
    sfx('scratch', 0.5, 1.1, 600);
    if (busy) return;
    if (cat.pose === 'lie') ACT.bellyRoll();
    else if (cat.pose === 'sit') Math.random() < 0.6 ? ACT.swat() : ACT.groom();
    else Math.random() < 0.5 ? ACT.headbutt() : ACT.scratch();
  }
  function startDrag() {
    cat.mode = 'held'; cat.pose = 'held'; cat.held = {}; cat.heldSince = now_(); A.hiss = false; cat.clip = null; cat.clipEl = null; cat.onend = null; cat.move = null;
    cat.edge = 0; cat.angle = 0; cat.jump = null; cat.turnA = null; cat.zoom = false; cat.floor = 0;
    const c = clips.held_dangle; if (c) { c.el.loop = true; c.el.currentTime = 0; c.el.play().catch(() => {}); show(c.el); cat.clipEl = c.el; } else show(posesImg.held);
    meow(true); updatePurr(); document.body.classList.add('dragging');
  }
  function endDrag() {
    document.body.classList.remove('dragging');
    cat.mode = 'fall'; cat.fall = { vy: 250 }; cat.u = clamp(cat.px, catW() * 0.36, innerWidth - catW() * 0.36);
    for (const k of ['held_dangle', 'hiss_squirm']) if (clips[k]) clips[k].el.pause();
    A.hiss = false; show(posesImg.held);
  }

  // ---------- Vòng lặp ----------
  // Cỡ mèo trong giờ nghỉ: đủ to để thu hút nhưng không che hết màn hình làm việc
  const PLAY = () => (SMALL ? Math.min(innerWidth * 0.7 / CAT_LEN, innerHeight * 0.95 / FH) : ROAM * 1.5);
  function wantScale(vw, vh) {
    if (!blocking || cat.edge !== 0) return ROAM;
    return PLAY();
  }
  function tick(now) {
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    requestAnimationFrame(tick);
    if (!clips.walk || !posesImg.stand) return;
    const vw = innerWidth, vh = HV();
    const visible = blocking || cat.exit;
    catEl.style.display = shadow.style.display = visible ? '' : 'none';
    if (!visible) { moodEl.style.opacity = 0; drawToys(now, dt); return; }
    cat.scale += (wantScale(vw, vh) - cat.scale) * Math.min(1, dt * 2.5);
    if (cat.edge === 0 && !cat.exit && !cat.enter && (cat.mode === 'idle' || (cat.mode === 'clip' && !cat.move))) { const lo = Math.min(catW() * 0.36, vw / 2); cat.u = clamp(cat.u, lo, vw - lo); }
    const W = catW(), H = catH(), speed = SPEED * Math.pow(cat.scale / ROAM, 0.6) * (cat.fast ? 2.2 : 1);
    if (!cat.started) { cat.u = vw / 2; setPose('stand'); }
    if (cat.mode === 'idle' || cat.pose === 'lie') cat.energy = Math.min(100, cat.energy + dt * (cat.pose === 'lie' ? 4 : 1));

    for (const t of treats) {      // bánh rơi xuống sàn, nảy nhẹ
      if (!t.landed) { t.vy += 2400 * dt; t.y += t.vy * dt; if (t.y >= vh - 18) { t.y = vh - 18; if (t.vy > 300) t.vy = -t.vy * 0.35; else t.landed = true; } }
      t.el.style.transform = `translate(${t.x - 18}px,${t.y - 30}px)`;
    }

    cat.idleT += dt;
    const el = cat.clipEl, t = el ? el.currentTime : 0;
    if (cat.turnA) { cat.turnA.t += dt; if (cat.turnA.t >= cat.turnA.dur) cat.turnA = null; }
    if (cat.mode === 'jump') {
      const j = cat.jump; j.t += dt;
      if (j.t >= j.dur) {
        cat.edge = j.to.edge; cat.u = j.to.u; cat.dir = j.to.dir; cat.jump = null; cat.px = j.to.x; cat.py = j.to.y; cat.angle = j.to.a;
        cat.floor = j.to.edge === 0 ? j.to.floor : 0; cat.shelfY = j.to.shelfY;
        if (j.level) { landFx(0.6); setPose('stand'); cat.idleDur = 0.4; } else startWalk();
      }
    } else if (cat.mode === 'walk') {
      const tg = cat.exit || cat.enter ? null : target();
      if (cat.exit) { if (cat.u < -W * 0.6 || cat.u > vw + W * 0.6) { cat.exit = false; setPose('stand'); } }
      else if (cat.enter) { if (Math.abs(vw / 2 - cat.u) < W * 0.3) { cat.enter = false; setPose('stand'); cat.idleDur = 0.1; meow(true); } }
      else if (tg) {
        if (cat.edge === 0 && (tg.kind === 'treat' || tg.y > vh * 0.55 ? 0 : 1) !== (cat.floor || 0) && (cat.last.hop || 0) + 2500 < now_()) { setPose('stand'); cat.idleDur = 0; }
        else if (cat.edge === 0) { const dx = tg.x - cat.px; if (Math.abs(dx) < W * (tg.kind === 'treat' ? 0.35 : 0.8)) { setPose('stand'); cat.idleDur = 0; } else if (Math.sign(dx) !== cat.dir) turnTo(Math.sign(dx)); }
        else { cat.wantFloor = true; cat.dir = -upDir(); }
      } else if (!cat.exit && !cat.enter && cat.walkT > cat.walkFor) { cat.walkT = 0; if (cat.edge === 0) setPose('stand'); else cat.walkFor = 3; }
      cat.walkT += dt;
      if (cat.mode === 'walk' && !cat.turnA) {
        if (cat.clipEl) cat.clipEl.playbackRate = cat.fast ? 1.8 : 1;
        const hit = moveAlong(speed * dt, W, vw, vh);
        if (cat.exit || cat.enter) { /* đi tiếp ra/vào màn hình */ }
        else if (hit === 'end') { if (!blocking && !tg && cat.edge === 0 && Math.random() < 0.55) jumpToWall(vw, vh, W, H); else { turnTo(-cat.dir); meow(false); } }
        else if (hit === 'top') turnTo(-cat.dir); else if (hit === 'bottom') jumpToFloor(vw, vh, W, H);
      }
    } else if (cat.mode === 'idle') {
      if (cat.idleT > cat.idleDur && !cat.turnA) decide();
    } else if (cat.mode === 'clip') {
      for (const q of cat.cues) if (!q[2] && t >= q[0]) { q[2] = true; q[1](); }
      if (cat.move) cat.move(t, dt);
      if (cat.clipEl && (cat.clipEl.ended || t >= (cat.clipDur || 0) - 0.03) && !cat.loop) { const f = cat.onend; cat.onend = null; cat.move = null; f ? f() : setPose(cat.pose); }
    } else if (cat.mode === 'fall') {
      if (cat.py >= vh - 0.5) { const id = vid('land'), th = cue(id, 'thump', 0.48); play(id, { start: Math.max(0, th - 0.2), rate: 1.2, cues: [[th, () => landFx(1)]], onend: () => { setPose('stand'); cat.idleDur = 0.5; } }); }
    } else if (cat.mode === 'held') {
      const hsec = (now_() - cat.heldSince) / 1000;
      if (hsec > 4 && !A.hiss) { A.hiss = true; sfx('hiss', 1); const c = clips.hiss_squirm; if (c) { c.el.loop = true; c.el.currentTime = 0; c.el.play().catch(() => {}); show(c.el); cat.clipEl = c.el; } }
    }

    // hướng + nhảy nhẹ khi quay đầu
    let flip = cat.mode === 'held' || cat.mode === 'fall' ? 1 : cat.dir < 0 ? -1 : 1;
    cat.hop = 0;
    if (cat.turnA) { const p = cat.turnA.t / cat.turnA.dur, c = Math.cos(Math.PI * p); flip = cat.turnA.from * (Math.abs(c) < 0.12 ? (c < 0 ? -0.12 : 0.12) : c); cat.hop = -Math.sin(Math.PI * p) * 0.16 * H; }
    cat.flipSign = flip;
    const [tx, ty] = anchor(cat.edge, cat.u, vw, vh), ta = EDGE_ANGLE[cat.edge];
    if (!cat.started) { cat.px = tx; cat.py = ty; cat.angle = ta; cat.started = true; }
    if (cat.mode === 'jump') {
      const j = cat.jump, p = Math.min(1, j.t / j.dur), e = p * p * (3 - 2 * p);
      cat.px = j.from.x + (j.to.x - j.from.x) * e; cat.py = j.from.y + (j.to.y - j.from.y) * e - j.arc * Math.sin(Math.PI * p);
      cat.angle = j.from.a + norm180(j.to.a - j.from.a) * e;
    } else if (cat.mode === 'held') {
      const k = Math.min(1, dt * 14), sway = clamp(ptr.vx * 0.018, -14, 14);
      cat.angle += (sway - cat.angle) * Math.min(1, dt * 8);
      const gx = (GRIP[0] - AX) * cat.scale, gy = (GRIP[1] - FEET) * cat.scale, a = cat.angle * Math.PI / 180;
      const wx = ptr.x - (gx * Math.cos(a) - gy * Math.sin(a)), wy = ptr.y - (gx * Math.sin(a) + gy * Math.cos(a));
      cat.px += (wx - cat.px) * k; cat.py += (wy - cat.py) * k;
    } else if (cat.mode === 'fall') {
      cat.angle += (0 - cat.angle) * Math.min(1, dt * 6);
      cat.fall.vy += 5200 * Math.sqrt(cat.scale / ROAM) * dt; cat.py = Math.min(vh, cat.py + cat.fall.vy * dt);
      cat.px += (cat.u - cat.px) * Math.min(1, dt * 8);
    } else {
      const k = Math.min(1, dt * (cat.mode === 'clip' && cat.move ? 30 : 10));
      cat.px += (tx - cat.px) * k; cat.py += (ty - cat.py) * k; cat.angle += norm180(ta - cat.angle) * k;
    }
    catEl.style.transform = `translate(${cat.px}px,${cat.py + cat.hop}px) rotate(${cat.angle}deg) scale(${flip * cat.scale},${cat.scale}) translate(${-AX}px,${-FEET}px)`;

    if (cat.edge === 0 && !cat.floor && cat.mode !== 'held' && cat.mode !== 'jump') {      // bóng dưới chân
      const bw = W * (cat.pose === 'lie' || cat.pose === 'belly' ? 0.95 : 0.75) * (1 + cat.hop / H * 0.6);
      shadow.style.cssText = `opacity:${cat.mode === 'fall' ? 0.15 : 0.32};width:${bw}px;height:${bw * 0.1}px;left:${cat.px - bw / 2}px;top:${cat.py - bw * 0.05 + ((BOTTOM[cat.pose] || FEET) - FEET) * cat.scale}px`;
    } else shadow.style.opacity = 0;
    const [hx, hy] = headScreen();                                             // biểu cảm + zZz
    moodEl.style.transform = `translate(${hx}px,${hy - 40 * Math.max(0.8, cat.scale / ROAM * 0.7)}px)`; moodEl.style.opacity = now < moodUntil ? 1 : 0;
    if (cat.pose === 'lie' && cat.mode === 'idle' && now - (cat.lastZ || 0) > 1800) { cat.lastZ = now; fx('zzz', hx, hy - 20, `font-size:${Math.max(18, 26 * cat.scale / ROAM)}px`, 2600, 'z'); }
    if (posesImg[cat.pose]) posesImg[cat.pose].style.setProperty('--b', 1 + 0.008 * Math.sin(now / 520));
    if (combo.n && now - combo.t > 8000) combo.n = 0;
    if (now - (cat.lastPurrChk || 0) > 300) { cat.lastPurrChk = now; updatePurr(); if (A.purrGain > 1 && now > (A.purrBoostUntil || 0)) { A.purrGain = 1; if (A.purr && A.ac) A.purr.g.gain.setTargetAtTime(1, A.ac.currentTime, 0.8); } }
    drawToys(now, dt);
    if (blocking) {
      const left = Math.max(0, state.endsAt - Date.now());
      $('#sub').textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    }
    $('#dbg').textContent = location.hash === '#debug' ? `${cat.mode} ${cat.pose} ${cat.clip || ''} t=${t.toFixed(2)} tool=${tool} s=${cat.scale.toFixed(2)} e=${cat.energy | 0}` : '';
  }

  // ---------- Vẽ laser + cần câu ----------
  const dot = $('#laser'), wandSvg = $('#wand');
  const NS = 'http://www.w3.org/2000/svg', mk = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); wandSvg.appendChild(el); return el; };
  const W_ = { rod: mk('line', { stroke: '#d98bb0', 'stroke-linecap': 'round' }), grip: mk('line', { stroke: '#f4f1ec', 'stroke-linecap': 'round', style: 'filter:drop-shadow(0 1px 1px #0005)' }),
    str: mk('line', { stroke: '#666', 'stroke-width': 1 }), knot: mk('circle', { fill: '#e3b33a' }), g: mk('g', {}) };
  W_.img = document.createElementNS(NS, 'image'); W_.img.setAttribute('href', 'assets/feather.svg'); W_.g.appendChild(W_.img);
  const setA = (el, o) => { for (const k in o) el.setAttribute(k, o[k]); };
  const wand = { fx: innerWidth / 2, fy: innerHeight / 2, vx: 0, vy: 0, tx: innerWidth / 2, ty: innerHeight / 2, init: false };
  let trailT = 0;
  function drawToys(now, dt) {
    const showLaser = tool === 'laser' && ptr.inside && (!ptr.touch || now - ptr.t < 6000);
    dot.style.display = showLaser ? 'block' : 'none';
    if (showLaser) {
      const jit = now < toyHide ? 6 : 0;
      dot.style.transform = `translate(${ptr.x + (jit ? rnd(-jit, jit) : 0)}px,${ptr.y + (jit ? rnd(-jit, jit) : 0)}px)`;
    }
    const showWand = tool === 'feather' && ptr.inside;
    wandSvg.style.display = showWand ? 'block' : 'none';
    if (showWand) {
      // đầu cần đi theo con trỏ, cán cầm ở dưới chĩa lên rồi cong xuống; dây + lông treo ở đầu cần, đung đưa như con lắc
      const k = SMALL ? 0.8 : 1, L = 48 * k;
      wand.tx += (ptr.x - wand.tx) * Math.min(1, dt * 18); wand.ty += (ptr.y - wand.ty) * Math.min(1, dt * 18);
      if (!wand.init) { wand.fx = wand.tx; wand.fy = wand.ty + L; wand.vx = wand.vy = 0; wand.init = true; }
      wand.vy += 1500 * dt; wand.vx *= 0.985; wand.vy *= 0.985;
      wand.fx += wand.vx * dt; wand.fy += wand.vy * dt;
      const ddx = wand.fx - wand.tx, ddy = wand.fy - wand.ty, d = Math.hypot(ddx, ddy) || 1;
      if (d > L) { const nx = ddx / d, ny = ddy / d; wand.fx = wand.tx + nx * L; wand.fy = wand.ty + ny * L; const vn = wand.vx * nx + wand.vy * ny; if (vn > 0) { wand.vx -= vn * nx; wand.vy -= vn * ny; } }
      const vw = innerWidth, side = wand.tx < vw * 0.55 ? 1 : -1;
      // cán thẳng: tay cầm ở phía dưới-bên cạnh, chĩa chéo lên tới đầu cần (con trỏ)
      const hx = wand.tx + side * 150 * k, hy = wand.ty + 210 * k, gx = wand.tx + side * 118 * k, gy = wand.ty + 165 * k;
      const ang = Math.atan2(wand.fx - wand.tx, wand.fy - wand.ty) * -180 / Math.PI, fs = 46 * k;
      setA(W_.rod, { x1: wand.tx, y1: wand.ty, x2: hx, y2: hy, 'stroke-width': 2.6 * k });
      setA(W_.grip, { x1: gx, y1: gy, x2: hx, y2: hy, 'stroke-width': 7 * k });
      setA(W_.str, { x1: wand.tx, y1: wand.ty, x2: wand.fx, y2: wand.fy });
      setA(W_.knot, { cx: wand.fx, cy: wand.fy, r: 2.5 * k });
      W_.g.setAttribute('transform', `translate(${wand.fx},${wand.fy}) rotate(${ang + 135})`);
      if (W_.fs !== fs) { W_.fs = fs; setA(W_.img, { x: -fs * 0.1, y: -fs * 0.84, width: fs, height: fs }); }
      const sp = Math.hypot(ptr.vx, ptr.vy);
      if (sp > 700) sfx(pick(['rustle1', 'rustle2']), Math.min(0.9, sp / 2500), 1, 350);
    } else wand.init = false;
    ptr.vx *= 0.9; ptr.vy *= 0.9;
  }

  // ---------- Chuột / chạm ----------
  let press = null;
  addEventListener('pointermove', (e) => {
    const n = now_(), dtp = Math.max(1, n - (ptr.pt || n));
    ptr.vx = (e.clientX - ptr.x) / dtp * 500 + ptr.vx * 0.5; ptr.vy = (e.clientY - ptr.y) / dtp * 500 + ptr.vy * 0.5; ptr.pt = n;
    const ddist = Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y);
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = n; ptr.inside = true; ptr.touch = e.pointerType === 'touch';
    if (press) {
      if (press.zone === 'head' && tool === 'hand') {          // vuốt đầu: cứ ~120px vuốt là 1 lần xoa
        press.stroke += ddist; if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press.moved = true;
        if (press.stroke > 90 * Math.max(0.8, cat.scale / ROAM * 0.5)) { press.stroke = 0; petAt(e.clientX, e.clientY, true); }
      } else if (!press.drag && press.zone && press.zone !== 'head' && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) { press.drag = true; startDrag(); }
    }
    if (tool === 'hand' && !press && n - (cat.lastCur || 0) > 50) {
      cat.lastCur = n; const z = zoneAt(e.clientX, e.clientY);
      document.body.dataset.cur = z === 'head' ? 'hand' : z ? 'point' : '';
    }
  });
  addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') ptr.inside = false; });
  document.addEventListener('mouseleave', () => { ptr.inside = false; });
  addEventListener('pointerdown', (e) => {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.inside = true; ptr.t = now_(); ptr.down = true; ptr.touch = e.pointerType === 'touch';
    if (e.target.closest('#assist')) return;
    ptr.jab = now_();
    const z = zoneAt(e.clientX, e.clientY, ptr.touch ? 3 : 1);
    if (tool === 'treat' && !z) { dropTreat(e.clientX, e.clientY); return; }
    press = { x: e.clientX, y: e.clientY, zone: z, drag: false, stroke: 0, moved: false };
    if (z === 'head' && tool === 'hand') document.body.dataset.cur = 'stroke';
  });
  addEventListener('pointerup', (e) => {
    ptr.down = false; if (!press) return; const p = press; press = null;
    if (tool === 'hand') document.body.dataset.cur = '';
    if (p.drag) return endDrag();
    if (p.zone === 'head' && p.moved) return;                   // vừa vuốt xong
    if (p.zone && (tool === 'hand' || tool === 'treat' || cat.pose === 'lie' || cat.pose === 'belly')) touchCat(e.clientX, e.clientY, p.zone);
  });
  addEventListener('contextmenu', (e) => { e.preventDefault(); if (tool !== 'hand') setTool('hand'); });

  // ---------- UI ----------
  function setTool(t) {
    tool = t; document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    document.body.dataset.tool = t; document.body.dataset.cur = '';
    cat.wantFloor = t === 'laser' || t === 'feather'; cat.noticed = false;
    if (t === 'feather') hurry(); else if (cat.mode === 'idle') cat.idleT = cat.idleDur;
  }
  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; const m = { 1: 'hand', 2: 'feather' }[e.key]; if (m) setTool(m); });

  // ---------- Nút nổi kiểu AssistiveTouch ----------
  const assist = $('#assist'), fab = $('#fab'), menu = $('#menu'), FS = 56;
  let fabPos; try { fabPos = JSON.parse(localStorage.getItem('kitten2-fab')); } catch (_) {}
  fabPos = fabPos || { side: 1, y: 0.55 };
  let awakeT = 0, openT = 0;
  const wake = () => { assist.classList.add('awake'); clearTimeout(awakeT); awakeT = setTimeout(() => assist.classList.remove('awake'), 3000); };
  const closeLater = (ms) => { clearTimeout(openT); openT = setTimeout(() => assist.classList.remove('open'), ms); };
  function placeFab(x, y) {
    if (x === undefined) { x = fabPos.side ? innerWidth - FS - 8 : 8; y = Math.max(8, Math.min(fabPos.y * innerHeight, innerHeight - FS - 8)); }
    assist.style.transform = `translate(${x}px,${y}px)`;
    menu.style.left = fabPos.side ? 'auto' : (FS + 8) + 'px'; menu.style.right = fabPos.side ? (FS + 8) + 'px' : 'auto';
  }
  placeFab(); addEventListener('resize', () => placeFab());
  let fdrag = null;
  fab.addEventListener('pointerdown', (ev) => { fdrag = { x: ev.clientX, y: ev.clientY, moved: false }; fab.setPointerCapture(ev.pointerId); wake(); });
  fab.addEventListener('pointermove', (ev) => {
    if (!fdrag) return;
    if (!fdrag.moved && Math.hypot(ev.clientX - fdrag.x, ev.clientY - fdrag.y) > 6) { fdrag.moved = true; assist.classList.add('drag'); assist.classList.remove('open'); }
    if (fdrag.moved) placeFab(Math.max(0, Math.min(ev.clientX - FS / 2, innerWidth - FS)), Math.max(0, Math.min(ev.clientY - FS / 2, innerHeight - FS)));
  });
  fab.addEventListener('pointerup', (ev) => {
    const d = fdrag; fdrag = null; if (!d) return;
    if (d.moved) { assist.classList.remove('drag'); fabPos = { side: ev.clientX > innerWidth / 2 ? 1 : 0, y: Math.max(0, Math.min(ev.clientY - FS / 2, innerHeight - FS)) / innerHeight }; placeFab(); try { localStorage.setItem('kitten2-fab', JSON.stringify(fabPos)); } catch (_) {} wake(); }
    else { assist.classList.toggle('open'); wake(); closeLater(6000); }
  });
  menu.addEventListener('click', () => { wake(); closeLater(2500); });
  $('#treatBtn').addEventListener('click', () => {
    if (!blocking) return;
    const W = catW(), x = clamp(cat.px + (cat.dir || 1) * W * rnd(0.3, 0.55), 50, innerWidth - 50);
    dropTreat(x, Math.max(40, (cat.floor ? cat.shelfY : HV()) - catH() * 1.4));
  });
  assist.addEventListener('pointerenter', wake);

  // Cửa sổ trong suốt trên desktop: chuột xuyên qua, chỉ bắt chuột khi trỏ vào mèo / nút nổi / đang dùng cần câu
  const native = window.kittenNative; let ignoring = null;
  function setIgnore(v) { if (native && ignoring !== v) { ignoring = v; native.setIgnore(v); } }
  if (MODE === 'overlay') {
    setIgnore(true);
    addEventListener('pointermove', (ev) => {
      const over = ev.target.closest && ev.target.closest('#assist');
      setIgnore(!(over || (blocking && tool === 'feather') || press || cat.mode === 'held' || (blocking && zoneAt(ev.clientX, ev.clientY, 2))));
    }, true);
  }

  function applyState(s) {
    state = s; const should = s.phase === 'break';
    if (should && !blocking) {
      blocking = true; dim.classList.add('on'); bubble.classList.add('on'); document.body.classList.add('blocking'); if (state.music) musicOn(true); meow(true);
      session = { pets: 0, catches: 0, treats: 0, belly: 0 }; treatsLeft = 3; renderTreat(); cat.wantFloor = true;
      // mèo chạy từ mép màn hình vào giữa
      const fromLeft = Math.random() < 0.5; cat.exit = false; cat.enter = true; cat.edge = 0; cat.floor = 0; cat.angle = 0; cat.turnA = null; cat.jump = null;
      cat.scale = PLAY();
      cat.u = fromLeft ? -catW() * 0.5 : innerWidth + catW() * 0.5; cat.px = cat.u; cat.py = HV(); cat.dir = fromLeft ? 1 : -1; cat.started = true;
      startWalk(cat.dir, true);
    }
    if (!should && blocking) {
      blocking = false; cat.enter = false; cat.exit = true; treats.splice(0).forEach((t) => t.el.remove());
      if (cat.mode === 'held' || cat.mode === 'fall') { document.body.classList.remove('dragging'); cat.mode = 'idle'; }
      cat.pose = 'stand'; startWalk(cat.u < innerWidth / 2 ? -1 : 1, true); dim.classList.remove('on'); bubble.classList.remove('on'); document.body.classList.remove('blocking'); musicOn(false);
      toast(`Giờ nghỉ: xoa đầu ${session.pets} · bắt được ${session.catches} · ăn ${session.treats} bánh 🐾`, 6000);
    }
    if (!state.music) musicOn(false); else if (blocking) musicOn(true);
    if (A.master) A.master.gain.value = state.volume;
  }
  S.on(applyState); applyState(state); renderBond(); renderTreat();
  addEventListener('pointerdown', () => audio(), { capture: true });
  addEventListener('keydown', () => audio(), { capture: true });

  window.K2 = { hopLevel, cat, clips, variants, play, setPose, setTool, ACT, get tool() { return tool; }, sfx, hearts, probeCat, zoneAt, ptr, wand, treats, dropTreat, turnTo, bond, target };
  loadAll().then(() => requestAnimationFrame(tick)).catch((e) => { $('#loading').textContent = 'Lỗi tải clip: ' + e.message; });
})();
