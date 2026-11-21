// Works out the page's look, and the colours of solid panels in the artwork, from
// the brand record. Nothing here is stored: it is recalculated every time.
//
// The hub and the studio page are the same clean white page for every brand. The
// brand shows through its fonts and two text colours taken from its palette. The
// artwork itself (panels, price tags, corners) still uses the brand's full look.
import { APPROVED, HEADLINE, contrast, lightest, darkest, bestOn, normaliseHex } from './colour.js';

// The page: the same for every brand (platform values, not brand data).
export const PAGE = {
  bg: '#FFFFFF',
  ink: '#141414',
  muted: '#5C5C5C',
  surface: '#F5F5F4',
  surface2: '#EBEBE9',
  line: '#DEDEDB',
  accent: '#141414',     // filled buttons and selected options
  onAccent: '#FFFFFF',
  r: '8px', r2: '16px', rb: '8px'
};

// Corner vocabulary for the artwork (platform words, not brand data): the price
// tag and other rounded parts of a layout follow the brand's chosen style.
const CORNERS = {
  sharp: { r: 2,  rb: 2 },
  soft:  { r: 8,  rb: 8 },
  round: { r: 14, rb: 14 },
  pill:  { r: 14, rb: 999 }
};

const CASES = { lower: 'lowercase', upper: 'uppercase' };

function cssFamily(f) {
  // Family names come from the brand record, so strip anything that could break out of the quotes.
  const name = String(f.family).replace(/["'\;{}<>]/g, '');
  return `'${name}',${f.fallback === 'serif' ? 'serif' : 'sans-serif'}`;
}

// The first palette colour, in the brand's own order, that reads at `min` on the
// page. Falls back to the page's text colour if none does.
export function firstReadable(hexes, min) {
  return hexes.find(h => contrast(h, PAGE.bg) >= min) || PAGE.ink;
}

export function derive(brand) {
  const hexes = brand.palette.map(c => normaliseHex(c.hex));
  const corners = CORNERS[(brand.look && brand.look.corners)] || CORNERS.soft;
  const heading = brand.fonts.heading, body = brand.fonts.body;

  const vars = Object.assign({}, PAGE, {
    // Large headings: the first palette colour at 3:1 (headlines and graphics).
    headInk: firstReadable(hexes, HEADLINE),
    // Links, numbers and other brand-coloured small text: the first at 4.5:1.
    accentText: firstReadable(hexes, APPROVED),
    head: cssFamily(heading),
    body: cssFamily(body),
    headW: String(heading.weight || 600),
    headTrack: (heading.tracking || 0) + 'em',
    headCase: CASES[heading.case] || 'none',
    mono: 'ui-monospace,SFMono-Regular,Menlo,monospace'
  });

  // Solid panel (product and details layouts): darkest palette colour,
  // with the best-reading palette colour for the text on it.
  const accent = hexes[0];
  const light = lightest(hexes), dark = darkest(hexes);
  const onAccent = bestOn(accent, [light, dark]);
  const panelBg = dark;
  const panelText = bestOn(panelBg, hexes);
  const panelRatio = contrast(panelText, panelBg);
  const accentOnPanel = contrast(accent, panelBg);
  const pill = accentOnPanel >= HEADLINE
    ? { bg: accent, text: onAccent }
    : { bg: panelText, text: panelBg };
  const panel = { bg: panelBg, text: panelText, ratio: panelRatio, ok: panelRatio >= APPROVED, pillBg: pill.bg, pillText: pill.text };

  return { vars, panel, cornerPx: corners };
}
