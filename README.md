# STMS Brand Platform

A white-label brand hub and artwork studio. Each client gets a hub (logos, colours, fonts, rules) and a studio where they make on-brand social and ad artwork by changing content only. Brands are served at `brands.stmsmedia.co.uk/<brand>`, each behind its own password.

This replaces the old brands.stmsmedia.co.uk hub. FORMA Padel is the pilot, but nothing in the platform is specific to FORMA.

## Start here

1. Read `CLAUDE.md` (the working rules).
2. Read `docs/spec.md` (what we are building) and `docs/data-shapes.md` (what a brand and a layout are as data).
3. For the studio read `docs/studio-engine.md`; for sign-in, isolation and the database read `docs/server.md`.
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
| `tools/` | `add-brand.php`: prints SQL for phpMyAdmin to add or update a brand (see `docs/server.md`). |
| `tests/` | The break-it checklist, the studio checks (`tests/studio`) and the server checks (`tests/server`). |

## Where we are (update this at the end of every session)

Last updated at the end of build step 2, slice 1.

| Build step | State |
|---|---|
| 1. Studio engine | **Done and committed.** Four layouts, three test brands, 83 browser checks. Accented letters allowed. Light or dark page is derived from the palette. Client page layout reworked (sticky preview, one status line, pinned download bar). Not tested in Safari or on a real phone. |
| 2. Login and the hub | **Slice 1 (secure core) built.** Sign-in, per-brand isolation, brand record and file serving, usage log, and the add-brand tool, with 35 server checks. **Slice 2 (the hub pages) and slice 3 (the studio served from the signed-in brand) are not started.** |
| 3. Admin that writes brand records | Not started. The add-brand tool is the stand-in until then. |
| 4. Re-enter the old brands | Not started. |
| 5. Layout import from an Illustrator SVG | Not started. |

### Pick it up

1. Read `CLAUDE.md`, then this README, `docs/server.md` and `docs/studio-engine.md`.
2. Everything is committed in git. `git log --oneline` is the history; each change is its own commit so any can be rolled back.
3. Nothing from step 2 is on the live site yet. The studio engine is also not deployed, because the studio needs the server to supply its brand.

### Run it

Start MariaDB if it is not running (`brew services start mariadb`), then from the project folder:

- **Studio checks:** `php -S 127.0.0.1:8765`, then open `http://127.0.0.1:8765/tests/studio/unit.html` (every line PASS). To look at the studio: `.../tests/studio/harness.html?brand=light-serif` (or `dark-sans`, `edge-midtones`), add `&dev=1` for test photos.
- **Server checks:** `php tests/server/run.php` (every line PASS).
- **Sign in by hand:** `php tests/server/run.php --serve` prints a local address and a password for each test brand.
- One-off setup for the local database is in `docs/server.md`. `config.test.php` holds the local test database login and is not in git; if it is missing, recreate it from that doc.

### Decisions made along the way (all recorded in `docs/`)

- The first palette colour is the main accent. Light or dark page is derived from it (pale accent gives a dark page). Nothing derivable is stored.
- Accented Latin letters are allowed. Only characters the brand's own font cannot draw, emoji, symbols and other scripts are stripped.
- Export is blocked when: text does not fit, the photo is enlarged beyond 133%, fonts have not loaded, there is no photo, or no allowed text colour reads clearly on the photo.
- The usage log holds brand, event and time only. No visitor address is stored. Wrong-password slowing keeps a keyed hash of the address for up to a day.
- Brands are added by the tool's SQL pasted into phpMyAdmin; passwords are typed at a hidden prompt or generated once, never put on the command line.
- Routing is in one file (`app/routes.php`) behind a single rewrite rule, so it can change if StackCP needs something different.

### Open questions and things not yet checked

- **On StackCP (Steve is testing):** does the `.htaccess` rewrite work, is `storage/` writable. The host's command line runs PHP 8.0.30 (the website's PHP version is not yet confirmed). The code is written for PHP 7.4+ but has only been run on PHP 8.5.
- **Draft versus live:** both can sign in for now. Decide what a draft brand means to clients when the admin is built.
- **Never tested:** Safari, iPhone and Android, touch dragging in the studio, real HEIC photos (only a clear message is shown), the small-screen message, https and the Secure cookie on the real host.
- **Not built:** carousel layout, logo files in the studio's wordmark layout, real logo colourways, the hub pages, the admin.
- The STMS palette and the FORMA assets in `design/` are placeholders. The three test brands in `tests/studio/fixtures/` are not real clients.

### Next step

Slice 2: the hub pages, built from `design/Main.dc.html` against the test brands. Start with the sections that need no logo files (Start here, Colours, Pairings, Typography), reusing the studio's colour and theme modules so derived values have one source. Then slice 3: serve the studio from `/<slug>/studio/` using the signed-in brand's record and report exports to `/<slug>/api/log`. Stop after each slice and wait for Steve's go-ahead.

## Build order

1. The studio engine as real files (safe areas, text fitting, contrast, photo checks), tested with two very different brands.
2. Login, plus one brand's hub, read from its brand record.
3. The admin that writes brand records.
4. Re-enter the old brands through the new admin if wanted.
5. Later: import layouts from an Illustrator SVG by layer names.

## Deploy

Hosting is Steve's 20i (StackCP) plan, PHP and MySQL. The site is served from `public_html/brands` on that host. `public_html` also holds the rest of stmsmedia.co.uk (portfolio, briefs, planner and more), so **nothing is ever uploaded outside the brands folder**. Nobody uses the old hub (Steve has a backup), so there is no staging site. Git keeps every earlier version.

Uploads go over SSH with rsync. The Mac has an SSH shortcut called `stms20i` (key `~/.ssh/stms_20i`, passphrase in the macOS keychain). FileZilla still works as a fallback.

The agreed upload routine:

1. **Folder lock.** Only the brands folder (and, once agreed, a private folder beside `public_html` for `app/` and `storage/`) is ever written to.
2. **Practice run.** An rsync dry run shows exactly which files would be sent. Steve approves the list.
3. **Backup.** The live copies of those files are copied to a dated folder on the Mac first.
4. **Upload, then check.** Only the approved files go up, then the live page is opened to confirm it works.
5. **Never uploaded:** `config.php`, `config.test.php`, `.git`, `design/`, `tests/`, `docs/`.

Not yet decided: the exact server layout. `app/` and `storage/` should sit outside `public_html` so they cannot be opened in a browser. Propose it before the first deploy.
