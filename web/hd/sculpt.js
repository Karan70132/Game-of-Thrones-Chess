// Rookroom FX — realistic Staunton-style chess pieces.
//
// Pieces are built procedurally (turned profiles for pawn/rook/bishop/queen/king,
// and a sculpted signed-distance-field head for the knight). If the optional
// file  models/pieces.glb  exists (made with blender/make_pieces.py), its meshes
// are used instead. Either way every piece type ends up as one merged geometry
// whose base sits at y = 0, so the rest of the app does not care where it came from.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const PIECE_TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
export const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
// Radius of each piece's foot, used for the glowing inlay ring and for effects.
export const BASE_RADIUS = { p: 0.27, n: 0.29, b: 0.27, r: 0.29, q: 0.30, k: 0.31 };
export const PIECE_HEIGHT = { p: 0.61, n: 0.82, b: 0.85, r: 0.66, q: 0.98, k: 1.13 };

const SEG = 96; // radial segments for turned pieces

// ---------------------------------------------------------------------------
// Turned-profile helper
// ---------------------------------------------------------------------------
class Profile {
  constructor() { this.pts = []; }
  pt(r, y) { this.pts.push(new THREE.Vector2(Math.max(r, 0), y)); return this; }
  arc(cx, cy, rad, a0, a1, n = 8) {
    for (let i = 0; i <= n; i++) {
      const a = THREE.MathUtils.degToRad(a0 + (a1 - a0) * (i / n));
      this.pt(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    return this;
  }
  spline(list, n = 20) {
    const c = new THREE.SplineCurve(list.map(([r, y]) => new THREE.Vector2(r, y)));
    for (const p of c.getPoints(n)) this.pt(p.x, p.y);
    return this;
  }
  points() {
    const out = [];
    for (const p of this.pts) {
      const last = out[out.length - 1];
      if (!last || last.distanceTo(p) > 1e-5) out.push(p);
    }
    return out;
  }
}

// The shared foot: rounded disc, inlay step, bead, cove. Ends at (0.76R, 0.125).
function foot(P, R) {
  return P.pt(0, 0)
    .pt(R - 0.016, 0)
    .arc(R - 0.016, 0.016, 0.016, -90, 0, 6)
    .pt(R, 0.038)
    .arc(R - 0.013, 0.038, 0.013, 0, 90, 6)
    .pt(R * 0.905, 0.053)
    .pt(R * 0.9, 0.058)
    .arc(R * 0.86, 0.08, 0.022, -90, 90, 10)
    .spline([[R * 0.86, 0.102], [R * 0.8, 0.112], [R * 0.76, 0.125]], 6);
}

function collar(P, y, rStem, rOut, h = 0.026) {
  const rr = h / 2;
  return P.pt(rStem, y)
    .pt(rOut - rr, y)
    .arc(rOut - rr, y + rr, rr, -90, 90, 8)
    .pt(rStem * 0.95, y + h + 0.004);
}

function lathe(P) {
  const g = new THREE.LatheGeometry(P.points(), SEG);
  return g;
}

// ---------------------------------------------------------------------------
// Piece builders
// ---------------------------------------------------------------------------
function buildPawn() {
  const R = BASE_RADIUS.p;
  const P = new Profile();
  foot(P, R)
    .spline([[R * 0.76, 0.125], [0.165, 0.17], [0.125, 0.25], [0.098, 0.33], [0.092, 0.36]], 16);
  collar(P, 0.36, 0.092, 0.158, 0.03);
  P.pt(0.075, 0.395);
  // head: sphere of radius 0.122 centred at y = 0.49
  const cy = 0.49, rad = 0.122;
  const a0 = THREE.MathUtils.radToDeg(Math.atan2(0.395 - cy, 0.075)) + 4;
  P.arc(0, cy, rad, a0, 90, 22);
  return lathe(P);
}

function buildRook() {
  const R = BASE_RADIUS.r;
  const P = new Profile();
  foot(P, R)
    .spline([[R * 0.76, 0.125], [0.2, 0.17], [0.186, 0.27], [0.19, 0.38], [0.205, 0.45]], 16)
    .pt(0.232, 0.462)
    .arc(0.232, 0.474, 0.012, -90, 90, 6)
    .pt(0.215, 0.49)
    .pt(0.215, 0.57)
    .arc(0.205, 0.57, 0.01, 0, 90, 4)
    .pt(0.15, 0.58)
    .pt(0.15, 0.55)
    .pt(0.0, 0.55);
  const body = lathe(P);

  // Battlements: six rounded blocks on the rim.
  const parts = [body];
  const n = 6, rIn = 0.152, rOut = 0.215, h = 0.07;
  for (let i = 0; i < n; i++) {
    const span = (Math.PI * 2) / n * 0.6;
    const a = (i / n) * Math.PI * 2;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, rOut - 0.008, a - span / 2, a + span / 2, false);
    shape.absarc(0, 0, rIn + 0.008, a + span / 2, a - span / 2, true);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: h - 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008,
      bevelSegments: 3, curveSegments: 18,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.57 + 0.008, 0);
    parts.push(g);
  }
  return merge(parts);
}

