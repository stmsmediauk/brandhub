// Starts the studio and connects the parts. Everything about a brand comes
// from its JSON, nothing about a brand is written here.
import { FORMATS, placeBlock, clamp } from './geometry.js';
import { derive } from './theme.js';
import { buildPlan, layoutFields } from './layout-engine.js';
import { sanitise } from './text-fit.js';
import { placement, resolutionLevel, decodeFile, clampPan } from './photo.js';
import { lumaMapFromImageData, assess } from './readability.js';
import { buildChecks } from './checks.js';
import { summarise } from './summary.js';
import { loadBrandFonts } from './fonts.js';
import { makeMeasure, drawFrame, drawPhoto } from './renderer.js';
import { renderToCanvas, toBlob, download, fileName, formatBytes } from './export.js';
import { createStore, saveState, loadState, savePhotoFile, loadPhotoFile, clearPhotoFile } from './state.js';
import { createUI } from './controls.js';
import { loadBrand } from './brand-loader.js';
import { SAMPLES, makeSample } from './samples.js';
import { createGlyphChecker } from './glyphs.js';
import { logoList, loadLogo, recolour, svgText, aspect } from '../../hub/logos.js';

const LUMA_SCALE = 0.25;

function showError(root, message) {
  root.textContent = '';
  const p = document.createElement('p');
  p.className = 'fatal';
  p.textContent = message;
  root.append(p);
}

