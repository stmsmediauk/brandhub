# Brand and layout data shapes (draft 1)

This defines what a brand and a layout are as data, so a new client never needs a platform change. It matches the prototype exactly.

## The idea

- **Stored:** only the decisions Steve makes in the admin.
- **Derived:** everything else, worked out when needed. Pairings, logo colourways, the hub's heading and link colours, text-colour options on photos and panel colours are never stored, so they can never drift out of step with the palette.
- **Versioned:** every save creates a new numbered version of the brand. A brand already delivered never breaks when the platform improves.

## Brand

One record per brand. Its values come from the five admin steps.

| Field | What it holds | Admin step |
|---|---|---|
| slug | The address, for example forma, so the hub lives at brands.stmsmedia.co.uk/forma | Basics |
| name, tagline, handle | Display text and the social handle (tagline and handle optional, up to 80 characters). The tagline shows beside the name in the hub header | Basics |
| password | One shared password for the whole brand, stored only as a hash | Basics |
| status | draft or live | Studio and publish |
| palette | A list of 2 to 12 colours, each with name and HEX. The order matters: the first colour is the brand's main accent (used in the artwork, for example the price tag), and the hub's heading and link colours are the first colours in this order that read on white (see Derived). CMYK and Pantone overrides per colour, used instead of the calculated values when set: `cmyk` is four numbers from 0 to 100 (`[0, 95, 85, 0]`), `pantone` is text (`"7729 C"`) and adds a Pantone line in the hub | Colours |
| fonts | Heading and body: family, source (Google or uploaded files), plus heading weight, case and letter-spacing. Optional `fallback` (`serif` or `sans-serif`, the default) for the moment before a font loads. Uploaded fonts list their files: `files: [{ url, weight, style }]` | Type and look |
| look | corners (sharp, soft, round or pill), used by the artwork only (price tags and other rounded parts). `hero` is no longer used: the hub is the same white page for every brand | Type and look |
| logos | A list of the brand's logos (up to 12), each `{ "id", "name", "file", "kind", "use" }`: `file` is a plain path to one master SVG in the brand's folder (`logos/primary.svg`), `kind` is `primary`, `secondary` or `mark`, `use` says when to use it. Any brand's set fits: FORMA has a primary logo, two wordmarks and a brand mark. The first primary is the one the Please don't examples are made from | Logos |
| sections | On or off for Start here, Logos, Colours, Pairings, Typography, Please don't, Supporting marks, Photography, Studio. Keys: `start`, `logos`, `colours`, `pairings`, `typography`, `dont`, `marks`, `photography`, `studio`. A section shows unless it is set to `false` | Studio and publish |
| start_here | Optional. The brand's own wording for the Start here rules, written by Steve: a list of 1 to 6 `{ "title", "text" }`. When missing, the standard four rules are shown, with the palette and typeface counts filled in | Studio and publish |
| studio.formats | Which of 1:1, 4:5, 9:16 and landscape are offered | Studio and publish |
| studio.layouts | Which layouts are offered, by layout id | Studio and publish |
| studio.photo_text_colours | Palette colours allowed for text on photos, at least one light and one dark | Studio and publish |
| studio.export | PNG and smaller JPG, file naming, carousel limit | Studio and publish |
| library | A link to the Dropbox folder where the brand's photos live. The studio shows it as an Open photo library button; the client downloads a photo there and uploads it into the studio | Studio and publish |
| version | A number that goes up on every save | automatic |

Example, shortened:

```json
{
  "slug": "stms",
  "name": "STMS Media",
  "status": "draft",
  "palette": [
    { "name": "Magenta", "hex": "#FF00FF" },
    { "name": "Black", "hex": "#0A0A0A" },
    { "name": "White", "hex": "#FFFFFF", "pantone": null }
  ],
  "fonts": {
    "heading": { "family": "Inter", "source": "google", "weight": 700, "case": "lower", "tracking": -0.03 },
    "body": { "family": "Inter", "source": "google" }
  },
  "look": { "corners": "sharp" },
  "logos": [
    { "id": "primary", "name": "Primary logo", "file": "logos/primary.svg", "kind": "primary", "use": "Use it first." },
    { "id": "mark", "name": "Brand mark", "file": "logos/mark.svg", "kind": "mark", "use": "App icons, avatars, favicons." }
  ],
  "sections": { "start": true, "logos": true, "colours": true, "pairings": true, "studio": true },
  "studio": {
    "formats": ["1:1", "4:5", "9:16", "landscape"],
    "layouts": ["full", "product", "wordmark"],
    "photo_text_colours": ["#FFFFFF", "#0A0A0A", "#FF00FF"]
  },
  "library": "https://www.dropbox.com/...",
  "version": 1
}
```

## Derived, never stored