function buildBishop() {
  const R = BASE_RADIUS.b;
  const P = new Profile();
  foot(P, R)
    .spline([[R * 0.76, 0.125], [0.16, 0.18], [0.118, 0.3], [0.1, 0.42], [0.102, 0.48]], 18);
  collar(P, 0.48, 0.102, 0.172, 0.028);
  collar(P, 0.516, 0.1, 0.152, 0.02);
  P.spline([[0.095, 0.54], [0.128, 0.585], [0.142, 0.635], [0.13, 0.69], [0.095, 0.74], [0.045, 0.775]], 28)
    .pt(0.026, 0.786);
  const cy = 0.812, rad = 0.032;
  P.arc(0, cy, rad, -55, 90, 12);
  const g = lathe(P);

  // Carve the diagonal mitre slit by pushing vertices near a tilted plane inward.
  const pos = g.attributes.position;
  const n = new THREE.Vector3(0.62, 0.78, 0).normalize();
  const c = new THREE.Vector3(0, 0.67, 0);
  const v = new THREE.Vector3();
  const w = 0.011, depth = 0.06;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y < 0.55 || v.y > 0.78) continue;
    if (v.x < -0.035) continue; // slit only cuts part way round
    const d = v.clone().sub(c).dot(n);
    if (Math.abs(d) > w) continue;
    const k = 1 - (d / w) ** 2;
    const fade = THREE.MathUtils.smoothstep(v.x, -0.035, 0.02);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-4) continue;
    const nr = Math.max(r - depth * k * fade, r * 0.35);
    v.x *= nr / r; v.z *= nr / r;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function buildQueen() {
  const R = BASE_RADIUS.q;
  const P = new Profile();
  foot(P, R)
    .spline([[R * 0.76, 0.125], [0.18, 0.2], [0.126, 0.36], [0.106, 0.52], [0.11, 0.58]], 20);
  collar(P, 0.58, 0.11, 0.185, 0.03);
  collar(P, 0.622, 0.108, 0.162, 0.02);
  P.spline([[0.105, 0.65], [0.118, 0.72], [0.15, 0.8], [0.185, 0.86]], 18)
    .pt(0.192, 0.868)
    .arc(0.184, 0.874, 0.009, -30, 120, 5)
    .spline([[0.165, 0.876], [0.14, 0.884], [0.1, 0.902], [0.05, 0.914]], 10)
    .pt(0.03, 0.918);
  const cy = 0.946, rad = 0.034;
  P.arc(0, cy, rad, -60, 90, 12);
  const parts = [lathe(P)];
  // coronet of pearls around the crown rim
  const pearls = 10;
  for (let i = 0; i < pearls; i++) {
    const a = (i / pearls) * Math.PI * 2;
    const s = new THREE.SphereGeometry(0.026, 18, 12);
    s.translate(Math.cos(a) * 0.178, 0.892, Math.sin(a) * 0.178);
    parts.push(s);
  }
  return merge(parts);
}

