// Sign-in / sign-up page: the two kings face off behind the card; the house picker shows its words.
import { webglAvailable } from './realm3d.js';
import { play as sfx } from './sounds.js';

const words = document.getElementById('house-words');
const sync = () => {
  const on = document.querySelector('#houses input:checked');
  if (words && on) words.textContent = `“${on.closest('.house-opt').dataset.words}”`;
  if (on) document.querySelectorAll('.sigil-thumb').forEach((img) => { img.src = on.closest('.house-opt').dataset.sigil; });
};
document.querySelectorAll('#houses input, #avatars input').forEach((r) => r.addEventListener('change', () => { sync(); sfx('steel'); }));
sync();

const host = document.getElementById('stage');
if (webglAvailable()) {
  import('./versus.js').then(async ({ buildStage }) => {
    const st = await buildStage(host);
    const place = () => {
      const wide = innerWidth > 900;
      st.duel.position.set(wide ? 2.6 : 0, wide ? 0 : 1.4, 0);
      st.duel.scale.setScalar(wide ? 1 : 0.62);
      st.camera.position.set(wide ? 1.2 : 0, 2.1, 8.6);
      st.camera.lookAt(wide ? 1.6 : 0, wide ? 1.55 : 2.4, 0);
    };
    place(); window.addEventListener('resize', place);
    st.onTick((dt, t, p) => {
      const wide = innerWidth > 900;
      st.camera.position.set((wide ? 1.2 : 0) + p.x * 0.6, 2.1 - p.y * 0.3, 8.6);
      st.camera.lookAt(wide ? 1.6 : 0, wide ? 1.55 : 2.4, 0);
    });
  }).catch((e) => console.warn('3D unavailable', e));
}
