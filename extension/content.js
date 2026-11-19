// Kitten Pomodoro - content script
// Mèo đi vòng quanh 4 cạnh màn hình, ngồi ở đáy, khi hết giờ làm thì ra giữa chắn màn hình.
(() => {
  if (window.top !== window || document.getElementById('kitten-pomodoro-host')) return;

  const WALK_SECONDS_IN_SIT_CLIP = 3.8;   // sau giây này mèo thôi bước và ngồi (tính theo giây để không phụ thuộc fps sprite)
  const SMALL = Math.min(innerWidth, innerHeight) < 600;       // điện thoại
  const ROAM_SCALE = SMALL ? 0.45 : 0.67, SPEED = 80; // px/s ở scale ROAM (sprite rộng 590px)
  // lúc chặn màn hình mèo phóng to gần phủ kín màn hình
  const blockScale = (w, h) => Math.min(5, innerWidth / w, innerHeight * 0.95 / h);
  const MEOWS = ['meow1', 'meow2', 'meow3', 'meow4'];
  // Mèo chỉ đi ở 3 cạnh: 0 đáy (mặt đất), 1 tường phải, 3 tường trái. KHÔNG đi trần nhà (không bị lộn ngược).
  const EDGE_ANGLE = { 0: 0, 1: -90, 3: 90 };
  let state = { phase: 'idle', endsAt: 0, catOn: true, volume: 0.5 };

  // ---------- DOM ----------
  const host = document.createElement('div');
  host.id = 'kitten-pomodoro-host';
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .dim{position:fixed;inset:0;background:rgba(20,14,30,.62);opacity:0;transition:opacity .8s;pointer-events:none}
      .dim.on{opacity:1;pointer-events:auto}
      canvas{position:fixed;left:0;top:0;pointer-events:auto;cursor:pointer;transform-origin:0 0;will-change:transform}
      .bubble{position:fixed;left:50%;top:14vh;transform:translateX(-50%);text-align:center;color:#fff;
        font:600 22px/1.4 system-ui,sans-serif;opacity:0;transition:opacity .8s;pointer-events:none;text-shadow:0 2px 8px #0008}
      .bubble.on{opacity:1}
      .bubble small{display:block;font:400 14px system-ui;opacity:.85;margin-top:4px}
      .bubble button{pointer-events:auto;margin-top:14px;padding:8px 18px;border:0;border-radius:20px;
        background:#ffffffd0;color:#3b2f2f;font:600 14px system-ui;cursor:pointer}
      .heart{position:fixed;font-size:26px;pointer-events:none;animation:up 1.3s ease-out forwards;text-shadow:0 2px 6px #0004}
      @keyframes up{from{opacity:1;transform:translate(0,0) scale(.7)}to{opacity:0;transform:translate(var(--dx),-90px) scale(1.2)}}
    </style>
    <div class="dim"></div>
    <div class="bubble"><div id="msg">Nghỉ ngơi một chút nhé 🐾</div><small id="sub"></small>
      <button id="skip">Cho mèo đi (bỏ qua giờ nghỉ)</button></div>
    <canvas></canvas>`;
  document.documentElement.appendChild(host);
  const $ = (s) => root.querySelector(s);
  const dim = $('.dim'), bubble = $('.bubble'), cv = $('canvas'), ctx = cv.getContext('2d');

  // ---------- Sprites ----------
  const clips = {};
  async function loadClip(name, optional) {
    try {
      const meta = await (await fetch(chrome.runtime.getURL(`sprites/${name}.json`))).json();
      const img = new Image();
      const loaded = new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error('sprite load failed: ' + name)); });
      img.src = chrome.runtime.getURL(`sprites/${name}.webp`);
      await loaded;
      clips[name] = { ...meta, img };
    } catch (e) { if (!optional) throw e; }
  }
  function drawFrame(clip, i, flip) {
    const c = clips[clip]; i = Math.min(c.frames - 1, Math.max(0, i | 0));
    if (cv.width !== c.w || cv.height !== c.h) { cv.width = c.w; cv.height = c.h; }
    ctx.clearRect(0, 0, c.w, c.h);
    ctx.save();
    if (flip) { ctx.translate(c.w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(c.img, (i % c.cols) * c.w, ((i / c.cols) | 0) * c.h, c.w, c.h, 0, 0, c.w, c.h);
    ctx.restore();
  }

  // ---------- Audio (file thật trong sounds/) ----------
  let ac, master, purr, purrBuf, scratchBuf, lastMeow = 0;
  const meowBufs = [];
  async function loadSound(name) {
    const r = await fetch(chrome.runtime.getURL(`sounds/${name}.mp3`));
    return ac.decodeAudioData(await r.arrayBuffer());
  }
  function audio() {
    // Chưa có thao tác nào của người dùng trên trang thì trình duyệt không cho phát tiếng -> không tạo AudioContext (tránh cảnh báo)
    if (!ac && !window.__kittenAutoplay && !(navigator.userActivation && navigator.userActivation.hasBeenActive)) return null;
    if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.connect(ac.destination);
      loadSound('purr').then((b) => { purrBuf = b; if (blocking) startPurr(); }).catch(() => {});
      loadSound('scratch').then((b) => { scratchBuf = b; }).catch(() => {});
      MEOWS.forEach((n) => loadSound(n).then((b) => meowBufs.push(b)).catch(() => {})); }
    master.gain.value = state.volume;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function startPurr() {
    if (!audio() || purr || !purrBuf) return;
    const src = ac.createBufferSource(); src.buffer = purrBuf; src.loop = true;
    const g = ac.createGain(); g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(1, ac.currentTime + 2);
    src.connect(g).connect(master); src.start();
    purr = { src, g };
  }
  function stopPurr() {
    if (!purr || !ac) return;
    const { src, g } = purr; purr = null;
    g.gain.cancelScheduledValues(ac.currentTime); g.gain.setValueAtTime(g.gain.value, ac.currentTime);
    g.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8);
    setTimeout(() => { try { src.stop(); } catch (e) {} }, 900);
  }
  // loud: tiếng to (chạm vào mèo / lúc chặn màn hình); roam: nhỏ hơn, có hồi chiêu để khỏi ồn
  function meow(loud) {
    if (!audio() || !meowBufs.length || ac.state !== 'running') return;
    const now = performance.now();
    if (!loud && now - lastMeow < 6000) return;
    lastMeow = now;
    const src = ac.createBufferSource(); src.buffer = meowBufs[(Math.random() * meowBufs.length) | 0];
    src.playbackRate.value = 0.95 + Math.random() * 0.1;
    const g = ac.createGain(); g.gain.value = loud ? 1 : 0.55;
    src.connect(g).connect(master); src.start();
  }

  // tiếng mèo khi bị chạm (cắt từ file gừ gừ), phát to mỗi lần bấm
  function scratchSound() {
    if (!audio() || !scratchBuf || ac.state !== 'running') return;
    const src = ac.createBufferSource(); src.buffer = scratchBuf;
    src.playbackRate.value = 0.97 + Math.random() * 0.06;
    const g = ac.createGain(); g.gain.value = 1.3;
    src.connect(g).connect(master); src.start();
  }

  // gừ gừ ngắn khi được xoa đầu (dùng lại file gừ gừ, fade vào/ra)
  function purrBurst(sec) {
    if (!audio() || !purrBuf || ac.state !== 'running' || purr) return;   // đang gừ gừ nền thì thôi
    const src = ac.createBufferSource(); src.buffer = purrBuf;
    const g = ac.createGain(), t = ac.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.1, t + 0.4);
    g.gain.setValueAtTime(1.1, t + sec - 0.8); g.gain.linearRampToValueAtTime(0, t + sec);
    src.connect(g).connect(master); src.start(t, Math.random() * 4); src.stop(t + sec + 0.1);
  }
  function hearts(x, y) {
    for (let i = 0; i < 3; i++) {
      const h = document.createElement('div');
      h.className = 'heart'; h.textContent = ['❤', '💗', '💕'][i % 3];
      h.style.cssText = `left:${x - 12 + (i - 1) * 22}px;top:${y - 20}px;animation-delay:${i * 0.15}s;--dx:${(i - 1) * 14}px`;
      root.appendChild(h); setTimeout(() => h.remove(), 1700);
    }
  }

  // ---------- Cat behaviour ----------
  const cat = { mode: 'walk', clip: 'walk', t: 0, edge: 0, u: 120, dir: 1, scale: ROAM_SCALE,
    angle: 0, px: 0, py: 0, nextSit: 8, nextTurn: 10, holdUntil: 0, started: false };
  let blocking = false, last = performance.now();

  // Toạ độ trên cạnh: đáy u = x; tường phải u = độ cao tính từ đáy (đi lên = dir +1);
  // tường trái u = khoảng cách từ trên xuống (đi lên = dir -1).
  function anchor(e, u, vw, vh) {
    return e === 0 ? [u, vh] : e === 1 ? [vw, vh - u] : [0, u];
  }
  cat.wallTop = 0;   // độ cao tối đa mèo leo được trên tường (px từ đáy)
  cat.jump = null;   // {t, dur, from:{x,y,a}, to:{edge,u,dir,x,y,a}, arc}
  const norm180 = (a) => ((a + 540) % 360) - 180;

  function enterWalk(dir) {
    cat.mode = 'walk'; cat.clip = 'walk'; cat.t = 0; if (dir) cat.dir = dir;
    cat.nextSit = 6 + Math.random() * 8; cat.nextTurn = 8 + Math.random() * 12;
  }
  function enterSit() { cat.mode = 'sit'; cat.clip = 'walk_sit'; cat.t = 0; cat.holdUntil = 0; }
  function enterRestedSit() { // ngồi sẵn (sau khi cào lúc đang chặn màn hình)
    cat.mode = 'sit'; cat.clip = 'walk_sit'; cat.t = (clips.walk_sit.frames - 1) / clips.walk_sit.fps; cat.holdUntil = 1e9;
  }
  function enterStandup() {   // ngồi -> đứng dậy (ngáp, vươn vai) rồi đi tiếp
    if (!clips.standup) return enterWalk(Math.random() < 0.5 ? 1 : -1);
    cat.mode = 'standup'; cat.clip = 'standup'; cat.t = 0;
  }
  function enterSleep(seconds) {
    if (!clips.sleep) return false;
    cat.mode = 'sleep'; cat.clip = 'sleep'; cat.t = 0; cat.holdUntil = seconds;
    return true;
  }
  function turnAround(withMeow) {   // quay đầu: clip quay (nếu có) + meo
    if (withMeow) meow(false);
    if (!clips.turn) { cat.dir = -cat.dir; return; }
    cat.mode = 'turn'; cat.clip = 'turn'; cat.t = 0; cat.turnFlip = cat.dir < 0;
  }

  function scratch() {
    if (cat.mode === 'scratch') return;
    scratchSound();
    if (!clips.scratch || cat.mode === 'jump') return;   // đang nhảy thì chỉ kêu, không ngắt cú nhảy
    cat.mode = 'scratch'; cat.clip = 'scratch'; cat.t = 0;
  }
  const FEET = { sleep: 0.86 };   // vị trí chân/đáy thân trong khung hình (mặc định 0.95)

  // ---- Xoa đầu (chạm vào đầu) / cào (chạm vào thân) ----
  // Vùng "đầu" tính theo hộp bao của mèo ở khung hình đang hiển thị, nên đúng với mọi tư thế/hướng/góc xoay.
  const bboxCache = new Map();
  function catBox() {
    const c = clips[cat.clip]; if (!c) return null;
    const key = cat.clip + ':' + cat.frame + ':' + cat.flip;
    if (bboxCache.has(key)) return bboxCache.get(key);
    const d = ctx.getImageData(0, 0, c.w, c.h).data;
    let x0 = c.w, x1 = 0, y0 = c.h, y1 = 0;
    for (let y = 0; y < c.h; y += 2) for (let x = 0; x < c.w; x += 2) {
      if (d[(y * c.w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const box = x1 > x0 ? { x0, x1, y0, y1 } : null;
    if (bboxCache.size > 300) bboxCache.clear();
    bboxCache.set(key, box);
    return box;
  }
  function zoneAt(x, y) {
    const c = clips[cat.clip], box = c && catBox();
    if (!box) return 'body';
    const a = cat.angle * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), dx = x - cat.px, dy = y - cat.py;
    const lx = (dx * cs + dy * sn) / cat.scale + clips.walk.w / 2;                       // toạ độ trong khung sprite
    const ly = (-dx * sn + dy * cs) / cat.scale + clips.walk.h * (FEET[cat.clip] || 0.95);
    const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
    if (lx < box.x0 || lx > box.x1 || ly < box.y0 || ly > box.y1) return 'body';
    const front = cat.flip ? lx < box.x0 + 0.32 * bw : lx > box.x1 - 0.32 * bw;    // đầu ở phía mèo đang hướng tới
    if (cat.clip === 'walk_sit' && cat.t >= WALK_SECONDS_IN_SIT_CLIP)             // ngồi nhìn thẳng: đầu ở phía trên giữa
      return ly < box.y0 + 0.45 * bh && Math.abs(lx - (box.x0 + box.x1) / 2) < 0.3 * bw ? 'head' : 'body';
    if (cat.clip === 'sleep') return (cat.flip ? lx < box.x0 + 0.38 * bw : lx > box.x1 - 0.38 * bw) ? 'head' : 'body';
    return front && ly < box.y0 + 0.62 * bh ? 'head' : 'body';
  }

  function pet(x, y) {
    hearts(x, y); purrBurst(3);
    const name = cat.mode === 'sit' && cat.t >= WALK_SECONDS_IN_SIT_CLIP && clips.pet_sit ? 'pet_sit' : 'pet';
    if (!clips[name] || cat.mode === 'pet' || cat.mode === 'scratch' || cat.mode === 'jump') return;
    cat.mode = 'pet'; cat.clip = name; cat.t = 0;
  }

  const upDir = () => (cat.edge === 1 ? 1 : -1);   // dir nào là đi lên trên tường

  // Đi dọc cạnh hiện tại. Trả về 'end' (hết đường đáy), 'top' (tới độ cao tối đa trên tường),
  // 'bottom' (xuống tới chân tường) hoặc null.
  function moveAlong(dist, W, vw, vh) {
    cat.u += cat.dir * dist;
    if (cat.edge === 0) {
      const lo = Math.min(W / 2, vw / 2), hi = vw - lo;
      if (cat.u >= hi) { cat.u = hi; return 'end'; }
      if (cat.u <= lo) { cat.u = lo; return 'end'; }
      return null;
    }
    const lo = Math.min(W / 2, vh / 2);                       // độ cao thấp nhất (thân nằm sát đáy)
    const top = Math.max(lo, Math.min(cat.wallTop, vh - lo)); // độ cao cao nhất
    let h = cat.edge === 1 ? cat.u : vh - cat.u;              // độ cao hiện tại
    let res = null;
    if (h >= top) { h = top; res = 'top'; }
    else if (h <= lo) { h = lo; res = 'bottom'; }
    cat.u = cat.edge === 1 ? h : vh - h;
    return res;
  }

  // Nhảy (đường cong) từ chỗ đang đứng sang cạnh khác; xoay dần từ góc cũ sang góc mới.
  function startJump(edge, u, dir, vw, vh, H) {
    const [x, y] = anchor(edge, u, vw, vh);
    cat.jump = { t: 0, dur: 0.75, from: { x: cat.px, y: cat.py, a: cat.angle }, to: { edge, u, dir, x, y, a: EDGE_ANGLE[edge] },
      arc: Math.max(60, H * 0.45) };
    cat.mode = 'jump'; cat.clip = 'walk'; cat.t = 0; cat.dir = dir;
    meow(false);
  }
  function jumpToWall(vw, vh, W, H) {
    const edge = cat.dir > 0 ? 1 : 3, lo = Math.min(W / 2, vh / 2);
    cat.wallTop = Math.max(W + 40, vh * (0.4 + 0.4 * Math.random()));
    startJump(edge, edge === 1 ? lo : vh - lo, edge === 1 ? 1 : -1, vw, vh, H);
  }
  function jumpToFloor(vw, vh, W, H) {
    const right = cat.edge === 1, lo = Math.min(W / 2, vw / 2);
    startJump(0, right ? vw - lo - 0.15 * W : lo + 0.15 * W, right ? -1 : 1, vw, vh, H);
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!alive()) { stopPurr(); host.remove(); return; }
    const vis = state.catOn || blocking;
    cv.style.display = vis ? '' : 'none';
    if (!vis || !clips.walk) return requestAnimationFrame(tick);

    const vw = window.innerWidth, vh = window.innerHeight;
    const wantScale = blocking && cat.edge === 0 ? blockScale(clips.walk.w, clips.walk.h) : ROAM_SCALE;
    cat.scale += (wantScale - cat.scale) * Math.min(1, dt * 2);
    const base = clips.walk, W = base.w * cat.scale, H = base.h * cat.scale;
    const speed = SPEED * Math.pow(cat.scale / ROAM_SCALE, 0.6);
    const centerU = vw / 2;

    cat.t += dt;
    const c = clips[cat.clip];
    if (cat.mode === 'jump') {
      const j = cat.jump; j.t += dt;
      if (j.t >= j.dur) {
        cat.edge = j.to.edge; cat.u = j.to.u; cat.dir = j.to.dir; cat.jump = null;
        cat.px = j.to.x; cat.py = j.to.y; cat.angle = j.to.a;
        enterWalk();
        cat.nextTurn = cat.t + 8 + Math.random() * 12;
      }
    } else if (cat.mode === 'walk') {
      if (blocking) {            // xuống chân tường (nếu đang trên tường) rồi đi về giữa mặt đất
        if (cat.edge === 0) {
          const dx = centerU - cat.u;
          if (Math.abs(dx) < 8) { cat.dir = 1; enterSit(); meow(true); }
          else cat.dir = Math.sign(dx);
        } else cat.dir = -upDir();
      } else {
        if (cat.t > cat.nextTurn) { turnAround(true); cat.nextTurn = cat.t + 8 + Math.random() * 12; }
        if (cat.t > cat.nextSit) {
          if (cat.edge !== 0) cat.nextSit = cat.t + 3;
          else if (Math.random() < 0.25 && enterSleep(15 + Math.random() * 15)) { /* ngủ trưa */ }
          else enterSit();
        }
      }
      if (cat.mode === 'walk') {
        const hit = moveAlong(speed * dt, W, vw, vh);
        if (hit === 'end') {       // hết đường dưới đất: nhảy lên tường hoặc quay đầu
          if (!blocking && Math.random() < 0.6) jumpToWall(vw, vh, W, H); else turnAround(true);
        } else if (hit === 'top') turnAround(true);        // leo đủ cao: quay đầu đi xuống
        else if (hit === 'bottom') jumpToFloor(vw, vh, W, H);
      }
    } else if (cat.mode === 'sit') { // clip ngồi: đi vài bước rồi ngồi xuống
      const f = cat.t * c.fps;
      if (cat.t < WALK_SECONDS_IN_SIT_CLIP) moveAlong(speed * dt, W, vw, vh);
      if (f >= c.frames - 1 && !cat.holdUntil) { cat.holdUntil = cat.t + (blocking ? 1e9 : 5 + Math.random() * 7); cat.holdStart = cat.t; }
      // giờ nghỉ dài: ngồi một lúc rồi ngủ gừ gừ
      if (blocking && cat.holdStart && cat.t - cat.holdStart > 12 && enterSleep(1e9)) { /* ngủ */ }
      else if (cat.holdUntil && cat.t > cat.holdUntil) enterStandup();
    } else if (cat.mode === 'sleep') {
      if (cat.t > cat.holdUntil) enterWalk(Math.random() < 0.5 ? 1 : -1);
    } else if (cat.mode === 'scratch') {
      if (cat.t * c.fps >= c.frames) { if (blocking && cat.edge === 0) enterRestedSit(); else enterWalk(); }
    } else if (cat.mode === 'standup') {
      if (cat.t * c.fps >= c.frames) enterWalk(cat.dir);
    } else if (cat.mode === 'turn') {
      if (cat.t * c.fps >= c.frames) { cat.dir = -cat.dir; enterWalk(); }
    } else if (cat.mode === 'pet') {      // được xoa đầu xong thì quay lại việc đang làm
      if (cat.t * c.fps >= c.frames) { if (blocking && cat.edge === 0) enterRestedSit(); else enterWalk(); }
    }

    const cc = clips[cat.clip];
    const looping = cat.mode === 'walk' || cat.mode === 'sleep' || cat.mode === 'jump';
    const frame = looping ? (cat.t * cc.fps) % cc.frames : Math.min(cc.frames - 1, cat.t * cc.fps);
    cat.flip = cat.mode === 'turn' ? cat.turnFlip : cat.dir < 0; cat.frame = frame | 0;
    drawFrame(cat.clip, frame, cat.flip);

    // vị trí + góc xoay theo cạnh đang đứng (làm mượt để quanh góc không bị giật)
    const [tx, ty] = anchor(cat.edge, cat.u, vw, vh);
    const ta = EDGE_ANGLE[cat.edge];
    if (!cat.started) { cat.px = tx; cat.py = ty; cat.angle = ta; cat.started = true; }
    if (cat.mode === 'jump') {
      const j = cat.jump, p = Math.min(1, j.t / j.dur), e = p * p * (3 - 2 * p);
      cat.px = j.from.x + (j.to.x - j.from.x) * e;
      cat.py = j.from.y + (j.to.y - j.from.y) * e - j.arc * Math.sin(Math.PI * p);
      cat.angle = j.from.a + norm180(j.to.a - j.from.a) * e;
    } else {
      const k = Math.min(1, dt * 10);
      cat.px += (tx - cat.px) * k; cat.py += (ty - cat.py) * k;
      cat.angle += norm180(ta - cat.angle) * k;
    }
    cv.style.transform = `translate(${cat.px}px,${cat.py}px) rotate(${cat.angle}deg) scale(${cat.scale}) translate(${-base.w / 2}px,${-base.h * (FEET[cat.clip] || 0.95)}px)`;

    if (blocking) {
      const left = Math.max(0, state.endsAt - Date.now());
      $('#sub').textContent = `Còn ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')} · bấm vào mèo để nghe meo`;
    }
    requestAnimationFrame(tick);
  }

  // ---------- State sync ----------
  function applyState() {
    const shouldBlock = state.phase === 'break';
    if (shouldBlock && !blocking) {
      blocking = true; dim.classList.add('on'); bubble.classList.add('on'); startPurr();
      if (cat.mode !== 'walk' && cat.mode !== 'jump') enterWalk();
    }
    if (!shouldBlock && blocking) {
      blocking = false; dim.classList.remove('on'); bubble.classList.remove('on'); stopPurr();
      if (cat.mode !== 'jump') enterWalk();
    }
    if (master) master.gain.value = state.volume;
  }
  chrome.storage.local.get(null).then((s) => { state = { ...state, ...s }; applyState(); });
  chrome.storage.onChanged.addListener((ch) => {
    for (const k in ch) state[k] = ch[k].newValue;
    applyState();
  });

  // Trỏ vào đầu: con trỏ thành bàn tay (xoa đầu); trỏ vào thân: con trỏ thường, bấm thì mèo cào.
  let lastMove = 0;
  cv.addEventListener('mousemove', (e) => {
    const now = performance.now(); if (now - lastMove < 40) return; lastMove = now;
    cv.style.cursor = zoneAt(e.clientX, e.clientY) === 'head' ? 'grab' : 'pointer';
  });
  cv.addEventListener('mousedown', (e) => { if (zoneAt(e.clientX, e.clientY) === 'head') cv.style.cursor = 'grabbing'; });
  cv.addEventListener('click', (e) => {
    if (zoneAt(e.clientX, e.clientY) === 'head') pet(e.clientX, e.clientY); else scratch();
    if (blocking) startPurr();
  });
  $('#skip').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'skip-break' }));
  // mở khoá audio ở lần chạm đầu tiên (chính sách autoplay)
  addEventListener('pointerdown', () => { audio(); if (blocking) startPurr(); }, { capture: true });
  addEventListener('keydown', () => audio(), { capture: true });

  // cho app desktop: biết khi nào con trỏ đang ở trên mèo / đang chặn màn hình để bật tắt click-through
  window.__kitten = {
    isBlocking: () => blocking,
    hit: (x, y) => {
      if (cv.style.display === 'none') return false;
      const r = cv.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    },
  };

  // ---------- Tải/giải phóng sprite ----------
  // Mỗi sprite sheet giải mã ra ~70MB nên chỉ giữ trong bộ nhớ khi tab đang được nhìn thấy.
  let loading = false, unloadTimer = 0;
  function ensureLoaded() {
    if (clips.walk || loading) return;
    loading = true;
    Promise.all([loadClip('walk'), loadClip('walk_sit'), loadClip('scratch', true), loadClip('turn', true),
      loadClip('standup', true), loadClip('sleep', true), loadClip('pet', true), loadClip('pet_sit', true)])
      .catch(() => { for (const k in clips) delete clips[k]; })
      .finally(() => { loading = false; });
  }
  document.addEventListener('visibilitychange', () => {
    clearTimeout(unloadTimer);
    if (document.visibilityState === 'visible') { last = performance.now(); ensureLoaded(); }
    else unloadTimer = setTimeout(() => { for (const k in clips) delete clips[k]; cv.width = cv.height = 1; }, 20000);
  });

  // Nếu extension bị tải lại/cập nhật khi trang còn mở thì script cũ mất kết nối: tự dọn dẹp, không báo lỗi.
  function alive() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
  }

  cat.u = 80 + Math.random() * (innerWidth * 0.5);
  if (document.visibilityState === 'visible') ensureLoaded();
  requestAnimationFrame(tick);
})();
