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

## Running the tests

From the project folder: `php -S 127.0.0.1:8765`, then open

- `http://127.0.0.1:8765/tests/studio/unit.html`: the scripted checks. Every line should say PASS. They need an internet connection, because the brand fonts come from Google Fonts.
- `http://127.0.0.1:8765/tests/studio/harness.html?brand=light-serif` (or `dark-sans`, or `edge-midtones`): the real studio with sample photos, for the manual break-it checklist.

The test brands are for testing only. They are not real clients.
