// The studio's current choices, and recovery after an accidental refresh.
// Text and choices are kept in localStorage; the photo file in IndexedDB.
// Everything is wrapped so the studio still works if the browser blocks storage.

export function createStore(initial) {
  let s = initial;
  const subs = new Set();
  return {
    get: () => s,
    set(patch) { s = Object.assign({}, s, patch); subs.forEach(f => f(s)); },
    subscribe(f) { subs.add(f); return () => subs.delete(f); }
  };
}

// Only these keys are remembered.
const KEEP = ['format', 'layout', 'values', 'pos', 'zoom', 'pan', 'textColour', 'photoRef'];

export function saveState(key, s) {
  try {
    const o = {}; KEEP.forEach(k => { o[k] = s[k]; });
    localStorage.setItem(key, JSON.stringify(o));
  } catch (e) { /* storage blocked: carry on without recovery */ }
}

export function loadState(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

export function clearState(key) {
  try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
}

const DB = 'stms-studio', STORE = 'photos';
function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
  });
}
export async function savePhotoFile(key, file) { try { await tx('readwrite', s => s.put({ blob: file, name: file.name, type: file.type }, key)); } catch (e) { /* ignore */ } }
export async function loadPhotoFile(key) {
  try {
    const rec = await tx('readonly', s => s.get(key));
    return rec ? new File([rec.blob], rec.name || 'photo', { type: rec.type || rec.blob.type }) : null;
  } catch (e) { return null; }
}
export async function clearPhotoFile(key) { try { await tx('readwrite', s => s.delete(key)); } catch (e) { /* ignore */ } }
