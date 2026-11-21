// Scripted checks for the studio engine. Open unit.html in a browser.
// Part 1 tests the pure logic with a stand-in for measuring text.
// Part 2 runs the real thing (real fonts, real canvas) against all three test brands.
import * as C from '../../public/studio/js/colour.js';
import * as G from '../../public/studio/js/geometry.js';
import { sanitise } from '../../public/studio/js/text-fit.js';
import { createGlyphChecker, fontDraws } from '../../public/studio/js/glyphs.js';
import { derive } from '../../public/studio/js/theme.js';
import { buildPlan, zones } from '../../public/studio/js/layout-engine.js';
import { placement, resolutionLevel, LIMITS } from '../../public/studio/js/photo.js';
import { assess, lumaMapFromImageData } from '../../public/studio/js/readability.js';
import { buildChecks } from '../../public/studio/js/checks.js';
import { summarise } from '../../public/studio/js/summary.js';
import { validateBrand, loadBrand } from '../../public/studio/js/brand-loader.js';
import { fileName, renderToCanvas, toBlob } from '../../public/studio/js/export.js';
import { makeMeasure } from '../../public/studio/js/renderer.js';
import { loadBrandFonts } from '../../public/studio/js/fonts.js';
import { makeSample, SAMPLES } from '../../public/studio/js/samples.js';
import { drawFrame } from '../../public/studio/js/renderer.js';
import { start } from '../../public/studio/js/main.js';
import * as H from '../../public/hub/hub.js';
import * as L from '../../public/hub/logos.js';

