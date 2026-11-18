/* ==========================================================================
   知潮 · 润色层（polish.js）
   极光背景 + 顶部阅读进度 + 内容入场揭示
   纯前端装饰，不触碰任何业务逻辑；减弱动效时自动降级。
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 极光背景层 ---------- */
  function mountAurora() {
    if (reduced) return;
    var host = document.getElementById("zcPAurora");
    if (!host || host.childElementCount) return;
    for (var i = 0; i < 4; i++) host.appendChild(document.createElement("i"));
  }

  /* ---------- 顶部阅读进度条 ---------- */
  function mountProgress() {
    var bar = document.getElementById("zcPProgress");
    if (!bar) return;
    var ticking = false;

    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.width = (ratio * 100).toFixed(2) + "%";
      bar.classList.toggle("on", ratio > 0.01);
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* ---------- 入场揭示 ---------- */
  function reveal() {
    var targets = [
      document.querySelector(".page-head"),
      document.querySelector(".spot"),
      document.querySelector(".ckc"),
      document.querySelector(".grid .panel"),
      document.querySelector(".grid .side")
    ].filter(Boolean);

    if (!targets.length) return;

    if (reduced || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("zc-p-in"); });
      return;
    }

    targets.forEach(function (el) { el.classList.add("zc-p-reveal"); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, idx) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.style.transitionDelay = (idx * 70) + "ms";
        el.classList.add("zc-p-in");
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    targets.forEach(function (el) { io.observe(el); });
  }

  function boot() {
    mountAurora();
    mountProgress();
    reveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
