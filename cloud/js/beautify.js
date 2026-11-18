/* ==========================================================================
   知潮 · 视觉美化层（beautify.js）
   樱花飘落 + 星光漂浮 + 面板轻交互
   纯前端装饰，不影响任何业务逻辑；减弱动效时自动停用。
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 樱花飘落 ---------- */
  function spawnPetals() {
    var host = document.getElementById("zcBPetals");
    if (!host || reduced) return;
    var count = window.innerWidth < 720 ? 8 : 18;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var p = document.createElement("i");
      var size = 8 + Math.random() * 9;
      p.style.left = (Math.random() * 100).toFixed(2) + "%";
      p.style.width = size.toFixed(1) + "px";
      p.style.height = size.toFixed(1) + "px";
      p.style.opacity = (0.25 + Math.random() * 0.4).toFixed(2);
      p.style.animationDuration = (14 + Math.random() * 16).toFixed(1) + "s";
      p.style.animationDelay = (-Math.random() * 22).toFixed(1) + "s";
      frag.appendChild(p);
    }
    host.appendChild(frag);
  }

  /* ---------- 星光漂浮 ---------- */
  function spawnSparkles() {
    var host = document.getElementById("zcBSparkles");
    if (!host || reduced) return;
    var count = window.innerWidth < 720 ? 12 : 26;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var s = document.createElement("i");
      s.style.left = (Math.random() * 100).toFixed(2) + "%";
      s.style.top = (Math.random() * 100).toFixed(2) + "%";
      s.style.animationDuration = (3.6 + Math.random() * 4).toFixed(1) + "s";
      s.style.animationDelay = (-Math.random() * 6).toFixed(1) + "s";
      frag.appendChild(s);
    }
    host.appendChild(frag);
  }

  function boot() {
    spawnPetals();
    spawnSparkles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* 主题切换后重新刷新星光颜色观感（仅重绘装饰层，不碰业务数据） */
  function refreshSparkles() {
    var host = document.getElementById("zcBSparkles");
    if (!host || reduced) return;
    host.innerHTML = "";
    spawnSparkles();
  }
  window.addEventListener("zc:settings", refreshSparkles);
  if (window.ZC && window.ZC.events) {
    window.ZC.events.addEventListener("zc:settings", refreshSparkles);
  }
})();
