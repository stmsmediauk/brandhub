// Generated test photos, for trying the studio without a real photo.
// Only offered when the page asks for them (the test harness), never to clients.
import { fromBitmap } from './photo.js';

export const SAMPLES = [
  { id: 'dark',     label: 'Dark' },
  { id: 'bright',   label: 'Bright' },
  { id: 'busy',     label: 'Busy' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'soft',     label: 'Slightly small' },
  { id: 'tiny',     label: 'Too small' }
];

// Small repeatable random numbers, so a sample looks the same every time.
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function radial(g, w, h, cx, cy, stops) {
  const r = Math.hypot(w, h) * 0.6;
  const grad = g.createRadialGradient(w * cx, h * cy, 0, w * cx, h * cy, r);
  stops.forEach(([o, c]) => grad.addColorStop(o, c));
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
}

function make(id) {
  const dims = { dark: [2400, 1600], bright: [2400, 1600], busy: [2400, 1600], portrait: [1600, 2400], soft: [1400, 1200], tiny: [500, 375] }[id];
  const c = document.createElement('canvas'); c.width = dims[0]; c.height = dims[1];
  const g = c.getContext('2d'), w = c.width, h = c.height;
  if (id === 'bright') radial(g, w, h, 0.3, 0.3, [[0, '#FFFFFF'], [0.4, '#EDEDEA'], [1, '#C8C8C2']]);
  else if (id === 'busy') {
    const r = rng(7);
    g.fillStyle = '#777'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = Math.floor(r() * 256); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(r() * w, r() * h, 40 + r() * 220, 40 + r() * 220); }
  } else radial(g, w, h, 0.72, 0.44, [[0, '#9DB1BC'], [0.38, '#52666F'], [1, '#1D2A31']]);
  return c;
}

export async function makeSample(id) {
  const bmp = await createImageBitmap(make(id));
  return fromBitmap(bmp, id + ' sample');
}
