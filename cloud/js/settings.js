/*!
 * 知潮 · 设置与主题中心（settings.js）
 * 集成规范：docs/game-ui-integration-spec.md §2 全局命名空间 / §3 设置 schema /
 *          §4 性能分级 / §6 CSS 约定 / §7 生命周期
 * 职责：创建 window.ZC、性能分级探测、设置持久化与广播、手动三态主题、
 *       游戏菜单风格设置面板、模块编排器（boot/shutdown，容错、幂等）。
 * 仅注册与延后操作 DOM；不引入任何依赖，普通 IIFE，无 import/export。
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * 常量与 schema（§3）
   * ------------------------------------------------------------------ */
  var STORE_KEY = "zhichao:settings:v1";
  var SCHEMA = {
    version: 1,
    theme: "auto",          // auto | light | dark
    mascot: true,
    mascotFps: 0,           // 0 = 按分级自动（low 12 / 移动 20 / 桌面 30 / high 60）
    motion: true,
    bgm: false,
    bgmVolume: 0.55,        // 0–1
    sfx: true,
    sfxVolume: 0.9          // 0–1
  };

  var THEME_VALUES = ["auto", "light", "dark"];

  /* ------------------------------------------------------------------ *
   * 工具
   * ------------------------------------------------------------------ */
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function readStorage() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function writeStorage(data) {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (err) {
      /* 私密模式等场景下静默失败，内存内设置仍生效 */
    }
  }

  /* 按 schema 类型与取值域清洗单个设置项 */
  function sanitize(key, value, fallback) {
    switch (key) {
      case "theme":
        return THEME_VALUES.indexOf(value) !== -1 ? value : fallback;
      case "mascot":
      case "motion":
      case "bgm":
      case "sfx":
        return !!value;
      case "mascotFps": {
        var n = Number(value);
        if (!isFinite(n) || n < 0) return fallback;
        n = Math.round(n);
        if (n === 0) return 0;
        return Math.min(60, n);
      }
      case "bgmVolume":
      case "sfxVolume": {
        var v = Number(value);
        if (!isFinite(v)) return fallback;
        return Math.max(0, Math.min(1, v));
      }
      default:
        return fallback;
    }
  }

  /* ------------------------------------------------------------------ *
   * §4 性能分级探测（ZC.env，其他模块只读）
   * ------------------------------------------------------------------ */
  function detectEnv() {
    var nav = window.navigator || {};
    var ua = (nav.userAgent || "").toLowerCase();
    var mobileUA = /android|iphone|ipad|ipod|harmonyos|mobile/.test(ua);
    var coarse = !!(window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches);
    var vw = window.innerWidth ||
      (document.documentElement && document.documentElement.clientWidth) || 0;
    var isMobile = mobileUA || (coarse && vw <= 820);

    var cores = Math.max(1, nav.hardwareConcurrency || 4);
    var mem = nav.deviceMemory || 4;
    var reducedMotion = !!(window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    var conn = nav.connection || {};
    var saveData = !!conn.saveData;
    var slowNet = ["slow-2g", "2g", "3g"].indexOf(conn.effectiveType) !== -1;

    var tier;
    if (reducedMotion || saveData || cores <= 2 || (isMobile && cores <= 4)) {
      tier = "low";
    } else if (!isMobile && cores >= 8 && mem >= 8 && !reducedMotion) {
      tier = "high";
    } else {
      tier = "mid";
    }

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (tier === "low") dpr = 1;

    return {
      isMobile: isMobile,
      cores: cores,
      mem: mem,
      reducedMotion: reducedMotion,
      saveData: saveData,
      slowNet: slowNet,
      dpr: dpr,
      tier: tier
    };
  }

  /* 首次运行默认值：移动 / 低性能关粒子、跳过开屏；reduced-motion 关动效 */
  function defaultsByEnv(env) {
    var d = clone(SCHEMA);
    if (env.reducedMotion) d.motion = false;
    return d;
  }

  function loadSettings(env) {
    var settings = defaultsByEnv(env);
    var stored = readStorage();
    if (stored) {
      Object.keys(SCHEMA).forEach(function (key) {
        if (key === "version") return;
        if (stored[key] !== undefined) {
          settings[key] = sanitize(key, stored[key], settings[key]);
        }
      });
    }
    settings.version = 1;
    return settings;
  }

  /* ------------------------------------------------------------------ *
   * 全局命名空间（§2）
   * ------------------------------------------------------------------ */
  var env = detectEnv();
  var settings = loadSettings(env);

  var ZC = {
    version: 1,
    events: new EventTarget(),
    env: env,
    settings: settings,
    modules: {},
    register: register,
    boot: boot,
    shutdown: shutdown,
    /* 共享辅助：mascotFps = 0 时按分级解析显式帧率 */
    resolveMascotFps: resolveMascotFps,
    set: setSetting,
    patch: patchSettings
  };
  window.ZC = ZC;

  function resolveMascotFps() {
    var v = Number(ZC.settings.mascotFps);
    if (isFinite(v) && v > 0) return Math.min(60, Math.round(v));
    if (ZC.env.tier === "low") return 12;
    if (ZC.env.isMobile) return 20;
    if (ZC.env.tier === "high") return 60;
    return 30;
  }

  /* ------------------------------------------------------------------ *
   * 主题解析与生效（§3 / §6：html[data-zc-theme] 挂实际值）
   * ------------------------------------------------------------------ */
  var darkMQ = window.matchMedia("(prefers-color-scheme: dark)");

  function resolvedTheme() {
    if (ZC.settings.theme === "auto") {
      return darkMQ.matches ? "dark" : "light";
    }
    return ZC.settings.theme;
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-zc-theme", resolvedTheme());
  }

  function onSystemThemeChange() {
    if (ZC.settings.theme === "auto") applyTheme();
  }
  if (typeof darkMQ.addEventListener === "function") {
    darkMQ.addEventListener("change", onSystemThemeChange);
  } else if (typeof darkMQ.addListener === "function") {
    darkMQ.addListener(onSystemThemeChange);
  }

  /* ------------------------------------------------------------------ *
   * 设置更新：写 ZC.settings → 持久化 → 生效 → 广播 zc:settings（§3 / §5）
   * ------------------------------------------------------------------ */
  function persist() {
    var out = { version: 1 };
    Object.keys(SCHEMA).forEach(function (key) {
      if (key === "version") return;
      out[key] = ZC.settings[key];
    });
    writeStorage(out);
  }

  function broadcast(changed) {
    var ev = new CustomEvent("zc:settings", {
      detail: { settings: ZC.settings, changed: changed }
    });
    ZC.events.dispatchEvent(ev);
  }

  function setSetting(key, value) {
    if (!Object.prototype.hasOwnProperty.call(SCHEMA, key) || key === "version") return;
    var clean = sanitize(key, value, ZC.settings[key]);
    if (ZC.settings[key] === clean) return;
    ZC.settings[key] = clean;
    persist();
    if (key === "theme") applyTheme();
    var changed = {};
    changed[key] = clean;
    broadcast(changed);
    syncPanelUI();
  }

  function patchSettings(patch) {
    if (!patch || typeof patch !== "object") return;
    var changed = {};
    Object.keys(patch).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(SCHEMA, key) || key === "version") return;
      var clean = sanitize(key, patch[key], ZC.settings[key]);
      if (ZC.settings[key] !== clean) {
        ZC.settings[key] = clean;
        changed[key] = clean;
      }
    });
    if (Object.keys(changed).length === 0) return;
    persist();
    if ("theme" in changed) applyTheme();
    broadcast(changed);
    syncPanelUI();
  }

  /* ------------------------------------------------------------------ *
   * 模块注册与编排器（§2 / §7）
   * boot/shutdown 容错：单模块抛错不影响其他模块；可重复调用、幂等。
   * ------------------------------------------------------------------ */
  var booted = false;
  var bootSettled = false;
  var deferredHandles = [];

  function register(name, api) {
    if (!name || typeof api !== "object" || api === null) return;
    ZC.modules[name] = {
      boot: typeof api.boot === "function" ? api.boot : null,
      shutdown: typeof api.shutdown === "function" ? api.shutdown : null
    };
  }

  function invokeModule(fn, name, onDone) {
    if (typeof fn !== "function") { if (onDone) onDone(); return; }
    var finished = false;
    function settle() {
      if (finished) return;
      finished = true;
      if (onDone) onDone();
    }
    try {
      var ret = fn();
      if (ret && typeof ret.then === "function") {
        ret.then(settle, function (err) {
          console.warn("[ZC] 模块 " + name + " 异步异常：", err);
          settle();
        });
      } else {
        settle();
      }
    } catch (err) {
      console.warn("[ZC] 模块 " + name + " 同步异常：", err);
      settle();
    }
  }

  function idleRun(callback) {
    if (typeof window.requestIdleCallback === "function") {
      var handle = window.requestIdleCallback(callback, { timeout: 200 });
      deferredHandles.push({ idle: true, handle: handle });
    } else {
      var timer = window.setTimeout(callback, 60);
      deferredHandles.push({ idle: false, handle: timer });
    }
  }

  function clearDeferred() {
    deferredHandles.forEach(function (entry) {
      try {
        if (entry.idle && typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(entry.handle);
        } else if (!entry.idle) {
          window.clearTimeout(entry.handle);
        }
      } catch (err) { /* 忽略清理异常 */ }
    });
    deferredHandles = [];
  }

  function boot() {
    if (booted) return Promise.resolve(); // 幂等：重复 boot 不重复启动
    booted = true;
    bootSettled = false;
    applyTheme();
    buildPanel(); // 注入导航入口与面板骨架（轻量 DOM，幂等）

    var names = Object.keys(ZC.modules);
    /* §7：game-ui 开屏先启动；其余模块在空闲回调中逐个懒启动 */
    var immediate = names.filter(function (n) { return n === "game-ui"; });
    var deferred = names.filter(function (n) { return n !== "game-ui"; });

    var pending = 0;
    function maybeFireBoot() {
      /* §5：zc:boot 在全部模块 boot 完成后广播；登出后迟到回调不再触发 */
      if (!booted || bootSettled || pending > 0) return;
      bootSettled = true;
      ZC.events.dispatchEvent(new CustomEvent("zc:boot", {
        detail: { tier: ZC.env.tier }
      }));
    }

    immediate.forEach(function (n) {
      pending++;
      invokeModule(ZC.modules[n].boot, n, function () { pending--; maybeFireBoot(); });
    });
    deferred.forEach(function (n) {
      pending++;
      idleRun(function () {
        invokeModule(ZC.modules[n].boot, n, function () { pending--; maybeFireBoot(); });
      });
    });

    maybeFireBoot(); // 无注册模块时立即广播
    return Promise.resolve();
  }

  function shutdown() {
    if (!booted) return; // 幂等：未启动直接返回
    booted = false;
    bootSettled = true; // 阻止迟到的 boot 完成回调广播 zc:boot
    clearDeferred();
    var names = Object.keys(ZC.modules).reverse(); // 逆序关闭
    names.forEach(function (n) { invokeModule(ZC.modules[n].shutdown, n); });
    closePanel();
  }

  /* ------------------------------------------------------------------ *
   * 设置面板（游戏菜单风格，class 前缀 zc-set-*，§8）
   * 脚本 defer 执行时 DOM 已解析；面板与触发按钮由本模块注入。
   * ------------------------------------------------------------------ */
  var panelRef = { overlay: null, trigger: null, root: null, track: null };
  var panelBuilt = false;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function tierLabel() {
    var map = { low: "低", mid: "中", high: "高" };
    var label = "性能分级：" + (map[env.tier] || env.tier);
    if (env.isMobile) label += " · 移动";
    if (env.reducedMotion) label += " · 减弱动效";
    return label;
  }

  function buildPanel() {
    if (panelBuilt) return;
    panelBuilt = true;

    /* 触发按钮：注入左侧导航 rail，复用现有 menu-item 视觉 */
    var rail = document.querySelector(".rail");
    if (rail) {
      var trigger = el("button", "menu-item log-btn zc-set-trigger");
      trigger.type = "button";
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-label", "打开设置");
      trigger.style.setProperty("--c", "var(--accent)");
      var ic = el("span", "ic");
      ic.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="3"/>' +
        '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
        "</svg>";
      var lb = el("span", "lb", "设置");
      trigger.appendChild(ic);
      trigger.appendChild(lb);
      trigger.addEventListener("click", openPanel);
      rail.appendChild(trigger);
      panelRef.trigger = trigger;
    }

    /* 遮罩 + 面板 */
    var overlay = el("div", "zc-set-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "设置");
    var panel = el("div", "zc-set-panel");
    overlay.appendChild(panel);

    /* 头部：标题 + 主题快捷切换 + 关闭 */
    var head = el("div", "zc-set-head");
    var title = el("div", "zc-set-title", "设置");
    head.appendChild(title);

    var themeSeg = el("div", "zc-set-seg zc-set-theme");
    themeSeg.dataset.key = "theme";
    [["auto", "自动"], ["light", "浅色"], ["dark", "深色"]].forEach(function (opt) {
      var b = el("button", null, opt[1]);
      b.type = "button";
      b.dataset.value = opt[0];
      b.addEventListener("click", function () { setSetting("theme", opt[0]); });
      themeSeg.appendChild(b);
    });
    head.appendChild(themeSeg);

    var closeBtn = el("button", "zc-set-close", "×");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "关闭设置");
    closeBtn.addEventListener("click", closePanel);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    var body = el("div", "zc-set-body");
    panel.appendChild(body);

    /* 性能分级徽标（只读） */
    var badge = el("div", "zc-set-badge", tierLabel());
    body.appendChild(badge);

    /* —— 外观 / 粒子 —— */
    body.appendChild(sectionTitle("视觉与动效"));
    body.appendChild(rowSwitch("motion", "界面动效", "入场动画、视差与悬浮反馈"));

    /* —— 看板娘 —— */
    body.appendChild(sectionTitle("看板娘"));
    body.appendChild(rowSwitch("mascot", "常驻看板娘", "汐音在页面角落陪伴互动"));
    body.appendChild(rowFps());
    body.appendChild(rowMascotReset());

    /* —— 音频 —— */
    body.appendChild(sectionTitle("音频"));
    body.appendChild(rowSwitch("bgm", "背景音乐", "挑一首在页面角落轻轻循环，随时可停"));
    body.appendChild(rowTrack());
    body.appendChild(rowRange("bgmVolume", "BGM 音量"));
    body.appendChild(rowCredits());
    body.appendChild(rowSwitch("sfx", "音效", "每一次点击、收藏、删除都有一记轻音"));
    body.appendChild(rowRange("sfxVolume", "音效音量"));

    overlay.addEventListener("mousedown", function (ev) {
      if (ev.target === overlay) closePanel();
    });
    document.addEventListener("keydown", onKeyDown);

    document.body.appendChild(overlay);
    if (window.ZC && ZC.events) {
      ZC.events.addEventListener("zc:bgm:tracks", refreshTrackSelect);
      ZC.events.addEventListener("zc:bgm", refreshTrackSelect);
    }
    panelRef.overlay = overlay;
    panelRef.root = panel;

    syncPanelUI();
  }

  function sectionTitle(text) {
    return el("div", "zc-set-sec-title", text);
  }

  function rowSwitch(key, name, desc) {
    var row = el("div", "zc-set-row");
    var info = el("div", "zc-set-row-info");
    info.appendChild(el("div", "zc-set-row-name", name));
    if (desc) info.appendChild(el("div", "zc-set-row-desc", desc));
    row.appendChild(info);

    var sw = el("button", "zc-set-switch");
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.dataset.key = key;
    sw.appendChild(el("span", "zc-set-knob"));
    sw.addEventListener("click", function () {
      setSetting(key, !ZC.settings[key]);
    });
    row.appendChild(sw);
    return row;
  }

  function rowSeg(key, name, options, dependKey) {
    var row = el("div", "zc-set-row");
    var info = el("div", "zc-set-row-info");
    info.appendChild(el("div", "zc-set-row-name", name));
    row.appendChild(info);

    var seg = el("div", "zc-set-seg");
    seg.dataset.key = key;
    if (dependKey) seg.dataset.depend = dependKey;
    options.forEach(function (opt) {
      var b = el("button", null, opt[1]);
      b.type = "button";
      b.dataset.value = opt[0];
      b.addEventListener("click", function () { setSetting(key, opt[0]); });
      seg.appendChild(b);
    });
    row.appendChild(seg);
    return row;
  }

  function bgmApi(){ return window.ZCBgm || null; }

  function refreshTrackSelect() {
    if (!panelRef.track) return;
    var api = bgmApi();
    var list = api ? api.tracks() : [];
    var cur = api ? api.current().id : "";
    var sel = panelRef.track;
    sel.innerHTML = "";
    if (!list.length) {
      var o0 = el("option", null, "还没有曲目");
      o0.value = "";
      sel.appendChild(o0);
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    list.forEach(function (t) {
      var o = el("option", null, (t.title || t.id) + (t.artist ? " · " + t.artist : ""));
      o.value = t.id;
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  }

  function rowTrack() {
    var row = el("div", "zc-set-row");
    var info = el("div", "zc-set-row-info");
    info.appendChild(el("div", "zc-set-row-name", "曲目"));
    info.appendChild(el("div", "zc-set-row-desc", "换一首，正在放的那首会淡出再换"));
    row.appendChild(info);

    var select = el("select", "zc-set-select");
    select.addEventListener("change", function () {
      var api = bgmApi();
      if (api && select.value) api.pick(select.value);
    });
    row.appendChild(select);
    panelRef.track = select;
    refreshTrackSelect();
    return row;
  }

  function rowCredits() {
    var row = el("div", "zc-set-row zc-set-row-note");
    var info = el("div", "zc-set-row-info");
    var cur = bgmApi() ? bgmApi().current().track : null;
    info.appendChild(el("div", "zc-set-row-desc",
      "曲目来自免费曲库 " + ((cur && cur.credit) ? cur.credit.replace("Kevin MacLeod · incompetech.com · ", "") : "CC BY 4.0") +
      "；署名：Kevin MacLeod（incompetech.com）。想加自己的曲子，放进 music 目录并登记一行就行。"));
    row.appendChild(info);
    return row;
  }

  function rowFps() {
    var row = el("div", "zc-set-row");
    var info = el("div", "zc-set-row-info");
    info.appendChild(el("div", "zc-set-row-name", "帧率"));
    info.appendChild(el("div", "zc-set-row-desc", "自动按性能分级适配"));
    row.appendChild(info);

    var select = el("select", "zc-set-select");
    select.dataset.key = "mascotFps";
    [["0", "自动"], ["12", "12"], ["20", "20"], ["30", "30"], ["60", "60"]]
      .forEach(function (opt) {
        var o = el("option", null, opt[1]);
        o.value = opt[0];
        select.appendChild(o);
      });
    select.addEventListener("change", function () {
      setSetting("mascotFps", Number(select.value));
    });
    row.appendChild(select);
    return row;
  }

  function rowMascotReset() {
    var row = el("div", "zc-set-row");
    var info = el("div", "zc-set-row-info");
    info.appendChild(el("div", "zc-set-row-name", "位置"));
    info.appendChild(el("div", "zc-set-row-desc", "可拖拽汐音到喜欢的位置，一键复位回默认角落"));
    row.appendChild(info);

    var btn = el("button", "zc-set-btn", "复位");
    btn.type = "button";
    btn.addEventListener("click", function () {
      ZC.events.dispatchEvent(new CustomEvent("zc:mascot:reset-pos", {}));
    });
    row.appendChild(btn);
    return row;
  }

  function rowRange(key, name) {
    var row = el("div", "zc-set-row");
    var info = el("div", "zc-set-row-info");
    info.appendChild(el("div", "zc-set-row-name", name));
    row.appendChild(info);

    var range = el("input", "zc-set-range");
    range.type = "range";
    range.min = "0";
    range.max = "1";
    range.step = "0.05";
    range.dataset.key = key;
    range.addEventListener("input", function () {
      setSetting(key, Number(range.value));
    });
    var val = el("span", "zc-set-val");
    val.dataset.key = key + "__label";
    row.appendChild(range);
    row.appendChild(val);
    return row;
  }

  /* 根据当前 ZC.settings 刷新面板控件态（不重建 DOM） */
  function syncPanelUI() {
    if (!panelBuilt || !panelRef.root) return;
    var root = panelRef.root;

    root.querySelectorAll("[data-key]").forEach(function (node) {
      var key = node.dataset.key;
      if (node.classList.contains("zc-set-switch")) {
        node.setAttribute("aria-checked", ZC.settings[key] ? "true" : "false");
      } else if (node.classList.contains("zc-set-seg")) {
        node.querySelectorAll("button").forEach(function (b) {
          b.classList.toggle("zc-on", b.dataset.value === String(ZC.settings[key]));
        });
        /* 依赖开关关闭时禁用次级选项 */
        if (node.dataset.depend) {
          var on = !!ZC.settings[node.dataset.depend];
          node.classList.toggle("zc-disabled", !on);
          node.querySelectorAll("button").forEach(function (b) {
            b.disabled = !on;
          });
        }
      } else if (node.tagName === "SELECT") {
        node.value = String(ZC.settings[key]);
      } else if (node.type === "range") {
        node.value = String(ZC.settings[key]);
      }
    });

    root.querySelectorAll(".zc-set-val").forEach(function (node) {
      var key = node.dataset.key.replace("__label", "");
      var pct = Math.round(Number(ZC.settings[key]) * 100);
      node.textContent = pct + "%";
    });
  }

  function onKeyDown(ev) {
    if (ev.key === "Escape" && panelRef.overlay &&
      panelRef.overlay.classList.contains("zc-open")) {
      closePanel();
    }
  }

  function openPanel() {
    buildPanel();
    if (!panelRef.overlay) return;
    panelRef.overlay.classList.add("zc-open");
    if (panelRef.trigger) panelRef.trigger.setAttribute("aria-expanded", "true");
    syncPanelUI();
    refreshTrackSelect();
  }

  function closePanel() {
    if (!panelRef.overlay) return;
    panelRef.overlay.classList.remove("zc-open");
    if (panelRef.trigger) panelRef.trigger.setAttribute("aria-expanded", "false");
  }

  /* 解析期：立即生效主题，避免刷新闪白；面板 DOM 延后到首次打开构建 */
  applyTheme();

  /* 暴露给集成方的最小调试/接管入口（非契约字段，不影响 §2 结构） */
  ZC._panel = { open: openPanel, close: closePanel, isOpen: function () {
    return !!(panelRef.overlay && panelRef.overlay.classList.contains("zc-open"));
  }};
})();
