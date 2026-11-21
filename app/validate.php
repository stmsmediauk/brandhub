<?php
declare(strict_types=1);

// Checks a brand record before it is stored. Mirrors the checks the studio makes
// in the browser (public/studio/js/brand-loader.js). Returns a list of plain
// sentences; an empty list means the record can be stored.

function hex_ok($h): bool
{
    return is_string($h) && (bool)preg_match('/^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $h);
}

function hex_luminance(string $hex): float
{
    $h = ltrim($hex, '#');
    if (strlen($h) === 3) $h = $h[0] . $h[0] . $h[1] . $h[1] . $h[2] . $h[2];
    $c = array_map(function ($i) use ($h) {
        $v = hexdec(substr($h, $i, 2)) / 255;
        return $v <= 0.04045 ? $v / 12.92 : pow(($v + 0.055) / 1.055, 2.4);
    }, [0, 2, 4]);
    return 0.2126 * $c[0] + 0.7152 * $c[1] + 0.0722 * $c[2];
}

function find_forbidden_keys($v, string $path = ''): array
{
    $found = [];
    if (!is_array($v)) return $found;
    foreach ($v as $k => $x) {
        $p = $path === '' ? (string)$k : $path . '.' . $k;
        if (is_string($k) && preg_match('/^(password|password_hash|secret|salt)$/i', $k)) $found[] = $p;
        $found = array_merge($found, find_forbidden_keys($x, $p));
    }
    return $found;
}

function validate_brand_config($b): array
{
    $e = [];
    if (!is_array($b)) return ['The brand record is not a JSON object.'];

    $slug = $b['slug'] ?? null;
    if (!is_string($slug) || !valid_slug($slug)) $e[] = 'slug must be 1 to 40 lower-case letters, digits or hyphens, not starting or ending with a hyphen.';
    elseif (reserved_slug($slug)) $e[] = 'the slug "' . $slug . '" is used by the site itself. Choose another.';

    if (!isset($b['name']) || !is_string($b['name']) || trim($b['name']) === '' || strlen($b['name']) > 80) $e[] = 'name is required (up to 80 characters).';

    foreach (find_forbidden_keys($b) as $p) $e[] = $p . ' must not be stored in the brand record (passwords are kept separately, as hashes).';
    if (isset($b['look']) && is_array($b['look']) && array_key_exists('theme', $b['look'])) $e[] = 'look.theme is no longer stored. The light or dark page is worked out from the palette.';

    $pal = $b['palette'] ?? null;
    if (!is_array($pal) || count($pal) < 2 || count($pal) > 12) $e[] = 'palette needs 2 to 12 colours.';
    else foreach (array_values($pal) as $i => $c) {
        if (!is_array($c) || !hex_ok($c['hex'] ?? null)) $e[] = 'palette colour ' . ($i + 1) . ' has no valid HEX.';
        if (!is_array($c) || !isset($c['name']) || !is_string($c['name']) || trim($c['name']) === '') $e[] = 'palette colour ' . ($i + 1) . ' has no name.';
        if (is_array($c) && isset($c['cmyk'])) {
            $k = $c['cmyk'];
            if (!is_array($k) || count($k) !== 4 || count(array_filter($k, function ($n) { return (is_int($n) || is_float($n)) && $n >= 0 && $n <= 100; })) !== 4) $e[] = 'palette colour ' . ($i + 1) . ' cmyk must be four numbers from 0 to 100, for example [0, 95, 85, 0].';
        }
        if (is_array($c) && isset($c['pantone']) && (!is_string($c['pantone']) || strlen($c['pantone']) > 40)) $e[] = 'palette colour ' . ($i + 1) . ' pantone must be text (up to 40 characters).';
    }

    if (isset($b['sections'])) {
        if (!is_array($b['sections'])) $e[] = 'sections must be an object of true or false values.';
        else foreach ($b['sections'] as $k => $v) if (!is_bool($v)) $e[] = 'sections.' . $k . ' must be true or false.';
    }
    if (isset($b['start_here'])) {
        $sh = $b['start_here'];
        if (!is_array($sh) || count($sh) < 1 || count($sh) > 6) $e[] = 'start_here must be a list of 1 to 6 rules.';
        else foreach (array_values($sh) as $i => $r) {
            if (!is_array($r) || !isset($r['title'], $r['text']) || !is_string($r['title']) || !is_string($r['text']) || trim($r['title']) === '' || strlen($r['title']) > 80 || strlen($r['text']) > 400) $e[] = 'start_here rule ' . ($i + 1) . ' needs a title (up to 80 characters) and text (up to 400).';
        }
    }
    if (isset($b['logos'])) {
        $lg = $b['logos'];
        if (!is_array($lg) || $lg !== array_values($lg) || count($lg) > 12) $e[] = 'logos must be a list of up to 12 logos.';
        else {
            $ids = [];
            foreach ($lg as $i => $l) {
                $n = 'logo ' . ($i + 1);
                if (!is_array($l)) { $e[] = $n . ' is not an object.'; continue; }
                if (!isset($l['id']) || !is_string($l['id']) || !preg_match('/^[a-z0-9-]{1,40}$/', $l['id'])) $e[] = $n . ' needs an id of lower-case letters, digits or hyphens.';
                elseif (isset($ids[$l['id']])) $e[] = $n . ' repeats the id "' . $l['id'] . '".';
                else $ids[$l['id']] = true;
                if (!isset($l['name']) || !is_string($l['name']) || trim($l['name']) === '' || strlen($l['name']) > 60) $e[] = $n . ' needs a name (up to 60 characters).';
                if (!isset($l['file']) || !is_string($l['file']) || !preg_match('#^[A-Za-z0-9][A-Za-z0-9._-]*(?:/[A-Za-z0-9][A-Za-z0-9._-]*)*\.svg$#i', $l['file']) || strpos($l['file'], '..') !== false) $e[] = $n . ' needs a file: a plain path to an SVG in the brand\'s folder, for example logos/primary.svg.';
                if (!isset($l['kind']) || !in_array($l['kind'], ['primary', 'secondary', 'mark'], true)) $e[] = $n . ' kind must be primary, secondary or mark.';
                if (isset($l['use']) && (!is_string($l['use']) || strlen($l['use']) > 200)) $e[] = $n . ' use must be text (up to 200 characters).';
            }
        }
    }
    foreach (['tagline', 'handle'] as $k) if (isset($b[$k]) && (!is_string($b[$k]) || strlen($b[$k]) > 80)) $e[] = $k . ' must be text (up to 80 characters).';

    foreach (['heading', 'body'] as $w) {
        $f = $b['fonts'][$w] ?? null;
        if (!is_array($f) || empty($f['family']) || !is_string($f['family'])) $e[] = 'the ' . $w . ' font needs a family.';
        elseif (!in_array($f['source'] ?? null, ['google', 'uploaded'], true)) $e[] = 'the ' . $w . ' font source must be google or uploaded.';
        elseif ($f['source'] === 'uploaded') {
            $files = $f['files'] ?? null;
            if (!is_array($files) || !$files || $files !== array_values($files)) $e[] = 'the ' . $w . ' font is uploaded, so it needs a list of files.';
            else foreach ($files as $i => $file) {
                $n = 'the ' . $w . ' font file ' . ($i + 1);
                if (!is_array($file) || !isset($file['url']) || !is_string($file['url']) || !preg_match('#^[A-Za-z0-9][A-Za-z0-9._-]*(?:/[A-Za-z0-9][A-Za-z0-9._-]*)*\.(woff2?|otf|ttf)$#i', $file['url']) || strpos($file['url'], '..') !== false) $e[] = $n . ' needs a url: a plain path to a .woff2, .woff, .otf or .ttf in the brand\'s folder, for example fonts/Brand-Regular.otf.';
                if (is_array($file) && isset($file['weight']) && (!is_int($file['weight']) || $file['weight'] < 100 || $file['weight'] > 900)) $e[] = $n . ' weight must be a number from 100 to 900.';
                if (is_array($file) && isset($file['style']) && !in_array($file['style'], ['normal', 'italic'], true)) $e[] = $n . ' style must be normal or italic.';
            }
        }
    }

    $s = $b['studio'] ?? [];
    if (!is_array($s)) $e[] = 'studio must be an object.';
    else {
        $formats = $s['formats'] ?? null;
        if (!is_array($formats) || !$formats) $e[] = 'studio.formats needs at least one format.';
        else foreach ($formats as $f) if (!in_array($f, ['1:1', '4:5', '9:16', 'landscape'], true)) $e[] = 'unknown format ' . json_encode($f) . '.';
        $layouts = $s['layouts'] ?? null;
        if (!is_array($layouts) || !$layouts) $e[] = 'studio.layouts needs at least one layout.';
        else foreach ($layouts as $l) if (!is_string($l) || !preg_match('/^[a-z0-9_-]+$/', $l)) $e[] = 'bad layout id ' . json_encode($l) . '.';
        $ptc = $s['photo_text_colours'] ?? null;
        if (!is_array($ptc) || !$ptc) $e[] = 'studio.photo_text_colours needs at least one colour.';
        elseif (count(array_filter($ptc, 'hex_ok')) !== count($ptc)) $e[] = 'a photo text colour is not a valid HEX.';
        else {
            $lums = array_map('hex_luminance', $ptc);
            if (!array_filter($lums, function ($l) { return $l >= 0.18; }) || !array_filter($lums, function ($l) { return $l < 0.18; })) $e[] = 'photo text colours need at least one light and one dark.';
        }
    }

    if (isset($b['look']['corners']) && !in_array($b['look']['corners'], ['sharp', 'soft', 'round', 'pill'], true)) $e[] = 'look.corners must be sharp, soft, round or pill.';
    if (isset($b['look']['hero']) && !in_array($b['look']['hero'], ['solid', 'tint', 'dark'], true)) $e[] = 'look.hero must be solid, tint or dark.';
    if (!empty($b['library']) && !preg_match('#^https://#i', (string)$b['library'])) $e[] = 'library must be an https:// link.';
    return $e;
}
