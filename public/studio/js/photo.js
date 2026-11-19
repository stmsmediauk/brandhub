// Photos: reading a file, and where the photo sits inside its rectangle.
// The placement maths is pure. The photo can never leave a gap at an edge,
// because the pan is stored as -1..1 of the room the photo has to move.

export const LIMITS = {
  warnAbove: 1,        // enlargement above 100%: usable but soft
  blockAbove: 1.33,    // enlargement above 133%: unusable
  maxFileBytes: 40 * 1048576,
  workingEdge: 4096    // larger photos are downsized in the browser
};

export class PhotoError extends Error {}

export function clampPan(v) {
  return Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
}

// Where the photo is drawn inside rect {x,y,w,h}.
// photo: { natW, natH } (size of the original, after rotation).
// zoom is 1 or more. pan is { x, y }, each -1..1.
export function placement(photo, rect, zoom, pan) {
  const cover = Math.max(rect.w / photo.natW, rect.h / photo.natH);
  const z = Math.max(1, zoom || 1);
  const scale = cover * z;                  // destination pixels per source pixel
  const dw = photo.natW * scale, dh = photo.natH * scale;
  const maxX = Math.max(0, (dw - rect.w) / 2), maxY = Math.max(0, (dh - rect.h) / 2);
  const px = clampPan(pan ? pan.x : 0), py = clampPan(pan ? pan.y : 0);
  const x = rect.x + (rect.w - dw) / 2 + px * maxX;
  const y = rect.y + (rect.h - dh) / 2 + py * maxY;
  return { scale, dw, dh, maxX, maxY, x, y };
}

// 'ok' | 'warn' | 'block' for an enlargement (1 = native pixels).
export function resolutionLevel(scale, limits = LIMITS) {
  if (scale > limits.blockAbove + 1e-9) return 'block';
  if (scale > limits.warnAbove + 1e-9) return 'warn';
  return 'ok';
}

// Read an uploaded file into a bitmap the studio can draw.
// Resolves to { bitmap, natW, natH, name }.
export async function decodeFile(file) {
  if (file.size > LIMITS.maxFileBytes) throw new PhotoError('That file is over 40 MB. Choose a smaller one.');
  const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e1) {
    try { bmp = await createImageBitmap(file); } catch (e2) {
      throw new PhotoError(heic
        ? 'This browser can’t open iPhone HEIC photos. Open the studio in Safari, or save the photo as a JPG first.'
        : 'Couldn’t read that image. Try a JPG or PNG.');
    }
  }
  return fromBitmap(bmp, file.name);
}

// Wrap a bitmap, downsizing very large ones. natW/natH stay the original size
// so the resolution check is honest.
export async function fromBitmap(bmp, name) {
  const natW = bmp.width, natH = bmp.height;
  if (!natW || !natH) throw new PhotoError('Couldn’t read that image. Try a JPG or PNG.');
  let bitmap = bmp;
  const long = Math.max(natW, natH);
  if (long > LIMITS.workingEdge) {
    const f = LIMITS.workingEdge / long;
    const c = document.createElement('canvas');
    c.width = Math.round(natW * f); c.height = Math.round(natH * f);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, 0, 0, c.width, c.height);
    bitmap = await createImageBitmap(c);
    if (bmp.close) bmp.close();
  }
  return { bitmap, natW, natH, name: name || 'Photo' };
}