const out = document.getElementById('results');
const tests = [];
let fails = 0, passes = 0;
const test = (name, fn) => tests.push([name, fn]);
const ok = (cond, msg) => { if (!cond) throw new Error(msg || 'not true'); };
const eq = (a, b, msg) => { if (a !== b) throw new Error((msg || 'values differ') + ': got ' + a + ', wanted ' + b); };
const near = (a, b, tol, msg) => { if (Math.abs(a - b) > tol) throw new Error((msg || 'values differ') + ': got ' + a + ', wanted ' + b); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const getJson = async u => (await fetch(u)).json();

const BRANDS = { 'light-serif': null, 'dark-sans': null, 'edge-midtones': null };
const LAYOUT_IDS = ['full', 'product', 'details', 'wordmark'];
const LAYOUTS = {};
const fake = (text, s) => text.length * s.sizePx * 0.6 + s.trackPx * Math.max(0, text.length - 1);

// ---------------------------------------------------------------- colour
test('colour: black on white is 21:1, same colour is 1:1', () => {
  near(C.contrast('#000000', '#FFFFFF'), 21, 0.001); near(C.contrast('#777777', '#777777'), 1, 0.001);
});
test('colour: known mid-grey ratio (#767676 on white is about 4.54)', () => near(C.contrast('#767676', '#FFFFFF'), 4.54, 0.02));
test('colour: thresholds 4.5 and 3', () => {
  eq(C.classify(4.5), 'approved'); eq(C.classify(4.49), 'headline'); eq(C.classify(3), 'headline'); eq(C.classify(2.99), 'never');
});
test('colour: parse short and long hex, reject nonsense', () => {
  eq(C.toHex(C.parseHex('#fa0')), '#FFAA00'); eq(C.parseHex('red'), null); eq(C.normaliseHex('c8f04a'), '#C8F04A');
});

// ---------------------------------------------------------------- geometry
test('geometry: safe areas for every format', () => {
  let s = G.safeArea('1:1'); near(s.x0, 79.92, 0.01); near(s.y1, 1080 - 79.92, 0.01);
  s = G.safeArea('landscape'); near(s.x0, 48, 0.01); near(s.y0, 48, 0.01);
  s = G.safeArea('9:16'); near(s.y0, 0.13 * 1920, 0.01); near(s.y1, 1920 - 0.177 * 1920, 0.01);
});
test('geometry: a block can never leave the safe area, with or without snapping', () => {
  for (const f of Object.keys(G.FORMATS)) {
    const { w, h } = G.FORMATS[f], safe = G.safeArea(f);
    for (const snap of [true, false]) for (const [x, y] of [[-9999, -9999], [9999, 9999], [w / 2, h / 2], [0, 9999]]) {
      const r = G.placeBlock(x, y, 400, 120, safe, w, h, snap);
      ok(r.left >= safe.x0 - 1e-6 && r.left + 400 <= safe.x1 + 1e-6, f + ' x'); ok(r.cy - 60 >= safe.y0 - 1e-6 && r.cy + 60 <= safe.y1 + 1e-6, f + ' y');
    }
  }
});
test('geometry: snaps to the centre line and reports the guide', () => {
  const safe = G.safeArea('1:1'), r = G.placeBlock(540 - 200 + 5, 540 + 4, 400, 100, safe, 1080, 1080, true);
  near(r.left, 340, 0.001); near(r.cy, 540, 0.001); ok(r.guide && r.guide.v === 540 && r.guide.h === 540, 'guide');
  eq(G.placeBlock(300, 300, 400, 100, safe, 1080, 1080, false).guide, null);
});

// ---------------------------------------------------------------- text
test('text: accented letters are kept (Café, Zoë, Ñ, Ł), and decomposed accents are joined', () => {
  const r = sanitise('Café Zoë Ñ Łódź ß'); eq(r.clean, 'Café Zoë Ñ Łódź ß'); ok(!r.changed);
  eq(sanitise('Cafe\u0301').clean, 'Café');
});
test('text: emoji, symbols, other scripts and look-alike signs are removed and reported', () => {
  const r = sanitise('Hi 😀 ★ 漢 3×4'); eq(r.clean, 'Hi    34'); ok(r.changed);
});
test('text: a letter the brand font cannot draw is removed, the rest is kept', () => {
  const r = sanitise('Café Zoë', c => c !== 'ë'); eq(r.clean, 'Café Zo'); ok(r.changed);
  eq(sanitise('abc', () => false).clean, 'abc'); // plain letters are never font-checked
});
test('text: line breaks and tabs become spaces without a complaint', () => {
  const r = sanitise('a\nb\tc\r\nd'); eq(r.clean, 'a b c d'); ok(!r.changed);
});
test('text: allowed punctuation survives', () => eq(sanitise('50% off! £5 & more: @x #1 (a/b)').clean, '50% off! £5 & more: @x #1 (a/b)'));

// ---------------------------------------------------------------- brand records
test('brand: all three test brands pass validation', () => { for (const k of Object.keys(BRANDS)) eq(validateBrand(BRANDS[k]).length, 0, k + ' ' + validateBrand(BRANDS[k]).join(' ')); });
test('brand: bad records are refused with plain messages', () => {
  const b = JSON.parse(JSON.stringify(BRANDS['dark-sans']));
  b.palette = [b.palette[0]]; ok(validateBrand(b).some(e => /2 to 12/.test(e)));
  const c = JSON.parse(JSON.stringify(BRANDS['dark-sans'])); c.studio.photo_text_colours = ['#FFFFFF']; ok(validateBrand(c).some(e => /light and one dark/.test(e)));
  const d = JSON.parse(JSON.stringify(BRANDS['dark-sans'])); d.studio.layouts = ['../x']; ok(validateBrand(d).some(e => /Bad layout id/.test(e)));
  ok(validateBrand(null).length > 0);
});

// ---------------------------------------------------------------- theme
test('theme: the page is the same clean white for every brand; text and muted text read at 4.5:1', () => {
  for (const k of Object.keys(BRANDS)) {
    const v = derive(BRANDS[k]).vars;
    eq(v.bg, '#FFFFFF', k); ok(C.contrast(v.ink, v.bg) >= 4.5, k + ' ink'); ok(C.contrast(v.muted, v.bg) >= 4.5, k + ' muted'); ok(C.contrast(v.onAccent, v.accent) >= 4.5, k + ' buttons');
  }
  const a = derive(BRANDS['dark-sans']).vars, b = derive(BRANDS['light-serif']).vars;
  for (const k of ['bg', 'ink', 'muted', 'surface', 'surface2', 'line', 'accent', 'onAccent', 'r', 'r2', 'rb']) eq(a[k], b[k], 'page value ' + k + ' is the same for every brand');
});
test('theme: nothing stored can change the page (a leftover look.theme or look.hero is ignored)', () => {
  const b = JSON.parse(JSON.stringify(BRANDS['light-serif'])); b.look.theme = 'dark'; b.look.hero = 'dark';
  eq(JSON.stringify(derive(b).vars), JSON.stringify(derive(BRANDS['light-serif']).vars));
  ok(!JSON.stringify(BRANDS).includes('"theme"'), 'fixtures hold no theme field');
});
test('theme: solid panel text reads at 4.5 for the two real brands, and is flagged for the mid-tone brand', () => {
  ok(derive(BRANDS['dark-sans']).panel.ok); ok(derive(BRANDS['light-serif']).panel.ok); ok(!derive(BRANDS['edge-midtones']).panel.ok);
});
test('theme: a family name cannot break out of the CSS quotes', () => {
  const b = JSON.parse(JSON.stringify(BRANDS['dark-sans'])); b.fonts.heading.family = "X'; background:red; }";
  ok(!derive(b).vars.head.includes(';'));
});

// ---------------------------------------------------------------- hub (slice 2)
const mkBrand = (hexes, look = {}) => ({ name: 'Test', palette: hexes.map((h, i) => ({ name: 'c' + i, hex: h })), fonts: { heading: { family: 'X', source: 'google', weight: 600 }, body: { family: 'Y', source: 'google' } }, look });
test('hub: headings use the first palette colour that reads at 3:1 on white, links the first at 4.5:1, never an invented colour', () => {
  for (const k of Object.keys(BRANDS)) {
    const v = derive(BRANDS[k]).vars, hexes = BRANDS[k].palette.map(c => C.normaliseHex(c.hex));
    ok(C.contrast(v.headInk, '#FFFFFF') >= 3, k + ' heading'); ok(C.contrast(v.accentText, '#FFFFFF') >= 4.5, k + ' link');
    ok(hexes.includes(v.headInk) && hexes.includes(v.accentText), k + ' both are palette colours');
    const firstHead = hexes.findIndex(h => C.contrast(h, '#FFFFFF') >= 3); eq(hexes.indexOf(v.headInk), firstHead, k + ' heading is the first that reads');
  }
  eq(derive(BRANDS['light-serif']).vars.headInk, '#2F5D43', 'Northlight: Forest, its first colour');
  eq(derive(BRANDS['dark-sans']).vars.headInk, '#0B0D0E', 'FORMA: the lime cannot be read on white, so the next colour (Carbon)');
  eq(derive(BRANDS['edge-midtones']).vars.accentText, '#8A6D55', 'Sandstone: Clay reads on white even though the palette has no readable pair');
  const stms = derive(mkBrand(['#FF00FF', '#0A0A0A', '#FFFFFF'])).vars;
  eq(stms.headInk, '#FF00FF', 'STMS magenta (3.1:1) is fine for big headings'); eq(stms.accentText, '#0A0A0A', 'but not for links');
  eq(derive(mkBrand(['#FFFFFF', '#F0F0F0'])).vars.accentText, '#141414', 'a palette with nothing readable on white falls back to the page text');
});
test('hub: the artwork keeps the brand’s own corner style', () => {
  eq(derive(BRANDS['light-serif']).cornerPx.rb, 999); eq(derive(BRANDS['dark-sans']).cornerPx.rb, 2);
});
test('hub: pairings use the same rules as the studio (approved 4.5, headline 3, never below)', () => {
  for (const k of Object.keys(BRANDS)) for (const bg of BRANDS[k].palette) {
    const p = H.pairingsFor(bg.hex, BRANDS[k].palette);
    eq(p.ok.length + p.large.length + p.never.length, BRANDS[k].palette.length - 1, k + ' every other colour is listed once');
    p.ok.forEach(o => ok(C.contrast(o.hex, bg.hex) >= 4.5)); p.large.forEach(o => { const r = C.contrast(o.hex, bg.hex); ok(r >= 3 && r < 4.5); }); p.never.forEach(o => ok(C.contrast(o.hex, bg.hex) < 3));
  }
  eq(H.pairingsFor('#C8F04A', BRANDS['dark-sans'].palette).ok[0].name, BRANDS['dark-sans'].palette.find(c => c.hex.toUpperCase() === '#0B0D0E').name, 'best first');
});
test('hub: standard Start here rules count the palette and the typefaces; the brand’s own wording replaces them', () => {
  const r = H.startRules(BRANDS['light-serif']); eq(r.length, 4); eq(r[1].title, 'Only the five palette colours'); ok(r[3].text.startsWith('Two typefaces'));
  ok(H.startRules(BRANDS['dark-sans'])[3].text.startsWith('One typeface'), 'FORMA uses one family for both');
  const own = Object.assign({}, BRANDS['light-serif'], { start_here: [{ title: 'Pine first', text: 'Lead with Forest.' }, { title: '', text: 'ignored' }, 'junk'] });
  eq(H.startRules(own).length, 1); eq(H.startRules(own)[0].title, 'Pine first');
});
test('hub: sections show unless switched off', () => {
  ok(H.sectionOn({}, 'colours')); ok(H.sectionOn({ sections: { studio: true } }, 'pairings')); ok(!H.sectionOn({ sections: { pairings: false } }, 'pairings'));
});
test('hub: CMYK is calculated from RGB unless the colour sets its own; Pantone only when set', () => {
  eq(C.cmykFromHex('#FFFFFF').join(','), '0,0,0,0'); eq(C.cmykFromHex('#000000').join(','), '0,0,0,100'); eq(C.cmykFromHex('#FF0000').join(','), '0,100,100,0');
  eq(C.cmykFor({ hex: '#FF0000', cmyk: [0, 95, 85, 0] }).join(','), '0,95,85,0'); eq(C.cmykFor({ hex: '#FF0000', cmyk: [1, 2] }).join(','), '0,100,100,0', 'a bad override is ignored');
  const m = H.hubModel(Object.assign({}, BRANDS['light-serif'], { palette: [{ name: 'A', hex: '#2F5D43', pantone: '7729 C' }, { name: 'B', hex: '#FFFFFF' }] }));
  eq(m.palette[0].values.map(v => v[0]).join(','), 'HEX,RGB,CMYK,Pantone'); eq(m.palette[1].values.length, 3); eq(m.palette[0].values[1][1], '47, 93, 67');
});
test('hub: font downloads: Google fonts link to Google, uploaded files come from the brand’s own files', () => {
  eq(H.fontDownloads({ family: 'DM Sans', source: 'google' }, '/x/files/')[0].href, 'https://fonts.google.com/specimen/DM+Sans');
  const up = H.fontDownloads({ family: 'Brand', source: 'uploaded', files: [{ url: 'fonts/Brand Bold.woff2', weight: 700 }, { url: 'fonts/b.woff2', weight: 400, style: 'italic' }] }, '/acme/files/');
  eq(up[0].href, '/acme/files/fonts/Brand%20Bold.woff2'); eq(up[0].label, 'Download Bold'); eq(up[1].label, 'Download Regular italic'); ok(up[0].download);
});

const EVIL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 50" onload="alert(1)"><style>.a{fill:red}</style><script>alert(2)</script>'
  + '<foreignObject><div>x</div></foreignObject><a href="https://evil.example"><path d="M0 0h10v10z"/></a><image href="https://evil.example/x.png"/>'
  + '<path class="a" d="M0 0h50v50z" fill="#123456" onclick="alert(3)" style="fill:url(https://evil.example/#x)"/><circle cx="70" cy="25" r="10" stroke="#000" fill="none"/><use href="#p"/><use xlink:href="https://evil.example/s.svg#x"/></svg>';
test('logos: a master SVG is cleaned of scripts, styles, handlers, embedded pages and outside links', () => {
  const svg = L.cleanSvg(EVIL_SVG); ok(svg, 'parsed'); const t = new XMLSerializer().serializeToString(svg);
  for (const bad of ['<script', 'alert', '<style', 'foreignObject', 'evil.example', 'onload', 'onclick', '<image', '<a ']) ok(!t.includes(bad), 'removed ' + bad);
  ok(t.includes('<use href="#p"'), 'a link inside the file is kept'); eq(svg.getAttribute('viewBox'), '0 0 100 50');
  eq(L.cleanSvg('<html>not svg</html>'), null); eq(L.cleanSvg('<svg xmlns="http://www.w3.org/2000/svg"><path'), null, 'broken file');
});
test('logos: recolouring puts every shape in the one colour and leaves "none" alone', () => {
  const svg = L.recolour(L.cleanSvg(EVIL_SVG), '#C8F04A');
  eq(svg.getAttribute('fill'), '#C8F04A'); eq(svg.querySelector('path[d="M0 0h50v50z"]').getAttribute('fill'), '#C8F04A');
  const c = svg.querySelector('circle'); eq(c.getAttribute('fill'), 'none'); eq(c.getAttribute('stroke'), '#C8F04A');
  ok(L.svgText(svg).startsWith('<?xml'), 'download is a proper SVG file');
});
test('logos: only colourways at 3:1 or better are offered, clearest first, never the background itself', () => {
  for (const k of Object.keys(BRANDS)) for (const bg of BRANDS[k].palette) {
    const w = L.colourways(bg.hex, BRANDS[k].palette);
    w.forEach(o => { ok(o.ratio >= 3, k); ok(o.hex !== C.normaliseHex(bg.hex), k + ' not the background'); });
    for (let i = 1; i < w.length; i++) ok(w[i - 1].ratio >= w[i].ratio, 'sorted');
  }
  eq(L.colourways('#C8F04A', BRANDS['dark-sans'].palette).map(o => o.name).join(','), 'Carbon', 'FORMA logo on Court: Carbon only');
  eq(L.colourways('#C9B79C', BRANDS['edge-midtones'].palette).length, 0, 'Sandstone: nothing stands out, so nothing is offered');
});
test('logos: the logo list keeps good entries, drops path tricks, and finds the primary', () => {
  const list = L.logoList({ logos: [{ id: 'a', name: 'A', file: 'logos/a.svg', kind: 'secondary' }, { id: 'b', name: 'B', file: '../x.svg', kind: 'primary' }, { id: 'c', name: 'C', file: 'logos/c.png' }, { id: 'd', name: 'D', file: 'logos/d.svg', kind: 'primary' }, null] });
  eq(list.map(l => l.id).join(','), 'a,d'); eq(L.mainLogo(list).id, 'd'); eq(L.logoList({}).length, 0);
  eq(L.logoList(BRANDS['dark-sans']).length, 4, 'FORMA test brand has four logos');
});
test('logos: the header uses the widest logo the brand has; a logo that failed to load is skipped', () => {
  const mk = vb => L.cleanSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '"><path d="M0 0h1v1z"/></svg>');
  const items = [{ logo: { id: 'primary' }, svg: mk('0 0 708 433') }, { logo: { id: 'landscape' }, svg: mk('0 0 1588 98') }, { logo: { id: 'broken' }, svg: null }, { logo: { id: 'mark' }, svg: mk('0 0 214 186') }];
  eq(H.headerLogoPick(items).logo.id, 'landscape'); eq(H.headerLogoPick([{ logo: { id: 'x' }, svg: null }]), null);
});
test('logos: file names are safe and readable', () => {
  eq(L.fileName('forma', 'wordmark-stacked', 'Carbon', 'png'), 'forma_wordmark-stacked_carbon.png');
  eq(L.fileName('café', 'primary', 'Deep Blue / 2', 'svg'), 'cafe_primary_deep-blue-2.svg');
});
test('logos: PNG export is a real transparent PNG at 2000px on the long side, in the chosen colour', async () => {
  const svg = L.recolour(L.cleanSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect x="0" y="0" width="100" height="100"/></svg>'), '#0B0D0E');
  const blob = await L.pngBlob(svg); eq(blob.type, 'image/png');
  const img = await createImageBitmap(blob); eq(img.width, 2000); eq(img.height, 1000);
  const c = document.createElement('canvas'); c.width = 2000; c.height = 1000; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const left = g.getImageData(500, 500, 1, 1).data, right = g.getImageData(1500, 500, 1, 1).data;
  eq([left[0], left[1], left[2], left[3]].join(','), '11,13,14,255', 'shape in Carbon'); eq(right[3], 0, 'transparent elsewhere');
});

// ---------------------------------------------------------------- layout engine (stand-in measuring)
function plan(brand, layoutId, fmt, values, pos) {
  return buildPlan({ layout: LAYOUTS[layoutId], formatId: fmt, values, pos, fonts: brand.fonts, brandName: brand.name, measure: fake });
}
test('engine: photo and panel together cover the whole format, for every layout and format', () => {
  for (const id of LAYOUT_IDS) for (const f of Object.keys(G.FORMATS)) {
    const { w, h } = G.FORMATS[f], z = zones(LAYOUTS[id], w, h);
    near(z.photo.w * z.photo.h + (z.panel ? z.panel.w * z.panel.h : 0), w * h, 1, id + ' ' + f);
  }
});
test('engine: normal text fits (at 90% or better) and the block stays in the safe area, every brand, layout and format', () => {
  for (const k of Object.keys(BRANDS)) for (const id of LAYOUT_IDS) for (const f of Object.keys(G.FORMATS)) {
    const p = plan(BRANDS[k], id, f, { headline: 'Studio open', subline: 'Liverpool', details: 'Book a call' });
    ok(!p.fit.over, k + ' ' + id + ' ' + f + ' over'); ok(p.fit.kUse >= 0.9, k + ' ' + id + ' ' + f + ' shrunk to ' + p.fit.kUse);
    if (p.block) { const s = p.safe; ok(p.block.left >= s.x0 - 1e-6 && p.block.left + p.block.w <= s.x1 + 1e-6 && p.block.top >= s.y0 - 1e-6 && p.block.top + p.block.h <= s.y1 + 1e-6, k + ' ' + id + ' ' + f + ' block'); }
  }
});
test('engine: text shrinks, never below 60%, then reports it is over', () => {
  const b = BRANDS['dark-sans'];
  let p = plan(b, 'full', '1:1', { headline: 'W'.repeat(30) }); ok(p.fit.k < 1 && p.fit.k >= 0.6, 'shrinks: ' + p.fit.k); ok(!p.fit.over);
  p = plan(b, 'full', '1:1', { headline: 'W'.repeat(45) }); ok(p.fit.over, 'over'); eq(p.fit.kUse, 0.6);
});
test('engine: empty text leaves only the mark, and no lines', () => {
  const p = plan(BRANDS['dark-sans'], 'full', '1:1', {}); ok(!p.hasText); ok(p.items.every(i => i.type === 'mark'));
});
test('engine: a dragged position is clamped inside the safe area', () => {
  const p = plan(BRANDS['dark-sans'], 'full', '4:5', { headline: 'Hi' }, { fx: 5, fy: -5 });
  ok(p.block.left + p.block.w <= p.safe.x1 + 1e-6); ok(p.block.top >= p.safe.y0 - 1e-6);
});
test('engine: the brand name on the wordmark layout never blocks the client', () => {
  const b = JSON.parse(JSON.stringify(BRANDS['dark-sans'])); b.name = 'A VERY LONG BRAND NAME INDEED';
  const p = plan(b, 'wordmark', '1:1', { headline: 'Hi' }); ok(!p.fit.over); ok(p.fit.kName < 1);
});
test('engine: Story keeps pinned footer clear of the app buttons', () => {
  const p = plan(BRANDS['dark-sans'], 'wordmark', '9:16', { headline: 'Hi', details: 'site.com' });
  const foot = p.items.filter(i => i.type === 'text').pop(); ok(foot.y + foot.h <= p.safe.y1 + 1e-6, 'footer inside safe');
});

// ---------------------------------------------------------------- photo
test('photo: pan and zoom can never reveal an edge (all shapes, all zooms, all pans)', () => {
  const rect = { x: 0, y: 0, w: 1080, h: 1350 };
  for (const [nw, nh] of [[4000, 3000], [3000, 4000], [2000, 2000], [500, 4000], [4000, 500], [1080, 1350]]) for (const z of [1, 1.5, 3]) for (const px of [-5, -1, 0, 0.3, 1, 5]) for (const py of [-5, -1, 0, 1, 5]) {
    const p = placement({ natW: nw, natH: nh }, rect, z, { x: px, y: py });
    ok(p.x <= rect.x + 1e-6 && p.x + p.dw >= rect.x + rect.w - 1e-6, 'x gap ' + [nw, nh, z, px]); ok(p.y <= rect.y + 1e-6 && p.y + p.dh >= rect.y + rect.h - 1e-6, 'y gap ' + [nw, nh, z, py]);
  }
});
test('photo: warning above 100%, block above 133%', () => {
  eq(resolutionLevel(1), 'ok'); eq(resolutionLevel(1.0001), 'warn'); eq(resolutionLevel(1.33), 'warn'); eq(resolutionLevel(1.3301), 'block');
  eq(placement({ natW: 1080, natH: 1350 }, { x: 0, y: 0, w: 1080, h: 1350 }, 1, null).scale, 1);
});
test('photo: a native-size photo in the format is not called soft', () => eq(resolutionLevel(placement({ natW: 1080, natH: 1080 }, { x: 0, y: 0, w: 1080, h: 1080 }, 1, null).scale), 'ok'));

// ---------------------------------------------------------------- readability
function flatMap(l, w = 100, h = 100) { const data = new Float32Array(w * h).fill(l); return { w, h, scale: 1, data }; }
test('readability: only colours that read are offered, best match first', () => {
  const cands = [{ name: 'White', hex: '#FFFFFF' }, { name: 'Black', hex: '#000000' }];
  const rect = [{ x: 10, y: 10, w: 50, h: 30 }];
  let a = assess(flatMap(0.02), rect, cands); eq(a.pass.length, 1); eq(a.best.name, 'White');
  a = assess(flatMap(0.9), rect, cands); eq(a.pass.length, 1); eq(a.best.name, 'Black');
});
test('readability: mid-grey under the text means no colour passes, and the closest is reported', () => {
  // (Pure black and white always have one that reads, so this uses two mid-tones.)
  const a = assess(flatMap(0.3), [{ x: 0, y: 0, w: 50, h: 50 }], [{ name: 'Sand', hex: '#C9B79C' }, { name: 'Clay', hex: '#8A6D55' }]);
  ok(!a.anyPass); ok(a.best === null); ok(a.closest.ratio < 4.5);
});
test('readability: a busy patch under the text is caught, a couple of stray specks are not', () => {
  const m = flatMap(0.02); for (let i = 0; i < 100 * 40; i++) m.data[i] = (i % 2) ? 0.02 : 0.9; // half of the top 40 rows are bright
  const white = [{ name: 'White', hex: '#FFFFFF' }];
  ok(!assess(m, [{ x: 0, y: 0, w: 100, h: 60 }], white).anyPass, 'busy');
  const m2 = flatMap(0.02); m2.data[5] = 0.9; m2.data[205] = 0.9;
  ok(assess(m2, [{ x: 0, y: 0, w: 100, h: 60 }], white).anyPass, 'specks');
});
test('readability: brightness map reads real pixels', () => {
  const img = { width: 2, height: 1, data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]) };
  const m = lumaMapFromImageData(img, 1); near(m.data[0], 1, 1e-6); near(m.data[1], 0, 1e-6);
});

