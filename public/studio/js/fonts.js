// Loads the brand's fonts and says whether they are ready.
// Export is blocked until this says 'ready', so the preview and the exported
// file always match.

// Weights each font is used at across the offered layouts.
export function weightsNeeded(brand, layouts) {
  const w = { heading: new Set([brand.fonts.heading.weight || 400]), body: new Set([brand.fonts.body.weight || 400]) };
  for (const l of layouts) {
    for (const line of ((l.text && l.text.lines) || [])) {
      const which = line.font === 'body' ? 'body' : 'heading';
      const spec = brand.fonts[which];
      w[which].add(line.weight === 'brand' || line.weight == null ? (spec.weight || 400) : line.weight);
    }
  }
  return w;
}

function googleUrl(family, weights) {
  const fam = encodeURIComponent(family).replace(/%20/g, '+');
  return 'https://fonts.googleapis.com/css2?family=' + fam + ':wght@' + [...weights].sort((a, b) => a - b).join(';') + '&display=swap';
}

function addLink(href) {
  return new Promise(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve(true);
    link.onerror = () => resolve(false);
    document.head.appendChild(link);
  });
}

// assetBase: where uploaded font files are served from.
// Resolves { ready: boolean, problems: string[] }.
export async function loadBrandFonts(brand, layouts, assetBase = '', timeoutMs = 12000) {
  const needed = weightsNeeded(brand, layouts);
  const problems = [];
  const jobs = [];
  const done = new Set();

  for (const which of ['heading', 'body']) {
    const spec = brand.fonts[which];
    const key = spec.family + '|' + spec.source;
    if (spec.source === 'uploaded') {
      for (const file of (spec.files || [])) {
        const face = new FontFace(spec.family, 'url(' + assetBase + file.url + ')', { weight: String(file.weight || 400), style: file.style || 'normal' });
        jobs.push(face.load().then(f => { document.fonts.add(f); }).catch(() => problems.push(spec.family + ' file ' + file.url)));
      }
    } else if (!done.has(key)) {
      done.add(key);
      const all = new Set([...needed[which]]);
      // Heading and body may share a family: ask Google once with every weight.
      const other = which === 'heading' ? 'body' : 'heading';
      if (brand.fonts[other].family === spec.family && brand.fonts[other].source !== 'uploaded') needed[other].forEach(x => all.add(x));
      jobs.push(addLink(googleUrl(spec.family, all)).then(ok => { if (!ok) problems.push(spec.family + ' from Google Fonts'); }));
    }
  }

  const timeout = new Promise(res => setTimeout(() => res('timeout'), timeoutMs));
  const first = await Promise.race([Promise.all(jobs), timeout]);
  if (first === 'timeout') problems.push('Timed out while loading fonts');

  // Confirm every family and weight is really available to the canvas.
  const checks = [];
  for (const which of ['heading', 'body']) {
    for (const wt of needed[which]) {
      checks.push(document.fonts.load(wt + ' 40px "' + brand.fonts[which].family + '"', 'Aa').then(list => {
        if (!list.length) problems.push(brand.fonts[which].family + ' ' + wt);
      }).catch(() => problems.push(brand.fonts[which].family + ' ' + wt)));
    }
  }
  await Promise.race([Promise.all(checks), timeout]);
  return { ready: problems.length === 0, problems };
}
