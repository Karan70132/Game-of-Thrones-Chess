// 3D playing board (and single-piece gallery) built on the project's Blender pieces.
// update(board, {selected, targets, last, hint, check}) keeps the scene in sync with the game.
import { THREE, makeRenderer, studio, pieceMaterials, pieceGeometries, reducedMotion } from './realm3d.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BOARD_THEMES, currentBoard } from './ui.js';
import { makeFx, ease } from './fx.js';

const at = (i) => new THREE.Vector3(i % 8 - 3.5, 0, 3.5 - (i >> 3));

function labelStrip(text, x, z, angle, color = '#e9cf9c') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 34px Cinzel, Georgia, serif'; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  [...text].forEach((ch, i) => g.fillText(ch, 64 + 128 * i, 34));
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.5), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2; m.rotation.y = angle; m.position.set(x, -0.014, z);
  return m;
}

export async function mountBoard(host, onSquare, mode = 'play') {
  const geos = await pieceGeometries();
  const renderer = makeRenderer(host);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0; controls.maxPolarAngle = 1.25;
  controls.minDistance = mode === 'gallery' ? 2.2 : 7; controls.maxDistance = mode === 'gallery' ? 7 : 24;
  studio(scene, renderer);
  const mats = pieceMaterials();
  const grain = await new THREE.TextureLoader().loadAsync('/static/grain.jpg').catch(() => null);
  if (grain) { grain.colorSpace = THREE.SRGBColorSpace; grain.wrapS = grain.wrapT = THREE.RepeatWrapping; }

  let dirty = true, loopUntil = 0;
  const wake = (ms = 0) => { dirty = true; loopUntil = Math.max(loopUntil, performance.now() + ms); };
  controls.addEventListener('change', () => wake(120));

  // ---- gallery mode: one sculpture on a pedestal -------------------------
  if (mode === 'gallery') {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.16, 64), new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 0.45, map: grain }));
    ped.position.y = -0.08; ped.receiveShadow = true; scene.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.012, 8, 96), mats.gold); ring.rotation.x = Math.PI / 2; scene.add(ring);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.25 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.16; floor.receiveShadow = true; scene.add(floor);
    let featured = null;
    const exhibit = (k, side = 'w') => {
      if (featured) scene.remove(featured);
      featured = new THREE.Mesh(geos[k], mats[side]); featured.castShadow = true; featured.rotation.y = 0.5; scene.add(featured); wake(400);
    };
    exhibit('N');
    const reset = () => { camera.position.set(2.2, 1.8, 3.2); controls.target.set(0, 0.62, 0); controls.update(); wake(200); };
    let spin = !reducedMotion();
    controls.addEventListener('start', () => { spin = false; });
    fit(); reset(); loop();
    return { exhibit, reset };
    function loop() {
      requestAnimationFrame(loop);
      if (host.offsetWidth === 0) return;
      if (spin && featured) { featured.rotation.y += 0.004; dirty = true; }
      if (controls.update()) dirty = true;
      if (dirty || performance.now() < loopUntil) { renderer.render(scene, camera); dirty = false; }
    }
    function fit() { size(); new ResizeObserver(size).observe(host); }
    function size() { const { width, height } = host.getBoundingClientRect(); if (!width) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); wake(); }
  }

  const rig = buildBoard({ geos, mats, grain, wake });
  scene.add(rig.group);
  const { tiles, men, update, setTheme } = rig;
  // ---- picking ----------------------------------------------------------------
  const ray = new THREE.Raycaster(), surface = renderer.domElement;
  let down = null, drag = false;
  function hit(e) {
    const r = surface.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2), camera);
    return ray.intersectObjects([...men.filter(Boolean), ...tiles], false)[0]?.object.userData.square;
  }
  surface.addEventListener('pointerdown', (e) => { if (!e.isPrimary) { drag = true; return; } down = [e.clientX, e.clientY]; drag = false; });
  surface.addEventListener('pointermove', (e) => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) drag = true;
    surface.style.cursor = down ? 'grabbing' : onSquare && hit(e) != null ? 'pointer' : 'grab';
  });
  surface.addEventListener('pointerup', (e) => {
    const click = down && !drag && e.button === 0; down = null;
    if (click && onSquare && !rig.busy) { const i = hit(e); if (i != null) onSquare(i); }
  });

  // ---- camera -------------------------------------------------------------------
  let view = 'angle';
  // Fit the whole board (frame + the tops of the back-rank pieces) inside the view.
  const fitPoints = [];
  for (const x of [-4.65, 4.65]) for (const z of [-4.65, 4.65]) for (const y of [-0.42, 0]) fitPoints.push(new THREE.Vector3(x, y, z));
  for (const x of [-3.5, 3.5]) for (const z of [-3.5, 3.5]) fitPoints.push(new THREE.Vector3(x, 1.65, z));
  const tmp = new THREE.Vector3();
  function fits(margin) {
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    let minY = 1, maxY = -1, ok = true;
    for (const p of fitPoints) {
      tmp.copy(p).project(camera);
      if (Math.abs(tmp.x) > margin || Math.abs(tmp.y) > margin) ok = false;
      minY = Math.min(minY, tmp.y); maxY = Math.max(maxY, tmp.y);
    }
    return { ok, mid: (minY + maxY) / 2 };
  }
  function place(dir, target, d) { camera.position.copy(target).addScaledVector(dir, d); camera.lookAt(target); }
  function frame(which = view) {
    view = which;
    camera.up.set(0, 1, 0);
    const top = which === 'top';
    const dir = top ? new THREE.Vector3(0, 1, 0.0001).normalize() : new THREE.Vector3(0, Math.cos(0.66), Math.sin(0.66));
    const target = new THREE.Vector3(0, top ? 0 : 0.2, top ? 0 : 0.2);
    // centre the board vertically, then find the closest distance that still fits
    for (let pass = 0; pass < 3; pass++) {
      let lo = 4, hi = 60;
      for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; place(dir, target, mid); if (fits(top ? 0.97 : 0.95).ok) hi = mid; else lo = mid; }
      place(dir, target, hi);
      if (top) break;
      const { mid } = fits(1);
      const span = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * hi;
      target.y += mid * span * Math.cos(0.66) * 0.9; target.z -= mid * span * Math.sin(0.66) * 0.9;
    }
    controls.target.copy(target);
    controls.update(); wake(200);
  }
  let lastW = 0, lastH = 0;
  function size() {
    const { width, height } = host.getBoundingClientRect(); if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (Math.abs(width - lastW) > 2 || Math.abs(height - lastH) > 2) { lastW = width; lastH = height; frame(view); }
    wake();
  }
  size();
  new ResizeObserver(() => { size(); }).observe(host);
  document.addEventListener('boardchange', (e) => setTheme(e.detail));
  rig.setPixelRatio(renderer.getPixelRatio());
  renderer.compile(scene, camera); // build every shader now, so the first capture does not stutter

  // ---- render loop (renders only when something changes) -----------------------
  let lastFrame = 0, frames = 0, slow = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (rig.tick(now)) dirty = true;
    // never draw while the 3D view is hidden (flat view active); catch up once it is shown again
    if (host.offsetWidth === 0) { dirty = true; return; }
    if (controls.update()) dirty = true;
    if (dirty || now < loopUntil) {
      // adaptive sharpness: if animated frames come slowly, drop toward the screen's own resolution
      if (lastFrame && now - lastFrame < 200) { frames++; if (now - lastFrame > 32) slow++; }
      lastFrame = now;
      if (frames >= 40) {
        const pr = renderer.getPixelRatio(), floor = Math.min(1, window.devicePixelRatio || 1);
        if (slow > 24 && pr > floor) { renderer.setPixelRatio(Math.max(floor, pr - 0.2)); lastW = 0; size(); rig.setPixelRatio(renderer.getPixelRatio()); }
        frames = 0; slow = 0;
      }
      if (rig.shake > 0) {
        const k = rig.shake * rig.shake * 0.06, saved = camera.position.clone();
        camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k;
        renderer.render(scene, camera); camera.position.copy(saved);
      } else renderer.render(scene, camera);
      dirty = false;
    }
  }
  requestAnimationFrame(loop);

  return { update, rain: rig.rain, reset: () => frame('angle'), top: () => frame('top'), setTheme, get view() { return view; } };
}

