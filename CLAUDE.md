# Working rules for this project

## What this is
A white-label brand hub and artwork studio for STMS Media clients. Read `README.md`, `docs/spec.md` and `docs/data-shapes.md` before changing anything. The screens in `design/` are the approved visual and behavioural reference.

## How to work with Steve
- Steve prefers to discuss and agree an idea before anything is built. Propose first, build once he agrees.
- Steve builds in VS Code and deploys with FileZilla. He does not write CSS. Keep instructions plain and give exact file lists for uploads.
- Say plainly when something has not been tested. Never claim it works unless it was run.

## Stack and limits
- PHP and MySQL on StackCP. No build step, no Node in production, no framework unless agreed.
- Plain HTML, CSS and JavaScript in the browser. Fonts load from Google Fonts or the brand's own uploaded files.
- Images are processed in the browser where possible.

## Rules that must never be broken
1. **Brand data is data.** Nothing about a specific client (colours, fonts, names, layouts) is written into code. A new client must never need a code change.
2. **Derived values are never stored.** Pairings, logo colourways, surface tones, text-colour options and the hero fallback are always calculated from the palette. Store only what Steve decides in the admin.
3. **Isolation.** A logged-in client can reach only their own brand's pages and files, enforced on the server. Never rely on the browser to hide another brand.
4. **Passwords** are stored only as hashes (`password_hash`) and checked on the server. One shared password per brand. The platform sends no email.
5. **Contrast rules (WCAG ratios):** at least 4.5 is approved for text, 3 to 4.5 is headlines and graphics only, below 3 is never. The studio offers only options that pass.
6. **The studio never lets a client break the brand:** fonts, colours, logo and safe areas are locked. No filters, no overlays or darkening, no gaps at photo edges.
7. **Export is blocked** when text does not fit, the photo is enlarged beyond 133%, or fonts have not loaded.
8. **Every change is tested against two very different brands** (for example a light serif brand and a dark sans brand) before it is called done.
9. **Secrets** (database login, salts) live in `config.php`, which is never committed. Keep `config.example.php` up to date instead.
10. **Brand config is versioned.** Saving creates a new version, so improvements never break a delivered brand.

## Decisions already made
- One domain, a path per brand: `brands.stmsmedia.co.uk/<brand>`. The login page is always STMS Media branded.
- One fixed, well-designed hub layout. The brand supplies the look: palette (2 to 12 colours), fonts, logos, corner style, hero treatment.
- Admin is five steps: Basics, Colours, Type and look, Logos, Studio and publish. A live preview appears only on Type and look. There is no pairing matrix screen.
- CMYK is calculated from RGB, with optional CMYK and Pantone overrides per colour.
- Photo library is a Dropbox folder link per brand, shown as an Open photo library button in the studio. No Dropbox API for now.
- Font licences are not tracked (private hub).
- Studio: one text colour for the whole block, chosen from the brand's allowed photo text colours, only those that read clearly on the pixels under the text. Text block is draggable within the safe area; the photo can be dragged and zoomed without leaving gaps.
- Layout import from an Illustrator SVG is a later step.

## Placeholders
The STMS palette (eight example colours) and the FORMA assets in the designs are placeholders. Do not treat them as final.

## Before saying a task is done
- Run it. Open the page in a browser and try it, including the failure cases in `tests/break-it-checklist.md`.
- List the files that changed, ready for upload.
- Update `docs/` if a decision changed.
- Update the "Where we are" section of `README.md` (state, how to run, open questions, next step) so the next session can pick up from it.
