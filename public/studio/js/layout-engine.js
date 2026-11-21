// Turns a layout (JSON) plus the brand, format and typed text into a "plan":
// where the photo, panel, mark and every line of text go, in export pixels.
// It never draws anything and never touches the page, so it can be tested
// with a stand-in for measuring text.
import { FORMATS, safeArea, placeBlock } from './geometry.js';
import { applyCase } from './text-fit.js';

export const MIN_SCALE_DEFAULT = 0.6;

// The text the client can fill in for a layout.
export function layoutFields(layout) {
  return layout.fields || [];
}

// Where the movable block starts for a format.
export function startPosition(layout, formatId) {
  const t = layout.text || {};
  const byFormat = t.start_by_format && t.start_by_format[formatId];
  return byFormat || t.start || { fx: 0.5, fy: 0.5 };
}

// A layout may change parts of itself for one format (for example a side panel
// instead of a bottom panel on landscape), under "by_format".
export function forFormat(layout, formatId) {
  const o = layout.by_format && layout.by_format[formatId];
  if (!o) return layout;
  const out = Object.assign({}, layout);
  if (o.photo) out.photo = o.photo;
  if (o.panel) out.panel = o.panel;
  if (o.text) out.text = Object.assign({}, layout.text, o.text);
  if (o.mark) out.mark = Object.assign({}, layout.mark, o.mark);
  return out;
}

// Rectangles for the photo and the optional solid panel. The split falls on a
// whole pixel so no faint seam can show between photo and panel.
export function zones(layout, W, H) {
  const full = { x: 0, y: 0, w: W, h: H };
  const p = layout.panel;
  if (!p) return { photo: full, panel: null };
  switch (p.edge) {
    case 'bottom': { const y = Math.round(H * (1 - p.size)); return { photo: { x: 0, y: 0, w: W, h: y }, panel: { x: 0, y, w: W, h: H - y } }; }
    case 'top':    { const y = Math.round(H * p.size);       return { photo: { x: 0, y, w: W, h: H - y }, panel: { x: 0, y: 0, w: W, h: y } }; }
    case 'left':   { const x = Math.round(W * p.size);       return { photo: { x, y: 0, w: W - x, h: H }, panel: { x: 0, y: 0, w: x, h: H } }; }
    case 'right':  { const x = Math.round(W * (1 - p.size)); return { photo: { x: 0, y: 0, w: x, h: H }, panel: { x, y: 0, w: W - x, h: H } }; }
    default:       return { photo: full, panel: null };
  }
}

// The weight to draw with. An uploaded font only has the weights that were
// uploaded, so a layout asking for another (Bold when only SemiBold exists) uses
// the nearest real one instead of letting the browser fake it. Ties go heavier.
export function nearestWeight(font, wanted) {
  const files = font && font.source === 'uploaded' && Array.isArray(font.files) ? font.files : null;
  const have = files ? [...new Set(files.filter(f => f && (f.style || 'normal') === 'normal').map(f => f.weight || 400))] : [];
  if (!have.length) return wanted;
  return have.reduce((best, w) => {
    const d = Math.abs(w - wanted), bd = Math.abs(best - wanted);
    return d < bd || (d === bd && w > best) ? w : best;
  }, have[0]);
}

// Height of the brand's logo when it stands in for the brand name, as a share of
// that line's font size.
export const NAME_LOGO_HEIGHT = 0.9;

