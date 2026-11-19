// Cleaning typed text. Pure functions.
// The measuring and shrinking itself lives in layout-engine.js, which uses the
// layout's own rules.

// Allowed characters. Everything else (emoji, accents, symbols) is removed.
const NOT_ALLOWED = /[^A-Za-z0-9 .,!?&'’\/:%+\-@#()£$€]/g;

// Returns { clean, changed } where changed says whether anything was removed.
export function sanitise(raw) {
  const flat = String(raw).replace(/[\r\n\t\u2028\u2029]+/g, ' ');
  const clean = flat.replace(NOT_ALLOWED, '');
  // Line breaks and tabs become spaces quietly. Only removed characters are reported.
  return { clean, changed: clean !== flat };
}

// Apply the brand's case rule to a string before measuring and drawing it.
export function applyCase(text, mode) {
  if (mode === 'upper') return text.toUpperCase();
  if (mode === 'lower') return text.toLowerCase();
  return text;
}
