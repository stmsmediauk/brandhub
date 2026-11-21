// The client hub. A clean white page for every brand; the brand shows through its
// fonts and its heading and link colours. Draws every section from the brand record.
// All colour decisions come from the studio's colour and theme modules, so the hub
// and the studio can never disagree. Nothing worked out here is stored.
import { contrast, classify, bestOn, lightest, darkest, normaliseHex, rgbString, cmykFor } from '../studio/js/colour.js';
import { derive } from '../studio/js/theme.js';

// ---------------------------------------------------------------- pure helpers (tested)

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const numberWord = n => WORDS[n] || String(n);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// A section shows unless the brand record switches it off.
export const sectionOn = (brand, key) => !(brand.sections && brand.sections[key] === false);

export function sameFamily(brand) {
  return brand.fonts.heading.family === brand.fonts.body.family;
}

// The brand's own Start here wording when Steve has written it, otherwise the standard four.
export function startRules(brand) {
  const own = Array.isArray(brand.start_here)
    ? brand.start_here.filter(r => r && typeof r.title === 'string' && r.title.trim() && typeof r.text === 'string')
    : [];
  if (own.length) return own.slice(0, 6).map(r => ({ title: r.title, text: r.text }));
  const n = brand.palette.length;
  return [
    { title: 'Use the primary logo first', text: 'Reach for the primary logo before anything else. Other versions are for when it genuinely doesn’t fit.' },
    { title: 'Only the ' + numberWord(n) + ' palette colours', text: 'Every colour you use comes from the palette. No near-matches, no new tints.' },
    { title: 'Only approved pairings', text: 'If a text and background combination isn’t on the list, the answer is no.' },
    { title: 'No guest fonts', text: (sameFamily(brand) ? 'One typeface, supplied here.' : 'Two typefaces, supplied here.') + ' Nothing else, however similar it looks.' }
  ];
}

// Which palette colours may sit on a background: the same rules as the studio.
export function pairingsFor(bgHex, palette) {
  const others = palette
    .filter(c => normaliseHex(c.hex) !== normaliseHex(bgHex))
    .map(c => ({ name: c.name, hex: normaliseHex(c.hex), ratio: contrast(bgHex, c.hex) }))
    .sort((a, b) => b.ratio - a.ratio);
  return {
    ok: others.filter(o => classify(o.ratio) === 'approved'),
    large: others.filter(o => classify(o.ratio) === 'headline'),
    never: others.filter(o => classify(o.ratio) === 'never')
  };
}

const WEIGHTS = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
export const weightName = w => WEIGHTS[w] || String(w);

// Where to get a font. Google fonts link to their Google Fonts page; uploaded fonts
// download from the brand's own files (served only to someone signed in to the brand).
export function fontDownloads(spec, filesBase) {
  if (spec.source === 'uploaded') {
    const files = Array.isArray(spec.files) ? spec.files.filter(f => f && typeof f.url === 'string') : [];
    return files.map(f => ({
      label: files.length > 1 ? 'Download ' + weightName(f.weight || 400) + (f.style === 'italic' ? ' italic' : '') : 'Download font',
      href: filesBase + f.url.split('/').map(encodeURIComponent).join('/'),
      download: true
    }));
  }
  return [{ label: 'Get it from Google Fonts', href: 'https://fonts.google.com/specimen/' + encodeURIComponent(spec.family).replace(/%20/g, '+'), download: false }];
}

// Everything the page shows, worked out from the record. No page access.
export function hubModel(brand) {
  const theme = derive(brand);
  const hexes = brand.palette.map(c => normaliseHex(c.hex));
  const light = lightest(hexes), dark = darkest(hexes);
  const palette = brand.palette.map(c => {
    const hex = normaliseHex(c.hex);
    const values = [['HEX', hex], ['RGB', rgbString(hex)], ['CMYK', cmykFor(c).join(', ')]];
    if (typeof c.pantone === 'string' && c.pantone.trim()) values.push(['Pantone', c.pantone.trim()]);
    return { name: c.name, hex, ink: bestOn(hex, [light, dark]), values };
  });
  return { theme, palette, rules: startRules(brand) };
}