// ---------------------------------------------------------------- checks
const facts = o => Object.assign({ fonts: 'ready', hasPhoto: true, photo: { level: 'ok', pct: 80 }, text: { hasText: true, over: false, kUse: 1, minScale: 0.6 }, readability: { mode: 'photo', chosen: { name: 'White', ratio: 9 }, anyPass: true, closest: null, panel: { ok: true } } }, o);
test('checks: everything fine means export is allowed', () => ok(!buildChecks(facts({})).blocked));
test('checks: fonts loading, fonts failed, text over, photo too soft, nothing readable each block export', () => {
  ok(buildChecks(facts({ fonts: 'loading' })).blocked); ok(buildChecks(facts({ fonts: 'failed' })).blocked);
  ok(buildChecks(facts({ text: { hasText: true, over: true, kUse: 0.6, minScale: 0.6 } })).blocked);
  ok(buildChecks(facts({ photo: { level: 'block', pct: 150 } })).blocked); ok(buildChecks(facts({ hasPhoto: false, photo: null })).blocked);
  ok(buildChecks(facts({ readability: { mode: 'photo', chosen: null, anyPass: false, closest: { ratio: 2 }, panel: { ok: true } } })).blocked);
  ok(buildChecks(facts({ readability: { mode: 'panel', panel: { ok: false, ratio: 2 } } })).blocked);
});
test('checks: a soft photo warns but does not block', () => { const r = buildChecks(facts({ photo: { level: 'warn', pct: 120 } })); ok(!r.blocked); ok(r.checks.some(c => c.tone === 'warn')); });

