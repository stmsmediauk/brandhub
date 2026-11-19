// Formats, safe areas, clamping and snapping. Pure functions.
// All coordinates are in export pixels of the chosen format.

export const FORMATS = {
  '1:1':       { id: '1:1',       label: '1:1 square',   w: 1080, h: 1080 },
  '4:5':       { id: '4:5',       label: '4:5 feed',     w: 1080, h: 1350 },
  '9:16':      { id: '9:16',      label: '9:16 story',   w: 1080, h: 1920 },
  'landscape': { id: 'landscape', label: 'Landscape',    w: 1200, h: 628 }
};

// Platform rules (docs/data-shapes.md).
export const SAFE = {
  margin: 0.074,            // of the width, on every side
  marginLandscape: 0.04,
  storyTop: 0.13,           // of the height, kept clear of the app's buttons
  storyBottom: 0.177
};

export function safeArea(formatId) {
  const f = FORMATS[formatId];
  const margin = (formatId === 'landscape' ? SAFE.marginLandscape : SAFE.margin) * f.w;
  const story = formatId === '9:16';
  return {
    x0: margin,
    x1: f.w - margin,
    y0: story ? Math.max(margin, SAFE.storyTop * f.h) : margin,
    y1: story ? f.h - Math.max(margin, SAFE.storyBottom * f.h) : f.h - margin
  };
}

// Keep v between lo and hi. If the range is upside down, lo wins.
export function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

// Place a block (left edge, vertical centre) inside the safe area, with optional
// snapping to the safe-area edges and the centre lines. Returns pixel values,
// plus the guide lines that snapped, if any.
export function placeBlock(left, cy, bw, bh, safe, W, H, snap, threshold = 12 * (W / 540)) {
  let guideV = null, guideH = null;
  if (snap) {
    const xs = [[safe.x0, safe.x0], [safe.x1 - bw, safe.x1], [W / 2 - bw / 2, W / 2]];
    const ys = [[safe.y0 + bh / 2, safe.y0], [safe.y1 - bh / 2, safe.y1], [H / 2, H / 2]];
    for (const [v, line] of xs) if (Math.abs(left - v) <= threshold) { left = v; guideV = line; break; }
    for (const [v, line] of ys) if (Math.abs(cy - v) <= threshold) { cy = v; guideH = line; break; }
  }
  left = clamp(left, safe.x0, safe.x1 - bw);
  cy = clamp(cy, safe.y0 + bh / 2, safe.y1 - bh / 2);
  return { left, cy, guide: (guideV !== null || guideH !== null) ? { v: guideV, h: guideH } : null };
}