// Builds the table, squares, markers and pieces into a group; reusable by the home page scene.
export function buildBoard({ geos, mats, grain, wake: rigWake = () => {}, shadowFloor: wantFloor = true }) {
  const group = new THREE.Group();
  const rig = { group, pulsing: false };
  // ---- table ------------------------------------------------------------------
  const oak = new THREE.MeshStandardMaterial({ color: '#3b2619', roughness: 0.42, map: grain });
  const brass = new THREE.MeshStandardMaterial({ color: '#b58a46', metalness: 0.7, roughness: 0.3 });
  for (const [w, h, y, m] of [[9.3, 0.24, -0.3, oak], [9.0, 0.03, -0.16, brass], [8.9, 0.14, -0.08, oak], [8.12, 0.02, -0.012, brass]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m); b.position.y = y; b.receiveShadow = true; b.castShadow = true; group.add(b);
  }
  group.add(labelStrip('abcdefgh', 0, 4.22, 0), labelStrip('12345678', -4.22, 0, Math.PI / 2));
  if (wantFloor) {
    const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.3 }));
    shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = -0.42; shadowFloor.receiveShadow = true; group.add(shadowFloor);
  }

  const tileMats = [new THREE.MeshStandardMaterial({ roughness: 0.62 }), new THREE.MeshStandardMaterial({ roughness: 0.62 })]; // [dark, light]
  const tileGeo = new THREE.BoxGeometry(0.998, 0.045, 0.998);
  const tiles = [];
  for (let i = 0; i < 64; i++) {
    const t = new THREE.Mesh(tileGeo, tileMats[(i % 8 + (i >> 3)) % 2]);
    t.position.copy(at(i)); t.position.y = -0.0225; t.receiveShadow = true; t.userData.square = i;
    tiles.push(t); group.add(t);
  }
  function setTheme(name = currentBoard()) {
    const th = BOARD_THEMES[name] || BOARD_THEMES.tourney;
    // the studio lights are bright, so tone the squares down to match the flat board's colours
    tileMats[0].color.set(th.dark).multiplyScalar(0.8); tileMats[1].color.set(th.light).multiplyScalar(0.74);
    for (const m of tileMats) { m.map = name === 'walnut' ? grain : null; m.needsUpdate = true; }
    rigWake();
  }
  setTheme();

  // ---- square markers: tints, legal-move dots, capture rings -----------------
  const basic = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const tintGeo = new THREE.PlaneGeometry(1, 1), dotGeo = new THREE.CircleGeometry(0.17, 40), haloGeo = new THREE.RingGeometry(0.17, 0.215, 40), capGeo = new THREE.RingGeometry(0.39, 0.48, 56);
  const M = {
    last: basic('#f5e15a', 0.42), sel: basic('#f5d33a', 0.7), hint: basic('#4fb3e0', 0.5), check: basic('#ff3b2f', 0.75),
    dot: basic('#10140d', 0.82), halo: basic('#ffffff', 0.85), cap: basic('#d23a2a', 0.92),
  };
  const marks = [];
  for (let i = 0; i < 64; i++) {
    const p = at(i);
    const tint = new THREE.Mesh(tintGeo, M.last); tint.rotation.x = -Math.PI / 2; tint.position.set(p.x, 0.002, p.z);
    const dot = new THREE.Group();
    const d1 = new THREE.Mesh(dotGeo, M.dot), d2 = new THREE.Mesh(haloGeo, M.halo);
    for (const d of [d1, d2]) { d.rotation.x = -Math.PI / 2; d.renderOrder = 3; dot.add(d); }
    dot.position.set(p.x, 0.006, p.z);
    const cap = new THREE.Mesh(capGeo, M.cap); cap.rotation.x = -Math.PI / 2; cap.position.set(p.x, 0.005, p.z); cap.renderOrder = 3;
    for (const o of [tint, dot, cap]) { o.visible = false; group.add(o); }
    marks.push({ tint, dot, cap });
  }

  // ---- pieces -----------------------------------------------------------------
  const fx = makeFx(group, mats);
  const UP = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const men = Array(64).fill(null);
  function pose(o, axis = null, tilt = 0) {
    qb.setFromAxisAngle(UP, o.userData.yaw);
    if (axis && tilt) o.quaternion.multiplyQuaternions(qa.setFromAxisAngle(axis, tilt), qb); else o.quaternion.copy(qb);
  }
  function makeMan(p) {
    const o = new THREE.Mesh(geos[p.toUpperCase()], mats[p === p.toUpperCase() ? 'w' : 'b']);
    o.castShadow = o.receiveShadow = true;
    o.userData.p = p;
    o.userData.yaw = p === p.toUpperCase() ? 0.48 : Math.PI + 0.48;
    if (p.toUpperCase() === 'N') o.userData.yaw = p === 'N' ? Math.PI * 0.5 + 0.2 : -Math.PI * 0.5 + 0.2; // knights face the enemy
    pose(o);
    group.add(o);
    return o;
  }

  // anim: one move in flight. {began, D, tracks, victims, promo, arrived, after}
  let prev = null, anim = null, lifted = null, lastNow = performance.now();
  let drops = [], wobble = null, topple = null;
  // which way a mated king falls: onto an empty neighbouring square if there is one, else off the board's edge
  function fallDir(i) {
    const f = i % 8, r = i >> 3;
    let best = null, score = -1;
    for (const [dx, dz] of [[0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0], [1, -1], [-1, -1], [0, -1]]) {
      const ff = f + dx, rr = r - dz, inside = ff >= 0 && ff < 8 && rr >= 0 && rr < 8;
      const sc = !inside ? 1 : prev && !prev[rr * 8 + ff] ? 2 : 0;
      if (sc > score) { score = sc; best = [dx, dz]; }
    }
    const dir = new THREE.Vector3(best[0], 0, best[1]).normalize();
    return { dir, axis: new THREE.Vector3(dir.z, 0, -dir.x) };
  }
  function restore(o, i) { o.position.copy(at(i)); o.scale.setScalar(1); pose(o); }
  function settle() {
    if (anim) {
      for (const v of anim.victims) group.remove(v.o);
      if (anim.promo) { group.remove(anim.promo.pawn); anim.promo.piece.visible = true; }
      for (const tr of anim.tracks) if (tr.o.parent) { tr.o.position.copy(tr.to); tr.o.scale.setScalar(1); pose(tr.o); }
      if (anim.promo) anim.promo.piece.scale.setScalar(1);
      anim = null;
    }
    for (const d of drops) restore(d.o, d.i);
    drops = [];
    if (wobble) { pose(wobble.o); wobble = null; }
    if (topple) { if (topple.o.parent) restore(topple.o, topple.i); topple = null; }
  }

  function update(board, { selected = null, targets = [], last = null, hint = null, check = null, mate = false, animate: wantAnim = false } = {}) {
    // pieces: animate a single forward move, otherwise snap
    if (!prev || prev.some((p, i) => p !== board[i])) {
      settle();
      const animate = wantAnim && prev && last && !reducedMotion() && prev[last[0]] && !board[last[0]] && board[last[1]];
      const movers = [];
      if (animate) {
        const [a, b] = last;
        movers.push([a, b]);
        if (prev[a].toUpperCase() === 'K' && Math.abs(b - a) === 2) movers.push([b > a ? a + 3 : a - 4, (a + b) / 2]);
      }
      const src = new Map(movers.map(([a, b]) => [b, men[a]]));
      movers.forEach(([a]) => { men[a] = null; });
      const tracks = [], victims = [];
      let promo = null;
      for (let i = 0; i < 64; i++) {
        if (men[i] && (men[i].userData.p !== board[i] || src.has(i))) {
          if (animate) victims.push({ o: men[i], i, base: men[i].position.clone() }); else group.remove(men[i]);
          men[i] = null;
        }
        if (board[i] && !men[i]) {
          const old = src.get(i), mv = movers.find(([, b]) => b === i);
          let mover = null;
          if (old && old.userData.p === board[i]) { men[i] = old; mover = old; }
          else if (old) { men[i] = makeMan(board[i]); men[i].visible = false; promo = { pawn: old, piece: men[i] }; mover = old; }
          else men[i] = makeMan(board[i]);
          men[i].userData.square = i; men[i].position.copy(at(i));
          if (mover && mv) {
            const from = at(mv[0]), to = at(i), dist = from.distanceTo(to);
            const axis = new THREE.Vector3(to.z - from.z, 0, from.x - to.x).normalize();
            tracks.push({ o: mover, from, to, dist, axis, knight: prev[mv[0]].toUpperCase() === 'N', main: mv === movers[0] });
            mover.position.copy(from);
          }
        }
      }
      prev = board.slice();
      if (tracks.length) {
        const main = tracks.find((t) => t.main) || tracks[0];
        const D = main.knight ? 640 : Math.min(720, 380 + main.dist * 55);
        anim = { began: performance.now(), D, tracks, main, victims, promo, arrived: false, popAt: 0, after: { check, mate } };
        rigWake(D + 1400);
      } else {
        for (const v of victims) group.remove(v.o);
        // arriving straight at a checkmate (no move to animate): the king is already down
        if (mate && check != null && men[check]) {
          topple = { o: men[check], i: check, began: performance.now() - 5000, ...fallDir(check), thud: true };
          rigWake(60);
        }
      }
    }
    // lift the selected piece
    if (lifted && lifted !== men[selected]) { if (!anim) lifted.position.y = 0; lifted = null; }
    if (selected !== null && men[selected] && !anim) { lifted = men[selected]; lifted.position.y = 0.12; }
    // markers
    const tg = new Map(targets.map((t) => [t.i, t]));
    for (let i = 0; i < 64; i++) {
      const m = marks[i], t = tg.get(i);
      let tint = null;
      if (check === i) tint = M.check;
      else if (selected === i) tint = M.sel;
      else if (hint && hint.includes(i)) tint = M.hint;
      else if (last && last.includes(i)) tint = M.last;
      m.tint.visible = !!tint; if (tint) m.tint.material = tint;
      m.dot.visible = !!t && !t.capture;
      m.cap.visible = !!t && !!t.capture;
    }
    rig.pulsing = targets.length > 0;
    rigWake(80);
  }

  function step(now) {
    const a = anim, T = (now - a.began) / a.D, t = Math.min(1, T);
    for (const tr of a.tracks) {
      if (!tr.o.parent) continue;
      tr.o.position.lerpVectors(tr.from, tr.to, ease.inOut(t));
      const H = tr.knight ? 0.95 : Math.min(0.5, 0.16 + tr.dist * 0.035);
      tr.o.position.y = Math.pow(Math.sin(Math.PI * t), 0.8) * H;
      // lean into the move, then rock back as it brakes; knights also twist in the air
      const lean = t < 1 ? (tr.knight ? 0.3 : 0.2) * Math.sin(2 * Math.PI * t) : 0;
      pose(tr.o, tr.axis, lean);
      if (tr.knight && t < 1) tr.o.rotateY(Math.sin(Math.PI * t) * 0.5);
      // squash on landing
      const u = (now - a.began - a.D) / 280;
      if (u >= 0 && u < 1) { const k = Math.exp(-4 * u) * Math.sin(u * Math.PI * 2.5); tr.o.scale.set(1 + 0.07 * k, 1 - 0.14 * k, 1 + 0.07 * k); }
      else tr.o.scale.setScalar(1);
    }
    // the target trembles as the attacker closes in
    if (T < 1) for (const v of a.victims) { const k = Math.max(0, (T - 0.5) / 0.5); v.o.position.x = v.base.x + Math.sin(now / 16) * 0.018 * k; }
    if (T >= 1 && !a.arrived) {
      a.arrived = true;
      const to = a.main.to;
      fx.landing(to, a.victims.length > 0);
      for (const v of a.victims) { fx.capture(v.base, v.o.userData.p === v.o.userData.p.toUpperCase() ? 'w' : 'b', a.main.from, 0.85); group.remove(v.o); }
      a.victims = [];
      if (a.promo) { group.remove(a.promo.pawn); a.promo.piece.visible = true; a.promo.piece.scale.setScalar(0.001); a.popAt = now; fx.promote(to); }
    }
    if (a.popAt) { const u = Math.min(1, (now - a.popAt) / 520); a.promo.piece.scale.setScalar(Math.max(0.001, ease.outBack(u))); }
    const done = T >= 1 && now - a.began - a.D > 300 && (!a.popAt || now - a.popAt > 520);
    if (done) {
      const { check, mate } = a.after;
      settle();
      if (check != null && men[check]) {
        fx.check(at(check));
        if (mate) topple = { o: men[check], i: check, began: now + 350, ...fallDir(check), thud: false };
        else wobble = { o: men[check], began: now };
      }
    }
  }

  // pieces drop onto the board, rank by rank (new game, new scene)
  function rain({ quick = false } = {}) {
    settle();
    if (reducedMotion()) return;
    const now = performance.now();
    drops = [];
    men.forEach((o, i) => {
      if (!o) return;
      const r = i >> 3, f = i % 8, order = o.userData.p === o.userData.p.toUpperCase() ? r : 7 - r;
      const delay = quick ? f * 14 + Math.random() * 60 : order * 110 + f * 26 + Math.random() * 40;
      drops.push({ o, i, at: now + delay, h: (quick ? 1.6 : 2.6) + Math.random() * 0.8, landed: false });
      o.position.y = 10;
    });
    rigWake(1800);
  }

  // advance animations; returns true while something moved
  function tick(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
    let moving = false;
    if (anim) { step(now); moving = true; }
    if (drops.length) {
      moving = true;
      let left = 0;
      for (const d of drops) {
        const u = (now - d.at) / 620;
        if (u < 0) { d.o.position.y = 10; left++; continue; }
        const k = Math.min(1, u);
        d.o.position.y = (1 - ease.outBounce(k)) * d.h;
        if (!d.landed && k > 0.36) { d.landed = true; if ((d.i >> 3) % 7 === 0) fx.landing(at(d.i)); }
        if (k < 1) left++;
      }
      if (!left) { for (const d of drops) restore(d.o, d.i); drops = []; }
    }
    if (wobble) {
      const u = (now - wobble.began) / 700;
      if (u >= 1) { pose(wobble.o); wobble = null; } else { pose(wobble.o, new THREE.Vector3(1, 0, 0), Math.sin(u * Math.PI * 6) * 0.12 * (1 - u)); }
      moving = true;
    }
    if (topple) {
      const u = Math.max(0, (now - topple.began) / 1150), k = ease.outBounce(Math.min(1, u)), th = 1.38 * k, r = 0.27;
      const base = at(topple.i);
      topple.o.position.set(base.x + topple.dir.x * r * (1 - Math.cos(th)), r * Math.sin(th) * 0.92, base.z + topple.dir.z * r * (1 - Math.cos(th)));
      pose(topple.o, topple.axis, th);
      if (!topple.thud && u > 0.36) { topple.thud = true; fx.thud(new THREE.Vector3(base.x + topple.dir.x * 0.9, 0, base.z + topple.dir.z * 0.9)); }
      if (u < 1) moving = true;
    }
    if (fx.tick(dt)) moving = true;
    rig.shake = fx.shake;
    if (rig.pulsing) {
      const sc = 1 + Math.sin(now / 260) * 0.07;
      for (const m of marks) if (m.dot.visible) m.dot.scale.set(sc, 1, sc);
      moving = true;
    }
    return moving;
  }
  Object.assign(rig, { update, setTheme, tick, rain, tiles, men, fx, shake: 0, setPixelRatio: fx.setPixelRatio, get busy() { return !!anim; } });
  return rig;
}
