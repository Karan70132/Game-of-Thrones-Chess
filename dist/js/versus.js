// The duel stage: two kings leaning in toward each other like fighters squaring up, warm light on Ivory,
// cold light on Obsidian, fire rising behind them. On arrival they charge in and clash.
// Used by the home page (with more scenery) and the account pages.
import { THREE, makeRenderer, pieceMaterials, pieceGeometries, embers, reducedMotion } from './realm3d.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeFx, ease } from './fx.js';
import { currentTheme } from './ui.js';
import { play as sfx } from './sounds.js';

// x: distance from the centre · yaw: turned toward the rival · lean: tilted in, toward the rival · pitch: chin up
export const STANCE = { x: 1.22, yaw: 0.66, lean: 0.2, pitch: -0.05, scale: 1.72 };

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// A wall of fire rising behind the duel: animated noise flames on a camera-facing plane.
export function fireMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uFlare: { value: 0 }, uAlpha: { value: 0.6 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform float uFlare; uniform float uAlpha; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        float y = vUv.y, x = (vUv.x - 0.5) * 2.0;
        float n = fbm(vec2(x * 3.0, y * 4.0 - uTime * 1.7));
        float n2 = fbm(vec2(x * 7.0 + 3.0, y * 6.0 - uTime * 2.6));
        float cols = fbm(vec2(x * 5.0 + 11.0, y * 0.7 - uTime * 0.6));
        // tongues of fire of different heights; the tallest near the middle
        float tongue = smoothstep(0.32, 0.7, cols);
        float h = (0.4 + 0.58 * tongue) * (1.0 - 0.35 * x * x) * (1.0 + uFlare * 0.25);
        float f = smoothstep(h, h * 0.2, y + (n2 - 0.5) * 0.3) * (0.55 + 0.8 * n);
        f *= smoothstep(1.0, 0.55, abs(x)) * smoothstep(0.0, 0.25, y);
        f = clamp(f * 1.25, 0.0, 1.0);
        vec3 col = mix(vec3(0.5, 0.06, 0.01), vec3(1.0, 0.38, 0.05), smoothstep(0.05, 0.55, f));
        col = mix(col, vec3(1.0, 0.82, 0.45), smoothstep(0.7, 1.0, f));
        gl_FragColor = vec4(col, pow(f, 1.4) * uAlpha);
      }`,
  });
}

export async function buildStage(host, { intro = true } = {}) {
  const geos = await pieceGeometries();
  const renderer = makeRenderer(host, { quality: 1.4 });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture; scene.environmentIntensity = 0.5; pmrem.dispose(); room.dispose();

  scene.add(new THREE.HemisphereLight('#fff1dc', '#1e1710', 0.55));
  const warm = new THREE.DirectionalLight('#ffd49a', 3.2); warm.position.set(-6, 7, 6); warm.castShadow = true;
  warm.shadow.mapSize.set(2048, 2048); Object.assign(warm.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 40 });
  warm.shadow.normalBias = 0.02; warm.shadow.radius = 5;
  const cold = new THREE.DirectionalLight('#9cc8ff', 2.4); cold.position.set(6, 5, 5);
  const rimW = new THREE.SpotLight('#ffb35c', 40, 30, 0.6, 0.6); rimW.position.set(-4, 5, -6);
  const rimB = new THREE.SpotLight('#6fb4ff', 45, 30, 0.6, 0.6); rimB.position.set(4, 5, -6);
  scene.add(warm, cold, rimW, rimB);

  const mats = pieceMaterials();
  const duel = new THREE.Group();
  const white = new THREE.Mesh(geos.K, mats.w), black = new THREE.Mesh(geos.K, mats.b);
  for (const k of [white, black]) { k.castShadow = true; k.receiveShadow = true; k.scale.setScalar(STANCE.scale); k.rotation.order = 'ZYX'; }
  const glowTex = glowTexture();
  const pool = (color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.01; return m;
  };
  const poolW = pool('#ffb44a'), poolB = pool('#4f9dff');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const sparks = embers(220, [2.2, 4.2, 1.6]);

  // fire behind the kings and embers drifting up through the whole scene
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.6), fireMaterial());
  fire.position.set(0, 2.6, -1.4); fire.renderOrder = -1;
  const sky = embers(520, [9, 8, 3]); sky.position.z = -0.6;

  duel.add(fire, white, black, poolW, poolB, floor, sparks, sky);
  scene.add(duel);
  const fx = makeFx(duel, mats);
  fx.setPixelRatio(renderer.getPixelRatio());

  function applyTheme() {
    const light = currentTheme() === 'light';
    sparks.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    sparks.material.uniforms.uColor.value.set(light ? '#b07a1c' : '#ffb04a');
    sparks.material.needsUpdate = true;
    sparks.visible = !light; // embers read as dust on a light background
    sky.material.blending = sparks.material.blending; sky.material.uniforms.uColor.value.set(light ? '#c0621a' : '#ff9a3a'); sky.material.needsUpdate = true;
    fire.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending; fire.material.uniforms.uAlpha.value = light ? 0.4 : 0.6; fire.material.needsUpdate = true;
    poolW.material.opacity = light ? 0.28 : 0.55; poolB.material.opacity = light ? 0.22 : 0.5;
    poolW.material.blending = poolB.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    floor.material.opacity = light ? 0.22 : 0.35;
  }
  applyTheme();
  document.addEventListener('themechange', applyTheme);

  // ---- the kings' pose: intro charge → clash → recoil → idle ------------------------
  const motion = !reducedMotion() && intro;
  let introT = motion ? 0 : 10, clashed = !motion, spread = 0; // spread: extra distance (home page parts the kings on scroll)
  const CHARGE = 0.95, RECOIL = 0.9;
  let flare = 0;
  function pose(dt, t, eased) {
    let x = STANCE.x, lean = STANCE.lean, lift = 0;
    if (spread > 0.5) introT = CHARGE + RECOIL; // already scrolled away: skip the entrance
    if (introT < CHARGE + RECOIL) {
      introT += dt;
      if (introT < CHARGE) {
        const k = ease.inOut(Math.min(1, introT / CHARGE));
        x = 6.5 + (0.94 - 6.5) * k; lean = -0.12 + (0.26 + 0.12) * k; lift = Math.sin(Math.PI * k) * 0.35;
      } else {
        if (!clashed) {
          clashed = true;
          fx.sparks.emit({ pos: { x: 0, y: 2.4, z: 0.2 }, count: 160, colors: ['#ffd27a', '#ff9a3c', '#fff4d6', '#8fc3ff'], speed: 4.2, up: 2.2, gravity: 3.5, life: 1.1, size: 0.07, drag: 1.2 });
          fx.ring({ x: -0.94, z: 0 }, '#ffbe5c', 0.7, 2.4); fx.ring({ x: 0.94, z: 0 }, '#6fb4ff', 0.7, 2.4);
          sfx('clash');
        }
        const u = Math.min(1, (introT - CHARGE) / RECOIL), spring = Math.exp(-5 * u) * Math.cos(u * Math.PI * 3);
        x = STANCE.x + (0.94 - STANCE.x) * spring; lean = STANCE.lean + (0.26 - STANCE.lean) * spring;
        flare = Math.max(flare, 1 - u);
      }
    }
    const breathe = Math.sin(t * 1.1) * 0.03, sway = Math.sin(t * 0.7) * 0.025;
    white.position.set(-x - spread, lift + breathe, 0); black.position.set(x + spread, lift + Math.sin(t * 1.1 + 1.6) * 0.03, 0);
    white.rotation.set(STANCE.pitch, STANCE.yaw + eased.x * 0.25, -(lean + sway));
    black.rotation.set(STANCE.pitch, -STANCE.yaw + eased.x * 0.25, lean - sway);
    poolW.position.x = white.position.x; poolB.position.x = black.position.x;
    fire.material.uniforms.uTime.value = t; fire.material.uniforms.uFlare.value = flare; flare *= 0.97;
    white.visible = black.visible = poolW.visible = poolB.visible = spread < 6.5; // parted kings leave the frame
    fire.visible = spread < 3; fire.material.uniforms.uAlpha.value = (currentTheme() === 'light' ? 0.4 : 0.6) * Math.max(0, 1 - spread / 3);
    sky.material.uniforms.uTime.value = t;
  }

  const pointer = new THREE.Vector2(), eased = new THREE.Vector2();
  window.addEventListener('pointermove', (e) => { pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5); }, { passive: true });
  const ticks = new Set();
  const clock = new THREE.Clock();
  let t = 0;
  function size() {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    sparks.material.uniforms.uPx.value = sky.material.uniforms.uPx.value = renderer.getPixelRatio() * (h / 800);
    fx.setPixelRatio(renderer.getPixelRatio() * (h / 900));
  }
  size(); window.addEventListener('resize', size);
  // adaptive sharpness: if frames get slow, render at a lower resolution (never below the screen's own)
  let slow = 0, frames = 0;
  function adapt(dt) {
    frames++; if (dt > 0.03) slow++;
    if (frames < 40) return;
    const pr = renderer.getPixelRatio(), floorPr = Math.min(1, window.devicePixelRatio || 1);
    if (slow > 24 && pr > floorPr) { renderer.setPixelRatio(Math.max(floorPr, pr - 0.2)); size(); }
    frames = 0; slow = 0;
  }
  const v3 = new THREE.Vector3();
  function project(x, y, z) {
    v3.set(x, y, z).applyMatrix4(duel.matrixWorld).project(camera);
    return { x: (v3.x * 0.5 + 0.5) * host.clientWidth, y: (0.5 - v3.y * 0.5) * host.clientHeight };
  }
  renderer.compile(scene, camera);
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!document.hidden && host.offsetWidth) {
      if (!reducedMotion()) { t += dt; eased.lerp(pointer, 1 - Math.pow(0.03, dt)); }
      sparks.material.uniforms.uTime.value = t;
      pose(dt, t, eased);
      fx.tick(dt);
      for (const fn of ticks) fn(dt, t, eased);
      if (fx.shake > 0) {
        const k = fx.shake * fx.shake * 0.08, saved = camera.position.clone();
        camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k;
        renderer.render(scene, camera); camera.position.copy(saved);
      } else renderer.render(scene, camera);
      adapt(dt);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  host.classList.add('ready');
  return {
    THREE, renderer, scene, camera, geos, mats, duel, white, black, poolW, poolB, sparks, fire, fx, project,
    pointer: eased, onTick: (fn) => ticks.add(fn), size,
    set spread(v) { spread = v; }, get spread() { return spread; }, get introDone() { return introT >= CHARGE + RECOIL; },
    replay() { if (reducedMotion()) return; introT = 0; clashed = false; },
  };
}