function buildKing() {
  const R = BASE_RADIUS.k;
  const P = new Profile();
  foot(P, R)
    .spline([[R * 0.76, 0.125], [0.19, 0.2], [0.132, 0.38], [0.114, 0.56], [0.12, 0.62]], 20);
  collar(P, 0.62, 0.12, 0.192, 0.032);
  collar(P, 0.666, 0.116, 0.168, 0.02);
  P.spline([[0.112, 0.69], [0.122, 0.76], [0.155, 0.84], [0.178, 0.88]], 18)
    .pt(0.184, 0.888)
    .arc(0.177, 0.894, 0.008, -30, 120, 5)
    .spline([[0.16, 0.9], [0.13, 0.92], [0.085, 0.94], [0.045, 0.952]], 10)
    .pt(0.04, 0.956)
    .pt(0.04, 0.975)
    .pt(0.0, 0.975);
  const parts = [lathe(P)];
  const v = new RoundedBoxGeometry(0.05, 0.17, 0.05, 3, 0.012);
  v.translate(0, 0.975 + 0.085, 0);
  const h = new RoundedBoxGeometry(0.14, 0.048, 0.05, 3, 0.012);
  h.translate(0, 1.075, 0);
  parts.push(v, h);
  return merge(parts);
}

// ---------------------------------------------------------------------------
// Knight: sculpted with a signed distance field, meshed with surface nets.
// ---------------------------------------------------------------------------
const KNIGHT_OUTLINE = [
  [-0.19, 0.12], [0.17, 0.12], [0.182, 0.17], [0.165, 0.25], [0.125, 0.33], [0.112, 0.38],
  [0.148, 0.418], [0.22, 0.443], [0.29, 0.468], [0.326, 0.5], [0.333, 0.54], [0.312, 0.576],
  [0.245, 0.61], [0.165, 0.658], [0.105, 0.705], [0.085, 0.758], [0.064, 0.818], [0.025, 0.772],
  [-0.04, 0.732], [-0.12, 0.672], [-0.18, 0.585], [-0.214, 0.475], [-0.226, 0.36],
  [-0.222, 0.26], [-0.202, 0.17],
];

function knightOutline() {
  const curve = new THREE.CatmullRomCurve3(
    KNIGHT_OUTLINE.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  return curve.getSpacedPoints(360).slice(0, -1).map((p) => [p.x, p.y]);
}

function polygonSDF(poly) {
  const n = poly.length;
  return (x, y) => {
    let d = Infinity, inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      const ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
      const dx = wx - ex * t, dy = wy - ey * t;
      d = Math.min(d, dx * dx + dy * dy);
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    }
    d = Math.sqrt(d);
    return inside ? -d : d;
  };
}

const ss = THREE.MathUtils.smoothstep;
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { return -smin(-a, -b, k); }
function sdSphere(x, y, z, cx, cy, cz, r) { return Math.hypot(x - cx, y - cy, z - cz) - r; }
function sdCapsule2(x, y, ax, ay, bx, by, r) {
  const px = x - ax, py = y - ay, ex = bx - ax, ey = by - ay;
  const t = Math.max(0, Math.min(1, (px * ex + py * ey) / (ex * ex + ey * ey)));
  return Math.hypot(px - ex * t, py - ey * t) - r;
}

