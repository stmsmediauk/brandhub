# Brand hub and artwork studio: spec v3

A platform for giving any client a bespoke-looking brand hub and a studio that makes on-brand social artwork, each set up by Steve in about an hour. FORMA Padel is the pilot.

## Scope and decisions

These points are settled.

- This platform replaces the current brands.stmsmedia.co.uk hub, and each brand is served at brands.stmsmedia.co.uk/<brand>.
- Pilot client: FORMA Padel, used by a few staff. Nothing in the platform is specific to FORMA, so it repeats for any client.
- One shared link per brand, protected by a password checked on the server.
- Output is social posts and adverts. Steve handles print.
- No approval step and no saved designs: generate, download, done.
- A usage log is built in from the start.
- Hosting is Steve's own StackCP plan, which includes PHP and MySQL.
- Each brand ticks which sections it shows: Start here, Logos, Colours, Approved pairings, Typography, Please don't, Supporting marks, Photography and Studio. Voice is out for now.
- One domain for every client: each brand lives at brands.stmsmedia.co.uk/<brand> (for example /forma), behind its own login. A client's own domain can be pointed at the same app later if ever needed. The platform sends no email.

## How a brand is defined

Everything that varies between clients is data, so a new client never needs a platform change. See `data-shapes.md` for the exact shapes.

- **Brand:** name, password, sections shown, theme, palette of 2 to 12 colours (pairings are derived from it), fonts, logos and image library.
- **Formats:** a default set (1:1, 4:5, 9:16, landscape) from which each brand picks what it needs.
- **Layouts:** any number per brand, each declaring its own fields and zones.
- **Zone names:** a standard vocabulary (headline, subhead, details, cta, image slot, logo) plus custom zones when a brand needs them.
- **Export defaults:** PNG, a smaller JPG option, file naming and the carousel limit, all adjustable per brand.
- **Isolation:** each brand's data, files and password are separate from every other brand's.
- **Versioning:** each brand's config is versioned, so platform improvements never break a brand already delivered.
- **Onboarding:** a five-step setup (Basics, Colours, Type and look, Logos, Studio and publish) that the admin screen walks through, so every setup follows the same hour.

Designing each client's layouts in Illustrator remains per-brand work and is the natural thing to price.

## Admin screen and bespoke looks

The target is a new brand's hub live in about an hour. Studio layouts are a separate stage of design work. The test for every admin feature: if it adds setup effort, it has to earn its place. Setup is five steps, and a live preview of the hub appears only on Type and look, where font and style choices need seeing.

**Generated for you**

- Upload one master SVG per logo and every colourway is offered from it, with PNG and SVG files made when someone downloads them.
- Enter the palette once and the approved, headline-only and never pairings are worked out in the background. The admin shows no matrix, only a warning if a colour has no readable text colour.
- The "please don't" examples are generated from the brand's own logo.
- Standard text (which file to use, minimum sizes, never screenshot the logo) comes pre-filled.

**Set per brand**

- Name, tagline, handle, address, client password (Steve passes it on; the platform sends no email), which sections are shown, and which palette colours may be used for text on photos (at least one light and one dark).
- Palette (2 to 12 colours), fonts and type rules, and image library if one is supplied.
- Brand-specific Start here rules, written by Steve.

**Bespoke look per client**

One carefully designed layout serves every client, on a clean white page that is the same for every brand, so the hub stays tidy and nothing has to be designed per client. The brand comes through its heading and body fonts, and two text colours taken from its palette: large headings use the first palette colour that reads at 3:1 on white, links and highlights the first that reads at 4.5:1. The brand's colours, logos and fonts appear as content in their sections. The studio page around the artwork is the same white; the artwork itself keeps the brand's full look, including its corner style. There is no custom CSS field, since Steve does not write CSS. (Decided 21 November 2026, replacing a fully branded hub with a light or dark page and a hero treatment.)

Steve is the only admin for now.

## Client hub

One fixed layout for every client, with the brand supplying its look. Designed in the Design canvas as a white-label shell shown in three test brands.

- **Login:** brands.stmsmedia.co.uk/<brand>, behind a login page that is always STMS Media branded. Once signed in, the client sees only their own brand's hub and studio.
- **Start here:** four rules: use the primary logo first, only the palette colours, only approved pairings, no guest fonts.
- **Logos:** each logo can be previewed on any palette colour. Only colourways that pass the pairing rules are offered, with PNG and SVG downloads.
- **Colours:** the full palette, each colour with HEX, RGB and CMYK values that copy in one click.
- **Which colours go together:** the client picks a background and sees which text colours are safe, which are for big headlines and graphics only, and which to never use. The studio enforces the same rules.
- **Typography, Please don't, Supporting marks:** downloadable fonts, generated misuse examples, and a marks library (handle, quote marks, "Featuring" tag, portrait frame).