// ---------------------------------------------------------------- page helpers

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(typeof k === 'string' ? document.createTextNode(k) : k);
  return e;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
  const t = el('textarea', { 'aria-hidden': 'true', style: { position: 'fixed', top: '-1000px', opacity: '0' } });
  t.value = text; document.body.append(t); t.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  t.remove(); return ok;
}

function sectionHead(id, title, intro) {
  return el('div', { class: 'sec-head' }, el('h2', { id: 'h-' + id, class: 'h2' }, title), intro ? el('p', { class: 'intro' }, intro) : null);
}

function section(id, title, intro, ...body) {
  return el('section', { id, class: 'sec', 'aria-labelledby': 'h-' + id }, sectionHead(id, title, intro), ...body);
}

function studioButton(cls) {
  return el('span', { class: cls + ' is-off', role: 'link', 'aria-disabled': 'true', title: 'The artwork studio is coming soon' },
    'Artwork studio', el('span', { class: 'soon' }, 'Coming soon'));
}

// ---------------------------------------------------------------- sections

function heroSection(brand, model) {
  const btns = [];
  if (sectionOn(brand, 'studio')) btns.push(studioButton('btn hero-btn'));
  if (sectionOn(brand, 'start')) btns.push(el('a', { class: 'btn hero-ghost', href: '#start' }, (model.rules.length === 1 ? 'Read the rule' : 'Read the ' + numberWord(model.rules.length) + ' rules')));
  return el('section', { class: 'hero', 'aria-label': 'Welcome' },
    el('span', { class: 'eyebrow hero-eyebrow' }, 'Brand hub'),
    el('h1', { class: 'hero-title' }, 'Everything ' + brand.name + ', in one place.'),
    el('p', { class: 'hero-text' }, 'Logos, colours, fonts and the rules that keep it all consistent. Download what you need, or make new artwork that is always on brand.'),
    btns.length ? el('div', { class: 'hero-btns' }, btns) : null);
}

function startSection(brand, model) {
  const n = model.rules.length;
  return section('start', 'Start here', cap(numberWord(n)) + (n === 1 ? ' rule covers almost everything. Follow it' : ' rules cover almost everything. Follow them') + ' and your work will look like ' + brand.name + '.',
    el('div', { class: 'rules' }, model.rules.map((r, i) =>
      el('div', { class: 'rule' },
        el('div', { class: 'rule-head' }, el('span', { class: 'rule-n' }, String(i + 1)), el('span', { class: 'rule-title head' }, r.title)),
        el('span', { class: 'rule-text' }, r.text)))));
}

function coloursSection(brand, model) {
  const cards = model.palette.map(c => {
    const flash = (btn, label) => async () => {
      const ok = await copyText(label.value);
      const tag = btn.querySelector('.copy-tag');
      if (tag) { tag.textContent = ok ? 'Copied' : 'Couldn’t copy'; tag.classList.toggle('on', ok); }
      clearTimeout(btn._t); btn._t = setTimeout(() => { if (tag) { tag.textContent = 'Copy'; tag.classList.remove('on'); } }, 1600);
    };
    const rows = c.values.map(([label, value]) => {
      const b = el('button', { type: 'button', class: 'val', 'aria-label': 'Copy ' + c.name + ' ' + label + ' ' + value },
        el('span', { class: 'val-main' }, el('span', { class: 'val-label' }, label), el('span', { class: 'val-value' }, value)),
        el('span', { class: 'copy-tag', 'aria-hidden': 'true' }, 'Copy'));
      b.addEventListener('click', flash(b, { value }));
      return b;
    });
    const sw = el('button', { type: 'button', class: 'swatch head', 'aria-label': 'Copy ' + c.name + ' HEX ' + c.hex, style: { background: c.hex, color: c.ink } },
      el('span', {}, c.name), el('span', { class: 'swatch-hex' }, c.hex));
    sw.addEventListener('click', () => rows[0].click());
    return el('div', { class: 'card colour' }, sw, el('div', { class: 'vals' }, rows));
  });
  const n = model.palette.length;
  return section('colours', 'Colours', cap(numberWord(n)) + ' colours. Nothing outside this palette. Click any value to copy it.',
    el('div', { class: 'grid grid-250' }, cards));
}

