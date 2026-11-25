// Starts the studio on its real page (/<brand>/studio/). The page says where this
// brand's record, files and layouts are; nothing about a brand is written here.
import { start } from './main.js';
import { logoList, loadLogo, recolour, aspect } from '../../hub/logos.js';
import { derive } from './theme.js';

const app = document.getElementById('app');
const d = app.dataset;
start({ root: app, brandUrl: d.brand, layoutsBase: d.layouts, assetBase: d.files, hubUrl: d.hub, logUrl: d.log, samples: false }).then(async s => {
  if (!s) return;
  // The brand's widest logo in the header, in place of the typed name (as in the hub).
  const logos = logoList(s.brand);
  if (!logos.length) return;
  const svgs = (await Promise.all(logos.map(l => loadLogo(d.files, l.file)))).filter(Boolean);
  const slot = app.querySelector('.brand-name');
  if (!svgs.length || !slot) return;
  const widest = svgs.reduce((b, x) => (aspect(x) > aspect(b) ? x : b), svgs[0]);
  const art = document.importNode(recolour(widest, derive(s.brand).vars.headInk), true);
  art.setAttribute('class', 'brand-logo'); art.setAttribute('role', 'img'); art.setAttribute('aria-label', s.brand.name);
  art.style.aspectRatio = String(aspect(widest));
  slot.replaceChildren(art);
});
