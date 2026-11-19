# STMS Brand Platform

A white-label brand hub and artwork studio. Each client gets a hub (logos, colours, fonts, rules) and a studio where they make on-brand social and ad artwork by changing content only. Brands are served at `brands.stmsmedia.co.uk/<brand>`, each behind its own password.

This replaces the old brands.stmsmedia.co.uk hub. FORMA Padel is the pilot, but nothing in the platform is specific to FORMA.

## Start here

1. Read `CLAUDE.md` (the working rules).
2. Read `docs/spec.md` (what we are building) and `docs/data-shapes.md` (what a brand and a layout are as data).
3. For the studio, read `docs/studio-engine.md` (file map, and how to run the tests).
4. Open the designs in `design/` for how every screen should look and behave. They are working prototypes, built as a Design canvas: `Main.dc.html` (client hub), `Studio.dc.html`, `Login.dc.html`, `AdminBrands.dc.html`, `AdminSetup.dc.html`. The published canvas is the easiest way to view them: https://claude.ai/artifact/5nK4chgMEtJKkxzSGjnc2r

## Layout

| Folder | What goes in it |
|---|---|
| `docs/` | The spec and data shapes. Update them when a decision changes. |
| `design/` | The prototype screens. Reference only, never deployed. |
| `app/` | PHP code that is not web-facing: brand loading, login, admin logic. |
| `public/` | Everything the web server serves: pages, JS, CSS. |
| `storage/` | Per-brand files (logos, fonts). Not in git. |
| `db/` | `schema.sql` and any migrations. |
| `tests/` | The break-it checklist, and any scripted checks. |

## Build order

1. The studio engine as real files (safe areas, text fitting, contrast, photo checks), tested with two very different brands.
2. Login, plus one brand's hub, read from its brand record.
3. The admin that writes brand records.
4. Re-enter the old brands through the new admin if wanted.
5. Later: import layouts from an Illustrator SVG by layer names.

## Deploy

Hosting is Steve's StackCP plan (PHP and MySQL). Deploy by FileZilla straight to brands.stmsmedia.co.uk. Nobody uses the old hub, so there is no staging site. Git keeps every earlier version. Before an upload, list the changed files (`git status` or `git diff --name-only`) so exactly those are sent.
