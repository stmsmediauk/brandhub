// Turns the list of checks into the one status line the client sees.
// Pure. The checks themselves (and what blocks export) live in checks.js.

function sentence(c) {
  const title = String(c.title).replace(/[.\s]+$/, '');
  return title + '. ' + c.text;
}

// Returns { tone: 'ok' | 'warn' | 'block', text, blocked }.
export function summarise(checks) {
  const blocks = checks.filter(c => c.tone === 'block');
  const warns = checks.filter(c => c.tone === 'warn');
  if (!blocks.length && !warns.length) return { tone: 'ok', text: 'Ready to download', blocked: false };
  if (blocks.length) {
    const more = blocks.length > 1 ? ' (' + (blocks.length - 1) + ' more to fix)' : '';
    return { tone: 'block', text: sentence(blocks[0]) + more, blocked: true };
  }
  return { tone: 'warn', text: sentence(warns[0]), blocked: false };
}