function resolveLine(line, ctx) {
  const font = ctx.fonts[line.font === 'body' ? 'body' : 'heading'];
  const raw = line.source === 'brand_name' ? ctx.brandName : (ctx.values[line.field] || '');
  const caseMode = line.case === 'brand' ? (font.case || 'none') : (line.case || 'none');
  const text = applyCase(String(raw).trim(), caseMode);
  const weight = nearestWeight(font, line.weight === 'brand' ? (font.weight || 400) : (line.weight || 400));
  // The brand name is drawn as the brand's own logo when it has one.
  if (line.source === 'brand_name' && ctx.nameLogo > 0) {
    const h1 = line.size * ctx.W * NAME_LOGO_HEIGHT;
    return { def: line, text: text || 'logo', isLogo: true, family: font.family, weight, size1: h1, trackPx1: 0, isPill: false, padX1: 0, padY1: 0,
      w1: h1 * ctx.nameLogo, h1, textW1: h1 * ctx.nameLogo, fixed: true, pin: line.pin || null };
  }
  const tracking = line.tracking === 'brand' ? (font.tracking || 0) : (line.tracking || 0);
  const size1 = line.size * ctx.W;
  const trackPx1 = tracking * size1;
  const isPill = line.style === 'pill';
  const padX1 = isPill ? (line.pad_x || 0) * ctx.W : 0;
  const padY1 = isPill ? (line.pad_y || 0) * ctx.W : 0;
  const textW1 = text ? ctx.measure(text, { family: font.family, weight, sizePx: size1, trackPx: trackPx1 }) : 0;
  return {
    def: line, text, family: font.family, weight, size1, trackPx1, isPill, padX1, padY1,
    w1: text ? textW1 + 2 * padX1 : 0,
    h1: text ? size1 + 2 * padY1 : 0,
    textW1,
    fixed: line.source === 'brand_name',
    pin: line.pin || null
  };
}