// ---------------------------------------------------------------- export names
test('export: file names come from the brand pattern', () => {
  eq(fileName('{brand}_{format}_{layout}', { brand: 'forma', format: '4:5', layout: 'full' }, 'png'), 'forma_4x5_full.png');
  eq(fileName(null, { brand: 'A B/C', format: 'landscape', layout: 'x' }, 'jpg'), 'a-b-c_landscape_x.jpg');
});

// ---------------------------------------------------------------- the one status line
test('status line: all good says Ready to download; a problem says what to fix in a plain sentence', () => {
  const good = summarise(buildChecks(facts({})).checks); eq(good.tone, 'ok'); eq(good.text, 'Ready to download'); ok(!good.blocked);
  const bad = summarise(buildChecks(facts({ photo: { level: 'block', pct: 150 } })).checks); eq(bad.tone, 'block'); ok(bad.blocked); ok(/low-res/i.test(bad.text) && /larger photo/.test(bad.text), bad.text);
  const soft = summarise(buildChecks(facts({ photo: { level: 'warn', pct: 120 } })).checks); eq(soft.tone, 'warn'); ok(!soft.blocked); ok(/120%/.test(soft.text));
});
test('status line: blocks win over warnings, extra blocks are counted, and it always agrees with the checks on blocking', () => {
  const f = facts({ fonts: 'loading', photo: { level: 'warn', pct: 120 }, text: { hasText: true, over: true, kUse: 0.6, minScale: 0.6 } });
  const r = buildChecks(f), sm = summarise(r.checks); eq(sm.tone, 'block'); ok(/1 more to fix/.test(sm.text), sm.text);
  for (const fonts of ['loading', 'ready', 'failed']) for (const level of ['ok', 'warn', 'block']) for (const over of [false, true]) for (const hasPhoto of [true, false]) for (const anyPass of [true, false]) {
    const rr = buildChecks(facts({ fonts, hasPhoto, photo: hasPhoto ? { level, pct: 100 } : null, text: { hasText: true, over, kUse: 1, minScale: 0.6 }, readability: { mode: 'photo', chosen: anyPass ? { name: 'White', ratio: 9 } : null, anyPass, closest: { ratio: 2 }, panel: { ok: true } } }));
    eq(summarise(rr.checks).blocked, rr.blocked, 'status and export agree');
  }
});

