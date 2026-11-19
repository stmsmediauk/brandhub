<?php
declare(strict_types=1);

const FILE_TYPES = [
    'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
    'webp' => 'image/webp', 'gif' => 'image/gif',
    'woff' => 'font/woff', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf', 'otf' => 'font/otf',
];

function brand_files_root(string $slug): string
{
    return rtrim((string)config()['storage_path'], '/') . '/brands/' . $slug;
}

// Turns the part of the address after /files/ into a real file inside this brand's
// own folder, or null. Only plain names are accepted: no dots at the start of a name,
// no "..", no backslashes, no odd characters, only known file types. The final path is
// resolved (symbolic links included) and must still be inside the brand's folder.
function resolve_brand_file(string $slug, string $encodedRel): ?string
{
    if (!valid_slug($slug)) return null;
    $rel = rawurldecode($encodedRel);
    if ($rel === '' || strlen($rel) > 200) return null;
    if (!preg_match('#^[A-Za-z0-9][A-Za-z0-9._-]*(?:/[A-Za-z0-9][A-Za-z0-9._-]*)*$#', $rel)) return null;
    $ext = strtolower((string)pathinfo($rel, PATHINFO_EXTENSION));
    if (!isset(FILE_TYPES[$ext])) return null;
    $root = realpath(brand_files_root($slug));
    if ($root === false) return null;
    $full = realpath($root . '/' . $rel);
    if ($full === false || strpos($full, $root . DIRECTORY_SEPARATOR) !== 0 || !is_file($full)) return null;
    return $full;
}

function send_brand_file(string $path): void
{
    $ext = strtolower((string)pathinfo($path, PATHINFO_EXTENSION));
    http_response_code(200);
    security_headers();
    header('Content-Type: ' . FILE_TYPES[$ext]);
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, max-age=300');
    // An SVG opened on its own address must never be able to run anything.
    if ($ext === 'svg') header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox");
    readfile($path);
}