## Studio

Clients change content only. Fonts, colours, logo and placement are locked.

**Flow**

1. Choose a format.
2. Fill the fields each layout declares: small line, big line, details, call to action, and a photo. Product layouts also show name, price and features.
3. The tool shows every layout at once with their content and photo.
4. They pick one, move the text block within the safe area, reposition the photo within limits, and export.

**Rules, defined per brand**

- Locked: logo, fonts, palette, safe zones, footer or legal text.
- Pairing rules: which text colours may sit on each background, with a minimum size, and a "never" list. Only valid options are offered.
- Text: a character limit, then shrink to a minimum size, then stop typing.
- Hint notes appear when a client touches a font or colour.
- Full-image layouts get a contrast check on the area under the text. There is no darkening or overlay option. The client chooses one text colour for the whole block from the brand's allowed photo text colours, and the studio only offers the ones that read clearly on the pixels under the text, picking the best match automatically. If none pass, the client is told to move the text or the photo, or choose another photo.
- No filters or colour adjustments on photos. Colourways can be shuffled within the approved set.

**Formats and export**

- Default formats are 1:1 at 1080x1080, 4:5 at 1080x1350, 9:16 at 1080x1920, landscape at 1200x628. Each brand picks the ones it needs.
- Export as PNG for full quality, with a smaller high-quality JPG option for file size.
- Carousels export as a zip of numbered files, up to 10 slides by default.

## Images and failure cases

**Images**

- Clients upload their own photos, or open the brand's Dropbox photo library link and upload from there.
- Resolution is checked on the cropped area. A soft warning means usable but soft, and a hard block means unusable. Full-image layouts have higher thresholds.
- A drag-and-zoom control that can never leave gaps at the edges.
- iPhone HEIC files are converted, large files are downsized in the browser, and photo rotation is respected.

**Failure cases**

- Very long words, odd characters, emoji and stray line breaks are handled by the text rules. Accented Latin letters (Café, Zoë, Ñ) are allowed. Only characters the brand's own font can't draw, such as emoji, symbols and other scripts, are stripped, with a message.
- Export is blocked until fonts are fully loaded, so the preview and the exported file always match.
- A warning on leaving the page, plus browser-side recovery of the current work after an accidental refresh.
- Clear messages for oversized files and small screens.

**Testing and done**

- Current Chrome and Safari on desktop, and phone browsers.
- A break-it checklist (`tests/break-it-checklist.md`) covering long text, awkward images, odd characters and every format, run before FORMA sees it.
- Done means a client's staff member produces each of the brand's layouts unaided with no brand violations. For the pilot, that is a FORMA staff member.
- Font licences are not tracked, because this is a private hub.

## Build order and open questions

**Build order**

1. One config per brand as the single source of truth for colours, pairings, fonts, logos, theme and section toggles, plus the admin screen that writes it.
2. The pilot brand's hub pages (FORMA's), read from that config.
3. The studio with the pilot's layouts, using the same config.
4. Later: import a layout from an Illustrator SVG by its layer names, so new layouts need no hand-coding.

**Still open**

- Layout import is confirmed; build it once two or three brands show how much layout work there is.
- The second client after FORMA is not known yet. Ideally one with a very different look and different content needs, to prove the platform repeats.
- Plan how the brands already on the live hub move into the new platform. Nobody uses the old hub, so this means re-entering them through the new admin when wanted.

## FORMA pilot configuration

This section is configuration for one brand, not part of the platform. Each layout fixes where the text, mark and wordmark sit in every format, so choosing a layout sets the starting text position. On full-image layouts the client can then drag the text block anywhere inside the format's safe area, with light snapping to the edges and centre lines, arrow-key nudging and a reset button. Text alignment is part of each layout's design. Steve designs them in Illustrator: one file per layout, four artboards, identical layer names on each.

| # | Layout | Text position | Notes |
|---|---|---|---|
| 1 | Full-image, left-middle | Small text block with dot mark at left-middle | Matches the cap ads |
| 2 | Full-image, centred | Headline and subline centred, small mark beneath, wordmark near the bottom | Matches the brand ads |
| 3 | Full-image, bottom | Text block at the bottom | New composition |
| 4 | Split with panel | Image plus a solid text panel | For product detail and longer copy |
| 5 | Athlete carousel | Its own layout | Flexible slide count, up to 10 |

Layouts 1 to 3 are likely to collapse into one movable full-image layout, since the client can now place the text where the photo allows. The centred wordmark layout stays separate because its composition is fixed.

**Other FORMA settings**

- Formats: all four defaults (1:1, 4:5, 9:16 and 1200x628 landscape).
- Product fields: name, price and features.
- Carousel: flexible slide count, up to 10.
- Users: a few FORMA staff.
- Export: PNG, plus a smaller high-quality JPG.