// opts: { root, brandUrl, layoutsBase, assetBase, hubUrl, logUrl, samples, dev }
// Test photos and the photo badge only show when the page allows samples AND the
// address has ?dev=1 (or opts.dev is true). The client page never allows samples.
export async function start(opts) {
  const root = opts.root || document.getElementById('app');
  const dev = opts.dev != null ? !!opts.dev : new URLSearchParams(location.search).get('dev') === '1';
  const showSamples = !!opts.samples && dev;
  root.textContent = 'Loading the studio…';
  let loaded;
  try { loaded = await loadBrand(opts); } catch (e) { showError(root, e.message); return null; }
  const { brand, layouts } = loaded;
  const layoutById = Object.fromEntries(layouts.map(l => [l.id, l]));
  const formatIds = brand.studio.formats;
  const theme = derive(brand);
  for (const [k, v] of Object.entries(theme.vars)) document.documentElement.style.setProperty('--' + k, v);
  document.title = brand.name + ' artwork studio';

  const generics = {};
  ['heading', 'body'].forEach(w => { generics[brand.fonts[w].family] = brand.fonts[w].fallback === 'serif' ? 'serif' : 'sans-serif'; });
  const measure = makeMeasure(generics);
  const nameOf = hex => { const c = brand.palette.find(p => p.hex === hex); return c ? c.name : hex; };
  const candidates = brand.studio.photo_text_colours.map(hex => ({ name: nameOf(hex), hex }));
  // Every font the layouts actually draw with, for the "can the font draw this letter" check.
  const used = new Set(layouts.flatMap(l => (l.text.lines || []).map(x => x.font === 'body' ? 'body' : 'heading')));
  const glyphs = createGlyphChecker([...used].map(w => ({ family: brand.fonts[w].family, weight: w === 'heading' ? (brand.fonts.heading.weight || 400) : (brand.fonts.body.weight || 400) })));
  const REMOVED = 'Some characters can’t be drawn in the brand font and were removed.';
  const storeKey = 'stms-studio:' + (brand.slug || 'brand') + ':v' + (brand.version || 1);
  const libraryUrl = /^https:\/\//i.test(brand.library || '') ? brand.library : '';

  // ---------- state ----------
  const initial = {
    format: formatIds[0], layout: brand.studio.layouts[0], values: {}, pos: {}, zoom: 1, pan: {}, textColour: null, photoRef: null,
    notes: {}, status: '', guide: null, fonts: 'loading', logos: 'loading', photoVersion: 0, dirty: false
  };
  const store = createStore(initial);
  let photoData = null;
  let last = null;

  async function setPhoto(data, ref, file) {
    photoData = data;
    store.set({ photoRef: ref, photoVersion: store.get().photoVersion + 1, zoom: 1, pan: {}, status: '', dirty: true });
    if (file) await savePhotoFile(storeKey + ':photo', file); else await clearPhotoFile(storeKey + ':photo');
  }

  // ---------- the brand's own logos in the artwork ----------
  // The widest logo stands in for the brand name (wordmark layout), the first mark
  // replaces the dot mark. Each is recoloured to whichever colour the text uses there.
  const allLogos = logoList(brand);
  const markEntry = allLogos.find(l => l.kind === 'mark') || null;
  const logoSvg = { name: null, mark: null };
  const logoImgs = new Map();            // 'which|hex' -> { img, ready, promise }
  function logoImage(which, hex) {
    const svg = logoSvg[which];
    if (!svg || !hex) return null;
    const key = which + '|' + hex;
    let e = logoImgs.get(key);
    if (!e) {
      const s = recolour(svg, hex);
      const ar = aspect(svg), long = 2400;
      s.setAttribute('width', ar >= 1 ? long : Math.round(long * ar)); s.setAttribute('height', ar >= 1 ? Math.round(long / ar) : long);
      const img = new Image();
      e = { img, ready: false };
      e.promise = new Promise(res => { img.onload = () => { e.ready = true; res(true); schedule(); }; img.onerror = () => res(false); });
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText(s).replace(/^<\?xml[^>]*>\n?/, ''));
      logoImgs.set(key, e);
    }
    return e.ready ? e.img : null;
  }
  // Every logo image the current frame draws, ready before anything is exported.
  async function logosReadyFor(plan, view) {
    const want = [];
    for (const it of plan.items) {
      if (it.type === 'logo') want.push([it.which, view.colours[it.color]]);
      if (it.type === 'mark' && it.brandMark) want.push(['mark', view.colours[it.color]]);
    }
    for (const [w, hex] of want) { logoImage(w, hex); const e = logoImgs.get(w + '|' + hex); if (e && !e.ready) await e.promise; }
    return want.every(([w, hex]) => { const e = logoImgs.get(w + '|' + hex); return e && e.ready; });
  }
  (async () => {
    if (!allLogos.length) { store.set({ logos: 'none' }); return; }
    const base = opts.assetBase || '';
    const loaded = await Promise.all(allLogos.map(async l => ({ l, svg: await loadLogo(base, l.file) })));
    const ok = loaded.filter(x => x.svg);
    const widest = ok.reduce((b, x) => (!b || aspect(x.svg) > aspect(b.svg) ? x : b), null);
    logoSvg.name = widest ? widest.svg : null;
    const m = markEntry && ok.find(x => x.l.id === markEntry.id);
    logoSvg.mark = m ? m.svg : null;
    store.set({ logos: ok.length ? 'ready' : 'failed' });
  })();

  function report(event) {
    if (!opts.logUrl) return;
    try { fetch(opts.logUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }) }).catch(() => {}); } catch (e) { /* never block the client */ }
  }

  // ---------- one frame ----------
  let lumaCanvas = null, lumaCache = { key: '', map: null };
  function lumaFor(plan, view, S, pan) {
    const key = [S.format, S.layout, S.zoom, pan.x, pan.y, S.photoVersion].join('|');
    if (lumaCache.key === key) return lumaCache.map;
    const w = Math.ceil(plan.W * LUMA_SCALE), h = Math.ceil(plan.H * LUMA_SCALE);
    if (!lumaCanvas) lumaCanvas = document.createElement('canvas');
    lumaCanvas.width = w; lumaCanvas.height = h;
    const g = lumaCanvas.getContext('2d', { willReadFrequently: true });
    g.setTransform(LUMA_SCALE, 0, 0, LUMA_SCALE, 0, 0);
    drawPhoto(g, plan, view);
    const map = lumaMapFromImageData(g.getImageData(0, 0, w, h), LUMA_SCALE);
    lumaCache = { key, map };
    return map;
  }

  function compute(S, values) {
    const layout = layoutById[S.layout];
    const logos = { name: logoSvg.name ? aspect(logoSvg.name) : 0, mark: !!logoSvg.mark };
    const plan = buildPlan({ layout, formatId: S.format, values, pos: S.pos[S.format], fonts: brand.fonts, brandName: brand.name, measure, logos });
    const pan = S.pan[S.format] || { x: 0, y: 0 };
    const pl = photoData ? placement(photoData, plan.photoRect, S.zoom, pan) : null;
    return { layout, plan, pan, pl };
  }

  function frame() {
    const S = store.get();
    const { layout, plan, pan, pl } = compute(S, S.values);
    const view = { photo: photoData, zoom: S.zoom, pan, cornerRb: theme.cornerPx.rb, generics, colours: null, logoImage };

    // Which text colours read clearly on the pixels under the text.
    let read = { mode: plan.onPhoto ? 'photo' : 'panel', chosen: null, anyPass: true, closest: null, panel: theme.panel };
    let options = [];
    if (plan.onPhoto && photoData) {
      const map = lumaFor(plan, Object.assign({}, view, { colours: { empty: '#000' } }), S, pan);
      const a = assess(map, plan.textRects, candidates, plan.W * 0.008);
      const manual = a.pass.find(o => o.hex === S.textColour);
      const chosen = manual || a.best;
      read = { mode: 'photo', chosen, anyPass: a.anyPass, closest: a.closest, panel: theme.panel, manual: !!manual, options: a.pass };
      options = a.pass;
    }
    const textHex = (read.chosen && read.chosen.hex) || (read.closest && read.closest.hex) || candidates[0].hex;
    view.colours = { text: textHex, panelBg: theme.panel.bg, panelText: theme.panel.text, pillBg: theme.panel.pillBg, pillText: theme.panel.pillText, empty: theme.vars.surface2 };

    const level = pl ? resolutionLevel(pl.scale) : null;
    const { checks, blocked } = buildChecks({
      // The brand's logos count as part of the brand's look: export waits for them too.
      fonts: S.fonts === 'ready' && S.logos === 'loading' ? 'loading' : S.fonts, hasPhoto: !!photoData,
      photo: pl ? { level, pct: Math.round(pl.scale * 100) } : null,
      text: { hasText: plan.hasText, over: plan.fit.over, kUse: plan.fit.kUse, minScale: plan.fit.minScale },
      readability: read
    });

    ui.sizeCanvas(plan.W, plan.H);
    drawFrame(ui.canvas.getContext('2d'), plan, view);
    last = { plan, view, blocked, checks, pl, read, S };

    const hint = plan.block
      ? 'Drag the text to move it, or use the arrow keys.'
      : 'The text position is fixed in this layout.';
    // A text colour choice is only shown when the brand offers more than one that reads here.
    const showSwatches = plan.onPhoto && !!photoData && options.length > 1;
    const colourNote = !read.manual ? 'Best match chosen automatically. Pick another if you like.' : 'Only colours that read clearly here are shown.';

    ui.update({
      brandName: brand.name, libraryUrl,
      formats: formatIds.map(id => ({ id, label: FORMATS[id].label, on: id === S.format })),
      layouts: layouts.map(l => ({ id: l.id, name: l.name, def: l, on: l.id === S.layout })),
      fields: layoutFields(layout).map(f => ({ id: f.id, label: f.label, max: f.max, example: f.example, value: S.values[f.id] || '', note: S.notes[f.id] || '' })),
      textColours: { show: showSwatches, options: options.map(o => ({ name: o.name, hex: o.hex, on: o.hex === (read.chosen && read.chosen.hex) })), note: colourNote },
      photo: {
        hasPhoto: !!photoData, zoom: S.zoom,
        meta: photoData ? photoData.name + ' · ' + photoData.natW + '×' + photoData.natH + 'px' : 'JPG or PNG',
        samples: showSamples ? SAMPLES.map(s => ({ id: s.id, label: s.label, on: !!(S.photoRef && S.photoRef.kind === 'sample' && S.photoRef.id === s.id) })) : null
      },
      summary: summarise(checks), notice: S.status, export: brand.studio.export,
      stage: {
        W: plan.W, H: plan.H, hint, noPhoto: !photoData, photoLabel: dev && photoData ? photoData.name : '',
        canPan: !!pl && (pl.maxX > 0.5 || pl.maxY > 0.5),
        safe: plan.block ? plan.safe : null, guide: S.guide,
        block: plan.block ? { left: plan.block.left, top: plan.block.top, w: plan.block.w, h: plan.block.h, colour: textHex } : null
      }
    });
  }

  let queued = false;
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; frame(); }); };
  let saveTimer = 0;
  store.subscribe(() => {
    schedule();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { const s = store.get(); if (s.dirty) saveState(storeKey, s); }, 300);
  });

  // ---------- what the client can do ----------
  const markDirty = patch => store.set(Object.assign({ dirty: true }, patch));

  const fieldSeq = {};
  const cb = {
    onFormat: id => store.set({ format: id, guide: null, status: '' }),
    onLayout: id => {
      const S = store.get(), layout = layoutById[id], values = Object.assign({}, S.values);
      layoutFields(layout).forEach(f => { if ((values[f.id] || '').length > f.max) values[f.id] = values[f.id].slice(0, f.max); });
      markDirty({ layout: id, values, guide: null, status: '', notes: {} });
    },
    onField: async (id, raw) => {
      // Accented letters need the font checked once. Ordinary typing never waits.
      const token = (fieldSeq[id] = (fieldSeq[id] || 0) + 1);
      const unknown = glyphs.unknown(raw);
      if (unknown.length) { await glyphs.ensure(unknown); if (token !== fieldSeq[id]) return; }
      const S = store.get();
      const def = layoutFields(layoutById[S.layout]).find(f => f.id === id);
      if (!def) return;
      const sc = sanitise(raw, glyphs.canDraw);
      const clean = sc.clean.slice(0, def.max), changed = sc.changed;
      const values = Object.assign({}, S.values, { [id]: clean });
      const cur = (S.values[id] || '');
      const trial = compute(S, values).plan;
      // Refuse typing that would not fit, but always allow deleting.
      if (trial.fit.over && clean.length > cur.length) {
        store.set({ notes: Object.assign({}, S.notes, { [id]: 'No more room: the text is already at its minimum size.' }) });
        return;
      }
      markDirty({ values, notes: Object.assign({}, S.notes, { [id]: changed ? REMOVED : '' }), status: '' });
    },
    onTextColour: hex => markDirty({ textColour: hex }),
    onFile: async file => {
      store.set({ status: 'Loading photo…' });
      try { const data = await decodeFile(file); await setPhoto(data, { kind: 'upload', name: file.name }, file); }
      catch (e) { store.set({ status: e.message || 'Couldn’t read that image.' }); }
    },
    onSample: async id => { const data = await makeSample(id); await setPhoto(data, { kind: 'sample', id }, null); },
    onZoom: v => markDirty({ zoom: clamp(v, 1, 3), status: '' }),
    onResetPhoto: () => markDirty({ zoom: 1, pan: {}, status: '' }),

    onBlockStart: () => { const b = last.plan.block; blockStart = { left: b.left, cy: b.cy }; },
    onBlockDrag: (dx, dy, snap) => {
      const p = last.plan, b = p.block;
      const r = placeBlock(blockStart.left + dx, blockStart.cy + dy, b.w, b.h, p.safe, p.W, p.H, snap);
      const S = store.get();
      markDirty({ pos: Object.assign({}, S.pos, { [S.format]: { fx: r.left / p.W, fy: r.cy / p.H } }), guide: r.guide });
    },
    onBlockEnd: () => store.set({ guide: null }),
    onBlockNudge: (dx, dy) => {
      const p = last.plan, b = p.block;
      const r = placeBlock(b.left + dx, b.cy + dy, b.w, b.h, p.safe, p.W, p.H, false);
      const S = store.get();
      markDirty({ pos: Object.assign({}, S.pos, { [S.format]: { fx: r.left / p.W, fy: r.cy / p.H } }) });
    },

    onPanStart: () => {
      if (!last || !last.pl || !(last.pl.maxX > 0.5 || last.pl.maxY > 0.5)) return false;
      panStart = { x: last.view.pan.x, y: last.view.pan.y, maxX: last.pl.maxX, maxY: last.pl.maxY };
      return true;
    },
    onPanDrag: (dx, dy) => {
      const S = store.get();
      const nx = clampPan(panStart.x + (panStart.maxX ? dx / panStart.maxX : 0));
      const ny = clampPan(panStart.y + (panStart.maxY ? dy / panStart.maxY : 0));
      markDirty({ pan: Object.assign({}, S.pan, { [S.format]: { x: nx, y: ny } }), status: '' });
    },
    onPanEnd: () => {},

    onExport: async type => {
      if (!last || last.blocked) { report('blocked_export'); store.set({ status: 'Not ready yet. Fix the problem shown above first.' }); return; }
      try {
        if (!(await logosReadyFor(last.plan, last.view))) throw new Error('The brand logo could not be drawn. Reload the page and try again.');
        const canvas = renderToCanvas(last.plan, last.view);
        const blob = await toBlob(canvas, type === 'png' ? 'image/png' : 'image/jpeg', brand.studio.export.jpg_quality);
        const S = last.S;
        const name = fileName(brand.studio.export.naming, { brand: brand.slug || brand.name, format: S.format, layout: S.layout }, type);
        download(blob, name);
        report('export');
        store.set({ status: 'Saved ' + name + ' (' + formatBytes(blob.size) + ').', dirty: false });
      } catch (e) { store.set({ status: e.message || 'The file could not be made.' }); }
    }
  };
  let blockStart = null, panStart = null;

  const ui = createUI(root, cb, { hubUrl: opts.hubUrl });

  // ---------- recover earlier work ----------
  const saved = loadState(storeKey);
  if (saved && saved.values) {
    const ok = {
      format: formatIds.includes(saved.format) ? saved.format : initial.format,
      layout: layoutById[saved.layout] ? saved.layout : initial.layout,
      values: saved.values || {}, pos: saved.pos || {}, zoom: clamp(Number(saved.zoom) || 1, 1, 3), pan: saved.pan || {},
      textColour: saved.textColour || null
    };
    store.set(Object.assign(ok, { status: 'Restored your work from last time.', dirty: true }));
    const ref = saved.photoRef;
    if (ref && ref.kind === 'sample' && opts.samples) makeSample(ref.id).then(d => { photoData = d; store.set({ photoRef: ref, photoVersion: store.get().photoVersion + 1 }); });
    else if (ref && ref.kind === 'upload') loadPhotoFile(storeKey + ':photo').then(async f => { if (!f) return; try { photoData = await decodeFile(f); store.set({ photoRef: ref, photoVersion: store.get().photoVersion + 1 }); } catch (e) { /* ignore */ } });
  }

  window.addEventListener('beforeunload', e => { if (store.get().dirty) { e.preventDefault(); e.returnValue = ''; } });

  // Text typed or restored before the fonts were ready is checked again once they are.
  async function revalidateText() {
    const S = store.get(), values = Object.assign({}, S.values), notes = Object.assign({}, S.notes);
    let any = false;
    for (const id of Object.keys(values)) {
      const unknown = glyphs.unknown(values[id]);
      if (unknown.length) await glyphs.ensure(unknown);
      const { clean, changed } = sanitise(values[id], glyphs.canDraw);
      if (changed) { values[id] = clean; notes[id] = REMOVED; any = true; }
    }
    if (any) store.set({ values, notes });
  }

  // ---------- fonts ----------
  loadBrandFonts(brand, layouts, opts.assetBase || '').then(r => {
    measure.clear();
    store.set({ fonts: r.ready ? 'ready' : 'failed' });
    if (r.ready) revalidateText();
    if (!r.ready) console.warn('Fonts not ready:', r.problems);
  });

  schedule();
  return { store, brand, layouts, theme, ui, cb, getLast: () => last, setSample: async id => { const d = await makeSample(id); await setPhoto(d, { kind: 'sample', id }, null); }, frame };
}