// Main entry.
//   layout, formatId, values {fieldId: text}, pos {fx, fy} or undefined,
//   fonts {heading:{family,weight,case,tracking}, body:{...}}, brandName,
//   measure(text, {family, weight, sizePx, trackPx}) -> width in px
//   logos: { name: width/height of the logo that stands in for the brand name,
//            mark: true when the brand's own mark replaces the dot mark } (optional)
export function buildPlan({ layout: baseLayout, formatId, values, pos, fonts, brandName, measure, logos }) {
  const layout = forFormat(baseLayout, formatId);
  const f = FORMATS[formatId];
  const W = f.w, H = f.h;
  const safe = safeArea(formatId);
  const z = zones(layout, W, H);
  const t = layout.text || {};
  const minScale = t.min_scale || MIN_SCALE_DEFAULT;
  const onPanel = t.on === 'panel' && z.panel;
  const lg = logos || {};
  const ctx = { W, H, fonts, values, brandName, measure, nameLogo: lg.name || 0 };
  const lines = (t.lines || []).map(l => resolveLine(l, ctx)).filter(l => l.text);
  const stack = lines.filter(l => !l.pin);
  const pinned = lines.filter(l => l.pin);
  const userLines = lines.filter(l => !l.fixed);
  const hasText = userLines.length > 0;

  // Space the text may use.
  const pad = (t.pad || 0) * W;
  let maxW, availH, gap1;
  // Text on a panel stays inside the safe area as well as inside the panel padding,
  // so Story text never sits under the app's own buttons.
  const pr = onPanel ? {
    x0: Math.max(z.panel.x + pad, safe.x0), x1: Math.min(z.panel.x + z.panel.w - pad, safe.x1),
    y0: Math.max(z.panel.y + pad, safe.y0), y1: Math.min(z.panel.y + z.panel.h - pad, safe.y1)
  } : null;
  if (onPanel) {
    maxW = pr.x1 - pr.x0;
    availH = pr.y1 - pr.y0;
    gap1 = (t.gap || 0) * W;
  } else {
    const share = (t.max_width_by_format && t.max_width_by_format[formatId]) ?? t.max_width ?? 0.62;
    maxW = (safe.x1 - safe.x0) * share;
    availH = safe.y1 - safe.y0;
    gap1 = (t.line_gap != null ? t.line_gap : (t.gap || 0)) * W;
  }

  // One shrink factor for all of the client's text.
  const widest = Math.max(0, ...userLines.map(l => l.w1));
  const kW = widest > 0 ? maxW / widest : 1;
  const stackH1 = stack.reduce((s, l) => s + l.h1, 0) + Math.max(0, stack.length - 1) * gap1;
  const kH = stackH1 > 0 ? availH / stackH1 : 1;
  const k = Math.min(1, kW, kH);
  const over = k < minScale - 1e-9;
  const kUse = Math.max(k, minScale);
  // The brand's own name shrinks to fit but never blocks the client.
  const nameLine = lines.find(l => l.fixed);
  const kName = nameLine && nameLine.w1 > 0 ? Math.min(1, maxW / nameLine.w1) : 1;

  const scaleOf = l => (l.fixed ? kName : kUse);
  const sized = l => {
    const ks = scaleOf(l);
    return { ...l, ks, size: l.size1 * ks, trackPx: l.trackPx1 * ks, w: l.w1 * ks, h: l.h1 * ks, padX: l.padX1 * ks, padY: l.padY1 * ks };
  };
  const stackS = stack.map(sized), pinnedS = pinned.map(sized);
  const gap = gap1 * kUse;
  const stackW = Math.max(0, ...stackS.map(l => l.w));
  const stackH = stackS.reduce((s, l) => s + l.h, 0) + Math.max(0, stackS.length - 1) * gap;

  const textColour = onPanel ? 'panelText' : 'text';
  const items = [];
  const rects = [];

  // Put one resolved line at a position. x is the left edge of the text area
  // the line aligns inside (width areaW).
  const place = (l, x, y, areaX, areaW, align) => {
    let lx = areaX;
    if (align === 'center') lx = areaX + (areaW - l.w) / 2;
    else if (align === 'right') lx = areaX + areaW - l.w;
    if (l.isLogo) {
      items.push({ type: 'logo', which: 'name', x: lx, y, w: l.w, h: l.h, color: textColour });
    } else if (l.isPill) {
      items.push({ type: 'pill', x: lx, y, w: l.w, h: l.h, color: 'pillBg' });
      items.push({ type: 'text', text: l.text, x: lx + l.padX, y: y + l.padY, w: l.w - 2 * l.padX, h: l.size, size: l.size, family: l.family, weight: l.weight, trackPx: l.trackPx, color: 'pillText' });
    } else {
      items.push({ type: 'text', text: l.text, x: lx, y, w: l.w, h: l.h, size: l.size, family: l.family, weight: l.weight, trackPx: l.trackPx, color: textColour });
    }
    return { x: lx, y, w: l.w, h: l.h };
  };

  const align = t.align || 'left';
  let block = null;

  if (t.movable && !onPanel) {
    // Movable block: optional dot mark, then the stack of lines.
    const showMark = !!(layout.mark && layout.mark.show);
    const markD = showMark ? layout.mark.size * W : 0;
    const markGap = showMark ? layout.mark.gap * W : 0;
    const bw = (showMark ? markD + markGap : 0) + stackW;
    const bh = Math.max(markD, stackH);
    const start = pos || startPosition(layout, formatId);
    const placed = placeBlock(start.fx * W, start.fy * H, bw, bh, safe, W, H, false);
    const top = placed.cy - bh / 2;
    if (showMark) items.push({ type: 'mark', cx: placed.left + markD / 2, cy: placed.cy, d: markD, color: 'text', brandMark: !!lg.mark });
    const textLeft = placed.left + (showMark ? markD + markGap : 0);
    let y = placed.cy - stackH / 2;
    stackS.forEach(l => { place(l, 0, y, textLeft, stackW, align); y += l.h + gap; });
    block = { left: placed.left, cy: placed.cy, w: bw, h: bh, top };
    rects.push({ x: block.left, y: top, w: bw, h: bh });
  } else if (onPanel) {
    // Fixed stack inside the solid panel, vertically centred.
    const areaX = pr.x0, areaW = pr.x1 - pr.x0;
    let y = pr.y0 + (pr.y1 - pr.y0 - stackH) / 2;
    stackS.forEach(l => { place(l, 0, y, areaX, areaW, align); y += l.h + gap; });
  } else {
    // Fixed stack on the photo: centred on the format, with pinned lines at the safe-area edge.
    const areaX = (W - maxW) / 2, areaW = maxW;
    let y = (H - stackH) / 2;
    stackS.forEach(l => { const r = place(l, 0, y, areaX, areaW, align); rects.push(r); y += l.h + gap; });
    pinnedS.forEach(l => {
      const off = (l.def.offset || 0) * W;
      const yy = l.pin === 'top' ? safe.y0 + off : safe.y1 - off - l.h;
      rects.push(place(l, 0, yy, areaX, areaW, align));
    });
  }

  return {
    format: formatId, W, H, safe,
    photoRect: z.photo, panelRect: z.panel,
    items, block,
    onPhoto: !onPanel,
    textRects: onPanel ? [] : rects,
    hasText,
    fit: { k, kUse, over, kName, maxW, minScale }
  };
}
