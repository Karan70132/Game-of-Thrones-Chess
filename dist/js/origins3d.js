// The C++ origins page: a turnable 3D sculpture for each source file (dist/origins/<file>.glb).
import { THREE, makeRenderer, studio, reducedMotion } from './realm3d.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export async function mountSculpture(host, file) {
  const gltf = await new GLTFLoader().loadAsync(`/static/origins/${file}.glb`);
  const renderer = makeRenderer(host, { quality: 1.5 });
  const scene = new THREE.Scene();
  studio(scene, renderer, { shadowSize: 5 });
  gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  // centre the sculpture and size the camera to it
  const box = new THREE.Box3().setFromObject(gltf.scene), centre = box.getCenter(new THREE.Vector3()), radius = box.getSize(new THREE.Vector3()).length() / 2;
  gltf.scene.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z));
  scene.add(gltf.scene);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.001; floor.receiveShadow = true; scene.add(floor);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 100);
  const target = new THREE.Vector3(0, (box.max.y - box.min.y) * 0.4, 0);
  const home = () => { const d = radius / Math.sin(THREE.MathUtils.degToRad(17)) * 1.02; camera.position.set(d * 0.55, d * 0.55, d * 0.63); controls.target.copy(target); controls.update(); };
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false; controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = radius * 1.4; controls.maxDistance = radius * 6;
  controls.autoRotate = !reducedMotion(); controls.autoRotateSpeed = 0.6;
  home();
  const spin = document.getElementById('sculpture-spin'), reset = document.getElementById('sculpture-reset');
  const label = () => { spin.textContent = controls.autoRotate ? 'Pause rotation' : 'Rotate'; spin.setAttribute('aria-pressed', String(controls.autoRotate)); };
  spin.hidden = reset.hidden = false; label();
  spin.onclick = () => { controls.autoRotate = !controls.autoRotate; label(); };
  reset.onclick = home;
  controls.addEventListener('start', () => { controls.autoRotate = false; label(); });
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  new ResizeObserver(size).observe(host); size();
  renderer.compile(scene, camera);
  host.querySelector('#gallery-fallback')?.remove();
  host.classList.add('live');
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    if (document.hidden) return;
    if (controls.update(dt) || controls.autoRotate) renderer.render(scene, camera);
  });
  renderer.render(scene, camera);
}
