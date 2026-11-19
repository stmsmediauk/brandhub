// Cleaning typed text. Pure functions.
// The measuring and shrinking itself lives in layout-engine.js, which uses the
// layout's own rules.

// Plain characters always allowed.
const PLAIN = /[A-Za-z0-9 .,!?&'’\/:%+\-@#()£$€]/;
// Accented Latin letters (Latin-1 Supplement and Latin Extended-A: Café, Zoë, Ñ, Ł...).
// Multiplication and division signs sit in this block but are not letters.
const ACCENTED = /[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F]/;

export function isAllowedChar(c) {
  return PLAIN.test(c) || ACCENTED.test(c);
}

// Characters outside plain ASCII need checking against the brand's font,
// because a font may not draw every accented letter or symbol.
export function needsFontCheck(c) {
  return c.charCodeAt(0) > 127;
}

// canDraw(char) says whether the brand's font can draw a character. It is only
// asked about non-ASCII characters. Returns { clean, changed } where changed
// says whether anything was removed.
export function sanitise(raw, canDraw = () => true) {
  // Composed letters, so "e" + accent pasted from some apps becomes one é.
  const flat = String(raw).normalize('NFC').replace(/[\r\n\t\u2028\u2029]+/g, ' ');
  let clean = '';
  for (const c of Array.from(flat)) {
    if (!isAllowedChar(c)) continue;
    if (needsFontCheck(c) && !canDraw(c)) continue;
    clean += c;
  }
  // Line breaks and tabs become spaces quietly. Only removed characters are reported.
  return { clean, changed: clean !== flat };
}

// Apply the brand's case rule to a string before measuring and drawing it.
export function applyCase(text, mode) {
  if (mode === 'upper') return text.toUpperCase();
  if (mode === 'lower') return text.toLowerCase();
  return text;
}
