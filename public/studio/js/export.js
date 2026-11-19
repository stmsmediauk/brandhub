// Making the downloadable file. Draws with the same renderer as the preview.
import { drawFrame } from './renderer.js';

export function renderToCanvas(plan, view) {
  const c = document.createElement('canvas');
  c.width = plan.W; c.height = plan.H;
  drawFrame(c.getContext('2d'), plan, view);
  return c;
}

export function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The browser could not make the file.'))), type, quality);
  });
}

// File name from the brand's pattern, for example {brand}_{format}_{layout}.
export function fileName(pattern, parts, ext) {
  const safe = s => String(s).toLowerCase().replace(/:/g, 'x').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  const base = (pattern || '{brand}_{format}_{layout}').replace(/\{(\w+)\}/g, (m, k) => safe(parts[k] != null ? parts[k] : ''));
  return base + '.' + ext;
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function formatBytes(n) {
  return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
}
