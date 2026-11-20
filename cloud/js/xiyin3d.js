/* ============ 汐音 3D 看板（B 方案） ============
 * 素材：assets/3d/xiyin-walk.glb（9.2MB 源 → meshopt 压到 1.3MB，动画/骨架原样保留）
 * 手法：MeshToon 平涂 + 屏幕空间描边（反壳）+ 沿月牙轨道来回巡游 + 视线跟随鼠标
 * 约束：登录后才拉取素材；无 WebGL / 窄屏 / 减弱动效 时一律回落到静态立绘
 *
 * 注意：/vendor/ 在线上是走 auth_request 的受保护目录，所以 three.js 相关依赖
 * 只能「登录后动态 import」，不能写成文件顶部的静态 import，否则登录页阶段就 401。
 */

let THREE = null;
let GLTFLoader = null;
let MeshoptDecoder = null;

async function loadDeps() {
  if (THREE) return;
  THREE = await import('../vendor/three.module.min.js');
  const loaderMod = await import('../vendor/three/GLTFLoader.js');
  GLTFLoader = loaderMod.GLTFLoader;
  const meshoptMod = await import('../vendor/three/meshopt_decoder.module.js');
  MeshoptDecoder = meshoptMod.MeshoptDecoder;
}

const MODEL_URL = 'assets/3d/xiyin-walk.glb';
const STAGE_W = 236;
const STAGE_H = 262;
const MIN_WIDTH = 901;      // 与 CSS 断点一致：窄屏只留静态立绘

const PATROL_X = 0.24;      // 巡游半幅（世界单位，角色高 1.0）
const WALK_SPEED = 0.50;    // 与 1.375s 步态周期匹配，减少脚滑
const TURN_LAMBDA = 7;      // 端点侧转的阻尼
const BODY_TURN = 0.26;     // 身体随行进方向的侧转角（约 15°）。模型 0° 正对镜头，
                            // 但头发体量极大：超过 ~35° 脸就会被发丝盖住，所以只做轻微倾身。

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

let ctx = null;             // 场景上下文（挂载时创建）
let booting = false;
let scheduled = 0;

const isNight = () => document.documentElement.getAttribute('data-zc-theme') === 'dark';

const PALETTE = {
  day: {
    key: 0xfff4f8, fill: 0xdfe2ff, rim: 0xffcfdd, amb: 0xffeaf3,
    outline: 0x55414d,
    keyI: 1.15, fillI: 0.35, rimI: 0.90, ambI: 0.45,
  },
  night: {
    key: 0xd6dcff, fill: 0x93a6d8, rim: 0xff9ec4, amb: 0x8e85ab,
    outline: 0x342a3e,
    keyI: 0.82, fillI: 0.22, rimI: 1.00, ambI: 0.34,
  },
};

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

