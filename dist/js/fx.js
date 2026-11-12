// Board effects for the 3D rig: sparks and dust, marble shards, shockwave rings, light beams and flashes.
// Everything lives inside the board group, is created up front (no shader compiles mid-game) and is
// advanced by tick(dt), which returns true while anything is still moving.
import { THREE } from './realm3d.js';

export const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

const VERT = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uPixel;
varying vec3 vColor; varying float vAlpha;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixel * (320.0 / -mv.z); vColor = aColor; vAlpha = aAlpha; }`;
const FRAG_GLOW = `varying vec3 vColor; varying float vAlpha;
void main() { float d = length(gl_PointCoord - 0.5); float core = smoothstep(0.5, 0.0, d), hot = smoothstep(0.16, 0.0, d);
  gl_FragColor = vec4((vColor * core + vec3(hot)) * vAlpha * 1.8, core * vAlpha); }`;
const FRAG_DUST = `varying vec3 vColor; varying float vAlpha;
void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vAlpha * 0.55; gl_FragColor = vec4(vColor, a); }`;

class Particles {
  constructor(parent, { max = 1200, glow = true } = {}) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.size0 = new Float32Array(max);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aColor', this.aCol); g.setAttribute('aSize', this.aSize); g.setAttribute('aAlpha', this.aAlpha);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: glow ? FRAG_GLOW : FRAG_DUST, transparent: true, depthWrite: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uPixel: { value: 1.5 } },
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 6;
    parent.add(this.points);
    this.c = new THREE.Color();
  }
  emit({ pos, count = 30, colors = ['#ffffff'], speed = 2, up = 1.5, gravity = 4, life = 0.8, size = 0.05, drag = 1.6, ring = false, radius = 0 }) {
    for (let k = 0; k < count && this.n < this.max; k++) {
      const i = this.n++, a = Math.random() * Math.PI * 2, sp = speed * (ring ? 0.75 + Math.random() * 0.5 : 0.25 + Math.random() * 0.75);
      this.p[i * 3] = pos.x + Math.cos(a) * radius; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z + Math.sin(a) * radius;
      this.v[i * 3] = Math.cos(a) * sp; this.v[i * 3 + 1] = ring ? up * Math.random() * 0.4 : up * (0.35 + Math.random()); this.v[i * 3 + 2] = Math.sin(a) * sp;
      this.life[i] = 0; this.maxLife[i] = life * (0.6 + Math.random() * 0.6); this.size0[i] = size * (0.5 + Math.random());
      this.drag[i] = drag; this.grav[i] = gravity;
      this.c.set(colors[(Math.random() * colors.length) | 0]);
      this.aCol.array[i * 3] = this.c.r; this.aCol.array[i * 3 + 1] = this.c.g; this.aCol.array[i * 3 + 2] = this.c.b;
    }
  }
  tick(dt) {
    if (!this.n) return false;
    let w = 0;
    const p = this.p, v = this.v, col = this.aCol.array, sz = this.aSize.array, al = this.aAlpha.array;
    for (let i = 0; i < this.n; i++) {
      this.life[i] += dt;
      const k = this.life[i] / this.maxLife[i];
      if (k >= 1) continue;
      const d = Math.exp(-this.drag[i] * dt);
      v[i * 3] *= d; v[i * 3 + 1] = v[i * 3 + 1] * d - this.grav[i] * dt; v[i * 3 + 2] *= d;
      const x = p[i * 3] + v[i * 3] * dt, z = p[i * 3 + 2] + v[i * 3 + 2] * dt;
      let y = p[i * 3 + 1] + v[i * 3 + 1] * dt;
      if (y < 0.01 && Math.abs(x) < 4.1 && Math.abs(z) < 4.1) { y = 0.01; v[i * 3 + 1] *= -0.3; }
      if (w !== i) {
        this.life[w] = this.life[i]; this.maxLife[w] = this.maxLife[i]; this.size0[w] = this.size0[i]; this.drag[w] = this.drag[i]; this.grav[w] = this.grav[i];
        v[w * 3] = v[i * 3]; v[w * 3 + 1] = v[i * 3 + 1]; v[w * 3 + 2] = v[i * 3 + 2];
        col[w * 3] = col[i * 3]; col[w * 3 + 1] = col[i * 3 + 1]; col[w * 3 + 2] = col[i * 3 + 2];
      }
      p[w * 3] = x; p[w * 3 + 1] = y; p[w * 3 + 2] = z;
      sz[w] = this.size0[w] * (1 - k * 0.5); al[w] = (1 - k) * Math.min(1, this.life[w] * 25);
      w++;
    }
    this.n = w;
    this.points.geometry.setDrawRange(0, w);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
    return w > 0;
  }
}

// Shards of marble: one instanced pool per side, reused for every capture.
class Shards {
  constructor(parent, material, count = 46) {
    this.mat = material.clone(); this.mat.transparent = true;
    this.mesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), this.mat, count);
    this.mesh.castShadow = true; this.mesh.frustumCulled = false; this.mesh.count = 0;
    parent.add(this.mesh);
    this.items = []; this.t = 0; this.life = 1.7; this.size = count;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.e = new THREE.Euler();
  }
  burst(center, height, from) {
    this.items = []; this.t = 0;
    const push = from ? new THREE.Vector3(center.x - from.x, 0, center.z - from.z).normalize() : new THREE.Vector3();
    for (let i = 0; i < this.size; i++) {
      const a = Math.random() * Math.PI * 2, y = Math.random() * height, r = 0.04 + Math.random() * 0.16, out = 0.8 + Math.random() * 2.4;
      this.items.push({
        p: new THREE.Vector3(center.x + Math.cos(a) * r, y + 0.03, center.z + Math.sin(a) * r),
        v: new THREE.Vector3(Math.cos(a) * out + push.x * 1.6, 1.4 + Math.random() * 3.4, Math.sin(a) * out + push.z * 1.6),
        rot: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16),
        s: 0.03 + Math.random() * 0.07 + (y < height * 0.3 ? 0.025 : 0),
      });
    }
    this.mesh.count = this.size;
  }
  tick(dt) {
    if (!this.mesh.count) return false;
    this.t += dt;
    const fade = Math.max(0, 1 - Math.max(0, this.t - this.life * 0.55) / (this.life * 0.45));
    this.mat.opacity = fade;
    this.items.forEach((it, i) => {
      it.v.y -= 9.8 * dt; it.p.addScaledVector(it.v, dt);
      if (it.p.y < it.s * 0.5 && Math.abs(it.p.x) < 4.1 && Math.abs(it.p.z) < 4.1) { it.p.y = it.s * 0.5; it.v.y *= -0.3; it.v.x *= 0.55; it.v.z *= 0.55; it.spin.multiplyScalar(0.55); }
      it.rot.addScaledVector(it.spin, dt);
      this.q.setFromEuler(this.e.set(it.rot.x, it.rot.y, it.rot.z)); this.s.setScalar(it.s * (0.35 + 0.65 * fade));
      this.mesh.setMatrixAt(i, this.m.compose(it.p, this.q, this.s));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.t >= this.life) { this.mesh.count = 0; return false; }
    return true;
  }
}

function fadeTexture(vertical) {
  const c = document.createElement('canvas'); c.width = vertical ? 4 : 128; c.height = vertical ? 128 : 4;
  const g = c.getContext('2d'), gr = vertical ? g.createLinearGradient(0, 0, 0, 128) : g.createLinearGradient(0, 0, 128, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c); return t;
}

export function makeFx(group, mats) {
  const sparks = new Particles(group, { glow: true });
  const dust = new Particles(group, { glow: false, max: 600 });
  const shards = { w: new Shards(group, mats.w, 64), b: new Shards(group, mats.b, 64) };
  const add = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  // shockwave rings (a small pool)
  const ringGeo = new THREE.RingGeometry(0.36, 0.46, 64);
  const rings = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(ringGeo, add('#ffd27a')); m.rotation.x = -Math.PI / 2; m.visible = true; m.scale.setScalar(0.0001); m.renderOrder = 5; group.add(m); return { m, t: 1, d: 0.6, grow: 2.6 }; });
  // light beam for promotions
  const beamMat = add('#ffe7a6'); beamMat.map = fadeTexture(true);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 7, 48, 1, true), beamMat);
  beam.scale.set(0.0001, 1, 0.0001); beam.renderOrder = 5; group.add(beam);
  let beamT = 1;
  // a flash of light at the point of impact (kept in the scene so the light count never changes)
  const flash = new THREE.PointLight('#ffb35a', 0, 6, 2); group.add(flash);
  let flashT = 1;
  let shake = 0;

  const api = {
    sparks, dust,
    setPixelRatio(pr) { sparks.mat.uniforms.uPixel.value = dust.mat.uniforms.uPixel.value = pr; },
    get shake() { return shake; },
    landing(pos, heavy = false) {
      dust.emit({ pos: { x: pos.x, y: 0.02, z: pos.z }, count: heavy ? 34 : 18, colors: ['#d8c39a', '#b49a6c', '#efe2c4'], speed: heavy ? 1.6 : 1.0, up: 0.5, gravity: 1.2, life: 0.6, size: heavy ? 0.07 : 0.05, drag: 3.2, ring: true, radius: 0.3 });
    },
    capture(pos, side, from, height = 0.8) {
      shards[side].burst(pos, height, from);
      sparks.emit({ pos: { x: pos.x, y: 0.45, z: pos.z }, count: 120, colors: ['#ffd27a', '#ff9a3c', '#fff1c9'], speed: 3.6, up: 2.6, gravity: 5, life: 0.85, size: 0.08 });
      dust.emit({ pos: { x: pos.x, y: 0.05, z: pos.z }, count: 40, colors: side === 'w' ? ['#efe5d0', '#cbbd9e'] : ['#2a2a33', '#4a4660'], speed: 1.8, up: 0.9, gravity: 1.5, life: 0.9, size: 0.09, drag: 2.6, ring: true, radius: 0.2 });
      api.ring(pos, '#ffcc6e', 0.55, 3.2);
      flash.position.set(pos.x, 0.9, pos.z); flash.color.set('#ffb35a'); flashT = 0;
      shake = Math.max(shake, 1);
    },
    ring(pos, color = '#ffd27a', d = 0.6, grow = 2.6) {
      const r = rings.reduce((a, b) => (b.t > a.t ? b : a));
      r.m.position.set(pos.x, 0.012, pos.z); r.m.material.color.set(color); r.t = 0; r.d = d; r.grow = grow;
    },
    check(pos) {
      api.ring(pos, '#ff4a3a', 0.7, 2.2);
      setTimeout(() => api.ring(pos, '#ff4a3a', 0.7, 2.2), 160);
      flash.position.set(pos.x, 1.2, pos.z); flash.color.set('#ff3a2a'); flashT = 0.35;
      shake = Math.max(shake, 0.45);
    },
    promote(pos) {
      beam.position.set(pos.x, 3.5, pos.z); beamT = 0;
      sparks.emit({ pos: { x: pos.x, y: 0.2, z: pos.z }, count: 90, colors: ['#fff3c4', '#ffd27a', '#ffffff'], speed: 1.2, up: 4.5, gravity: -0.5, life: 1.2, size: 0.05, drag: 1.2, ring: true, radius: 0.35 });
      api.ring(pos, '#fff0b0', 0.8, 3);
      flash.position.set(pos.x, 1.5, pos.z); flash.color.set('#fff0c0'); flashT = 0;
    },
    thud(pos) { api.landing(pos, true); api.ring(pos, '#c9a35a', 0.6, 2); shake = Math.max(shake, 0.7); },
    tick(dt) {
      let busy = sparks.tick(dt) | dust.tick(dt) | shards.w.tick(dt) | shards.b.tick(dt);
      for (const r of rings) {
        if (r.t >= 1) continue;
        r.t = Math.min(1, r.t + dt / r.d); busy = true;
        const k = ease.out(r.t); r.m.scale.setScalar(0.4 + k * r.grow); r.m.material.opacity = (1 - r.t) * 0.9;
        if (r.t >= 1) r.m.scale.setScalar(0.0001);
      }
      if (beamT < 1) {
        beamT = Math.min(1, beamT + dt / 1.1); busy = true;
        const w = Math.sin(Math.PI * Math.min(1, beamT * 1.4)) * (1 - beamT * 0.3);
        beam.scale.set(Math.max(0.0001, w), 1, Math.max(0.0001, w)); beamMat.opacity = w * 0.85;
      }
      if (flashT < 1) { flashT = Math.min(1, flashT + dt / 0.32); flash.intensity = (1 - flashT) * (1 - flashT) * 14; busy = true; }
      if (shake > 0) { shake = Math.max(0, shake - dt * 3.2); busy = true; }
      return !!busy;
    },
  };
  return api;
}