// ================================================================ real browser tests
async function realBrand(key) {
  const b = BRANDS[key];
  const fonts = await loadBrandFonts(b, LAYOUT_IDS.filter(i => b.studio.layouts.includes(i)).map(i => LAYOUTS[i]));
  ok(fonts.ready, key + ' fonts: ' + fonts.problems.join(', '));
  const generics = {}; ['heading', 'body'].forEach(w => { generics[b.fonts[w].family] = b.fonts[w].fallback === 'serif' ? 'serif' : 'sans-serif'; });
  return { b, generics, measure: makeMeasure(generics), theme: derive(b) };
}
function viewFor(R, photo, textHex) {
  return { photo, zoom: 1, pan: { x: 0, y: 0 }, cornerRb: R.theme.cornerPx.rb, generics: R.generics, colours: { text: textHex, panelBg: R.theme.panel.bg, panelText: R.theme.panel.text, pillBg: R.theme.panel.pillBg, pillText: R.theme.panel.pillText, empty: '#222' } };
}

for (const key of Object.keys(BRANDS)) {
  test('real [' + key + ']: every layout in every format draws with no empty pixel, and exports PNG and JPG at the right size', async () => {
    const R = await realBrand(key);
    const photo = await makeSample('dark');
    for (const id of R.b.studio.layouts) for (const f of R.b.studio.formats) {
      const p = buildPlan({ layout: LAYOUTS[id], formatId: f, values: { headline: 'Studio open', subline: 'Liverpool', details: 'Book a call' }, fonts: R.b.fonts, brandName: R.b.name, measure: R.measure });
      const c = renderToCanvas(p, viewFor(R, photo, '#FFFFFF'));
      eq(c.width, G.FORMATS[f].w); eq(c.height, G.FORMATS[f].h);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let minA = 255; for (let i = 3; i < d.length; i += 4) if (d[i] < minA) minA = d[i];
      eq(minA, 255, key + ' ' + id + ' ' + f + ' has transparent pixels');
      const png = await toBlob(c, 'image/png'), jpg = await toBlob(c, 'image/jpeg', 0.9);
      ok(png.size > 1000 && jpg.size > 1000 && jpg.size < png.size, 'export sizes ' + png.size + '/' + jpg.size);
    }
  });
  test('real [' + key + ']: the font check keeps accented letters the brand font draws, and removes ones it cannot', async () => {
    const R = await realBrand(key), h = R.b.fonts.heading;
    const g = createGlyphChecker([{ family: h.family, weight: h.weight || 400 }]);
    const text = 'Café Zoë Ñ ŉ 漢';
    await g.ensure(g.unknown(text));
    const { clean } = sanitise(text, g.canDraw);
    ok(clean.includes('Café Zoë Ñ'), key + ' keeps ordinary accents: ' + clean);
    ok(!clean.includes('漢'), 'other scripts are stripped');
    // Fraunces has no ŉ; Montserrat and Space Grotesk do.
    eq(clean.includes('ŉ'), h.family !== 'Fraunces', key + ' ŉ with ' + h.family);
    eq(await fontDraws(h.family, h.weight || 400, '漢'), false, 'detector flags a glyph the font really lacks');
    eq(await fontDraws(h.family, h.weight || 400, 'é'), true);
  });
  test('real [' + key + ']: the preview and the export are the same pixels', async () => {
    const R = await realBrand(key), photo = await makeSample('bright');
    const f = R.b.studio.formats[0], id = R.b.studio.layouts[0];
    const p = buildPlan({ layout: LAYOUTS[id], formatId: f, values: { headline: 'Same' }, fonts: R.b.fonts, brandName: R.b.name, measure: R.measure });
    const a = document.createElement('canvas'); a.width = p.W; a.height = p.H; drawFrame(a.getContext('2d'), p, viewFor(R, photo, '#000000'));
    const b2 = renderToCanvas(p, viewFor(R, photo, '#000000'));
    const da = a.getContext('2d').getImageData(0, 0, p.W, p.H).data, db = b2.getContext('2d').getImageData(0, 0, p.W, p.H).data;
    let diff = 0; for (let i = 0; i < da.length; i++) if (da[i] !== db[i]) diff++;
    eq(diff, 0, 'pixels differ');
  });
  test('real [' + key + ']: real text measuring: normal text fits, far too much text does not, wider text makes a wider block', async () => {
    const R = await realBrand(key);
    const mk = t => buildPlan({ layout: LAYOUTS.full, formatId: '1:1', values: { headline: t }, fonts: R.b.fonts, brandName: R.b.name, measure: R.measure });
    ok(!mk('Studio open').fit.over); ok(mk('W'.repeat(80)).fit.over);
    ok(mk('Studio open').block.w < mk('Studio open and more').block.w, 'wider text, wider block');
  });
}

