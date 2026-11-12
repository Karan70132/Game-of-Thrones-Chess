// Profile page: live crest preview, house choice from the quiz (?house=), picture upload.
import { crestSVG } from './ui.js';
import { play as sfx } from './sounds.js';

const $ = (id) => document.getElementById(id);
const photo = $('id_photo');
const name = $('preview-name').textContent.split(' ')[0];

const fromQuiz = new URLSearchParams(location.search).get('house');
if (fromQuiz) { const r = document.querySelector(`#houses input[value="${CSS.escape(fromQuiz)}"]`); if (r) r.checked = true; }

function preview() {
  const opt = document.querySelector('#houses input:checked')?.closest('.house-opt');
  if (!opt) return;
  const d = opt.dataset;
  const av = document.querySelector('#avatars input:checked')?.parentElement.querySelector('img[data-src]')?.dataset.src;
  const picture = photo.value || av || d.sigil;
  document.querySelectorAll('.sigil-thumb').forEach((img) => { img.src = d.sigil; });
  $('crest-preview').innerHTML = `<span class="crest">${crestSVG({ field: d.field, metal: d.metal, piece: d.piece, photo: picture })}</span>`;
  $('preview-words').textContent = `“${d.words}”`;
  $('preview-house').textContent = d.name;
  const title = $('id_title').value;
  $('preview-name').textContent = title ? `${name} ${title}` : name;
  $('photo-clear').hidden = !photo.value;
}
document.querySelectorAll('#houses input, #avatars input').forEach((r) => r.addEventListener('change', () => { preview(); sfx('steel'); }));
$('id_title').addEventListener('change', preview);

// Shrink the chosen picture to a 240×288 shield-shaped crop before it is saved.
async function usePicture(file) {
  if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return;
  const img = await createImageBitmap(file);
  const W = 240, H = 288, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const scale = Math.max(W / img.width, H / img.height);
  const w = img.width * scale, h = img.height * scale;
  c.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2.6, w, h);
  let q = 0.86, data = c.toDataURL('image/jpeg', q);
  while (data.length > 140000 && q > 0.4) { q -= 0.12; data = c.toDataURL('image/jpeg', q); }
  photo.value = data;
  preview();
}
$('photo-file').addEventListener('change', (e) => usePicture(e.target.files[0]));
const drop = $('photo-drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); usePicture(e.dataTransfer.files[0]); });
$('photo-clear').onclick = () => { photo.value = ''; $('photo-file').value = ''; preview(); };
if (fromQuiz) preview();
