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

Last updated at the end of build step 2, slice 2 (committed and uploaded on 21 November 2026).

| Build step | State |
|---|---|
| 1. Studio engine | **Done and committed.** Four layouts, three test brands, 83 browser checks. Accented letters allowed. Client page layout reworked (sticky preview, one status line, pinned download bar). Not tested in Safari or on a real phone. |
| 2. Login and the hub | **Slice 1 (secure core) built and live.** Sign-in, per-brand isolation, brand record and file serving, usage log, and the add-brand tool. **Slice 2 (the hub pages) built and live:** header, hero, Start here, Logos, Colours, Pairings, Typography and Please don't, on a clean white page with the brand's fonts and heading and link colours, drawn by `public/hub/hub.js` with the studio's colour and theme modules. The studio page is the same white. 41 server checks, 95 browser checks. **Slice 3 (the studio served from the signed-in brand) is not started.** |
| 3. Admin that writes brand records | Not started. The add-brand tool is the stand-in until then. |
| 4. Re-enter the old brands | Not started. |
| 5. Layout import from an Illustrator SVG | Not started. |

### Pick it up

1. Read `CLAUDE.md`, then this README, `docs/server.md` and `docs/studio-engine.md`.
2. Everything is committed in git. `git log --oneline` is the history; each change is its own commit so any can be rolled back.
3. Step 2 slices 1 and 2 are live at brands.stmsmedia.co.uk (sign-in and the hub pages). The only brand in the live database is the test brand `northlight`. The studio is not deployed, because it needs the server to supply its brand.

### Run it

Start MariaDB if it is not running (`brew services start mariadb`), then from the project folder:

- **Studio checks:** `php -S 127.0.0.1:8765`, then open `http://127.0.0.1:8765/tests/studio/unit.html` (every line PASS). To look at the studio: `.../tests/studio/harness.html?brand=light-serif` (or `dark-sans`, `edge-midtones`), add `&dev=1` for test photos.
- **Server checks:** `php tests/server/run.php` (every line PASS).
- **Look at the hub by hand:** `php tests/server/run.php --serve` prints a local address for each test brand. Test mode is on there, so no password is asked. Don't run the checks while it is open: they reset the same test database (restart `--serve` afterwards).
- One-off setup for the local database is in `docs/server.md`. `config.test.php` holds the local test database login and is not in git; if it is missing, recreate it from that doc.

### Decisions made along the way (all recorded in `docs/`)

- The hub and studio page are the same clean white for every brand (decided 21 November 2026, replacing the light or dark branded page). The brand shows through its fonts, and headings and links in the first palette colours that read on white (3:1 and 4.5:1). The artwork keeps the brand's full look and corner style. Nothing derivable is stored.
- Accented Latin letters are allowed. Only characters the brand's own font cannot draw, emoji, symbols and other scripts are stripped.
- Export is blocked when: text does not fit, the photo is enlarged beyond 133%, fonts have not loaded, there is no photo, or no allowed text colour reads clearly on the photo.
- The usage log holds brand, event and time only. No visitor address is stored. Wrong-password slowing keeps a keyed hash of the address for up to a day.
- Brands are added by the tool's SQL pasted into phpMyAdmin; passwords are typed at a hidden prompt or generated once, never put on the command line.
- Routing is in one file (`app/routes.php`) behind a single rewrite rule, so it can change if StackCP needs something different.
- The hub page carries the signed-in brand's own record; `public/hub/hub.js` draws the sections from it. The heading and link colours are derived in `theme.js`, never stored. `hub` is a reserved address.

### Open questions and things not yet checked

- **Checked on the real host (21 November 2026):** the `.htaccess` rewrite works, PHP can write to `storage/` (sessions are saved), https redirects work and the session cookie is Secure, HttpOnly and SameSite=Lax. The database is MariaDB 10.11.
- **PHP:** the website was on 7.4.33. Steve switched it to PHP 8.0 in My20i on 21 November 2026 (now 8.0.30; the main stmsmedia.co.uk site still answers).
- **Also checked live:** signing in to a test brand (`northlight`, draft, from `tests/studio/fixtures/light-serif.json`), the usage log records the sign-in, a wrong password is refused, the 6th wrong try in 15 minutes is slowed, a form without its token is refused, and another brand's record is forbidden.
- **Checked by Steve on the live site:** signed-in isolation (signed in to `northlight`, another brand's address shows the sign-in page), and sign-in on iPhone Safari.
- **Not yet tried on the live site:** the full break-it checklist. `northlight` is a test brand: remove it before real clients are added.
- **Draft versus live:** both can sign in. With test mode on (`config.php`), draft brands open without a password, so test brands stay draft. **Switch test mode off before real clients use the site.** Decide what a draft brand means to clients when the admin is built.
- **Never tested:** the studio in Safari and on iPhone (only sign-in has been tried there), Android, touch dragging in the studio, real HEIC photos (only a clear message is shown), the small-screen message.
- **Logos:** real FORMA logos (from Steve's Dropbox) are kept in `storage/brands/forma/logos/` locally (not in git) and on the server in `brands-app/storage/brands/forma/logos/`. Until the admin exists, logo files are uploaded over SSH and listed in the brand record with the add-brand tool. `run.php --serve` copies `storage/brands/` in so they show locally.
- **Hub sections not built yet:** Supporting marks, and the Download all (zip) link. The Artwork studio button is greyed out with "Coming soon" until slice 3.
- `look.hero` in brand records is no longer used (the hub is white for every brand); `look.corners` is used by the artwork only. The admin's Type and look step can drop the hero choice.
- **Not built:** carousel layout, logo files in the studio's wordmark layout, real logo colourways, the admin.
- The STMS palette and the FORMA assets in `design/` are placeholders. The three test brands in `tests/studio/fixtures/` are not real clients.

### Next step

Slice 3: serve the studio from `/<slug>/studio/` using the signed-in brand's record and report exports to `/<slug>/api/log`. Stop after each slice and wait for Steve's go-ahead.

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
4. **Upload, then check.** Stage the committed files (`git archive HEAD app public`) in a scratch folder, set web files to 644 and folders to 755 and app files to 600 there, then send with `rsync -rlpc` (compares contents, keeps those permissions). The Mac's own rsync has no `--chmod` option. Only the approved files go up, then the live page is opened to confirm it works.
5. **Never uploaded:** `config.php`, `config.test.php`, `.git`, `design/`, `tests/`, `docs/`.

Server layout (first deployed 21 November 2026):

```
/home/sites/5b/8/82a71f04d6/
  public_html/brands/   contents of public/ (index.php, .htaccess, hub/, and the studio's colour.js, theme.js and studio.css)
  brands-app/           private, not reachable from the web
    app/
    storage/            sessions and brand files (written by PHP)
    config.php          the local config.live.php, renamed on upload
```

`public/index.php` finds `app/` next to the web folder (on a computer) or in `brands-app/` beside `public_html` (live).

**Permissions:** files on the Mac are owner-only, and rsync copies that, which makes Apache answer 403. Web files must be 644 (folders 755) before they are sent; keep `brands-app/` at 700 and `config.php` at 600.