function gridSDF2D(fn, x0, y0, x1, y1, step) {
  // Sample an exact 2D distance once on a fine grid, then read it back bilinearly.
  const nx = Math.ceil((x1 - x0) / step) + 1, ny = Math.ceil((y1 - y0) / step) + 1;
  const g = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g[i + j * nx] = fn(x0 + i * step, y0 + j * step);
  return (x, y) => {
    let fx = (x - x0) / step, fy = (y - y0) / step;
    fx = Math.max(0, Math.min(nx - 1.001, fx)); fy = Math.max(0, Math.min(ny - 1.001, fy));
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const a = g[i + j * nx], b = g[i + 1 + j * nx], c = g[i + (j + 1) * nx], d = g[i + 1 + (j + 1) * nx];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function knightSDF() {
  const silC = gridSDF2D(polygonSDF(knightOutline()), -0.3, 0.08, 0.4, 0.88, 0.0035);
  const halfWidth = (x, y) => {
    let h = 0.1;
    h -= 0.034 * ss(x, 0.04, 0.27) * ss(y, 0.4, 0.52);   // narrow muzzle
    h -= 0.026 * ss(y, 0.64, 0.8);                          // narrow crown of head
    h += 0.022 * (1 - ss(y, 0.14, 0.32));                   // sturdy neck base
    h -= 0.03 * ss(-x, 0.1, 0.2) * ss(y, 0.3, 0.45);        // mane ridge thinner than neck
    h += 0.012 * Math.exp(-((x - 0.05) ** 2 + (y - 0.56) ** 2) / 0.004); // cheeks
    return h;
  };
  return (x, y, z) => {
    const rr = 0.045;
    const d2 = silC(x, y);
    const h = halfWidth(x, y);
    const wx = d2 + rr, wy = Math.abs(z) - h + rr;
    let d = Math.min(Math.max(wx, wy), 0) + Math.hypot(Math.max(wx, 0), Math.max(wy, 0)) - rr;
    // split the ear tips into two ears
    d = smax(d, 0.014 - Math.abs(z) - (1 - ss(y, 0.725, 0.765)) * 0.2, 0.008);
    // eyes
    for (const s of [-1, 1]) {
      const zEye = s * (halfWidth(0.13, 0.6) + 0.004);
      d = smin(d, sdSphere(x, y, z, 0.13, 0.6, zEye * 0.92, 0.024), 0.02);
      // nostrils
      d = smax(d, -sdSphere(x, y, z, 0.3, 0.548, s * 0.045, 0.017), 0.008);
    }
    // open mouth
    d = smax(d, -(sdCapsule2(x, y, 0.36, 0.5, 0.235, 0.474, 0.0085)), 0.006);
    // mane grooves along the back
    const back = ss(-x, 0.12, 0.2) * ss(y, 0.3, 0.38) * (1 - ss(y, 0.64, 0.7));
    if (back > 0) d += 0.006 * back * Math.sin((y * 1.3 - x * 0.6) * 95);
    return d;
  };
}

function surfaceNets(sdf, min, max, step) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1;
  const ny = Math.ceil((max[1] - min[1]) / step) + 1;
  const nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const vals = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    vals[id(i, j, k)] = sdf(min[0] + i * step, min[1] + j * step, min[2] + k * step);

  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cell = new Int32Array(cx * cy * cz).fill(-1);
  const cid = (i, j, k) => i + cx * (j + cy * k);
  const verts = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const [a, b, e] = corners[c];
      cv[c] = vals[id(i + a, j + b, k + e)];
      if (cv[c] < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [e0, e1] of edges) {
      const v0 = cv[e0], v1 = cv[e1];
      if ((v0 < 0) === (v1 < 0)) continue;
      const t = v0 / (v0 - v1);
      const p0 = corners[e0], p1 = corners[e1];
      sx += p0[0] + (p1[0] - p0[0]) * t;
      sy += p0[1] + (p1[1] - p0[1]) * t;
      sz += p0[2] + (p1[2] - p0[2]) * t;
      cnt++;
    }
    cell[cid(i, j, k)] = verts.length / 3;
    verts.push(min[0] + (i + sx / cnt) * step, min[1] + (j + sy / cnt) * step, min[2] + (k + sz / cnt) * step);
  }

  // project vertices onto the surface and take the gradient as the normal
  const e = step * 0.25;
  const normals = new Float32Array(verts.length);
  for (let v = 0; v < verts.length; v += 3) {
    let x = verts[v], y = verts[v + 1], z = verts[v + 2];
    for (let it = 0; it < 2; it++) {
      const d = sdf(x, y, z);
      let gx = sdf(x + e, y, z) - sdf(x - e, y, z);
      let gy = sdf(x, y + e, z) - sdf(x, y - e, z);
      let gz = sdf(x, y, z + e) - sdf(x, y, z - e);
      const gl = Math.hypot(gx, gy, gz) || 1;
      gx /= gl; gy /= gl; gz /= gl;
      const move = Math.max(-step, Math.min(step, d));
      x -= gx * move; y -= gy * move; z -= gz * move;
      normals[v] = gx; normals[v + 1] = gy; normals[v + 2] = gz;
    }
    verts[v] = x; verts[v + 1] = y; verts[v + 2] = z;
  }

  const index = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) index.push(a, c, b, a, d, c); else index.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const inside = vals[id(i, j, k)] < 0;
    // edge along x: shared by 4 cells around it
    if (i < cx && j >= 1 && j < cy && k >= 1 && k < cz && inside !== (vals[id(i + 1, j, k)] < 0))
      quad(cell[cid(i, j - 1, k - 1)], cell[cid(i, j, k - 1)], cell[cid(i, j, k)], cell[cid(i, j - 1, k)], inside);
    // edge along y
    if (j < cy && i >= 1 && i < cx && k >= 1 && k < cz && inside !== (vals[id(i, j + 1, k)] < 0))
      quad(cell[cid(i - 1, j, k - 1)], cell[cid(i - 1, j, k)], cell[cid(i, j, k)], cell[cid(i, j, k - 1)], inside);
    // edge along z
    if (k < cz && i >= 1 && i < cx && j >= 1 && j < cy && inside !== (vals[id(i, j, k + 1)] < 0))
      quad(cell[cid(i - 1, j - 1, k)], cell[cid(i, j - 1, k)], cell[cid(i, j, k)], cell[cid(i - 1, j, k)], inside);
  }

  // make every triangle face along the field gradient
  const P = verts, N = normals;
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx2 = N[a] + N[b] + N[c], ny2 = N[a + 1] + N[b + 1] + N[c + 1], nz2 = N[a + 2] + N[b + 2] + N[c + 2];
    if (fx * nx2 + fy * ny2 + fz * nz2 < 0) { const tmp = index[t + 1]; index[t + 1] = index[t + 2]; index[t + 2] = tmp; }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  const uv = new Float32Array((verts.length / 3) * 2);
  for (let v = 0, u = 0; v < verts.length; v += 3, u += 2) { uv[u] = verts[v] + 0.5; uv[u + 1] = verts[v + 1]; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

function buildKnight() {
  const R = BASE_RADIUS.n;
  const P = new Profile();
  foot(P, R)
    .spline([[R * 0.76, 0.125], [0.212, 0.15], [0.205, 0.168]], 6)
    .pt(0.0, 0.17);
  const footGeo = lathe(P);
  const head = surfaceNets(knightSDF(), [-0.27, 0.105, -0.16], [0.37, 0.85, 0.16], 0.0074);
  head.translate(-0.02, 0, 0);
  return merge([footGeo, head]);
}

function merge(parts) {
  const prepared = parts.map((g) => {
    let geo = g.index ? g.toNonIndexed() : g;
    if (!geo.attributes.uv) {
      const n = geo.attributes.position.count;
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    for (const name of Object.keys(geo.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    }
    return geo;
  });
  return mergeGeometries(prepared, false);
}

// ---------------------------------------------------------------------------
// Public: geometry set (procedural, or from Blender GLB if available)
// ---------------------------------------------------------------------------
let cachedSet = null;

export async function loadPieceGeometries({ glbUrl } = {}) {
  if (cachedSet) return cachedSet;
  if (glbUrl) {
    try {
      const set = await loadGLB(glbUrl);
      if (set) { cachedSet = { ...set, source: 'blender' }; return cachedSet; }
    } catch (err) {
      console.info('[rookroom] pieces.glb not used:', err.message);
    }
  }
  cachedSet = buildProceduralSet();
  return cachedSet;
}

export function buildProceduralSet() {
  const t0 = performance.now();
  const set = {
    p: buildPawn(), n: buildKnight(), b: buildBishop(),
    r: buildRook(), q: buildQueen(), k: buildKing(), source: 'procedural',
  };
  for (const t of PIECE_TYPES) { set[t].computeBoundingBox(); set[t].computeBoundingSphere(); }
  console.info(`[rookroom] pieces sculpted in ${(performance.now() - t0).toFixed(0)} ms`);
  return set;
}

async function loadGLB(url) {
  const head = await fetch(url, { method: 'HEAD' });
  if (!head.ok) return null;
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const set = {};
  for (const t of PIECE_TYPES) {
    const name = PIECE_NAMES[t];
    const parts = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const owner = (o.name + ' ' + (o.parent ? o.parent.name : '')).toLowerCase();
      if (!owner.includes(name)) return;
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      parts.push(g);
    });
    if (!parts.length) throw new Error(`no "${name}" mesh in ${url}`);
    const g = merge(parts);
    // normalise: centre the round foot on x/z, base on y = 0, height matching the procedural set
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const pos = g.attributes.position;
    const footTop = bb.min.y + (bb.max.y - bb.min.y) * 0.08;
    const fb = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (v.y <= footTop) fb.expandByPoint(v); }
    const c = (fb.isEmpty() ? bb : fb).getCenter(new THREE.Vector3());
    g.translate(-c.x, -bb.min.y, -c.z);
    const s = PIECE_HEIGHT[t] / (bb.max.y - bb.min.y);
    g.scale(s, s, s);
    g.computeBoundingBox(); g.computeBoundingSphere();
    set[t] = g;
  }
  return set;
}