function pairingsSection(brand, model) {
  const box = el('div', { class: 'pair-body' });
  const state = { bg: model.palette[0].hex, text: null };
  const dot = (c, on, big) => el('button', {
    type: 'button', class: 'dot' + (big ? ' dot-big' : ''), 'aria-label': c.name, 'aria-pressed': on ? 'true' : 'false', 'data-hex': c.hex, style: { background: c.hex }
  });
  const chip = (o, on) => el('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', 'data-hex': o.hex },
    el('span', { class: 'chip-dot', 'aria-hidden': 'true', style: { background: o.hex } }), o.name);

  // Redrawing replaces the buttons, so put keyboard focus back on the one just picked.
  const refocus = (sel, hex) => { const b = box.querySelector(sel + '[data-hex="' + hex + '"]'); if (b) b.focus(); };

  function draw() {
    const bg = model.palette.find(c => c.hex === state.bg) || model.palette[0];
    const p = pairingsFor(bg.hex, brand.palette);
    const usable = [...p.ok, ...p.large];
    const sel = usable.find(o => o.hex === state.text) || usable[0] || null;

    const bgs = el('div', { class: 'dots' }, model.palette.map(c => {
      const b = dot(c, c.hex === bg.hex, true);
      b.addEventListener('click', () => { state.bg = c.hex; state.text = null; draw(); refocus('.dot', c.hex); });
      return b;
    }));
    const pickRow = list => el('div', { class: 'chips' }, list.map(o => {
      const b = chip(o, sel && o.hex === sel.hex);
      b.addEventListener('click', () => { state.text = o.hex; draw(); refocus('.chip', o.hex); });
      return b;
    }));

    let sample;
    if (sel) {
      const bodyOk = classify(sel.ratio) === 'approved';
      sample = el('div', { class: 'pair-sample', style: { background: bg.hex, color: sel.hex } },
        el('span', { class: 'pair-headline head' }, 'Headline in ' + sel.name),
        bodyOk ? el('span', { class: 'pair-copy' }, 'This is how body text looks in ' + sel.name + ' on ' + bg.name + '.')
               : el('span', { class: 'pair-copy small' }, 'Too faint for small text. Use it for big headlines and graphics only.'));
    } else {
      sample = el('div', { class: 'pair-sample', style: { background: bg.hex, color: bestOn(bg.hex, brand.palette.map(c => c.hex)) } },
        el('span', { class: 'pair-copy' }, 'No palette colour reads clearly on ' + bg.name + '. Use it for shapes and backgrounds, never behind text.'));
    }

    const groups = el('div', { class: 'pair-groups' },
      el('div', { class: 'group' }, el('span', { class: 'eyebrow' }, '2. Use these for text'),
        p.ok.length ? pickRow(p.ok) : el('span', { class: 'muted small' }, 'Nothing reads well enough for body text on ' + bg.name + '.')),
      p.large.length ? el('div', { class: 'group' }, el('span', { class: 'eyebrow' }, 'Big headlines and graphics only'), pickRow(p.large)) : null,
      p.never.length ? el('div', { class: 'group' }, el('span', { class: 'eyebrow' }, 'Never use'),
        el('div', { class: 'nevers' }, p.never.map(o => el('span', { class: 'never' }, el('span', { class: 'chip-dot', 'aria-hidden': 'true', style: { background: o.hex } }), o.name)))) : null);

    box.replaceChildren(
      el('div', { class: 'group' }, el('span', { class: 'eyebrow' }, '1. Pick a background'), bgs),
      el('div', { class: 'grid grid-300 pair-grid' }, sample, groups));
  }
  draw();
  return section('pairings', 'Which colours go together', 'Choose the background you’re using. We’ll show you which text colours are safe on it.', box);
}

