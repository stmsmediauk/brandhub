# Break-it checklist

Run before calling a studio or hub change done. Do it with two very different brands.

## Text
- [ ] Very long headline, very long word, no spaces
- [ ] Accented letters (Café, Zoë, Ñ) are kept; emoji, odd symbols and any letter the brand's font can't draw are stripped with a message
- [ ] Pasted line breaks and tabs
- [ ] Text shrinks to 60%, then typing stops with a clear message
- [ ] Empty fields

## Photos
- [ ] Very small photo (blocked), slightly small (warning), large (fine)
- [ ] Portrait, landscape and square photos in every format
- [ ] iPhone HEIC file, rotated photo, a photo over 40 MB
- [ ] Zoom and drag never reveal an empty edge
- [ ] Bright, dark and busy photos: only readable text colours are offered
- [ ] No allowed text colour passes: the client is told to move the text or change the photo

## Layout and export
- [ ] Every format: 1:1, 4:5, 9:16 (Story keeps clear of the app buttons), landscape
- [ ] Text block can be dragged, snaps, stays inside the safe area, arrow keys nudge it
- [ ] Export is blocked while fonts load, and when text or photo fails
- [ ] Exported PNG and JPG match the preview exactly
- [ ] Refreshing the page warns and recovers the current work

## Login and isolation
Run by script: `php tests/server/run.php` (see docs/server.md). It covers every line here except the two marked by hand.
- [ ] Wrong password, empty password, repeated wrong passwords (slowed down, and the right password is refused during the lock-out)
- [ ] A brand that does not exist gives the same answer, and takes about the same time, as a wrong password for a real one
- [ ] Logged in as brand A, try brand B's address, record, files and download log: all refused, exactly as for a brand that does not exist
- [ ] Direct links to another brand's logo and font files are refused; so are `..`, encoded and doubled `..`, symbolic links, hidden files and non-image files
- [ ] The app's code, config and storage cannot be fetched from the web
- [ ] Signing out ends the session for good; changing a brand's password signs everyone out
- [ ] The session cookie is HttpOnly and SameSite, and Secure everywhere except localhost
- [ ] By hand on the real server: https works, the cookie shows Secure in the browser's developer tools, and a deliberately wrong database password shows only "Something went wrong"

## Studio on its real page
- [ ] `/<brand>/studio/` opens for the signed-in brand only; another brand's studio sends you to its sign-in
- [ ] The Wordmark layout shows the brand's real logo, the Full image layout its real mark, each in the readable text colour
- [ ] A brand without logos still works (typed name, dot mark)
- [ ] Downloads appear in the usage log as export; pressing download while blocked logs blocked_export
- [ ] Uploaded fonts draw at their real weights (no faked bold)
- [ ] Touch: drag the text and the photo on iPhone

## Hub
- [ ] Every brand gets the same clean white page; only the fonts and the heading and link colours change (Northlight: Forest; FORMA: Carbon, because its lime cannot be read on white)
- [ ] A palette of 2 and of 12 colours: the Colours rule reads correctly ("two", "twelve"), and 12 dots still fit on a phone logo card
- [ ] A palette where nothing reads (Sandstone): the hub still loads, Pairings says no colour reads, nothing crashes
- [ ] A brand with its own Start here wording shows it in the intro row, and the standard rules disappear from the sections
- [ ] A section switched off disappears from the page and the header links
- [ ] A CMYK override and a Pantone value show instead of / as well as the calculated values
- [ ] Every Copy button puts exactly the shown value on the clipboard (desktop and iPhone)
- [ ] Picking colours in Pairings works by keyboard, and focus stays on the picked button
- [ ] At phone width nothing scrolls sideways; long brand names and colour names wrap
- [ ] The Artwork studio button is greyed out with "Coming soon" and does nothing
- [ ] An uploaded (non-Google) font downloads only when signed in to that brand
- [ ] Logos: every background offers only colourways at 3:1 or better; a background where nothing stands out says so instead of showing a bad logo
- [ ] Logos: SVG and PNG downloads open correctly in Illustrator / Preview, in the chosen colour, PNG transparent
- [ ] Logos: a logo file containing a script, a style or an outside link shows the shape only, never runs anything
- [ ] A brand with no logos shows no Logos or Please don't section, and its name (not a logo) in the header and hero
- [ ] The header stays at the top while scrolling, on desktop and iPhone; header links land with the section title visible below it
- [ ] Buttons look right in Safari and Chrome, and the greyed Artwork studio button does nothing

## Devices
- [ ] Current Chrome and Safari on desktop
- [ ] iPhone and Android browsers, including touch drag in the studio

## Admin
- [ ] Palette of 2 and of 12 colours
- [ ] A colour with no readable text colour shows the warning
- [ ] Remove a colour that is used for photo text: toggles stay in step
- [ ] Review blocks publishing until required checks pass
