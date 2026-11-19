# Studio engine

Plain HTML, CSS and JavaScript (ES modules, no build step). Nothing about a brand is in the code: a brand and its layouts arrive as JSON.

## Files

```
public/studio/
  index.html           the page. Sets where the brand JSON comes from
  studio.css           layout of the page only. Colours and fonts come from the brand
  js/
    main.js            starts the studio and connects everything
    brand-loader.js    the only file that knows where the brand JSON comes from; checks it
    theme.js           page colours and solid-panel colours, worked out from the palette
    colour.js          contrast maths and the 4.5 / 3 rules
    fonts.js           loads the brand fonts and says when they are ready
    geometry.js        formats, safe areas, clamping and snapping
    text-fit.js        cleans typed text (accented letters allowed), applies the brand's case rule
    glyphs.js          asks the browser whether the brand font can really draw a letter
    layout-engine.js   layout JSON + brand + typed text -> where everything goes (a "plan")
    renderer.js        draws a plan on a canvas (used for the preview AND the export)
    photo.js           reading photos, pan and zoom limits, resolution check
    readability.js     which text colours read clearly on the pixels under the text
    checks.js          the checks list, and whether export is blocked
    summary.js         turns the checks into the one status line shown by the download bar
    export.js          PNG and JPG files and file names
    state.js           current choices, and recovery after a refresh
    samples.js         generated test photos (test harness only)
    controls.js        the screen: builds it once, then updates it
public/layouts/        full.json, product.json, details.json, wordmark.json
tests/studio/
  unit.html + tests.js the scripted checks
  harness.html         the real studio, run against a test brand, with sample photos
  fixtures/            three TEST brands (light serif, dark sans, mid-tones edge case)
```

## How a brand gets into the page

`index.html` calls `start({ brandUrl, layoutsBase, ... })`. `brand-loader.js` fetches the brand JSON, refuses it with a plain message if it is incomplete, then fetches each layout the brand opted into from `layoutsBase`. Until login exists, `brandUrl` points at a file that does not exist, so the page shows a message. When login is built (build step 2) `index.html` becomes `index.php` and the address becomes the logged-in brand's own record, read from the database on the server. Only `brand-loader.js` and that one address change.

## The page

Two columns, centred, up to 1200px wide.

- **Left:** format tabs directly above the preview, and one short hint line under it. The preview is sticky: it stays in view while the controls scroll, and is sized to the height of the window.
- **Right:** three compact sections (Layout, Text, Photo), then the download bar.
  - Layout: the thumbnails in one row.
  - Text: the fields the layout declares. The text colour choice appears only when the brand offers more than one colour that reads clearly on the current photo; with one it is used automatically.
  - Photo: upload, the brand's photo library link, zoom and reset.
  - Download bar: stays at the bottom of the controls. It shows one status line, either a green tick with "Ready to download" or a plain sentence saying what to fix (the buttons are greyed out when a problem blocks export). What blocks export has not changed: see `checks.js`.
- **Phone (under 860px wide):** the preview stays fixed at the top, the controls scroll underneath, and the download bar is fixed to the bottom of the screen.
- **Test photos** and the photo name badge are hidden unless the address has `?dev=1` *and* the page allows samples (the test harness does, the client page does not).

The text colour, the dot mark and the artwork itself are drawn by the engine and are unaffected by the page layout.

## Running the tests

From the project folder: `php -S 127.0.0.1:8765`, then open

- `http://127.0.0.1:8765/tests/studio/unit.html`: the scripted checks. Every line should say PASS. They need an internet connection, because the brand fonts come from Google Fonts.
- `http://127.0.0.1:8765/tests/studio/harness.html?brand=light-serif&dev=1` (or `dark-sans`, or `edge-midtones`): the real studio, for the manual break-it checklist. `dev=1` adds the test photos; leave it off to see what a client sees (then use Upload photo).

The page-layout checks (centred, sticky preview, pinned download bar, phone layout) need real window sizes, so they are run by a browser script rather than `unit.html`. Resize the harness window to check them by eye.

The test brands are for testing only. They are not real clients.
