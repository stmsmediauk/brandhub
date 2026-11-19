// The studio's screen: builds the page once, then updates it from a "model".
// Brand text is only ever put in with textContent, never as HTML.
import { zones } from './layout-engine.js';

const SVG = 'http://www.w3.org/2000/svg';

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => { if (c != null) el.append(c); });
  return el;
}

function thumb(layout) {
  const W = 40, H = 50;
  const z = zones(layout, W, H);
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 ' + W + ' ' + H); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'thumb');
  const rect = (r, cls) => { const e = document.createElementNS(SVG, 'rect'); e.setAttribute('x', r.x); e.setAttribute('y', r.y); e.setAttribute('width', r.w); e.setAttribute('height', r.h); e.setAttribute('class', cls); s.append(e); };
  rect(z.photo, 'th-photo');
  if (z.panel) rect(z.panel, 'th-panel');
  const t = layout.text || {};
  const onPanel = t.on === 'panel' && z.panel;
  let x, y;
  if (onPanel) { x = z.panel.x + 4; y = z.panel.y + z.panel.h / 2 - 5; }
  else if (t.movable) { const st = (t.start || { fx: 0.15, fy: 0.5 }); x = st.fx * W + (layout.mark && layout.mark.show ? 6 : 0); y = st.fy * H - 5; }
  else { x = 10; y = H / 2 - 5; }
  if (t.movable && layout.mark && layout.mark.show) { const c = document.createElementNS(SVG, 'circle'); c.setAttribute('cx', x - 3); c.setAttribute('cy', y + 5); c.setAttribute('r', 2.5); c.setAttribute('class', 'th-bar'); s.append(c); }
  [[16, 3.4], [11, 2.2], [8, 2.2]].forEach(([w, hh], i) => rect({ x: t.align === 'center' ? (W - w) / 2 : x, y: y + i * 5, w, h: hh }, onPanel ? 'th-bar-panel' : 'th-bar'));
  return s;
}

