/* ==========================================================================
 * 知潮 · 常驻看板娘「汐音」模块（伪 Live2D：分层图 + 轻量变换）
 * 仅注册到 window.ZC，不污染其他全局；IIFE 普通脚本（非 ES module）。
 * 负责：呼吸起伏、分层视差、鼠标跟随（平滑插值）、点击气泡台词 + 表情、
 *       闲置小动作、移动端收起为小头像、分级帧率节流、隐藏页暂停、
 *       设置实时响应、zc:sfx 事件、直接调用全局 openChat 打开聊天窗口。
 * 拖拽：桌面/触摸均可拖动看板娘，边界钳制在视口内；位置单独持久化到
 *       localStorage（key: zhichao:mascot:pos:v1，与设置 zhichao:settings:v1 分开），
 *       复位事件 zc:mascot:reset-pos 清除存储并回到 CSS 默认位置。
 * ========================================================================== */
(function () {
  'use strict';

  /* ---------------- 资源与文案 ---------------- */

  var ASSET = {
    body: 'assets/mascot/layer-body.webp',
    bodyNight: 'assets/mascot/layer-body-night.webp',
    backhair: 'assets/mascot/layer-backhair.webp',
    faces: {
      hi: 'assets/chibi-hi.webp',
      love: 'assets/chibi-love.png',
      lie: 'assets/chibi-lie.webp'
    }
  };

  var FACE_CYCLE = ['hi', 'love', 'lie'];

  /* 夜间主题（哥特礼服）切换：html[data-zc-theme="dark"] 时换成整图单层的哥特版，
     后发分层在夜间不参与视差（哥特版的长发已被黑纱遮住，分层无意义）。 */
  function isNightTheme() {
    return document.documentElement.getAttribute('data-zc-theme') === 'dark';
  }
  function bodySrc() { return isNightTheme() ? ASSET.bodyNight : ASSET.body; }

  /* 位置持久化独立 key（与设置 zhichao:settings:v1 分开） */
  var POS_KEY = 'zhichao:mascot:pos:v1';
  var DRAG_THRESHOLD = 5;          // px，位移超过判定为拖拽
  var EDGE_PAD = 8;                // 视口边缘保留间距

  var LINES = [
    '主人，今天的热点我都整理好啦～',
    '复习累了就歇一会儿，汐音陪着你',
    '11408 加油，今天也别熬太晚哦',
    '这条热点值得细看，要聊聊吗？',
    '哼哼，被主人发现啦～',
    '记得喝水，别一直坐着呀',
    '今天也辛苦主人啦，摸摸头',
    '有拿不准的题，随时喊汐音哦'
  ];

  var SVG_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9.1 9.1 0 0 1-3.8-.8L3 21l1.8-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/>' +
    '</svg>';

  var SVG_FOLD =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 9l6 6 6-6"/>' +
    '</svg>';

  /* ---------------- 内部状态 ---------------- */

  var state = {
    booted: false,
    root: null,
    stage: null,
    pop: null,
    layerBack: null,
    layerBody: null,
    bubble: null,
    bubbleText: null,
    face: null,
    chatBtn: null,
    foldBtn: null,
    avatar: null,

    rafId: null,
    lastTs: 0,
    fps: 30,
    motion: true,
    collapsed: false,

    pointer: { x: 0, y: 0, tx: 0, ty: 0 },
    faceIdx: 0,
    idleTimer: null,
    bubbleTimer: null,
    listeners: [],

    drag: null,                    // 进行中的拖拽会话
    dragMoved: false,              // 本次指针交互是否越过阈值（用于抑制 click）
    safeProbe: null                // 安全区探测元素
  };

  /* ---------------- 配置读取（设置只读 ZC，不写设置存储；仅看板娘位置单独持久化） ---------------- */

  function zc() { return window.ZC || null; }
  function settings() { var z = zc(); return (z && z.settings) || {}; }
  function env() { var z = zc(); return (z && z.env) || {}; }

  /* 帧率：显式 mascotFps>0 用之；0 按分级自动 low12 / 移动20 / 桌面30 / high60。
     优先复用 settings.js 共享解析，避免分级逻辑两处漂移；缺失时本地兜底。 */
  function resolveFps() {
    var z = zc();
    if (z && typeof z.resolveMascotFps === 'function') {
      try {
        var shared = z.resolveMascotFps();
        if (isFinite(shared) && shared > 0) return Math.max(1, Math.min(60, Math.round(shared)));
      } catch (err) { /* 走本地兜底 */ }
    }
    var v = Number(settings().mascotFps);
    if (v && v > 0) return Math.max(1, Math.min(60, Math.round(v)));
    var e = env();
    var tier = e.tier || 'mid';
    if (tier === 'low') return 12;
    if (e.isMobile) return 20;
    if (tier === 'high') return 60;
    return 30;
  }

  function motionOn() {
    var e = env();
    if (e.reducedMotion) return false;
    return settings().motion !== false;
  }

  function mascotEnabled() { return settings().mascot !== false; }

  /* ---------------- 事件绑定记账，便于 shutdown 彻底摘除 ---------------- */

  function on(target, evt, fn, opts) {
    target.addEventListener(evt, fn, opts);
    state.listeners.push({ target: target, evt: evt, fn: fn, opts: opts });
  }

  function detachAll() {
    state.listeners.forEach(function (rec) {
      rec.target.removeEventListener(rec.evt, rec.fn, rec.opts);
    });
    state.listeners = [];
  }

  /* ---------------- 工具 ---------------- */

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------------- 星月手账：汐音记得主人什么时候来过 ----------------
     ck 模块把到访信息挂到 ZC.visit（今天第一次来 / 是否打卡 / 连击天数），
     看板娘只读不写，台词因此能顺着主人的真实轨迹说话。 */
  function visit() {
    var z = zc();
    return (z && z.visit) || null;
  }

  function visitLines() {
    var v = visit();
    if (!v) return [];
    var out = [];
    if (v.checkedToday && v.checkinAt) {
      out.push('主人今天 ' + v.checkinAt + ' 按了月牙，汐音记在手账上啦～');
    }
    if (v.firstToday) {
      out.push('主人今天 ' + v.firstToday + ' 就来啦，我都数着呢');
    }
    if (v.streak >= 3) {
      out.push('手账连着 ' + v.streak + ' 天啦，主人好厉害～');
    }
    if (!v.checkedToday) {
      out.push('今天还没按月牙哦，去手账里点一下嘛～');
    }
    return out;
  }

  /* 月晷时钟：汐音随时能读到「现在几点」，说话才对得上此刻 */
  function clock() {
    return (window.ZCClock && window.ZCClock.info) ? window.ZCClock.info() : null;
  }

  function timeLines() {
    var c = clock();
    if (!c) return [];
    var out = ['现在是 ' + c.hm + '，汐音一直看着钟呢'];
    if (c.phase === 'deep' || c.phase === 'late') {
      out.push('都 ' + c.hm + ' 了…主人该睡啦，明天再继续好不好');
    } else if (c.phase === 'noon') {
      out.push('中午了，' + c.hm + ' 还没吃饭的话，现在就去');
    } else if (c.phase === 'dusk') {
      out.push('傍晚 ' + c.hm + '，今天辛苦啦，缓一缓吧');
    } else {
      out.push('已经是' + c.label + '了，' + c.hm + ' 这一刻汐音也记下了');
    }
    return out;
  }

  function greetLine() {
    var c = clock();
    var v = visit();
    var hello = c ? c.hello + '。' : '';
    if (v && v.checkedToday && v.checkinAt) return hello + '今天 ' + v.checkinAt + ' 的月牙按过啦，欢迎回来～';
    if (v && v.firstToday) return hello + '主人今天 ' + v.firstToday + ' 就来啦，汐音一直等着呢～';
    if (v && v.streak > 0) return hello + '连着 ' + v.streak + ' 天的手账，今天也来按一下嘛～';
    return c ? c.hello + '，主人来啦～' : pick(LINES);
  }

  function sfx(name) {
    var z = zc();
    if (z && z.events) {
      z.events.dispatchEvent(new CustomEvent('zc:sfx', { detail: { name: name } }));
    }
  }

  function clearTimers() {
    if (state.idleTimer) { clearTimeout(state.idleTimer); state.idleTimer = null; }
    if (state.bubbleTimer) { clearTimeout(state.bubbleTimer); state.bubbleTimer = null; }
  }

  /* ---------------- 位置：持久化 / 边界钳制 / 复位 ---------------- */

  function safeInsets() {
    // env(safe-area-inset-*) 无法直接读 JS，用一个探测元素取计算值
    if (!state.safeProbe) {
      state.safeProbe = document.createElement('div');
      state.safeProbe.style.cssText =
        'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
        'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);' +
        'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
      document.body.appendChild(state.safeProbe);
    }
    var cs = getComputedStyle(state.safeProbe);
    return {
      l: parseFloat(cs.paddingLeft) || 0,
      r: parseFloat(cs.paddingRight) || 0,
      t: parseFloat(cs.paddingTop) || 0,
      b: parseFloat(cs.paddingBottom) || 0
    };
  }

  function clampRect(rect) {
    var s = safeInsets();
    var minX = s.l + EDGE_PAD;
    var maxX = window.innerWidth - s.r - EDGE_PAD - rect.width;
    var minY = s.t + EDGE_PAD;
    var maxY = window.innerHeight - s.b - EDGE_PAD - rect.height;
    return {
      x: Math.max(minX, Math.min(maxX, rect.left)),
      y: Math.max(minY, Math.min(maxY, rect.top))
    };
  }

  function placeAt(x, y) {
    if (!state.root) return;
    state.root.style.bottom = 'auto';
    state.root.style.left = x + 'px';
    state.root.style.top = y + 'px';
  }

  function readPos() {
    try {
      var raw = localStorage.getItem(POS_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (p && isFinite(p.x) && isFinite(p.y)) return p;
    } catch (err) { /* 存储不可用则走默认位置 */ }
    return null;
  }

  function writePos(pos) {
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y) })); }
    catch (err) { /* 私密模式等场景静默失败 */ }
  }

  function clearPos() {
    try { localStorage.removeItem(POS_KEY); } catch (err) { /* 忽略 */ }
  }

  function persistPos() {
    if (!state.root) return;
    var rect = state.root.getBoundingClientRect();
    var c = clampRect(rect);
    placeAt(c.x, c.y);
    writePos(c);
  }

  function restorePos() {
    var p = readPos();
    if (!p || !state.root) return;
    var rect = state.root.getBoundingClientRect();
    var c = clampRect({ left: p.x, top: p.y, width: rect.width, height: rect.height });
    placeAt(c.x, c.y);
  }

  function resetPos() {
    clearPos();
    if (!state.root) return;
    state.root.style.left = '';
    state.root.style.top = '';
    state.root.style.bottom = '';
  }

  /* ---------------- 拖拽（Pointer Events 统一鼠标 / 触摸） ---------------- */

  function detachDrag(handle) {
    if (!handle) return;
    handle.removeEventListener('pointermove', onHandlePointerMove);
    handle.removeEventListener('pointerup', onHandlePointerUp);
    handle.removeEventListener('pointercancel', onHandlePointerUp);
  }

  function onHandlePointerDown(e) {
    if (!state.booted || !state.root) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    state.dragMoved = false;   // 新一轮交互开始即复位，避免上一轮拖拽标志残留阻塞点击
    var rect = state.root.getBoundingClientRect();
    state.drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left,
      origTop: rect.top,
      moved: false,
      handle: e.currentTarget
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* 旧环境兜底 */ }
    e.currentTarget.addEventListener('pointermove', onHandlePointerMove);
    e.currentTarget.addEventListener('pointerup', onHandlePointerUp);
    e.currentTarget.addEventListener('pointercancel', onHandlePointerUp);
  }

  function onHandlePointerMove(e) {
    var d = state.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    var dx = e.clientX - d.startX;
    var dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) d.moved = true;
    if (!d.moved) return;
    var rect = state.root.getBoundingClientRect();
    var c = clampRect({ left: d.origLeft + dx, top: d.origTop + dy, width: rect.width, height: rect.height });
    placeAt(c.x, c.y);
  }

  function onHandlePointerUp(e) {
    var d = state.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    detachDrag(d.handle);
    if (d.moved) {
      state.dragMoved = true;   // 抑制随后的 click 气泡/展开逻辑
      persistPos();
    }
    state.drag = null;
  }

  function onResize() {
    if (!state.booted || !state.root) return;
    var c = clampRect(state.root.getBoundingClientRect());
    placeAt(c.x, c.y);
    if (readPos()) writePos(c);   // 已有持久化位置才随窗口变化重存，避免把默认位置写入
  }

  function onResetPos() {
    try { resetPos(); } catch (err) { console.warn('[zc-mascot] reset pos failed', err); }
  }

  /* ---------------- DOM 构建 ---------------- */

  function buildDOM() {
    var root = document.createElement('div');
    root.className = 'zc-mascot';
    root.id = 'zcMascot';
    root.setAttribute('role', 'complementary');
    root.setAttribute('aria-label', '看板娘汐音');

    root.innerHTML =
      '<div class="zc-mascot__bubble" hidden>' +
        '<img class="zc-mascot__face" src="' + ASSET.faces.hi + '" alt="">' +
        '<span class="zc-mascot__bubble-text"></span>' +
      '</div>' +
      '<div class="zc-mascot__stage" role="button" tabindex="0" aria-label="点一下汐音">' +
        '<div class="zc-mascot__bob">' +
          '<div class="zc-mascot__pop">' +
            '<div class="zc-mascot__layer zc-mascot__layer-back">' +
              (isNightTheme() ? '' : '<img src="' + ASSET.backhair + '" alt="" draggable="false">') +
            '</div>' +
            '<div class="zc-mascot__layer zc-mascot__layer-body">' +
              '<img src="' + bodySrc() + '" alt="汐音" draggable="false">' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="zc-mascot__actions">' +
        '<button class="zc-mascot__btn zc-mascot__chat" type="button" aria-label="和汐音聊天">' +
          SVG_CHAT + '<span class="zc-mascot__btn-label">聊聊</span>' +
        '</button>' +
        '<button class="zc-mascot__btn zc-mascot__fold" type="button" aria-label="收起看板娘">' +
          SVG_FOLD +
        '</button>' +
      '</div>' +
      '<button class="zc-mascot__avatar" type="button" aria-label="展开汐音">' +
        '<img src="' + bodySrc() + '" alt="汐音小头像" draggable="false">' +
      '</button>';

    return root;
  }

  function grabRefs() {
    state.stage = state.root.querySelector('.zc-mascot__stage');
    state.pop = state.root.querySelector('.zc-mascot__pop');
    state.layerBack = state.root.querySelector('.zc-mascot__layer-back');
    state.layerBody = state.root.querySelector('.zc-mascot__layer-body');
    state.bubble = state.root.querySelector('.zc-mascot__bubble');
    state.bubbleText = state.root.querySelector('.zc-mascot__bubble-text');
    state.face = state.root.querySelector('.zc-mascot__face');
    state.chatBtn = state.root.querySelector('.zc-mascot__chat');
    state.foldBtn = state.root.querySelector('.zc-mascot__fold');
    state.avatar = state.root.querySelector('.zc-mascot__avatar');
  }

  /* 主题切换时只换资源，不重建 DOM：呼吸、跟随、拖拽位置都保持原样 */
  function applyThemeAssets() {
    if (!state.booted) return;
    var src = bodySrc();
    [state.layerBody, state.avatar].forEach(function (host) {
      if (!host) return;
      var im = host.tagName === 'IMG' ? host : host.querySelector('img');
      if (im && im.getAttribute('src') !== src) im.src = src;
    });
    if (!state.layerBack) return;
    var backImg = state.layerBack.querySelector('img');
    if (isNightTheme()) {
      if (backImg) state.layerBack.removeChild(backImg);
    } else if (!backImg) {
      var im = document.createElement('img');
      im.src = ASSET.backhair;
      im.alt = '';
      im.draggable = false;
      state.layerBack.appendChild(im);
    }
  }

  function watchTheme() {
    if (state.themeObserver) return;
    state.themeObserver = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].attributeName === 'data-zc-theme') { applyThemeAssets(); return; }
      }
    });
    state.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-zc-theme']
    });
  }

  /* ---------------- 气泡与反馈 ---------------- */

  function hideBubble() {
    if (!state.bubble) return;
    state.bubble.classList.remove('on');
    state.bubble.hidden = true;
  }

  function showBubble(line, faceKey) {
    if (!state.bubble) return;
    state.face.src = ASSET.faces[faceKey] || ASSET.faces.hi;
    state.bubbleText.textContent = line;
    state.bubble.hidden = false;
    // 强制回流后再加 class，保证过渡重新触发
    void state.bubble.offsetWidth;
    state.bubble.classList.add('on');
    clearTimeout(state.bubbleTimer);
    state.bubbleTimer = setTimeout(hideBubble, 3600);
  }

  function bounce() {
    if (!state.pop) return;
    state.pop.classList.remove('bounce');
    void state.pop.offsetWidth;
    state.pop.classList.add('bounce');
  }

  function react() {
    state.faceIdx = (state.faceIdx + 1) % FACE_CYCLE.length;
    showBubble(pick(LINES.concat(visitLines(), timeLines())), FACE_CYCLE[state.faceIdx]);
    bounce();
  }

  /* ---------------- 闲置小动作 ---------------- */

  function scheduleIdle() {
    clearTimeout(state.idleTimer);
    state.idleTimer = setTimeout(idleAction, 16000 + Math.random() * 12000);
  }

  function idleAction() {
    if (!state.booted || state.collapsed) { scheduleIdle(); return; }
    // 闲置时偶尔冒一句软文案，表情在 hi / lie 之间轻切
    var faceKey = Math.random() < 0.5 ? 'hi' : 'lie';
    showBubble(pick(LINES.concat(visitLines(), timeLines())), faceKey);
    scheduleIdle();
  }

  /* ---------------- 聊天联动：直接调用全局 openChat，不重复实现聊天 ---------------- */

  function openChat() {
    sfx('click');
    // 兼容旧版浮动入口：若页面仍存在 #chatLaunch 则点击它，否则直接调用全局 openChat
    var launch = document.getElementById('chatLaunch');
    if (launch && !launch.hidden && typeof launch.click === 'function') {
      launch.click();
      return;
    }
    if (typeof window.openChat === 'function') {
      try { window.openChat(); } catch (err) { /* 忽略：保持看板娘不报错 */ }
    }
  }

  /* ---------------- 收起 / 展开 ---------------- */

  function setCollapsed(v) {
    state.collapsed = !!v;
    if (state.root) state.root.classList.toggle('is-collapsed', state.collapsed);
    if (state.collapsed) hideBubble();
  }

  /* ---------------- 动画循环（帧率节流 + 平滑插值） ---------------- */

  function startLoop() {
    if (state.rafId == null) {
      state.lastTs = 0;
      state.rafId = requestAnimationFrame(loop);
    }
  }

  function stopLoop() {
    if (state.rafId != null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  function loop(ts) {
    state.rafId = requestAnimationFrame(loop);
    if (!state.booted) return;
    if (document.hidden) { state.lastTs = ts; return; }

    var interval = 1000 / state.fps;
    if (!state.lastTs) state.lastTs = ts;
    var dt = ts - state.lastTs;
    state.lastTs = ts;
    if (dt < interval) return;          // 帧时间节流：超过帧率上限才渲染一帧
    dt = Math.min(dt, 100);

    update(dt);
  }

  function update(dt) {
    var p = state.pointer;
    if (state.motion) {
      var k = 1 - Math.exp(-dt / 140);  // 指数平滑插值，跟随不生硬
      p.x += (p.tx - p.x) * k;
      p.y += (p.ty - p.y) * k;
    } else {
      p.x = 0; p.y = 0; p.tx = 0; p.ty = 0;
    }

    if (!state.stage) return;
    var sx = p.x, sy = p.y;
    // 根层：整体小幅位移 + 轻微偏转
    state.stage.style.transform =
      'translate3d(' + (sx * 7).toFixed(2) + 'px,' + (sy * 5).toFixed(2) + 'px,0)' +
      ' rotate(' + (sx * 2.2).toFixed(2) + 'deg)';
    // 视差：后发反向偏移且幅度更大，身体小幅跟随，形成层次
    state.layerBack.style.transform =
      'translate3d(' + (sx * -6).toFixed(2) + 'px,' + (sy * -3).toFixed(2) + 'px,0)';
    state.layerBody.style.transform =
      'translate3d(' + (sx * 3).toFixed(2) + 'px,' + (sy * 2).toFixed(2) + 'px,0)';
  }

  /* ---------------- 设置响应 ---------------- */

  function applySettings() {
    if (!state.root) return;
    state.fps = resolveFps();
    state.motion = motionOn();
    state.root.classList.toggle('zc-mascot--static', !state.motion);
    var show = mascotEnabled();
    state.root.style.display = show ? '' : 'none';
    if (show) { scheduleIdle(); startLoop(); } else { clearTimers(); hideBubble(); stopLoop(); }
  }

  function onSettings() {
    try { applySettings(); } catch (err) { console.warn('[zc-mascot] settings apply failed', err); }
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindEvents() {
    on(window, 'pointermove', function (e) {
      var x = (e.clientX / window.innerWidth) * 2 - 1;
      var y = (e.clientY / window.innerHeight) * 2 - 1;
      state.pointer.tx = Math.max(-1, Math.min(1, x));
      state.pointer.ty = Math.max(-1, Math.min(1, y));
    }, { passive: true });

    // 拖拽手柄：展开态舞台 + 收起态头像；按钮不参与拖拽
    on(state.stage, 'pointerdown', onHandlePointerDown);
    on(state.avatar, 'pointerdown', onHandlePointerDown);

    on(state.stage, 'click', function () {
      if (!state.booted) return;
      if (state.dragMoved) { state.dragMoved = false; return; }  // 拖拽后抑制气泡
      sfx('pop');
      react();
      scheduleIdle();
    });

    on(state.stage, 'keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sfx('pop');
        react();
        scheduleIdle();
      }
    });

    on(state.chatBtn, 'click', function (e) {
      e.stopPropagation();
      openChat();
    });

    on(state.foldBtn, 'click', function (e) {
      e.stopPropagation();
      sfx('click');
      setCollapsed(true);
    });

    on(state.avatar, 'click', function () {
      if (state.dragMoved) { state.dragMoved = false; return; }  // 拖拽后不触发展开
      sfx('click');
      setCollapsed(false);
    });

    var z = zc();
    if (z && z.events) {
      on(z.events, 'zc:settings', onSettings);
      on(z.events, 'zc:mascot:reset-pos', onResetPos);
      // 月晷时钟：整点、跨时段、点表盘时汐音都接一句话
      on(z.events, 'zc:hour', function (e) {
        var d = (e && e.detail) || {};
        if (!state.booted || state.collapsed) return;
        showBubble(d.line || '整点啦～', 'hi');
        scheduleIdle();
      });
      on(z.events, 'zc:phase', function (e) {
        var d = (e && e.detail) || {};
        if (!state.booted || state.collapsed) return;
        showBubble(d.line || ('到' + (d.label || '') + '了呢'), 'hi');
        scheduleIdle();
      });
      on(z.events, 'zc:clock', function (e) {
        var d = (e && e.detail) || {};
        if (!state.booted || state.collapsed) return;
        showBubble(d.line || '汐音看看现在几点…', 'hi');
        bounce();
        scheduleIdle();
      });

      // 打卡成功：汐音自己也冒一句、弹一下，与手账卡片上的反应呼应
      on(z.events, 'zc:checkin', function (e) {
        var d = (e && e.detail) || {};
        if (!state.booted || state.collapsed) return;
        sfx('pop');
        showBubble(d.line || '主人打卡啦～', 'love');
        bounce();
        scheduleIdle();
      });
    }

    on(window, 'resize', onResize);

    on(document, 'visibilitychange', function () {
      if (document.hidden) { stopLoop(); } else if (state.booted) { startLoop(); }
    });
  }

  /* ---------------- 生命周期 ---------------- */

  function preload() {
    [ASSET.body, ASSET.bodyNight, ASSET.backhair].forEach(function (src) {
      var im = new Image();
      im.src = src;
    });
  }

  function boot() {
    if (state.booted) return Promise.resolve();
    try {
      state.root = buildDOM();
      document.body.appendChild(state.root);
      grabRefs();

      // 移动端 / 窄屏默认收起为小头像，避免遮挡正文
      var e = env();
      var narrow = window.innerWidth <= 720;
      setCollapsed(!!(e.isMobile || narrow));

      restorePos();
      bindEvents();
      applySettings();
      watchTheme();
      applyThemeAssets();
      preload();

      state.booted = true;
      startLoop();
      scheduleIdle();

      // 到场打招呼：用星月手账里的真实到访时间，会话内只冒一句
      setTimeout(function () {
        if (!state.booted || state.collapsed) return;
        showBubble(greetLine(), 'hi');
      }, 1500);
    } catch (err) {
      console.warn('[zc-mascot] boot failed', err);
      shutdown(); // 部分挂载时回滚，保证幂等
    }
    return Promise.resolve();
  }

  function shutdown() {
    try {
      stopLoop();
      clearTimers();
      detachDrag(state.stage);
      detachDrag(state.avatar);
      detachAll();
      if (state.themeObserver) { state.themeObserver.disconnect(); state.themeObserver = null; }
      if (state.safeProbe && state.safeProbe.parentNode) {
        state.safeProbe.parentNode.removeChild(state.safeProbe);
      }
      if (state.root && state.root.parentNode) {
        state.root.parentNode.removeChild(state.root);
      }
    } catch (err) {
      console.warn('[zc-mascot] shutdown failed', err);
    }
    state.booted = false;
    state.root = null;
    state.stage = null;
    state.pop = null;
    state.layerBack = null;
    state.layerBody = null;
    state.bubble = null;
    state.bubbleText = null;
    state.face = null;
    state.chatBtn = null;
    state.foldBtn = null;
    state.avatar = null;
    state.safeProbe = null;
    state.drag = null;
    state.dragMoved = false;
    state.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    state.faceIdx = 0;
    return Promise.resolve();
  }

  /* ---------------- 注册到 ZC ---------------- */

  function register() {
    if (window.ZC && typeof window.ZC.register === 'function') {
      window.ZC.register('mascot', { boot: boot, shutdown: shutdown });
      return true;
    }
    return false;
  }

  if (!register()) {
    // 防御性兜底：settings.js 因加载顺序稍后就绪时，短窗口内重试注册
    var retry = setInterval(function () {
      if (register()) clearInterval(retry);
    }, 50);
    setTimeout(function () { clearInterval(retry); }, 3000);
  }

})();
