/* ==========================================================================
   知潮 · 月晷时钟（汐音的时辰）
   ------------------------------------------------------------------------
   一个自包含的小模块：把「现在几点」同时变成
     ① 页面上的月晷条（月牙指针表盘 + 24 小时色温轨道 + 时段台词）
     ② 看板娘能读到的 ZCClock.info()（台词、问候、作息提醒都按此刻说话）
     ③ 聊天 system 里的真实时间锚点（ZCClock.promptLine()）
   不依赖任何第三方库，纯 DOM 操作；登录后才 mount，退出登录即 unmount。
   ========================================================================== */
(function () {
  "use strict";

  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];

  /* 一天切成 8 个时段，每段有自己的色温与台词池 */
  var RANGES = [
    { k: "deep", a: 0, b: 5, label: "深夜", tint: "#7a7596", hello: "这个点还醒着吗？现在是 ",
      lines: [
        "凌晨的世界很安静，只剩月亮和汐音还醒着",
        "这么晚还没睡…主人是睡不着，还是舍不得今天结束？",
        "夜里想起的事都容易变重，先睡吧，明天再想"
      ] },
    { k: "dawn", a: 5, b: 8, label: "清晨", tint: "#d79fac", hello: "早安～现在是 ",
      lines: [
        "天刚亮，今天也从这里开始哦",
        "早呀，外面的风还凉，记得加件外套",
        "清晨最适合做一件小事，剩下的交给时间"
      ] },
    { k: "morn", a: 8, b: 11, label: "上午", tint: "#c8977f", hello: "上午好，现在是 ",
      lines: [
        "上午好，事情一件件来，别急着全做完",
        "这会儿头脑最清醒，难题放在这段里吧",
        "记得中途站起来走两步，汐音帮你盯着时间"
      ] },
    { k: "noon", a: 11, b: 13, label: "中午", tint: "#d8b57c", hello: "中午好，现在是 ",
      lines: [
        "中午啦，吃饭了吗？",
        "别又对着屏幕啃面包…去好好吃一顿嘛",
        "饭后走一走，下午才不容易困"
      ] },
    { k: "aft", a: 13, b: 17, label: "午后", tint: "#c99a6f", hello: "下午好，现在是 ",
      lines: [
        "午后最容易犯困，要不要伸个懒腰",
        "喝点水吧，这一杯汐音替你记着",
        "下午过去了大半，进度条还顺吗？"
      ] },
    { k: "dusk", a: 17, b: 19, label: "黄昏", tint: "#c78184", hello: "傍晚好，现在是 ",
      lines: [
        "太阳要落了，今天的辛苦也该收一收",
        "这个时刻的光最好看，抬头看一眼窗外吧",
        "黄昏是一天的缓冲，不用立刻切换状态"
      ] },
    { k: "eve", a: 19, b: 23, label: "夜晚", tint: "#a8809e", hello: "晚上好，现在是 ",
      lines: [
        "晚上好，今天过得怎么样？跟我讲讲嘛",
        "夜里安静，正适合慢慢看几条热点",
        "今天已经辛苦了，剩下的时间留给自己"
      ] },
    { k: "late", a: 23, b: 24, label: "夜深", tint: "#8b819f", hello: "夜深了，现在是 ",
      lines: [
        "夜深了，明天还要早起的话，就早点收尾吧",
        "再晚一点就是明天了，主人要不算了？",
        "这个点还亮着屏幕…汐音陪你，但只陪一小会儿"
      ] }
  ];

  function pad(n) { return String(n).padStart(2, "0"); }
  function phaseOf(hour) {
    for (var i = 0; i < RANGES.length; i++) {
      if (hour >= RANGES[i].a && hour < RANGES[i].b) return RANGES[i];
    }
    return RANGES[0];
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var st = {
    root: null, els: {}, timer: null, linePhase: "", line: "",
    hourKey: "", bound: false, mounted: false
  };

  /* -------- 对外信息 -------- */
  function info() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    var p = phaseOf(h);
    var pct = (h * 3600 + m * 60 + s) / 86400;
    var hm = pad(h) + ":" + pad(m);
    return {
      hour: h, minute: m, second: s, pct: pct,
      hm: hm, hms: hm + ":" + pad(s),
      phase: p.k, label: p.label, tint: p.tint,
      weekday: "周" + WEEK[d.getDay()],
      date: (d.getMonth() + 1) + "/" + d.getDate(),
      stamp: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + hm,
      line: st.line || p.lines[0],
      hello: p.hello + hm
    };
  }

  /* 给聊天系统提示用的时间锚点 */
  function promptLine() {
    var i = info();
    return "【现在的真实时间】" + i.stamp + "（" + i.weekday + "，" + i.label + "）。" +
      "说话贴合此刻就好：问候、饭点、作息都别错位；主人问起时间再报，平时不要主动提几点。";
  }

  /* 短锚点：随最后一条用户消息一起发给模型，保证时刻紧贴问题，不会被长上下文淹没 */
  function anchorLine() {
    var i = info();
    return "（此刻 " + i.stamp + " " + i.weekday + " " + i.label + "）";
  }

  /* 给聊天开场白用的问候 */
  function greeting() { return info().hello; }

  /* 随时取一句此刻该说的话（看板娘点击、空闲时用） */
  function say() {
    var p = phaseOf(new Date().getHours());
    return pick(p.lines);
  }

  /* -------- 表盘 -------- */
  function buildDial(el) {
    var NS = "http://www.w3.org/2000/svg";
    function mk(tag, attrs) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
      return n;
    }
    var svg = mk("svg", { viewBox: "0 0 48 48", "aria-hidden": "true" });
    svg.appendChild(mk("circle", { class: "ckc-disc", cx: 24, cy: 24, r: 21 }));
    svg.appendChild(mk("circle", { class: "ckc-ring", cx: 24, cy: 24, r: 21 }));
    // 8 个刻度，每 3 小时一格，让表盘读得出「一天」
    for (var t = 0; t < 8; t++) {
      svg.appendChild(mk("line", {
        class: "ckc-tick", x1: 24, y1: 3.4, x2: 24, y2: 6.2,
        transform: "rotate(" + (t * 45) + " 24 24)"
      }));
    }
    var arc = mk("circle", {
      class: "ckc-arc", cx: 24, cy: 24, r: 21,
      transform: "rotate(-90 24 24)"
    });
    var C = 2 * Math.PI * 21;
    arc.setAttribute("stroke-dasharray", "0 " + C.toFixed(2));
    svg.appendChild(arc);
    svg.appendChild(mk("circle", { class: "ckc-hub", cx: 24, cy: 24, r: 1.7 }));
    var hand = mk("g", { class: "ckc-hand" });
    hand.appendChild(mk("line", { class: "ckc-stem", x1: 24, y1: 24, x2: 24, y2: 8.6 }));
    hand.appendChild(mk("circle", { class: "ckc-glint", cx: 24, cy: 6.2, r: 5 }));
    // 月牙指针：外弧 + 内侧反弧拼出弯月，尾巴朝圆心
    hand.appendChild(mk("path", {
      class: "ckc-moon",
      d: "M25.203 3.25a3 3 0 1 0 0 5.5a2.75 2.75 0 1 1 0-5.5z"
    }));
    svg.appendChild(hand);
    el.appendChild(svg);
    st.els.arc = arc;
    st.els.hand = hand;
    st.arcLen = C;
  }

  /* -------- 渲染 -------- */
  function apply() {
    if (!st.root) return;
    var i = info();
    var e = st.els;

    e.hh.textContent = pad(i.hour);
    e.mm.textContent = pad(i.minute);
    e.ss.textContent = ":" + pad(i.second);

    if (st.linePhase !== i.phase) {
      st.linePhase = i.phase;
      st.line = pick(phaseOf(i.hour).lines);
      e.root.style.setProperty("--ckc-tint", i.tint);
      e.phase.textContent = i.label;
      e.say.textContent = st.line;
      if (st.mounted) {
        /* 跨时段：让看板娘也换一口气 */
        emit("zc:phase", { phase: i.phase, label: i.label, line: st.line });
      }
    }

    e.date.textContent = i.date + " " + i.weekday;
    e.prog.textContent = "已过 " + Math.round(i.pct * 100) + "%";

    var pctStr = (i.pct * 100).toFixed(3) + "%";
    e.mark.style.left = pctStr;
    e.future.style.left = pctStr;
    if (e.arc) e.arc.setAttribute("stroke-dasharray", (st.arcLen * i.pct).toFixed(2) + " " + st.arcLen.toFixed(2));
    if (e.hand) e.hand.style.transform = "rotate(" + (i.pct * 360).toFixed(2) + "deg)";

    /* 整点轻击一次 */
    var hk = i.stamp.slice(0, 10) + " " + pad(i.hour);
    if (i.minute === 0 && i.second <= 2 && st.hourKey !== hk) {
      st.hourKey = hk;
      e.root.classList.remove("strike");
      void e.root.offsetWidth;
      e.root.classList.add("strike");
      emit("zc:hour", { hour: i.hour, line: i.hour + " 点整啦" + (i.hour >= 22 || i.hour < 5 ? "，该睡了哦" : "，时间过得好快呢") });
    }
  }

  function emit(name, detail) {
    var z = window.ZC;
    if (z && z.events) {
      try { z.events.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
    }
  }

  function tick() {
    if (document.hidden) return;   // 后台标签页不用画
    apply();
  }

  /* -------- 轨道提示 -------- */
  function bindRibbon() {
    var ribbon = st.els.ribbon, tip = st.els.tip;
    if (!ribbon || !tip) return;
    function show(ev) {
      var r = ribbon.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width;
      x = Math.max(0, Math.min(0.999, x));
      var h = Math.min(23, Math.floor(x * 24));
      var m = Math.floor((x * 24 - h) * 60 / 10) * 10;
      var p = phaseOf(h);
      tip.textContent = pad(h) + ":" + pad(m) + " · " + p.label;
      tip.style.left = (x * 100) + "%";
      tip.classList.add("on");
    }
    ribbon.addEventListener("pointermove", show);
    ribbon.addEventListener("pointerleave", function () { tip.classList.remove("on"); });
  }

  function bindDial() {
    var dial = st.els.dial;
    if (!dial) return;
    function speak() {
      dial.classList.remove("spin");
      void dial.offsetWidth;
      dial.classList.add("spin");
      var p = phaseOf(new Date().getHours());
      st.line = pick(p.lines);
      if (st.els.say) st.els.say.textContent = st.line;
      emit("zc:clock", { line: "现在是 " + info().hm + "，" + st.line, time: info().hm });
    }
    dial.addEventListener("click", speak);
    dial.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
        ev.preventDefault();
        speak();
      }
    });
  }

  function bindVisibility() {
    if (st.visBound) return;
    st.visBound = true;
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && st.mounted) apply();
    });
  }

  /* -------- 生命周期 -------- */
  function mount() {
    var root = document.getElementById("ckc");
    if (!root || st.mounted) return;
    st.root = root;
    st.els = {
      root: root,
      dial: document.getElementById("ckcDial"),
      hh: document.getElementById("ckcHH"),
      mm: document.getElementById("ckcMM"),
      ss: document.getElementById("ckcSS"),
      phase: document.getElementById("ckcPhase"),
      date: document.getElementById("ckcDate"),
      prog: document.getElementById("ckcProg"),
      ribbon: document.getElementById("ckcRibbon"),
      mark: document.getElementById("ckcMark"),
      future: document.getElementById("ckcFuture"),
      tip: document.getElementById("ckcTip"),
      say: document.getElementById("ckcSay")
    };
    buildDial(st.els.dial);
    bindRibbon();
    bindDial();
    bindVisibility();
    st.linePhase = "";
    apply();                 // 预渲染一次（此时 mounted=false，不会误发事件）
    st.hourKey = info().stamp.slice(0, 10) + " " + pad(info().hour);
    st.mounted = true;
    if (st.timer) clearInterval(st.timer);
    st.timer = setInterval(tick, 1000);
  }

  function unmount() {
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    st.mounted = false;
    st.linePhase = "";
    st.root = null;
  }

  window.ZCClock = {
    mount: mount, unmount: unmount,
    info: info, promptLine: promptLine, anchorLine: anchorLine, greeting: greeting, say: say
  };
})();
