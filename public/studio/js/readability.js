// Which text colours read clearly on the pixels under the text.
// Pure functions over a brightness map, so they can be tested without a page.
import { APPROVED, luminance, linear, ratioFromLum } from './colour.js';

// A colour passes when this share of the pixels under the text reach 4.5:1.
// 0.95 means a few stray specks are forgiven but a busy patch is not.
export const COVERAGE = 0.95;
const MAX_SAMPLES = 6000;

// Brightness map from canvas image data. scale = map pixels per format pixel.
export function lumaMapFromImageData(imageData, scale) {
  const { width: w, height: h, data } = imageData;
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    out[i] = 0.2126 * linear(data[i * 4]) + 0.7152 * linear(data[i * 4 + 1]) + 0.0722 * linear(data[i * 4 + 2]);
  }
  return { w, h, scale, data: out };
}

// Brightness values under a set of rectangles (format pixels, optional padding).
export function samplesUnder(map, rects, padPx = 0) {
  const vals = [];
  const total = rects.reduce((s, r) => s + Math.max(1, (r.w + 2 * padPx) * map.scale) * Math.max(1, (r.h + 2 * padPx) * map.scale), 0);
  const stride = Math.max(1, Math.ceil(Math.sqrt(total / MAX_SAMPLES)));
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor((r.x - padPx) * map.scale)), x1 = Math.min(map.w, Math.ceil((r.x + r.w + padPx) * map.scale));
    const y0 = Math.max(0, Math.floor((r.y - padPx) * map.scale)), y1 = Math.min(map.h, Math.ceil((r.y + r.h + padPx) * map.scale));
    for (let y = y0; y < y1; y += stride) for (let x = x0; x < x1; x += stride) vals.push(map.data[y * map.w + x]);
  }
  return vals;
}

// Contrast that COVERAGE of the samples reach, for a text colour.
export function ratioFor(textLum, samples) {
  if (!samples.length) return 21;
  const rs = samples.map(l => ratioFromLum(textLum, l)).sort((a, b) => a - b);
  const idx = Math.min(rs.length - 1, Math.floor((1 - COVERAGE) * rs.length));
  return rs[idx];
}

// candidates: [{ name, hex }]. Returns every candidate with its ratio, the ones
// that pass, and the best match (highest ratio among those that pass).
export function assess(map, rects, candidates, padPx = 0) {
  const samples = map ? samplesUnder(map, rects, padPx) : [];
  const options = candidates.map(c => {
    const ratio = ratioFor(luminance(c.hex), samples);
    return { name: c.name, hex: c.hex, ratio, pass: ratio >= APPROVED };
  });
  const pass = options.filter(o => o.pass);
  const best = pass.slice().sort((a, b) => b.ratio - a.ratio)[0] || null;
  const closest = options.slice().sort((a, b) => b.ratio - a.ratio)[0] || null;
  return { options, pass, best, closest, anyPass: pass.length > 0 };
}