// callbacks: onFormat, onLayout, onField, onTextColour, onFile, onSample, onZoom, onResetPhoto,
//            onExport(type), onBlockStart(), onBlockDrag(dx,dy,snap), onBlockEnd(), onBlockNudge(dx,dy),
//            onPanStart(), onPanDrag(dx,dy), onPanEnd()
export function createUI(root, cb, opts) {
  root.textContent = '';

  // ---------- header ----------
  const brandName = h('span', { class: 'brand-name' });
  const header = h('header', { class: 'top' }, h('div', { class: 'top-in' },
    h('div', { class: 'top-id' }, brandName, h('span', { class: 'sub', text: 'Artwork studio' })),
    opts.hubUrl ? h('a', { class: 'btn ghost small', href: opts.hubUrl, text: 'Back to brand hub' }) : null));

  // ---------- left: format tabs, preview, one-line hint ----------
  const formatRow = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Format' });
  const canvas = h('canvas', { class: 'art', 'aria-label': 'Artwork preview' });
  const safeBox = h('div', { class: 'safe', hidden: true });
  const guideV = h('div', { class: 'guide v', hidden: true });
  const guideH = h('div', { class: 'guide h', hidden: true });
  const blockBtn = h('button', { type: 'button', class: 'block', 'aria-label': 'Text block. Drag to move, or use the arrow keys.', hidden: true });
  const prompt = h('div', { class: 'prompt', hidden: true });
  const photoLabel = h('span', { class: 'photo-label' });
  const stage = h('div', { class: 'stage' }, canvas, safeBox, guideV, guideH, blockBtn, prompt, photoLabel);
  const hint = h('p', { class: 'hint' });
  const preview = h('section', { class: 'preview', 'aria-label': 'Preview' }, formatRow, stage, hint);

  // ---------- right: Layout, Text, Photo, download bar ----------
  const layoutRow = h('div', { class: 'layouts' });
  const fieldsBox = h('div', { class: 'col gap12' });
  const swatches = h('div', { class: 'row wrap' });
  const colourNote = h('span', { class: 'note' });
  const colourBox = h('div', { class: 'col gap8', hidden: true }, h('span', { class: 'label', text: 'Text colour' }), swatches, colourNote);

  const upInput = h('input', { id: 'upfile', type: 'file', accept: 'image/*', class: 'vh', on: { change: e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) cb.onFile(f); } } });
  const upMeta = h('span', { class: 'note meta' });
  const libRow = h('div', { class: 'row wrap center-y', hidden: true });
  const sampleLabel = h('span', { class: 'eyebrow', text: 'Test photos (dev only)', hidden: true });
  const sampleRow = h('div', { class: 'row wrap' });
  const zoom = h('input', { id: 'zoom', type: 'range', min: '1', max: '3', step: '0.05', value: '1', on: { input: e => cb.onZoom(parseFloat(e.target.value)) } });
  const zoomLabel = h('span', { class: 'note zl' });

  const sLayout = h('section', { class: 'sec', 'aria-label': 'Layout' }, h('h2', { class: 'sect', text: 'Layout' }), layoutRow);
  const sText = h('section', { class: 'sec', 'aria-label': 'Text' }, h('h2', { class: 'sect', text: 'Text' }), fieldsBox, colourBox);
  const sPhoto = h('section', { class: 'sec', 'aria-label': 'Photo' }, h('h2', { class: 'sect', text: 'Photo' }),
    h('div', { class: 'row wrap center-y' }, h('label', { for: 'upfile', class: 'btn solid', text: 'Upload photo' }), upInput, upMeta),
    libRow, sampleLabel, sampleRow,
    h('div', { class: 'row center-y gap12' }, h('label', { for: 'zoom', class: 'note', text: 'Zoom' }), zoom, zoomLabel,
      h('button', { type: 'button', class: 'link', text: 'Reset photo', on: { click: () => cb.onResetPhoto() } })));

  // The download bar: one status line, then the buttons. Always in view.
  const notice = h('span', { class: 'notice', role: 'status' });
  const statusDot = h('span', { class: 'sdot', 'aria-hidden': 'true' });
  const statusText = h('span', { class: 'stext' });
  const statusLine = h('div', { class: 'statusline', role: 'status', 'aria-live': 'polite' }, statusDot, statusText);
  const btnPng = h('button', { type: 'button', class: 'btn solid big', text: 'Download PNG', on: { click: () => cb.onExport('png') } });
  const btnJpg = h('button', { type: 'button', class: 'btn outline big2', text: 'Smaller JPG', on: { click: () => cb.onExport('jpg') } });
  const bar = h('div', { class: 'bar' }, notice, statusLine, h('div', { class: 'actions' }, btnPng, btnJpg));

  const controls = h('aside', { class: 'controls', 'aria-label': 'Controls' }, sLayout, sText, sPhoto, bar);

  const small = h('p', { class: 'small-note', text: 'The studio works best on a larger screen. Rotate your phone or use a tablet or computer.' });
  root.append(header, small, h('div', { class: 'body' }, preview, controls));

  // ---------- dragging the text block ----------
  let blockDrag = null;
  blockBtn.addEventListener('pointerdown', e => {
    e.stopPropagation();
    try { blockBtn.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    cb.onBlockStart();
    blockDrag = { x: e.clientX, y: e.clientY };
    blockBtn.classList.add('dragging');
  });
  blockBtn.addEventListener('pointermove', e => {
    if (!blockDrag) return;
    const k = canvas.width / canvas.getBoundingClientRect().width;
    cb.onBlockDrag((e.clientX - blockDrag.x) * k, (e.clientY - blockDrag.y) * k, !e.altKey);
  });
  const endBlock = () => { if (!blockDrag) return; blockDrag = null; blockBtn.classList.remove('dragging'); cb.onBlockEnd(); };
  blockBtn.addEventListener('pointerup', endBlock);
  blockBtn.addEventListener('pointercancel', endBlock);
  blockBtn.addEventListener('keydown', e => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const step = (canvas.width / 54) * (e.shiftKey ? 4 : 1);
    cb.onBlockNudge(d[0] * step, d[1] * step);
  });

  // ---------- dragging the photo ----------
  let panDrag = null;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    try { stage.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    if (!cb.onPanStart()) return;
    panDrag = { x: e.clientX, y: e.clientY };
    stage.classList.add('grabbing');
  });
  stage.addEventListener('pointermove', e => {
    if (!panDrag) return;
    const k = canvas.width / canvas.getBoundingClientRect().width;
    cb.onPanDrag((e.clientX - panDrag.x) * k, (e.clientY - panDrag.y) * k);
  });
  const endPan = () => { if (!panDrag) return; panDrag = null; stage.classList.remove('grabbing'); cb.onPanEnd(); };
  stage.addEventListener('pointerup', endPan);
  stage.addEventListener('pointercancel', endPan);

  // ---------- updating ----------
  const sig = {};
  const once = (key, value, fn) => { const s = JSON.stringify(value); if (sig[key] !== s) { sig[key] = s; fn(); } };
  const pct = (v, total) => (v / total * 100) + '%';
  const optBtn = (label, on, fn) => h('button', { type: 'button', class: 'opt' + (on ? ' on' : ''), 'aria-pressed': String(on), text: label, on: { click: fn } });

  function update(m) {
    brandName.textContent = m.brandName;

    once('formats', m.formats, () => { formatRow.textContent = ''; m.formats.forEach(f => formatRow.append(optBtn(f.label, f.on, () => cb.onFormat(f.id)))); });

    once('layouts', m.layouts.map(l => [l.id, l.on]), () => {
      layoutRow.textContent = '';
      m.layouts.forEach(l => layoutRow.append(h('button', { type: 'button', class: 'layout' + (l.on ? ' on' : ''), 'aria-label': l.name, 'aria-pressed': String(l.on), on: { click: () => cb.onLayout(l.id) } }, thumb(l.def), h('span', { class: 'lname', text: l.name }))));
    });

    // Fields are rebuilt only when the layout changes, so typing is never interrupted.
    once('fields', m.fields.map(f => [f.id, f.label, f.max]), () => {
      fieldsBox.textContent = '';
      m.fields.forEach(f => {
        const count = h('span', { class: 'count' });
        const note = h('span', { class: 'note fnote', hidden: true });
        const input = h('input', { id: 'fld-' + f.id, type: 'text', maxlength: String(f.max), autocomplete: 'off', placeholder: f.example || '', 'data-field': f.id, on: { input: e => cb.onField(f.id, e.target.value) } });
        fieldsBox.append(h('div', { class: 'col gap6', 'data-wrap': f.id }, h('label', { for: 'fld-' + f.id, class: 'flabel' }, h('span', { text: f.label }), count), input, note));
      });
    });
    m.fields.forEach(f => {
      const wrap = fieldsBox.querySelector('[data-wrap="' + f.id + '"]');
      if (!wrap) return;
      const input = wrap.querySelector('input');
      if (input.value !== f.value) input.value = f.value;
      wrap.querySelector('.count').textContent = f.value.length + '/' + f.max;
      const note = wrap.querySelector('.note');
      note.textContent = f.note || ''; note.hidden = !f.note;
    });

    // Only shown when the brand offers a real choice for this photo.
    colourBox.hidden = !m.textColours.show;
    once('swatches', m.textColours.options, () => {
      swatches.textContent = '';
      m.textColours.options.forEach(c => {
        const dot = h('span', { class: 'dot', 'aria-hidden': 'true', style: 'background:' + c.hex });
        swatches.append(h('button', { type: 'button', class: 'opt sw' + (c.on ? ' on' : ''), 'aria-pressed': String(c.on), on: { click: () => cb.onTextColour(c.hex) } }, dot, c.name));
      });
    });
    colourNote.textContent = m.textColours.note;

    upMeta.textContent = m.photo.meta;
    libRow.hidden = !m.libraryUrl;
    once('lib', m.libraryUrl || '', () => {
      libRow.textContent = '';
      if (m.libraryUrl) libRow.append(h('a', { class: 'btn outline small', href: m.libraryUrl, target: '_blank', rel: 'noopener', text: 'Open photo library' }), h('span', { class: 'note', text: 'Download a photo there, then upload it here.' }));
    });
    sampleLabel.hidden = !m.photo.samples;
    sampleRow.hidden = !m.photo.samples;
    once('samples', m.photo.samples || [], () => { sampleRow.textContent = ''; (m.photo.samples || []).forEach(s => sampleRow.append(optBtn(s.label, s.on, () => cb.onSample(s.id)))); });
    if (parseFloat(zoom.value) !== m.photo.zoom) zoom.value = String(m.photo.zoom);
    zoomLabel.textContent = Math.round(m.photo.zoom * 100) + '%';
    zoom.disabled = !m.photo.hasPhoto;

    // Download bar
    const sm = m.summary;
    statusLine.className = 'statusline t-' + sm.tone;
    statusDot.textContent = sm.tone === 'ok' ? '✓' : sm.tone === 'warn' ? '!' : '✕';
    statusText.textContent = sm.text;
    notice.textContent = m.notice || ''; notice.hidden = !m.notice;
    btnPng.hidden = !m.export.png; btnJpg.hidden = !m.export.jpg;
    [btnPng, btnJpg].forEach(b => { b.setAttribute('aria-disabled', String(sm.blocked)); b.classList.toggle('disabled', sm.blocked); });

    // Stage
    const s = m.stage;
    stage.style.setProperty('--ar', (s.W / s.H).toFixed(5));
    stage.classList.toggle('canpan', s.canPan);
    hint.textContent = s.hint;
    photoLabel.textContent = s.photoLabel;
    prompt.hidden = !s.noPhoto;
    prompt.textContent = s.noPhoto ? 'Upload a photo to begin' : '';

    safeBox.hidden = !s.safe;
    if (s.safe) {
      safeBox.style.left = pct(s.safe.x0, s.W); safeBox.style.top = pct(s.safe.y0, s.H);
      safeBox.style.width = pct(s.safe.x1 - s.safe.x0, s.W); safeBox.style.height = pct(s.safe.y1 - s.safe.y0, s.H);
      safeBox.classList.toggle('hot', !!s.guide);
    }
    guideV.hidden = !(s.guide && s.guide.v != null); if (!guideV.hidden) guideV.style.left = pct(s.guide.v, s.W);
    guideH.hidden = !(s.guide && s.guide.h != null); if (!guideH.hidden) guideH.style.top = pct(s.guide.h, s.H);

    blockBtn.hidden = !s.block;
    if (s.block) {
      blockBtn.style.left = pct(s.block.left, s.W); blockBtn.style.top = pct(s.block.top, s.H);
      blockBtn.style.width = pct(s.block.w, s.W); blockBtn.style.height = pct(s.block.h, s.H);
      blockBtn.style.setProperty('--outline', s.block.colour);
    }
  }

  // Resizing a canvas clears it, so main.js calls this before it draws.
  function sizeCanvas(W, H) { if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; } }

  return { update, sizeCanvas, canvas, stage };
}
