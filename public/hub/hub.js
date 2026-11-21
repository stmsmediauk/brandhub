// The client hub. A clean white page for every brand; the brand shows through its
// fonts and its heading and link colours. Draws every section from the brand record.
// All colour decisions come from the studio's colour and theme modules, so the hub
// and the studio can never disagree. Nothing worked out here is stored.
import { contrast, classify, bestOn, lightest, darkest, normaliseHex, rgbString, cmykFor } from '../studio/js/colour.js';
import { derive } from '../studio/js/theme.js';
import { logoList, mainLogo, colourways, recolour, svgText, pngBlob, fileName, download, loadLogo, aspect } from './logos.js';

// ---------------------------------------------------------------- pure helpers (tested)

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const numberWord = n => WORDS[n] || String(n);

// A section shows unless the brand record switches it off.
export const sectionOn = (brand, key) => !(brand.sections && brand.sections[key] === false);

export function sameFamily(brand) {
  return brand.fonts.heading.family === brand.fonts.body.family;
}

// The brand's own Start here wording, when Steve has written it (shown in the intro row).
export function ownRules(brand) {
  return Array.isArray(brand.start_here)
    ? brand.start_here.filter(r => r && typeof r.title === 'string' && r.title.trim() && typeof r.text === 'string').slice(0, 6).map(r => ({ title: r.title, text: r.text }))
    : [];
}

