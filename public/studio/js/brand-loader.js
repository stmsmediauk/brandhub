// The only file that knows where a brand's JSON comes from.
// It fetches the brand, checks it, then fetches the layouts it opts into.
import { FORMATS } from './geometry.js';
import { parseHex, luminance, normaliseHex } from './colour.js';

const ID = /^[a-z0-9_-]+$/;

async function getJson(url, what) {
  let res;
  try { res = await fetch(url, { credentials: 'same-origin', cache: 'no-cache' }); }
  catch (e) { throw new Error('Couldn’t load ' + what + '. Check your connection.'); }
  if (res.status === 401 || res.status === 403) throw new Error('You’re not signed in to this brand.');
  if (!res.ok) throw new Error('Couldn’t load ' + what + ' (' + res.status + ').');
  try { return await res.json(); } catch (e) { throw new Error(what + ' is not valid JSON.'); }
}

// Returns a list of plain-English problems. An empty list means it can be used.
export function validateBrand(b) {
  const errs = [];
  if (!b || typeof b !== 'object') return ['The brand record is empty.'];
  if (!b.name) errs.push('The brand has no name.');
  if (!Array.isArray(b.palette) || b.palette.length < 2 || b.palette.length > 12) errs.push('The palette needs 2 to 12 colours.');
  else b.palette.forEach((c, i) => { if (!c || !parseHex(c.hex)) errs.push('Palette colour ' + (i + 1) + ' has no valid HEX.'); });
  for (const w of ['heading', 'body']) {
    const f = b.fonts && b.fonts[w];
    if (!f || !f.family) errs.push('The ' + w + ' font is missing.');
    else if (f.source !== 'google' && f.source !== 'uploaded') errs.push('The ' + w + ' font source must be google or uploaded.');
  }
  const s = b.studio || {};
  if (!Array.isArray(s.formats) || !s.formats.length) errs.push('No formats are switched on.');
  else s.formats.forEach(f => { if (!FORMATS[f]) errs.push('Unknown format ' + f + '.'); });
  if (!Array.isArray(s.layouts) || !s.layouts.length) errs.push('No layouts are switched on.');
  else s.layouts.forEach(l => { if (!ID.test(String(l))) errs.push('Bad layout id ' + l + '.'); });
  const ptc = s.photo_text_colours;
  if (!Array.isArray(ptc) || !ptc.length) errs.push('No photo text colours are chosen.');
  else {
    const lums = ptc.map(h => luminance(h));
    if (!ptc.every(h => parseHex(h))) errs.push('A photo text colour is not a valid HEX.');
    else if (!lums.some(l => l >= 0.18) || !lums.some(l => l < 0.18)) errs.push('Photo text colours need at least one light and one dark.');
  }
  return errs;
}

function validateLayout(l, id) {
  if (!l || l.id !== id) return 'Layout ' + id + ' has the wrong id.';
  if (!Array.isArray(l.fields) || !l.text || !Array.isArray(l.text.lines)) return 'Layout ' + id + ' is incomplete.';
  return null;
}

// opts: { brandUrl, layoutsBase }
export async function loadBrand(opts) {
  const brand = await getJson(opts.brandUrl, 'the brand');
  const errs = validateBrand(brand);
  if (errs.length) throw new Error('This brand isn’t ready: ' + errs.join(' '));
  brand.palette.forEach(c => { c.hex = normaliseHex(c.hex); });
  brand.studio.photo_text_colours = brand.studio.photo_text_colours.map(normaliseHex);
  brand.studio.export = Object.assign({ png: true, jpg: true, naming: '{brand}_{format}_{layout}', jpg_quality: 0.9 }, brand.studio.export || {});
  const layouts = [];
  for (const id of brand.studio.layouts) {
    const l = await getJson(opts.layoutsBase + id + '.json', 'layout ' + id);
    const bad = validateLayout(l, id);
    if (bad) throw new Error(bad);
    layouts.push(l);
  }
  return { brand, layouts };
}