// ---------------------------------------------------------------- the whole studio, driven like a client would
async function waitFor(fn, ms = 20000, what = 'condition') { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what); await sleep(50); } }
async function type(input, text) { for (const ch of text) { input.value += ch; input.dispatchEvent(new Event('input', { bubbles: true })); await frames(); } }
async function openStudio(key) {
  document.getElementById('app')?.remove();
  const root = document.createElement('div'); root.id = 'app'; document.body.append(root);
  localStorage.clear();
  const s = await start({ root, brandUrl: 'fixtures/' + key + '.json', layoutsBase: '../../public/layouts/', assetBase: '', hubUrl: '', samples: true });
  ok(s, 'studio started'); await waitFor(() => s.store.get().fonts !== 'loading', 20000, 'fonts'); ok(s.store.get().fonts === 'ready', 'fonts ready'); await frames();
  return { s, root };
}
for (const key of ['dark-sans', 'light-serif']) {
  test('studio [' + key + ']: no photo blocks export; a good photo unblocks it', async () => {
    const { s, root } = await openStudio(key);
    ok(s.getLast().blocked, 'blocked with no photo'); ok(root.querySelector('.btn.big').classList.contains('disabled'));
    await s.setSample('dark'); await frames(); ok(!s.getLast().blocked, 'unblocked: ' + s.getLast().checks.map(c => c.tone + ':' + c.title).join(' | '));
  });
  test('studio [' + key + ']: emoji and line breaks are stripped with a message; limit and no-room rules hold', async () => {
    const { s, root } = await openStudio(key); await s.setSample('dark'); await frames();
    const inp = root.querySelector('[data-field="headline"]'), note = () => root.querySelector('[data-wrap="headline"] .note').textContent;
    inp.value = 'Hi 😀 there\tnow'; inp.dispatchEvent(new Event('input', { bubbles: true })); await frames();
    eq(inp.value, 'Hi  there now'); ok(/removed/.test(note()), 'message: ' + note());
    inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); await frames();
    await type(inp, 'W'.repeat(28));
    ok(inp.value.length < 28, 'typing stopped early at ' + inp.value.length); ok(/No more room/.test(note()), 'message: ' + note());
    ok(!s.getLast().plan.fit.over, 'never left in an over state'); eq(s.getLast().plan.fit.kUse >= 0.6, true);
    inp.value = 'x'.repeat(40); inp.dispatchEvent(new Event('input', { bubbles: true })); await frames(); ok(inp.value.length <= 28, 'limit of 28 applies to pasted text');
  });
  test('studio [' + key + ']: the download bar shows one status line: ready, or a plain reason with the buttons greyed', async () => {
    const { s, root } = await openStudio(key);
    const line = () => root.querySelector('.statusline'), btn = () => root.querySelector('.btn.big');
    ok(/Add a photo/.test(line().textContent), 'no photo: ' + line().textContent); ok(line().classList.contains('t-block')); ok(btn().classList.contains('disabled'));
    eq(root.querySelectorAll('.check').length, 0, 'the four check cards are gone');
    await s.setSample('dark'); s.cb.onField('headline', 'Studio open'); await frames(); await frames();
    eq(line().textContent.replace('✓', ''), 'Ready to download'); ok(line().classList.contains('t-ok')); ok(!btn().classList.contains('disabled')); eq(btn().getAttribute('aria-disabled'), 'false');
    await s.setSample('busy'); await frames(); await frames();
    ok(/hard to read/i.test(line().textContent) && /move the text/i.test(line().textContent), line().textContent); ok(btn().classList.contains('disabled'));
    ok(line().getBoundingClientRect().bottom <= root.querySelector('.actions').getBoundingClientRect().top + 1, 'the status sentence must sit above the buttons, not over them');
    eq(getComputedStyle(line()).position, 'static');
    await s.setSample('tiny'); await frames(); await frames(); ok(/low-res/i.test(line().textContent), line().textContent);
  });
  test('studio [' + key + ']: the text colour control only appears when the brand offers more than one choice for this photo', async () => {
    const { s, root } = await openStudio(key); s.cb.onField('headline', 'Studio open'); s.cb.onField('subline', 'Liverpool');
    const box = () => [...root.querySelectorAll('.label')].find(l => l.textContent === 'Text colour').parentElement;
    ok(box().hidden, 'hidden with no photo');
    let sawHidden = false, sawShown = false;
    for (const sample of ['dark', 'bright', 'portrait']) {
      await s.setSample(sample); await frames(); await frames(); const n = s.getLast().read.options.length;
      eq(box().hidden, n <= 1, sample + ' with ' + n + ' option(s)'); if (n > 1) { sawShown = true; ok(root.querySelectorAll('.sw').length === n, 'one swatch each'); } else sawHidden = true;
      if (n === 1) eq(s.getLast().read.chosen.hex, s.getLast().read.options[0].hex, 'the only choice is used automatically');
    }
    ok(sawShown || sawHidden, 'exercised');
  });
  test('studio [' + key + ']: test photos and the photo badge are hidden unless dev is on', async () => {
    const { s, root } = await openStudio(key); await s.setSample('dark'); await frames(); await frames();
    ok([...root.querySelectorAll('.opt')].every(b => !['Dark', 'Bright', 'Busy', 'Portrait'].includes(b.textContent)), 'no sample buttons');
    eq(root.querySelector('.photo-label').textContent, ''); ok(root.querySelector('.eyebrow').hidden);
    document.getElementById('app').remove(); const r2 = document.createElement('div'); r2.id = 'app'; document.body.append(r2);
    const d = await start({ root: r2, brandUrl: 'fixtures/' + key + '.json', layoutsBase: '../../public/layouts/', assetBase: '', hubUrl: '', samples: true, dev: true });
    await d.setSample('dark'); await frames(); await frames();
    ok([...r2.querySelectorAll('.opt')].some(b => b.textContent === 'Dark'), 'dev shows sample buttons'); ok(/sample/.test(r2.querySelector('.photo-label').textContent), 'dev shows the badge');
  });
  test('studio [' + key + ']: typing Café Zoë Ñ keeps the letters; a letter the font lacks is removed with a message', async () => {
    const { s, root } = await openStudio(key); await s.setSample('dark');
    const inp = root.querySelector('[data-field="headline"]'), note = () => root.querySelector('[data-wrap="headline"] .note').textContent;
    await type(inp, 'Café Zoë Ñ'); await sleep(300); await frames();
    eq(inp.value, 'Café Zoë Ñ'); eq(s.store.get().values.headline, 'Café Zoë Ñ'); ok(!/removed/.test(note()), 'no message: ' + note());
    inp.value = 'Zoë ŉ 😀'; inp.dispatchEvent(new Event('input', { bubbles: true })); await sleep(500); await frames();
    const lacks = s.brand.fonts.heading.family === 'Fraunces';
    eq(inp.value, lacks ? 'Zoë  ' : 'Zoë ŉ ', 'value: [' + inp.value + ']'); ok(/removed/.test(note()), 'message: ' + note());
  });
  test('studio [' + key + ']: dragging and arrow keys keep the text inside the safe area in every format', async () => {
    const { s, root } = await openStudio(key); await s.setSample('dark');
    s.cb.onField('headline', 'Studio open'); await frames();
    for (const f of s.brand.studio.formats) {
      s.cb.onFormat(f); await frames();
      let L = s.getLast(); s.cb.onBlockStart();
      for (const [dx, dy] of [[9999, 9999], [-9999, -9999], [300, -200]]) { s.cb.onBlockDrag(dx, dy, true); await frames(); L = s.getLast(); const b = L.plan.block, sf = L.plan.safe; ok(b.left >= sf.x0 - 1e-6 && b.left + b.w <= sf.x1 + 1e-6 && b.top >= sf.y0 - 1e-6 && b.top + b.h <= sf.y1 + 1e-6, f + ' drag ' + dx); }
      s.cb.onBlockEnd(); for (let i = 0; i < 30; i++) s.cb.onBlockNudge(200, 200); await frames(); L = s.getLast(); ok(L.plan.block.left + L.plan.block.w <= L.plan.safe.x1 + 1e-6, f + ' nudge');
    }
  });
  test('studio [' + key + ']: the visible preview is fully painted after every format and layout change', async () => {
    const { s } = await openStudio(key); await s.setSample('dark'); s.cb.onField('headline', 'Studio open');
    for (const lay of s.brand.studio.layouts) for (const f of s.brand.studio.formats) {
      s.cb.onLayout(lay); s.cb.onFormat(f); await frames(); await frames();
      const c = s.ui.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      eq(c.width, G.FORMATS[f].w); let minA = 255; for (let i = 3; i < d.length; i += 4) if (d[i] < minA) minA = d[i];
      eq(minA, 255, 'preview not painted: ' + lay + ' ' + f);
    }
  });
  test('studio [' + key + ']: photo checks: too small blocks, slightly small warns, large is fine; zoom past 133% blocks', async () => {
    const { s } = await openStudio(key); s.cb.onFormat('4:5');
    await s.setSample('tiny'); await frames(); ok(s.getLast().checks.some(c => c.id === 'photo' && c.tone === 'block'), 'tiny blocks'); ok(s.getLast().blocked);
    await s.setSample('soft'); await frames(); ok(s.getLast().checks.some(c => c.id === 'photo' && c.tone === 'warn'), 'soft warns');
    await s.setSample('dark'); await frames(); ok(s.getLast().checks.some(c => c.id === 'photo' && c.tone === 'ok'), 'large ok');
    s.cb.onZoom(3); await frames(); ok(s.getLast().checks.some(c => c.id === 'photo' && c.tone === 'block'), 'zoom 300% blocks');
  });
  test('studio [' + key + ']: dragging the photo at any zoom never shows an edge', async () => {
    const { s } = await openStudio(key); await s.setSample('portrait'); s.cb.onFormat('landscape'); s.cb.onZoom(2.5); await frames();
    ok(s.cb.onPanStart(), 'can pan');
    for (const [dx, dy] of [[9999, 9999], [-9999, -9999], [0, 400], [-300, 0]]) {
      s.cb.onPanDrag(dx, dy); await frames(); const L = s.getLast(), r = L.plan.photoRect, p = L.pl;
      ok(p.x <= r.x + 1e-6 && p.x + p.dw >= r.x + r.w - 1e-6 && p.y <= r.y + 1e-6 && p.y + p.dh >= r.y + r.h - 1e-6, 'edge shown after ' + dx + ',' + dy);
    }
  });
  test('studio [' + key + ']: bright and dark photos each offer only colours that read, and the best is chosen', async () => {
    const { s, root } = await openStudio(key); s.cb.onField('headline', 'Studio open'); s.cb.onField('subline', 'Liverpool');
    for (const sample of ['dark', 'bright']) {
      await s.setSample(sample); await frames(); const L = s.getLast();
      ok(L.read.anyPass, sample + ' something reads'); ok(L.read.chosen.ratio >= 4.5, 'chosen reads');
      const shown = [...root.querySelectorAll('.sw')].length; eq(shown, L.read.options ? L.read.options.length : shown);
    }
    await s.setSample('dark'); await frames(); const darkPick = s.getLast().read.chosen.hex;
    await s.setSample('bright'); await frames(); const brightPick = s.getLast().read.chosen.hex;
    ok(C.luminance(darkPick) > C.luminance(brightPick), 'light text on dark photo, dark text on bright photo');
  });
  test('studio [' + key + ']: no allowed colour passes on a busy photo -> export blocked with advice', async () => {
    const { s, root } = await openStudio(key); s.cb.onField('headline', 'Studio open'); s.cb.onField('subline', 'Liverpool'); s.cb.onField('details', 'Book a call');
    await s.setSample('busy'); await frames(); const L = s.getLast();
    ok(!L.read.anyPass, 'nothing reads on a busy photo'); ok(L.blocked); ok(/move the text/i.test(L.checks.find(c => c.id === 'read').text));
    ok(root.querySelector('#app, .colour-note, .note') !== null);
  });
  test('studio [' + key + ']: switching layout keeps the text; panel layouts have a fixed text colour; blocked export says why', async () => {
    const { s, root } = await openStudio(key); await s.setSample('dark'); s.cb.onField('headline', 'Kept'); await frames();
    s.cb.onLayout('product'); await frames(); eq(s.store.get().values.headline, 'Kept'); eq(s.getLast().read.mode, 'panel'); ok(!s.getLast().blocked);
    s.cb.onLayout('wordmark'); await frames(); ok(s.getLast().plan.items.some(i => i.text === (key === 'dark-sans' ? 'FORMA' : 'Northlight')), 'brand name drawn');
    await s.setSample('tiny'); await frames(); await s.cb.onExport('png'); await frames();
    ok(/Not ready yet/.test(s.store.get().status), 'status: ' + s.store.get().status);
  });
  test('studio [' + key + ']: work is remembered for a refresh, and the page warns before leaving', async () => {
    const { s } = await openStudio(key); s.cb.onField('headline', 'Remember me'); s.cb.onFormat('9:16'); await sleep(500);
    const saved = JSON.parse(localStorage.getItem('stms-studio:' + s.brand.slug + ':v1')); eq(saved.values.headline, 'Remember me');
    ok(s.store.get().dirty, 'dirty so the page warns');
    document.getElementById('app').remove();
    const root = document.createElement('div'); root.id = 'app'; document.body.append(root);
    const s2 = await start({ root, brandUrl: 'fixtures/' + key + '.json', layoutsBase: '../../public/layouts/', assetBase: '', hubUrl: '', samples: true });
    await frames(); eq(s2.store.get().values.headline, 'Remember me'); eq(s2.store.get().format, '9:16'); ok(/Restored/.test(s2.store.get().status));
  });
  test('studio [' + key + ']: the page is the clean white look, with the brand’s font and colour on its name', async () => {
    const { s, root } = await openStudio(key);
    const cs = getComputedStyle(root.querySelector('.brand-name'));
    ok(cs.fontFamily.includes(s.brand.fonts.heading.family), 'heading font ' + cs.fontFamily);
    eq(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toUpperCase(), '#141414', 'buttons are the same neutral for every brand');
    const want = derive(s.brand).vars.accentText; const rgb = C.parseHex(want).join(', ');
    eq(cs.color, 'rgb(' + rgb + ')', 'the brand name is in the brand’s link colour');
  });
}
test('studio [edge-midtones]: a brand with no readable panel colour cannot export panel layouts', async () => {
  const { s } = await openStudio('edge-midtones'); await s.setSample('dark'); s.cb.onLayout('product'); await frames();
  ok(s.getLast().blocked); ok(s.getLast().checks.some(c => c.id === 'read' && c.tone === 'block'));
});
test('studio: a broken brand address shows a plain message, not a blank page', async () => {
  const root = document.createElement('div'); document.body.append(root);
  const r = await start({ root, brandUrl: 'fixtures/nope.json', layoutsBase: '../../public/layouts/', samples: false });
  eq(r, null); ok(/Couldn’t load the brand/.test(root.textContent), root.textContent); root.remove();
});

// ---------------------------------------------------------------- run
(async () => {
  for (const k of Object.keys(BRANDS)) BRANDS[k] = await getJson('fixtures/' + k + '.json');
  for (const id of LAYOUT_IDS) LAYOUTS[id] = await getJson('../../public/layouts/' + id + '.json');
  for (const [name, fn] of tests) {
    let line;
    try { await fn(); passes++; line = 'PASS  ' + name; } catch (e) { fails++; line = 'FAIL  ' + name + '  ->  ' + (e && e.message); }
    const d = document.createElement('div'); d.textContent = line; d.className = line.startsWith('PASS') ? 'p' : 'f'; out.append(d);
  }
  const sum = document.createElement('div'); sum.id = 'summary'; sum.textContent = 'SUMMARY ' + passes + ' passed, ' + fails + ' failed'; out.append(sum);
  document.body.dataset.done = '1';
})();
