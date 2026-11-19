// Can the brand's fonts draw a character? Accented letters are allowed, but
// only if every font the layouts use can really draw them, so the preview and
// the export never show a missing-letter box or a stand-in font.
//
// The test draws the character in the brand font and again in a font that does
// not exist. If the two pictures are identical, the brand font has no such
// glyph and the browser fell back to its default.
import { needsFontCheck } from './text-fit.js';

const NO_SUCH_FONT = '"stms-no-such-font-zz"';

function picture(font, ch) {
  const c = document.createElement('canvas');
  c.width = 90; c.height = 90;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.font = font;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#000';
  g.fillText(ch, 10, 62);
  return g.getImageData(0, 0, 90, 90).data;
}

function same(a, b) {
  for (let i = 3; i < a.length; i += 4) if (a[i] !== b[i]) return false;
  return true;
}

// true: drawable. false: the font lacks it. null: cannot tell yet (font not loaded).
export async function fontDraws(family, weight, ch) {
  const fam = '"' + String(family).replace(/["\\]/g, '') + '"';
  try {
    // If the font itself is not available we cannot judge anything.
    if (!(await document.fonts.load(weight + ' 48px ' + fam, 'A')).length) return null;
    // Asking for this character loads the part of the font that covers it, if any.
    const faces = await document.fonts.load(weight + ' 48px ' + fam, ch);
    if (!faces.length) return false;
  } catch (e) { return null; }
  const mine = picture(weight + ' 48px ' + fam + ', ' + NO_SUCH_FONT, ch);
  const nothing = picture(weight + ' 48px ' + NO_SUCH_FONT, ch);
  return !same(mine, nothing);
}

// fonts: [{ family, weight }] for every font the studio draws with.
export function createGlyphChecker(fonts) {
  const cache = new Map();   // character -> true | false

  const variants = ch => {
    const set = new Set([ch]);
    [ch.toUpperCase(), ch.toLowerCase()].forEach(v => { if (Array.from(v).length === 1) set.add(v); });
    return [...set];
  };

  return {
    // Characters in the text that have not been checked yet.
    unknown(text) {
      const out = new Set();
      for (const c of Array.from(String(text).normalize('NFC'))) if (needsFontCheck(c) && !cache.has(c)) out.add(c);
      return [...out];
    },
    // Unchecked characters are allowed until they are checked.
    canDraw(ch) { return cache.get(ch) !== false; },
    async ensure(chars) {
      for (const ch of chars) {
        let ok = true, tell = true;
        for (const v of variants(ch)) for (const f of fonts) {
          const r = await fontDraws(f.family, f.weight, v);
          if (r === null) tell = false; else if (r === false) ok = false;
        }
        if (tell) cache.set(ch, ok);
      }
    }
  };
}
