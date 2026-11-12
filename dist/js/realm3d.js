// Shared Three.js helpers: renderer, studio lighting, materials and the Blender piece meshes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// quality: how much sharper than the screen to render (supersampling). 1.5 makes edges crisp
// on ordinary 1080p laptops; phones and high-DPI screens are capped at 2× their own density.
export function makeRenderer(host, { shadows = true, quality = 1.5 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(Math.min(2, Math.max(dpr, quality)));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);
  return renderer;
}

export function studio(scene, renderer, { warm = '#ffe3bd', cold = '#a9cdf0', keyAt = [-4.5, 9, 4.5], shadowSize = 6.5 } = {}) {
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.62;
  pmrem.dispose(); room.dispose();
  const hemi = new THREE.HemisphereLight('#fff3e0', '#2a2218', 0.85);
  const key = new THREE.DirectionalLight(warm, 3.0);
  key.position.set(...keyAt); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 0.1, far: 40 });
  key.shadow.normalBias = 0.015; key.shadow.bias = -0.0002; key.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(cold, 2.0); rim.position.set(5, 4, -6);
  scene.add(hemi, key, rim);
  return { hemi, key, rim };
}

// Marble textures painted once in a canvas: faint veins make the pieces read as stone, not plastic.
function hash(x, y) { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); }
function vnoise(x, y, px) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (a) => ((a % px) + px) % px;
  const a = hash(w(xi), yi), b = hash(w(xi + 1), yi), c = hash(w(xi), yi + 1), d = hash(w(xi + 1), yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, px) { let s = 0, a = 0.5, f = 1; for (let o = 0; o < 5; o++) { s += a * vnoise(x * f, y * f, px * f); a *= 0.5; f *= 2; } return s; }
function marble(base, vein, strength) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), B = new THREE.Color(base), V = new THREE.Color(vein);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x / W) * 6, v = (y / H) * 3, n = fbm(u, v, 6); // tiles seamlessly around the piece
    const k = Math.pow(1 - Math.abs(Math.sin((u + v * 1.7 + n * 5.5) * Math.PI)), 9) * strength;
    const cloud = (n - 0.5) * 0.08, i = (y * W + x) * 4;
    img.data[i] = 255 * Math.min(1, Math.max(0, B.r + cloud + (V.r - B.r) * k));
    img.data[i + 1] = 255 * Math.min(1, Math.max(0, B.g + cloud + (V.g - B.g) * k));
    img.data[i + 2] = 255 * Math.min(1, Math.max(0, B.b + cloud + (V.b - B.b) * k));
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
let mats = null;
export function pieceMaterials() {
  mats ??= {
    w: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: marble('#efe5d0', '#b5a382', 0.3), roughness: 0.3, clearcoat: 0.75, clearcoatRoughness: 0.14, sheen: 0.25, sheenColor: new THREE.Color('#fff2da') }),
    b: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: marble('#1e1f26', '#4a4660', 0.45), roughness: 0.22, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
    gold: new THREE.MeshStandardMaterial({ color: '#c99a3e', metalness: 0.85, roughness: 0.28 }),
  };
  return mats;
}

let library = null;
// High-detail pieces (dist/pieces-hd.glb, made by web/hd/export.html or web/hd/make_pieces_hd.py),
// falling back to the original Blender set (dist/staunton.glb). Both use nodes P N B R Q K, base at y = 0.
export async function pieceGeometries() {
  const load = (file) => new GLTFLoader().loadAsync(file).then((gltf) =>
    Object.fromEntries('PNBRQK'.split('').map((k) => [k, gltf.scene.getObjectByName(k).geometry])));
  library ??= load('/static/pieces-hd.glb').catch(() => load('/static/staunton.glb'));
  return library;
}

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// Embers rising between the kings (GPU-animated points).
export function embers(count = 260, spread = [6, 6, 4]) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread[0];
    pos[i * 3 + 1] = Math.random() * spread[1];
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread[2];
    seed[i] = Math.random();
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffb04a') }, uHeight: { value: spread[1] }, uPx: { value: 1 } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uHeight; uniform float uPx; varying float vA;
      void main(){ vec3 p = position; p.y = mod(p.y + uTime*(0.25+seed*0.45), uHeight);
        p.x += sin(uTime*0.6 + seed*20.0)*0.25; vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
        gl_PointSize = (2.0 + seed*4.0) * uPx * (6.0 / -mv.z); vA = smoothstep(0.0, 0.6, p.y) * (1.0 - smoothstep(uHeight*0.6, uHeight, p.y)); }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d)*vA; gl_FragColor = vec4(uColor*a*1.6, a); }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}