// The standard rules, each shown at the top of the section it is about, so the page
// opens on something visual rather than a block of text. None when the brand has its
// own wording, or Start here is switched off.
export function sectionRules(brand) {
  if (!sectionOn(brand, 'start') || ownRules(brand).length) return {};
  const h = brand.fonts.heading.family, b = brand.fonts.body.family;
  return {
    logos: 'Use the primary logo first. Other versions are for when it doesn’t fit.',
    colours: 'Only these ' + numberWord(brand.palette.length) + ' colours. No near-matches, no new tints.',
    pairings: 'Only approved pairings. If a combination isn’t listed here, the answer is no.',
    typography: (sameFamily(brand) ? h : h + ' and ' + b) + ' only. No guest fonts.'
  };
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
  return { theme, palette, rules: sectionRules(brand), own: ownRules(brand) };
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

// head: { rule, intro }. The rule (when there is one) sits under the title, then a
// short muted line on how to use the section.
function section(id, title, head, ...body) {
  return el('section', { id, class: 'sec', 'aria-labelledby': 'h-' + id },
    el('div', { class: 'sec-head' },
      el('h2', { id: 'h-' + id, class: 'h2' }, title),
      head.rule ? el('p', { class: 'sec-rule' }, head.rule) : null,
      head.intro ? el('p', { class: 'intro' }, head.intro) : null),
    ...body);
}

function studioButton(cls, brand) {
  return el('a', { class: cls, href: '/' + encodeURIComponent(brand.slug || '') + '/studio/' }, 'Open the artwork studio');
}

// The logo for the slim header bar: the widest one the brand has (a landscape
// wordmark if there is one), so it reads at a small height.
export function headerLogoPick(items) {
  const ok = items.filter(i => i.svg);
  if (!ok.length) return null;
  return ok.reduce((best, i) => (aspect(i.svg) > aspect(best.svg) ? i : best), ok[0]);
}

function placeLogo(holder, svg, hex, label, cls) {
  const art = document.importNode(recolour(svg, hex), true);
  art.setAttribute('class', cls); art.setAttribute('role', 'img'); art.setAttribute('aria-label', label);
  art.style.aspectRatio = String(aspect(svg));   // keeps its shape when only the height is set
  holder.replaceChildren(art);
}

// ---------------------------------------------------------------- sections

function heroSection(brand, model) {
  const btns = [];
  if (sectionOn(brand, 'studio')) btns.push(studioButton('btn btn-dark', brand));
  return el('section', { class: 'hero', 'aria-label': 'Welcome' },
    el('div', { class: 'hero-copy' },
      el('span', { class: 'eyebrow hero-eyebrow' }, 'Brand hub'),
      el('h1', { class: 'hero-title' }, 'Everything ' + brand.name + ', in one place.'),
      el('p', { class: 'hero-text' }, 'Logos, colours, fonts and the rules that keep it all consistent.'),
      model.own.length ? el('ol', { class: 'own-rules' }, model.own.map(r => el('li', {}, el('b', {}, r.title), ' ', r.text))) : null),
    btns.length ? el('div', { class: 'hero-btns' }, btns) : null);
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
  return section('colours', 'Colours', { rule: model.rules.colours, intro: 'Tap any value to copy it.' },
    el('div', { class: 'grid grid-4' }, cards));
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
  return section('pairings', 'Which colours go together', { rule: model.rules.pairings, intro: 'Choose the background you’re using to see which text colours are safe on it.' }, box);
}

function typeSection(brand, filesBase, rules) {
  const card = (label, spec, isHead) => el('div', { class: 'card type-card' },
    el('span', { class: 'eyebrow' }, label),
    el('span', { class: 'type-aa' + (isHead ? ' head' : '') }, 'Aa'),
    el('span', { class: 'type-name' }, spec.family + ' ' + weightName(spec.weight || 400)),
    isHead ? el('span', { class: 'type-sample head' }, 'ABCDEFGHIJKLM 0123456789')
           : el('span', { class: 'type-sample' }, 'The quick brown fox jumps over the lazy dog. 0123456789'),
    el('div', { class: 'links' }, fontDownloads(spec, filesBase).map(d =>
      el('a', { class: 'link', href: d.href, download: d.download ? '' : null, target: d.download ? null : '_blank', rel: d.download ? null : 'noopener noreferrer' }, d.label))));
  return section('type', 'Typography', { rule: rules.typography, intro: rules.typography ? '' : (sameFamily(brand) ? 'One typeface.' : 'Two typefaces.') + ' No guest fonts.' },
    el('div', { class: 'grid grid-300' }, card('Headings', brand.fonts.heading, true), card('Body', brand.fonts.body, false)));
}

// ---------------------------------------------------------------- logos

const KIND_LABEL = { primary: 'Primary', secondary: 'Secondary', mark: 'Mark' };

function logoCard(brand, logo, svgPromise) {
  const hexes = brand.palette.map(c => normaliseHex(c.hex));
  const pal = brand.palette.map(c => ({ name: c.name, hex: normaliseHex(c.hex) }));
  const startBg = logo.kind === 'primary' ? hexes[0] : logo.kind === 'mark' ? darkest(hexes) : lightest(hexes);
  const state = { bg: startBg, cw: null, svg: null, failed: false };
  const preview = el('div', { class: 'logo-preview' });
  const controls = el('div', { class: 'logo-controls' });
  const card = el('div', { class: 'card logo-card' }, preview,
    el('div', { class: 'logo-body' },
      el('div', { class: 'logo-head' }, el('span', { class: 'logo-title head' }, logo.name), el('span', { class: 'badge' }, KIND_LABEL[logo.kind])),
      logo.use ? el('span', { class: 'logo-use' }, logo.use) : null,
      controls));

  function draw(focusSel) {
    const bg = pal.find(c => c.hex === state.bg) || pal[0];
    const ways = colourways(bg.hex, brand.palette);
    const cw = ways.find(w => w.hex === state.cw) || ways[0] || null;
    preview.style.background = bg.hex;
    if (state.failed) preview.replaceChildren(el('span', { class: 'small', style: { color: bestOn(bg.hex, hexes) } }, 'This logo could not be loaded.'));
    else if (!state.svg) preview.replaceChildren(el('span', { class: 'small', style: { color: bestOn(bg.hex, hexes) } }, 'Loading…'));
    else if (!cw) preview.replaceChildren();
    else { const art = document.importNode(recolour(state.svg, cw.hex), true); art.setAttribute('class', 'logo-art logo-' + logo.kind); art.setAttribute('role', 'img'); art.setAttribute('aria-label', logo.name + ' in ' + cw.name + ' on ' + bg.name); preview.replaceChildren(art); }

    const dots = el('div', { class: 'dots' }, pal.map(c => {
      const b = el('button', { type: 'button', class: 'dot dot-small', 'aria-label': 'On ' + c.name, title: c.name, 'aria-pressed': c.hex === bg.hex ? 'true' : 'false', 'data-hex': c.hex, style: { background: c.hex } });
      b.addEventListener('click', () => { state.bg = c.hex; state.cw = null; draw('.dot-small[data-hex="' + c.hex + '"]'); });
      return b;
    }));
    const chips = ways.length ? el('div', { class: 'dots' }, ways.map(w => {
      const on = cw && w.hex === cw.hex;
      const b = el('button', { type: 'button', class: 'dot dot-cw', 'aria-label': 'Logo in ' + w.name, title: w.name, 'aria-pressed': on ? 'true' : 'false', 'data-hex': w.hex, style: { background: w.hex } });
      b.addEventListener('click', () => { state.cw = w.hex; draw('.dot-cw[data-hex="' + w.hex + '"]'); });
      return b;
    })) : el('span', { class: 'muted small' }, 'Nothing stands out on ' + bg.name + '. Pick another background.');

    const ready = state.svg && cw;
    const getSvg = () => recolour(state.svg, cw.hex);
    const png = el('button', { type: 'button', class: 'btn btn-dark btn-small', disabled: ready ? null : true, 'aria-label': 'Download ' + logo.name + ' as PNG' }, '↓ PNG');
    const svgBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-small', disabled: ready ? null : true, 'aria-label': 'Download ' + logo.name + ' as SVG' }, '↓ SVG');
    if (ready) {
      png.addEventListener('click', async () => {
        png.textContent = 'Making…';
        try { download(await pngBlob(getSvg()), fileName(brand.slug || brand.name, logo.id, cw.name, 'png')); png.textContent = '↓ PNG'; }
        catch (e) { png.textContent = 'PNG failed'; }
      });
      svgBtn.addEventListener('click', () => download(new Blob([svgText(getSvg())], { type: 'image/svg+xml' }), fileName(brand.slug || brand.name, logo.id, cw.name, 'svg')));
    }

    controls.replaceChildren(
      el('div', { class: 'pick' }, el('span', { class: 'eyebrow' }, 'On'), dots),
      el('div', { class: 'pick' }, el('span', { class: 'eyebrow' }, 'Logo'), chips),
      cw ? el('span', { class: 'combo' }, cw.name + ' on ' + bg.name + ' · ' + cw.ratio.toFixed(1) + ':1') : null,
      el('div', { class: 'links' }, png, svgBtn));
    if (focusSel) { const f = controls.querySelector(focusSel); if (f) f.focus(); }
  }
  draw();
  svgPromise.then(svg => { if (svg) state.svg = svg; else state.failed = true; draw(); });
  return card;
}

function logosSection(brand, logos, loaded, rules) {
  return section('logos', 'Logos', { rule: rules.logos, intro: 'Pick what it’s going on; only colourways that pass the pairing rules are offered.' },
    el('div', { class: 'grid grid-logos' }, logos.map(l => logoCard(brand, l, loaded.get(l.id)))));
}

// A colour that is clearly not in the palette: the accent turned to the opposite hue.
function offPalette(hexes) {
  const [r, g, b] = hexes[0].slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 180 + 360) % 360;
  const sat = 0.85, lig = Math.min(Math.max(l, 0.42), 0.55);
  const c = (1 - Math.abs(2 * lig - 1)) * sat, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = lig - c / 2;
  const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [rr, gg, bb].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function dontSection(brand, logo, svgPromise) {
  const hexes = brand.palette.map(c => normaliseHex(c.hex));
  const plain = lightest(hexes);
  const ink = (colourways(plain, brand.palette)[0] || { hex: darkest(hexes) }).hex;
  const busy = 'repeating-linear-gradient(45deg,' + [0, 1, 2].map(i => hexes[i % hexes.length] + ' ' + (i * 14) + 'px ' + (i * 14 + 14) + 'px').join(',') + ')';
  const items = [
    { title: 'Don’t stretch', text: 'Scale the logo evenly.', bg: plain, colour: ink, style: { transform: 'scaleX(1.5) scaleY(.75)' } },
    { title: 'Don’t tilt', text: 'Keep it level.', bg: plain, colour: ink, style: { transform: 'rotate(-14deg)' } },
    { title: 'Don’t recolour', text: 'Use only the approved logo colours.', bg: plain, colour: offPalette(hexes), style: {} },
    { title: 'Don’t add shadows', text: 'No effects, glows or outlines.', bg: plain, colour: ink, style: { filter: 'drop-shadow(5px 6px 0 rgba(0,0,0,.35)) drop-shadow(0 0 12px rgba(0,0,0,.25))' } },
    { title: 'Don’t use a busy background', text: 'Keep clear space behind it.', bg: busy, colour: lightest(hexes), style: {} },
    { title: 'Don’t use a guest font', text: 'Never retype the logo.', bg: plain, colour: ink, retype: true }
  ];
  const tiles = items.map(d => {
    const box = el('div', { class: 'dont-art', style: { background: d.bg } },
      el('span', { class: 'dont-x', 'aria-hidden': 'true' }, '✕'));
    const holder = el('div', { class: 'dont-logo', style: d.style || {} });
    if (d.retype) holder.append(el('span', { class: 'dont-retype', style: { color: d.colour } }, brand.name));
    box.prepend(holder);
    return { d, holder, tile: el('div', { class: 'dont' }, box, el('span', { class: 'muted small' }, el('b', { class: 'ink' }, d.title), ' · ' + d.text)) };
  });
  svgPromise.then(svg => {
    if (!svg) return;
    for (const t of tiles) if (!t.d.retype) { const art = document.importNode(recolour(svg, t.d.colour), true); art.setAttribute('class', 'logo-art'); art.setAttribute('aria-hidden', 'true'); t.holder.append(art); }
  });
  return section('dont', 'Please don’t', { intro: 'The mistakes we see most. Every one of these is easy to avoid.' },
    el('div', { class: 'grid grid-6' }, tiles.map(t => t.tile)));
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
  const logos = logoList(brand);
  const loaded = new Map(logos.map(l => [l.id, loadLogo(filesBase, l.file)]));
  const main = mainLogo(logos);
  if (logos.length) add('logos', 'logos', 'Logos', () => logosSection(brand, logos, loaded, model.rules));
  add('colours', 'colours', 'Colours', () => coloursSection(brand, model));
  add('pairings', 'pairings', 'Pairings', () => pairingsSection(brand, model));
  add('typography', 'type', 'Type', () => typeSection(brand, filesBase, model.rules));
  if (main) add('dont', 'dont', 'Don’ts', () => dontSection(brand, main, loaded.get(main.id)));

  if (nav) nav.replaceChildren(...links.map(([id, label]) => el('a', { class: 'nl', href: '#' + id }, label)));
  if (actions && sectionOn(brand, 'studio')) actions.prepend(studioButton('btn btn-dark btn-sm header-studio', brand));
  root.replaceChildren(heroSection(brand, model), ...parts);

  // The brand's own logo in the header bar, in place of the typed name, in the
  // brand's heading colour (a palette colour that reads at 3:1 or better on white).
  const ink = model.theme.vars.headInk;
  if (logos.length) Promise.all(logos.map(l => loaded.get(l.id).then(svg => ({ logo: l, svg })))).then(items => {
    const pick = headerLogoPick(items);
    const slot = document.querySelector('.brand-name');
    if (!pick || !slot) return;
    placeLogo(slot, pick.svg, ink, brand.name, 'header-logo-art');
    slot.closest('.brand').classList.add('has-logo');
  });
  return model;
}

function boot() {
  if (typeof document === 'undefined') return;   // imported outside a page (checks)
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
