// Draws a plan onto a canvas. The same drawing is used for the preview and for
// the exported file, so they cannot differ.
import { placement } from './photo.js';

const HAS_LETTER_SPACING = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;

function fontCss(weight, sizePx, family, generics) {
  const fam = String(family).replace(/["\\]/g, '');
  return weight + ' ' + sizePx + 'px "' + fam + '", ' + ((generics && generics[family]) || 'sans-serif');
}

// Width of a string at a given tracking, the same way it will be drawn.
function textWidth(ctx, text, trackPx) {
  const chars = Array.from(text);
  if (!trackPx || chars.length < 2) {
    if (HAS_LETTER_SPACING) ctx.letterSpacing = '0px';
    return ctx.measureText(text).width;
  }
  if (HAS_LETTER_SPACING) { ctx.letterSpacing = '0px'; return ctx.measureText(text).width + trackPx * (chars.length - 1); }
  return chars.reduce((s, c) => s + ctx.measureText(c).width, 0) + trackPx * (chars.length - 1);
}

// Returns measure(text, {family, weight, sizePx, trackPx}) for layout-engine.js.
export function makeMeasure(generics) {
  const ctx = document.createElement('canvas').getContext('2d');
  const cache = new Map();
  const measure = (text, s) => {
    const key = s.family + '|' + s.weight + '|' + s.sizePx + '|' + s.trackPx + '|' + text;
    let w = cache.get(key);
    if (w === undefined) {
      ctx.font = fontCss(s.weight, s.sizePx, s.family, generics);
      w = textWidth(ctx, text, s.trackPx);
      cache.set(key, w);
    }
    return w;
  };
  measure.clear = () => cache.clear();
  return measure;
}

function drawText(ctx, it, colour, generics) {
  ctx.font = fontCss(it.weight, it.size, it.family, generics);
  ctx.fillStyle = colour;
  ctx.textBaseline = 'alphabetic';
  const y = it.y + it.size * 0.82;
  if (!it.trackPx) { if (HAS_LETTER_SPACING) ctx.letterSpacing = '0px'; ctx.fillText(it.text, it.x, y); return; }
  if (HAS_LETTER_SPACING) { ctx.letterSpacing = it.trackPx + 'px'; ctx.fillText(it.text, it.x, y); ctx.letterSpacing = '0px'; return; }
  let x = it.x;
  for (const c of Array.from(it.text)) { ctx.fillText(c, x, y); x += ctx.measureText(c).width + it.trackPx; }
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The dot mark: a round field of small dots.
function drawMark(ctx, m, colour) {
  const spacing = m.d * (5.5 / 38), radius = m.d * 0.042, reach = m.d / 2 - radius;
  ctx.fillStyle = colour;
  const n = Math.ceil(reach / spacing);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const x = i * spacing, y = j * spacing;
    if (Math.hypot(x, y) > reach + 0.01) continue;
    ctx.beginPath(); ctx.arc(m.cx + x, m.cy + y, radius, 0, Math.PI * 2); ctx.fill();
  }
}

// The brand's own logo (already recoloured), fitted inside a box without stretching.
function drawLogo(ctx, img, x, y, w, h) {
  const ar = (img.naturalWidth || img.width) / (img.naturalHeight || img.height || 1);
  let dw = w, dh = w / ar;
  if (dh > h) { dh = h; dw = h * ar; }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// Photo only, clipped to its rectangle. Used by the frame and by the
// brightness map that decides which text colours read clearly.
export function drawPhoto(ctx, plan, view) {
  const r = plan.photoRect;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  if (view.photo) {
    const p = placement(view.photo, r, view.zoom, view.pan);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // Half a pixel of overscan on each side so no hairline can show at an edge.
    ctx.drawImage(view.photo.bitmap, p.x - 0.5, p.y - 0.5, p.dw + 1, p.dh + 1);
  } else {
    ctx.fillStyle = view.colours.empty; ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.restore();
}

// Whole frame: photo, panel, mark and text.
//   view: { photo, zoom, pan, colours:{text, panelBg, panelText, pillBg, pillText, empty}, cornerRb, generics,
//           logoImage(which, hex) -> a loaded image of the brand's logo in that colour, or null }
export function drawFrame(ctx, plan, view) {
  ctx.clearRect(0, 0, plan.W, plan.H);
  drawPhoto(ctx, plan, view);
  if (plan.panelRect) { ctx.fillStyle = view.colours.panelBg; const p = plan.panelRect; ctx.fillRect(p.x, p.y, p.w, p.h); }
  const rb = (view.cornerRb || 0) * (plan.W / 540);
  for (const it of plan.items) {
    if (it.type === 'mark') {
      if (!it.brandMark) drawMark(ctx, it, view.colours[it.color]);
      else { const img = view.logoImage && view.logoImage('mark', view.colours[it.color]); if (img) drawLogo(ctx, img, it.cx - it.d / 2, it.cy - it.d / 2, it.d, it.d); }
    } else if (it.type === 'logo') {
      const img = view.logoImage && view.logoImage(it.which, view.colours[it.color]);
      if (img) drawLogo(ctx, img, it.x, it.y, it.w, it.h);
    }
    else if (it.type === 'pill') { ctx.fillStyle = view.colours[it.color]; roundRectPath(ctx, it.x, it.y, it.w, it.h, rb); ctx.fill(); }
    else drawText(ctx, it, view.colours[it.color], view.generics);
  }
}
