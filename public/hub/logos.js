// Logos for the hub: make a master SVG safe, recolour it into an approved
// colourway, and turn it into SVG or PNG downloads. Everything happens in the
// browser from the one master file; no colourway is ever stored.
import { contrast, normaliseHex, HEADLINE } from '../studio/js/colour.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const KINDS = ['primary', 'secondary', 'mark'];

// The brand's logos as a clean list. Anything malformed is left out.
export function logoList(brand) {
  if (!Array.isArray(brand.logos)) return [];
  return brand.logos.filter(l => l && typeof l.file === 'string' && /^[A-Za-z0-9][A-Za-z0-9._\/-]*\.svg$/i.test(l.file) && !l.file.includes('..'))
    .map((l, i) => ({
      id: typeof l.id === 'string' && /^[a-z0-9-]+$/.test(l.id) ? l.id : 'logo-' + (i + 1),
      name: typeof l.name === 'string' && l.name.trim() ? l.name : 'Logo',
      file: l.file,
      kind: KINDS.includes(l.kind) ? l.kind : 'secondary',
      use: typeof l.use === 'string' ? l.use : ''
    }));
}

// The logo the Please don't examples are made from: the first primary, else the first.
export const mainLogo = logos => logos.find(l => l.kind === 'primary') || logos[0] || null;

// Which palette colours the logo may be in on a background: 3:1 or better
// (logos count as graphics), the clearest first. Never the background itself.
export function colourways(bgHex, palette) {
  return palette
    .map(c => ({ name: c.name, hex: normaliseHex(c.hex) }))
    .filter(c => c.hex !== normaliseHex(bgHex))
    .map(c => ({ ...c, ratio: contrast(c.hex, bgHex) }))
    .filter(c => c.ratio >= HEADLINE)
    .sort((a, b) => b.ratio - a.ratio);
}

// Parse a master SVG and strip anything active or external: scripts, embedded
// pages, styles, event handlers and links that leave the file. Returns the <svg>
// element (not in the page), or null if the file is not a usable SVG.
const DROP = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'style', 'a', 'image', 'audio', 'video', 'animate', 'set', 'animatemotion', 'animatetransform']);
export function cleanSvg(text) {
  if (typeof text !== 'string' || text.length > 2000000) return null;
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  for (const el of [...svg.querySelectorAll('*')]) {
    if (DROP.has(el.localName.toLowerCase())) { el.remove(); continue; }
  }
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(a.name);
      else if ((n === 'href' || n === 'xlink:href') && !v.startsWith('#')) el.removeAttribute(a.name);
      else if (n === 'style' || n === 'class') el.removeAttribute(a.name);
      else if (/url\(/.test(v) && !/url\(\s*#/.test(v)) el.removeAttribute(a.name);
    }
  }
  if (!svg.getAttribute('viewBox')) {
    const w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
    if (w > 0 && h > 0) svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  }
  return svg;
}

// A copy of a clean SVG with every shape in one colour.
const SHAPES = 'path,circle,ellipse,rect,polygon,polyline,line,text,tspan';
export function recolour(svg, hex) {
  const out = svg.cloneNode(true);
  out.setAttribute('fill', hex);
  for (const el of out.querySelectorAll(SHAPES + ',g')) {
    if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none') el.setAttribute('fill', hex);
    if (el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none') el.setAttribute('stroke', hex);
  }
  return out;
}

export function svgText(svg) {
  const s = svg.cloneNode(true);
  s.removeAttribute('width'); s.removeAttribute('height'); s.removeAttribute('preserveAspectRatio');
  if (!s.getAttribute('xmlns')) s.setAttribute('xmlns', SVG_NS);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(s);
}

// The shape of the drawing, from its viewBox.
export function aspect(svg) {
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  return vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? vb[2] / vb[3] : 1;
}

// PNG of the SVG, transparent, with its long side `size` pixels.
export function pngBlob(svg, size = 2000) {
  const ar = aspect(svg);
  const w = Math.round(ar >= 1 ? size : size * ar), h = Math.round(ar >= 1 ? size / ar : size);
  const s = svg.cloneNode(true);
  s.setAttribute('width', w); s.setAttribute('height', h);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText(s).replace(/^<\?xml[^>]*>\n?/, ''));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png');
    };
    img.onerror = () => reject(new Error('The logo could not be drawn'));
    img.src = url;
  });
}

// A safe file name: brand_logo_colour.ext
export function fileName(brandSlug, logoId, colourName, ext) {
  const part = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
  return part(brandSlug) + '_' + part(logoId) + '_' + part(colourName) + '.' + ext;
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Fetch and clean one logo. Resolves to the clean <svg>, or null.
export async function loadLogo(filesBase, file) {
  try {
    const r = await fetch(filesBase + file.split('/').map(encodeURIComponent).join('/'), { credentials: 'same-origin' });
    if (!r.ok) return null;
    return cleanSvg(await r.text());
  } catch (e) { return null; }
}