function typeSection(brand, filesBase) {
  const card = (label, spec, isHead) => el('div', { class: 'card type-card' },
    el('span', { class: 'eyebrow' }, label),
    el('span', { class: 'type-aa' + (isHead ? ' head' : '') }, 'Aa'),
    el('span', { class: 'type-name' }, spec.family + ' ' + weightName(spec.weight || 400)),
    isHead ? el('span', { class: 'type-sample head' }, 'ABCDEFGHIJKLM 0123456789')
           : el('span', { class: 'type-sample' }, 'The quick brown fox jumps over the lazy dog. 0123456789'),
    el('div', { class: 'links' }, fontDownloads(spec, filesBase).map(d =>
      el('a', { class: 'link', href: d.href, download: d.download ? '' : null, target: d.download ? null : '_blank', rel: d.download ? null : 'noopener noreferrer' }, d.label))));
  return section('type', 'Typography', (sameFamily(brand) ? 'One typeface.' : 'Two typefaces.') + ' No guest fonts.',
    el('div', { class: 'grid grid-300' }, card('Headings', brand.fonts.heading, true), card('Body', brand.fonts.body, false)));
}

// ---------------------------------------------------------------- fonts

function loadFonts(brand, filesBase) {
  const google = new Map();
  const want = (spec, ws) => {
    if (spec.source === 'uploaded') {
      for (const f of (spec.files || [])) {
        if (!f || typeof f.url !== 'string') continue;
        const face = new FontFace(spec.family, 'url(' + filesBase + f.url.split('/').map(encodeURIComponent).join('/') + ')', { weight: String(f.weight || 400), style: f.style || 'normal' });
        face.load().then(x => document.fonts.add(x)).catch(() => {});
      }
      return;
    }
    const s = google.get(spec.family) || new Set();
    ws.forEach(w => s.add(w)); google.set(spec.family, s);
  };
  want(brand.fonts.heading, [brand.fonts.heading.weight || 600]);
  want(brand.fonts.body, [400, 500, 600]);
  // One request per weight: a weight a family does not have then fails on its own.
  for (const [family, ws] of google) for (const w of ws) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g, '+') + ':wght@' + w + '&display=swap';
    document.head.append(link);
  }
}

// ---------------------------------------------------------------- start

export function renderHub({ root, nav, actions, brand, filesBase }) {
  const model = hubModel(brand);
  for (const [k, v] of Object.entries(model.theme.vars)) document.documentElement.style.setProperty('--' + k, v);
  loadFonts(brand, filesBase);

  const parts = [];
  const links = [];
  const add = (key, id, label, make) => { if (sectionOn(brand, key)) { parts.push(make()); links.push([id, label]); } };
  add('start', 'start', 'Start here', () => startSection(brand, model));
  add('colours', 'colours', 'Colours', () => coloursSection(brand, model));
  add('pairings', 'pairings', 'Pairings', () => pairingsSection(brand, model));
  add('typography', 'type', 'Type', () => typeSection(brand, filesBase));

  if (nav) nav.replaceChildren(...links.map(([id, label]) => el('a', { class: 'nl', href: '#' + id }, label)));
  if (actions && sectionOn(brand, 'studio')) actions.prepend(studioButton('btn btn-accent'));
  root.replaceChildren(heroSection(brand, model), ...parts);
  return model;
}

function boot() {
  const root = document.getElementById('hub');
  const data = document.getElementById('brand-data');
  if (!root || !data) return;
  try {
    const brand = JSON.parse(data.textContent);
    renderHub({ root, nav: document.getElementById('hub-nav'), actions: document.getElementById('hub-actions'), brand, filesBase: root.dataset.files || '' });
  } catch (e) {
    root.replaceChildren(el('p', { class: 'intro' }, 'Something went wrong showing your brand hub. Please refresh the page. If it keeps happening, contact STMS Media.'));
    console.error(e);
  }
  document.body.classList.remove('hub-loading');
}
boot();