/* 4 阶色阶：二次元平涂的明暗断层 */
function makeGradient() {
  const steps = [0.36, 0.62, 0.84, 1.0].map((v) => Math.round(v * 255));
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => {
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function makeLights() {
  const g = new THREE.Group();
  const p = isNight() ? PALETTE.night : PALETTE.day;
  const key = new THREE.DirectionalLight(p.key, p.keyI);
  key.position.set(1.1, 2.2, 2.1);
  const fill = new THREE.DirectionalLight(p.fill, p.fillI);
  fill.position.set(-1.7, 1.1, 1.4);
  const rim = new THREE.DirectionalLight(p.rim, p.rimI);
  rim.position.set(-0.3, 1.5, -2.0);
  const amb = new THREE.AmbientLight(p.amb, p.ambI);
  g.add(key, fill, rim, amb);
  g.userData = { key, fill, rim, amb };
  return g;
}

function retint(lights) {
  const p = isNight() ? PALETTE.night : PALETTE.day;
  const { key, fill, rim, amb } = lights.userData;
  key.color.setHex(p.key); key.intensity = p.keyI;
  fill.color.setHex(p.fill); fill.intensity = p.fillI;
  rim.color.setHex(p.rim); rim.intensity = p.rimI;
  amb.color.setHex(p.amb); amb.intensity = p.ambI;
  if (ctx && ctx.outlineMat) {
    ctx.outlineMat.color.setHex(p.outline);
    ctx.outlineMat.emissive.setHex(p.outline);
  }
}

function build(v) {
  const host = document.getElementById('mascot3d');
  const canvas = document.getElementById('mascot3dCanvas');
  const app = document.getElementById('app');
  if (!host || !canvas) return null;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(STAGE_W, STAGE_H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, STAGE_W / STAGE_H, 0.05, 40);
  const camDist = 2.28;
  camera.position.set(0.14, 0.56, camDist);
  camera.lookAt(-0.01, 0.52, 0);

  const lights = makeLights();
  scene.add(lights);

  /* 把世界单位换算成像素，用于让服务端阴影跟着脚走 */
  const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camDist;
  const pxPerUnit = STAGE_W / (visH * camera.aspect);

  /* 角色根 */
  const stage = new THREE.Group();
  scene.add(stage);
  stage.add(v.root);

  /* 材质：Toon 平涂（保留原画贴图，所以脸和衣服的绘制细节不会丢） */
  const gradientMap = makeGradient();
  const baseColor = v.mesh.material && v.mesh.material.map ? v.mesh.material.map : null;
  if (baseColor) baseColor.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const toon = new THREE.MeshToonMaterial({
    map: baseColor,
    gradientMap,
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  v.mesh.material = toon;
  v.mesh.frustumCulled = false;

  /* 描边：同几何、同骨架的反壳，顶点在屏幕空间沿（蒙皮后的）法线外扩固定像素 */
  const olRes = { value: new THREE.Vector2(STAGE_W, STAGE_H).multiplyScalar(renderer.getPixelRatio()) };
  const olPx = { value: 1.7 * renderer.getPixelRatio() };
  const outlineMat = toon.clone();
  outlineMat.map = null;
  outlineMat.gradientMap = null;
  outlineMat.color.setHex((isNight() ? PALETTE.night : PALETTE.day).outline);
  outlineMat.emissive = new THREE.Color((isNight() ? PALETTE.night : PALETTE.day).outline);
  outlineMat.emissiveIntensity = 1;
  outlineMat.side = THREE.BackSide;
  outlineMat.onBeforeCompile = (shader) => {
    shader.uniforms.uOlRes = olRes;
    shader.uniforms.uOlPx = olPx;
    shader.vertexShader = 'uniform vec2 uOlRes;\nuniform float uOlPx;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        vec3 vnorm = normalize( ( modelViewMatrix * vec4( objectNormal, 0.0 ) ).xyz );
        float ll = length( vnorm.xy );
        if ( ll > 1e-4 ) {
          gl_Position.xy += ( vnorm.xy / ll ) * uOlPx * ( 2.0 / uOlRes.y ) * gl_Position.w;
        }
      }`
    );
  };

  const outline = new THREE.SkinnedMesh(v.mesh.geometry, outlineMat);
  outline.bindMode = v.mesh.bindMode;
  outline.bindMatrix.copy(v.mesh.bindMatrix);
  outline.bindMatrixInverse.copy(v.mesh.bindMatrixInverse);
  outline.position.copy(v.mesh.position);
  outline.quaternion.copy(v.mesh.quaternion);
  outline.scale.copy(v.mesh.scale);
  outline.frustumCulled = false;
  outline.bind(v.skeleton, v.mesh.bindMatrix);
  v.mesh.parent.add(outline);

  /* 动画 */
  let mixer = null;
  if (v.clip) {
    mixer = new THREE.AnimationMixer(v.root);
    const action = mixer.clipAction(v.clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
  }

  ctx = {
    host, canvas, app, renderer, scene, camera, stage, mesh: v.mesh, outlineMat,
    lights, mixer, clip: v.clip,
    head: v.head, neck: v.neck,
    yaw: 0, dir: 1, nearLook: { x: 0, y: 0 }, look: { x: 0, y: 0 },
    shadowEl: host.querySelector('.m3d-shadow'),
    themeObs: null, io: null, raf: 0, last: 0, running: false, ready: true, pxPerUnit,
    _e: new THREE.Euler(), _q: new THREE.Quaternion(),
    _e2: new THREE.Euler(), _q2: new THREE.Quaternion(), _pq: new THREE.Quaternion(),
  };

  // 初始朝向：正对镜头（模型 0° 即正面），起步后再随行进方向轻微侧身
  stage.rotation.y = BODY_TURN;
  stage.position.x = 0;

  if (REDUCED.matches) {
    mixer && mixer.setTime(0.35);
    renderer.render(scene, camera);
  } else {
    startLoop();
  }
  setupVisibility();
  setupTheme();
  return ctx;
}

function setupVisibility() {
  if (!ctx) return;
  const { host } = ctx;
  ctx.io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) startLoop();
      else stopLoop();
    }
  }, { threshold: 0.02 });
  ctx.io.observe(host);
  document.addEventListener('visibilitychange', onDocVis);
}
function onDocVis() {
  if (!ctx) return;
  if (document.hidden) stopLoop();
  else if (!REDUCED.matches) startLoop();
}

function setupTheme() {
  if (!ctx) return;
  ctx.themeObs = new MutationObserver(() => retint(ctx.lights));
  ctx.themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-zc-theme'] });
}

function startLoop() {
  if (!ctx || ctx.running || REDUCED.matches || document.hidden) return;
  ctx.running = true;
  ctx.last = performance.now();
  ctx.raf = requestAnimationFrame(tick);
}
function stopLoop() {
  if (!ctx) return;
  ctx.running = false;
  if (ctx.raf) cancelAnimationFrame(ctx.raf);
  ctx.raf = 0;
}

/* 说明：这套模型头发体量极大，一旦把头骨做偏航（无论局部轴还是世界轴），
 * 长发就会像帘子一样盖住整张脸 —— 实测 ±30° 以上就完全不可读。所以视线
 * 不用头骨，改成整身极轻微的侧倾，观感上仍然是「她在注意你」。 */
function tick(now) {
  if (!ctx || !ctx.running) return;
  const dt = Math.min(0.05, Math.max(0, (now - ctx.last) / 1000));
  ctx.last = now;

  // 巡游：沿 X 来回，端点阻尼换向
  ctx.stage.position.x += ctx.dir * WALK_SPEED * dt;
  if (ctx.stage.position.x > PATROL_X) { ctx.stage.position.x = PATROL_X; ctx.dir = -1; }
  else if (ctx.stage.position.x < -PATROL_X) { ctx.stage.position.x = -PATROL_X; ctx.dir = 1; }

  // 侧转：始终面向观众，只按行进方向偏一点 + 跟鼠标的轻微倾身
  ctx.look.x = THREE.MathUtils.damp(ctx.look.x, ctx.nearLook.x, 4.5, dt);
  const lean = THREE.MathUtils.clamp(ctx.look.x, -1, 1) * 0.15;
  const targetYaw = (ctx.dir > 0 ? BODY_TURN : -BODY_TURN) + lean;
  ctx.stage.rotation.y = THREE.MathUtils.damp(ctx.stage.rotation.y, targetYaw, TURN_LAMBDA, dt);

  if (ctx.mixer) ctx.mixer.update(dt);

  if (ctx.shadowEl) {
    ctx.shadowEl.style.setProperty('--sx', (ctx.stage.position.x * ctx.pxPerUnit).toFixed(1) + 'px');
  }

  ctx.renderer.render(ctx.scene, ctx.camera);
  ctx.raf = requestAnimationFrame(tick);
}

/* ---------- 视线输入 ---------- */
function onPointer(e) {
  if (!ctx) return;
  ctx.nearLook.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
  ctx.nearLook.y = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
}
function onPointerOut() {
  if (ctx) ctx.nearLook.x = 0, ctx.nearLook.y = 0;
}
window.addEventListener('pointermove', onPointer, { passive: true });
document.addEventListener('pointerleave', onPointerOut);

/* ---------- 生命周期 ---------- */
function reveal() {
  const host = document.getElementById('mascot3d');
  const app = document.getElementById('app');
  if (!host) return;
  host.hidden = false;
  requestAnimationFrame(() => host.classList.add('is-on'));
  if (app) app.classList.add('zc-3d-on');
}

function fadeOut() {
  document.getElementById('app')?.classList.remove('zc-3d-on');
  const img = document.querySelector('.mascot');
  if (img && ctx) img.style.transition = '';
  const host = document.getElementById('mascot3d');
  if (host) host.classList.remove('is-on');
}

function teardown() {
  if (!ctx) return;
  stopLoop();
  if (ctx.io) ctx.io.disconnect();
  if (ctx.themeObs) ctx.themeObs.disconnect();
  document.removeEventListener('visibilitychange', onDocVis);

  ctx.scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry && o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        Object.values(m).forEach((val) => { if (val && val.isTexture) val.dispose(); });
        m.dispose();
      });
    }
  });
  ctx.renderer.dispose();
  ctx.renderer.forceContextLoss?.();
  fadeOut();
  ctx = null;
  const host = document.getElementById('mascot3d');
  if (host) host.hidden = true;
}

async function mount() {
  if (ctx || booting) return;
  if (document.getElementById('app')?.hidden) return;
  if (window.innerWidth < MIN_WIDTH || !hasWebGL()) return;

  booting = true;
  try {
    await loadDeps();
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(MODEL_URL);
    if (!gltf || !gltf.scene) throw new Error('empty gltf');

    let mesh = null;
    let skeleton = null;
    gltf.scene.traverse((o) => {
      if (!mesh && o.isSkinnedMesh) { mesh = o; skeleton = o.skeleton; }
    });
    if (!mesh) throw new Error('no skinned mesh');

    const root = gltf.scene;
    const clip = gltf.animations && gltf.animations.length ? gltf.animations[0] : null;

    build({ root, mesh, skeleton, clip, head: root.getObjectByName('Head'), neck: root.getObjectByName('Neck') });
    if (!ctx) throw new Error('build failed');
    reveal();
  } catch (err) {
    console.warn('[xiyin3d] 3D 看板未启用，保持静态立绘：', err && err.message ? err.message : err);
    teardown();
  } finally {
    booting = false;
  }
}

function schedule() {
  if (scheduled) return;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 380));
  scheduled = idle(() => { scheduled = 0; mount(); });
}

window.addEventListener('resize', () => {
  if (window.innerWidth < MIN_WIDTH) { if (ctx) teardown(); }
  else if (!ctx) schedule();
}, { passive: true });

window.ZC3D = { mount, teardown, get ctx() { return ctx; } };

/* 登录后（#app[hidden] 变 false）才加载；回到登录页立即卸载释放显存 */
(function wire() {
  const app = document.getElementById('app');
  if (!app) return;
  if (!app.hidden) schedule();
  new MutationObserver(() => {
    if (app.hidden) teardown();
    else schedule();
  }).observe(app, { attributes: true, attributeFilter: ['hidden'] });
})();
