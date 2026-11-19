// Works out the page's colours, and the colours of solid panels, from the
// brand's palette. Nothing here is stored: it is recalculated every time.
import { APPROVED, HEADLINE, contrast, mix, lightest, darkest, bestOn, normaliseHex } from './colour.js';

// Corner vocabulary (platform words, not brand data).
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

export function derive(brand) {
  const hexes = brand.palette.map(c => normaliseHex(c.hex));
  const light = lightest(hexes), dark = darkest(hexes);
  const darkTheme = brand.look && brand.look.theme === 'dark';
  const bg = darkTheme ? dark : light;
  const ink = darkTheme ? light : dark;
  const accent = hexes[0];
  const onAccent = bestOn(accent, [light, dark]);

  // Muted text moves towards the background only as far as it stays readable.
  let muted = mix(ink, bg, 0.35);
  for (let t = 0.35; contrast(muted, bg) < APPROVED && t > 0; t -= 0.05) muted = mix(ink, bg, Math.max(t, 0));

  const corners = CORNERS[(brand.look && brand.look.corners)] || CORNERS.soft;
  const heading = brand.fonts.heading, body = brand.fonts.body;

  const vars = {
    bg, ink, accent, onAccent, muted,
    surface: mix(bg, ink, 0.05),
    surface2: mix(bg, ink, 0.1),
    line: mix(bg, ink, 0.18),
    r: corners.r + 'px',
    rb: corners.rb + 'px',
    head: cssFamily(heading),
    body: cssFamily(body),
    headW: String(heading.weight || 600),
    headTrack: (heading.tracking || 0) + 'em',
    headCase: CASES[heading.case] || 'none'
  };

  // Solid panel (product and details layouts): darkest palette colour,
  // with the best-reading palette colour for the text on it.
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
