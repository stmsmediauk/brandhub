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

## Devices
- [ ] Current Chrome and Safari on desktop
- [ ] iPhone and Android browsers, including touch drag in the studio

## Admin
- [ ] Palette of 2 and of 12 colours
- [ ] A colour with no readable text colour shows the warning
- [ ] Remove a colour that is used for photo text: toggles stay in step
- [ ] Review blocks publishing until required checks pass
