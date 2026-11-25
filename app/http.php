<?php
declare(strict_types=1);

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function is_local_request(?array $server = null): bool
{
    $server = $server ?? $_SERVER;
    // The connection itself comes from this computer. A header cannot fake this.
    return in_array($server['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
}

function security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('X-Frame-Options: DENY');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
}

// Pages are STMS Media branded and load Inter from Google Fonts.
const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

// The signed-in hub also runs its own script (/hub/hub.js) and loads the brand's
// fonts: from Google Fonts, or the brand's uploaded files on this site.
const HUB_CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

// The studio also reads photos the client picks (blob: and data: images) and draws
// the brand's logos from data: images.
const STUDIO_CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

function send_page(int $status, string $html, array $headers = [], string $csp = PAGE_CSP): void
{
    http_response_code($status);
    security_headers();
    header('Content-Type: text/html; charset=utf-8');
    header('Content-Security-Policy: ' . $csp);
    header('Cache-Control: no-store');
    foreach ($headers as $h) header($h);
    echo $html;
}

function send_json(int $status, $data, array $headers = []): void
{
    http_response_code($status);
    security_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    foreach ($headers as $h) header($h);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function send_redirect(string $to, int $status = 303): void
{
    http_response_code($status);
    security_headers();
    header('Location: ' . $to);
    header('Cache-Control: no-store');
}

// The one answer for "you may not have this", whether the brand exists or not.
function send_forbidden_json(): void
{
    send_json(403, ['error' => 'not_signed_in']);
}

function send_text(int $status, string $text, array $headers = []): void
{
    http_response_code($status);
    security_headers();
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    foreach ($headers as $h) header($h);
    echo $text;
}

// The address path as the browser sent it (still percent-encoded), without the query.
function request_path(): string
{
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $path = parse_url($uri, PHP_URL_PATH);
    return is_string($path) && $path !== '' ? $path : '/';
}

function request_method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

// Same origin check for requests that change something. Browsers send Origin on
// every cross-site POST. A request with no Origin at all is allowed (it cannot be
// a cross-site browser request).
function same_origin_ok(): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return true;
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $oh = parse_url($origin, PHP_URL_HOST);
    $op = parse_url($origin, PHP_URL_PORT);
    if (!is_string($oh)) return false;
    $originHost = $oh . ($op ? ':' . $op : '');
    return strcasecmp($originHost, $host) === 0;
}
