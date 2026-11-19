// Builds the list of checks shown to the client and decides whether export is
// blocked. Pure: it only reads the facts it is given.

// facts:
//   fonts: 'loading' | 'ready' | 'failed'
//   hasPhoto, photo: { level: 'ok'|'warn'|'block', pct }
//   text: { hasText, over, kUse }
//   readability: { mode: 'photo'|'panel', chosen: {name, ratio}|null, anyPass, closest, panel: {ok, ratio} }
export function buildChecks(f) {
  const checks = [];
  const add = (id, tone, title, text) => checks.push({ id, tone, title, text });

  if (f.fonts === 'loading') add('fonts', 'block', 'Fonts are still loading', 'Export unlocks when the brand fonts are ready.');
  else if (f.fonts === 'failed') add('fonts', 'block', 'Fonts didn’t load', 'Check your connection and reload the page. Export stays off so the file always matches the preview.');
  else add('fonts', 'ok', 'Brand fonts loaded', 'What you see is what exports.');

  if (f.text.over) add('text', 'block', 'Text doesn’t fit', 'Shorten the text. It is already at its minimum size.');
  else if (f.text.kUse < 1) add('text', f.text.kUse < 0.8 ? 'warn' : 'ok', 'Text shrunk to ' + Math.round(f.text.kUse * 100) + '%', 'It shrinks to fit, down to ' + Math.round(f.text.minScale * 100) + '%.');
  else if (!f.text.hasText) add('text', 'warn', 'No text yet', 'Type something in the fields.');
  else add('text', 'ok', 'Text fits', 'At full size.');

  if (!f.hasPhoto) add('photo', 'block', 'Add a photo', 'Upload one to start.');
  else if (f.photo.level === 'block') add('photo', 'block', 'Photo too low-res', 'Export is blocked. Use a larger photo or zoom out.');
  else if (f.photo.level === 'warn') add('photo', 'warn', 'Photo a little soft', 'Enlarged to ' + f.photo.pct + '% for this crop.');
  else add('photo', 'ok', 'Photo is sharp enough', 'Plenty of pixels for this size.');

  const r = f.readability;
  if (r.mode === 'panel') {
    if (!r.panel.ok) add('read', 'block', 'This layout can’t be used yet', 'The brand has no colour that reads clearly on a solid panel. Tell STMS Media.');
    else add('read', 'ok', 'Text is easy to read', 'It sits on a solid panel.');
  } else if (r.anyPass && r.chosen) {
    add('read', 'ok', 'Text is easy to read', r.chosen.name + ' text reads clearly here (' + r.chosen.ratio.toFixed(1) + ':1).');
  } else if (!f.hasPhoto || !f.text.hasText) {
    add('read', 'ok', 'Text is easy to read', 'Checked once there is a photo and text.');
  } else {
    const c = r.closest ? ' (best is ' + r.closest.ratio.toFixed(1) + ':1)' : '';
    add('read', 'block', 'Text is hard to read here', 'Move the text to a clearer part of the photo, or choose another photo' + c + '.');
  }

  const blocked = checks.some(c => c.tone === 'block');
  return { checks, blocked };
}
