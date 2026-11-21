// Colour maths. Pure functions, no page access.
// Contrast rules (WCAG ratios): 4.5 or more is approved for text, 3 to 4.5 is
// headlines and graphics only, below 3 is never.

export const APPROVED = 4.5;
export const HEADLINE = 3;

export function parseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function toHex(rgb) {
  return '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function normaliseHex(hex) {
  const rgb = parseHex(hex);
  return rgb ? toHex(rgb) : null;
}

// One 0-255 channel to linear light.
export function linear(v) {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

// Relative luminance, 0 (black) to 1 (white).
export function luminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

// Contrast ratio from two luminances.
export function ratioFromLum(a, b) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function contrast(hexA, hexB) {
  return ratioFromLum(luminance(hexA), luminance(hexB));
}

// 'approved' | 'headline' | 'never'
export function classify(ratio) {
  if (ratio >= APPROVED) return 'approved';
  if (ratio >= HEADLINE) return 'headline';
  return 'never';
}

// Blend a towards b. t=0 gives a, t=1 gives b.
export function mix(hexA, hexB, t) {
  const a = parseHex(hexA), b = parseHex(hexB);
  return toHex(a.map((v, i) => v + (b[i] - v) * t));
}

export function lightest(hexes) {
  return hexes.reduce((best, h) => (luminance(h) > luminance(best) ? h : best), hexes[0]);
}

export function darkest(hexes) {
  return hexes.reduce((best, h) => (luminance(h) < luminance(best) ? h : best), hexes[0]);
}

// The candidate with the highest contrast against `on`.
export function bestOn(on, candidates) {
  let best = candidates[0], r = -1;
  for (const c of candidates) {
    const cr = contrast(c, on);
    if (cr > r) { r = cr; best = c; }
  }
  return best;
}

// "R, G, B" for display.
export function rgbString(hex) {
  const rgb = parseHex(hex);
  return rgb ? rgb.join(', ') : '';
}

// CMYK percentages calculated from RGB (a simple conversion with no colour profile).
// A brand can set its own CMYK per colour instead; see cmykFor.
export function cmykFromHex(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(v => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map(x => Math.round(x * 100));
}

// The CMYK to show for a palette colour: its own override when set, otherwise calculated.
export function cmykFor(colour) {
  const o = colour && colour.cmyk;
  if (Array.isArray(o) && o.length === 4 && o.every(n => typeof n === 'number' && n >= 0 && n <= 100)) return o.map(n => Math.round(n));
  return cmykFromHex(colour && colour.hex);
}