- **Pairing rules:** from the palette. Contrast of at least 4.5:1 is approved for text, 3 to 4.5 is headlines and graphics only, below 3 is never.
- **Logo colourways:** a logo in each palette colour that passes 3:1 on the chosen background (never the background colour itself), clearest first. The master SVG is cleaned in the browser (scripts, styles, event handlers, embedded pages and outside links removed) and every shape is set to the one colour. SVG and PNG downloads (transparent, 2000px on the long side) are made in the browser from it. Logos are recoloured as one colour; a multi-colour original is not offered as it is yet.
- **Please don't examples:** made from the first primary logo: stretched, tilted, in an off-palette colour (the accent turned to the opposite hue), with shadows, on a busy stripe of palette colours, and the brand name retyped in a guest font.
- **CMYK:** calculated from the RGB value unless an override is set.
- **Hub and studio page:** the same clean white page for every brand (white, near-black text, light grey cards and lines, neutral black buttons, fixed corners). These are platform values (`PAGE` in `public/studio/js/theme.js`), not brand data.
- **Heading colour (hub):** the first palette colour, in the brand's order, that reads at 3:1 on white (headings are large, so the headlines rule applies). Used for the hero title, section headings, Start here numbers and rule titles. If no colour reaches 3:1, the page text colour.
- **Logo in the hub header:** the brand's widest logo (a landscape wordmark if there is one), in the heading colour. It is the only logo at the top of the page. Without logos, the brand name is shown in its heading font.
- **Link colour (hub and studio):** the first palette colour that reads at 4.5:1 on white. Used for links, the brand name in the header and other small brand-coloured text. If none does, the page text colour. Both are always real palette colours, never invented tints: FORMA's lime cannot be read on white, so its headings and links use Carbon.
- **Studio text colours:** the allowed photo colours that pass 4.5:1 on the pixels under the text, with the best match chosen automatically. A colour passes when 95% of the pixels under the text reach 4.5:1, so a few stray specks are forgiven but a busy patch is not. The best match is the passing colour with the highest contrast. If none pass, export is blocked and the client is told to move the text or change the photo.
- **Solid panel colours (Product and Details layouts):** the panel is the darkest palette colour, its text is the palette colour that reads best on it, and the price pill uses the accent (or, if the accent would be under 3:1 on the panel, the panel's text colour). If no palette colour reaches 4.5:1 on the panel, those layouts are blocked and the admin should warn.

## Layout

A layout says where things go, never how the brand looks. Colours and fonts always come from the brand. Layouts live with the platform (`public/layouts/<id>.json`) and a brand opts in by id. A brand-specific layout is simply one only that brand switches on.

| Field | What it holds |
|---|---|
| id, name | For example full, Full image |
| fields | The text the client fills in: id, label, character limit `max`, and an `example` shown as the input hint. Text is kept by field id, so it survives switching layouts |
| photo | `fill`: how much of the format the photo covers (1 is all of it). With a panel, the photo sits on the opposite side |
| panel | Optional solid panel: `edge` (top, bottom, left or right) and `size` (share of the format). Its colours are derived, never set |
| text | `on` (photo or panel), `movable`, `align`, `start` (and `start_by_format`), `min_scale`, `max_width` (share of the safe width, and `max_width_by_format`), `pad` and `gap` for panels, `line_gap`, and `lines` |
| text.lines | One entry per line: the `field` it shows (or `source: "brand_name"`), `font` (heading or body), `weight` (`brand` or a number), `size` as a fraction of the format width, `case` and `tracking` (`brand` follows the brand's heading style). A line can be `style: "pill"` (a filled tag, with `pad_x` and `pad_y`) or `pin: "bottom"` / `"top"` (fixed to the safe-area edge, with an optional `offset`) |
| mark | Whether the dot mark shows, its size and its gap, as fractions of the format width |
| by_format | Changes for one format only, for example a side panel instead of a bottom panel on landscape. Can replace `photo`, `panel`, and part of `text` or `mark` |

Example, shortened (see `public/layouts/` for the real ones):

```json
{
  "id": "full",
  "name": "Full image",
  "fields": [
    { "id": "headline", "label": "Headline", "max": 28, "example": "Your headline" }
  ],
  "photo": { "fill": 1 },
  "text": {
    "on": "photo", "movable": true, "align": "left",
    "start": { "fx": 0.15, "fy": 0.5 },
    "start_by_format": { "landscape": { "fx": 0.09, "fy": 0.5 } },
    "min_scale": 0.6, "max_width": 0.62,
    "lines": [
      { "field": "headline", "font": "heading", "weight": "brand", "size": 0.0352, "case": "brand", "tracking": "brand" }
    ]
  },
  "mark": { "show": true, "size": 0.0704, "gap": 0.0333 }
}
```

## Platform rules, not per brand

These are the same for every client. A layout may override them in one place if it needs to.

- **Format sizes:** 1:1 at 1080x1080, 4:5 at 1080x1350, 9:16 at 1080x1920, landscape at 1200x628.
- **Safe area:** a margin of 7.4% of the width on every side, 4% for landscape. Stories also keep the top 13% and bottom 17.7% clear of the app's own buttons. Movable text, text on a panel and pinned lines all stay inside it.
- **Photo checks:** a warning above 100% enlargement and a block above 133%. The photo can never leave a gap at the edges.
- **Text:** shrinks to no less than 60%, then typing is refused (deleting is always allowed). Accented Latin letters are kept. Anything else outside the allowed set (emoji, symbols, other scripts), and any accented letter the brand's font can't draw (checked in the browser against the font itself), is stripped with a message. Line breaks and tabs become spaces.
- **Export is blocked** when text does not fit, the photo is enlarged beyond 133%, fonts have not loaded, there is no photo, or no allowed text colour reads clearly on the photo.

## Where it lives

On Steve's StackCP plan, with PHP and MySQL. See `db/schema.sql`.

- **brands:** one row per brand with the password hash, status and current version.
- **brand_versions:** the full brand record as JSON, one row per saved version. The address (`slug`), `status` and `version` are columns of `brands`, so they are not repeated in the JSON: the site adds them when it sends the record. The record never holds a password.
- **Files:** logos, fonts and library images in `storage/brands/<slug>/`, outside the web folder. They are only ever sent through PHP, after checking that the visitor is signed in to that brand.
- **usage_log:** brand, event (login, export, blocked_export) and time. Nothing else: no visitor address, layout, format or file name. This feeds the Brands screen.
- **login_attempts:** wrong-password tries, only to slow down guessing (5 tries in 15 minutes per visitor per address). It stores the address typed in the URL and a keyed hash of the visitor's address, never the address itself, and rows are removed after a day.
- **Sessions:** PHP sessions kept in `storage/sessions/`. A session belongs to one brand. Changing a brand's password or removing the brand ends its sessions.
- **draft and live:** both can sign in for now. What a draft brand means to clients is decided with the admin screen.

## Decided

- **Passwords:** one shared password per brand.
- **CMYK and Pantone:** optional override fields per colour in the admin, used instead of the calculated CMYK.
- **Font licences:** not tracked, because this is a private hub.
- **Library images:** a Dropbox folder link per brand, opened from the studio. Photos are not pulled in automatically, so the client downloads one and uploads it. Pulling straight from Dropbox would need its API and is a possible later step.
- **Replaces the live hub:** this platform replaces the current brands.stmsmedia.co.uk hub. Nobody uses the old hub.