// ---------------------------------------------------------------------------
// Materials: polished ivory marble vs. iridescent obsidian
// ---------------------------------------------------------------------------
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x, y, periodX) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const wrap = (a) => ((a % periodX) + periodX) % periodX;
  const a = hash(wrap(xi), yi), b = hash(wrap(xi + 1), yi);
  const c = hash(wrap(xi), yi + 1), d = hash(wrap(xi + 1), yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, periodX = 1e6, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { s += a * valueNoise(x * f, y * f, periodX * f); a *= 0.5; f *= 2; }
  return s;
}

export function marbleCanvas({ base, vein, veinStrength = 0.5, w = 512, h = 256, scale = 6, seed = 0 }) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const B = new THREE.Color(base), V = new THREE.Color(vein);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x / w) * scale, v = (y / h) * scale * 0.5 + seed;
      const n = fbm(u, v, scale);
      const n2 = fbm(u * 2.3 + 7, v * 2.3, scale * 2.3);
      const veinV = Math.abs(Math.sin((u * 0.9 + v * 1.7 + n * 5.5) * Math.PI));
      const k = Math.pow(1 - veinV, 9) * veinStrength + Math.pow(1 - Math.abs(Math.sin((v * 3 + n2 * 4) * Math.PI)), 20) * veinStrength * 0.35;
      const cloud = (n - 0.5) * 0.12;
      const i = (y * w + x) * 4;
      img.data[i] = THREE.MathUtils.clamp((B.r + cloud + (V.r - B.r) * k) * 255, 0, 255);
      img.data[i + 1] = THREE.MathUtils.clamp((B.g + cloud + (V.g - B.g) * k) * 255, 0, 255);
      img.data[i + 2] = THREE.MathUtils.clamp((B.b + cloud + (V.b - B.b) * k) * 255, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function createPieceMaterials() {
  const ivoryTex = new THREE.CanvasTexture(marbleCanvas({ base: '#e2d5bd', vein: '#a8936f', veinStrength: 0.32, seed: 3 }));
  const onyxTex = new THREE.CanvasTexture(marbleCanvas({ base: '#16121e', vein: '#4d3f78', veinStrength: 0.5, seed: 11 }));
  for (const t of [ivoryTex, onyxTex]) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  const white = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: ivoryTex, roughness: 0.42, metalness: 0,
    clearcoat: 0.8, clearcoatRoughness: 0.14, sheen: 0.2, sheenColor: new THREE.Color('#fff1d6'),
    sheenRoughness: 0.6, emissive: new THREE.Color('#e9b44c'), emissiveIntensity: 0,
  });
  const black = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: onyxTex, roughness: 0.2, metalness: 0.05,
    clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.45, iridescenceIOR: 1.35,
    iridescenceThicknessRange: [180, 520], emissive: new THREE.Color('#3ef0ff'), emissiveIntensity: 0,
  });
  const whiteRing = new THREE.MeshStandardMaterial({ color: '#2a1d08', emissive: new THREE.Color('#ffb733'), emissiveIntensity: 2.2, roughness: 0.4, metalness: 0.6 });
  const blackRing = new THREE.MeshStandardMaterial({ color: '#03161a', emissive: new THREE.Color('#2ee8ff'), emissiveIntensity: 2.6, roughness: 0.4, metalness: 0.6 });
  return { w: { body: white, ring: whiteRing }, b: { body: black, ring: blackRing } };
}

// One chess piece = body mesh + glowing inlay ring at the foot.
export function makePiece(type, color, geos, mats) {
  const group = new THREE.Group();
  group.name = `${color}${type}`;
  const body = new THREE.Mesh(geos[type], mats[color].body.clone());
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);
  const R = BASE_RADIUS[type];
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.905, 0.0055, 8, 96), mats[color].ring.clone());
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.056;
  group.add(ring);
  // knights face the opponent
  if (type === 'n') body.rotation.y = color === 'w' ? Math.PI / 2 : -Math.PI / 2;
  group.userData = { type, color, body, ring, baseRingIntensity: ring.material.emissiveIntensity };
  return group;
}
