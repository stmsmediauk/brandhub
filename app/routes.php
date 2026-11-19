<?php
declare(strict_types=1);

// ALL routing lives in this one file. The web server only has to send every
// address that is not a real file to public/index.php (see public/.htaccess).
//
//   /                          a plain page, no list of brands
//   /<slug>/                   sign-in page, or the hub when signed in
//   /<slug>/login   (POST)     check the password
//   /<slug>/logout  (POST)     sign out
//   /<slug>/api/brand.json     the signed-in brand's record
//   /<slug>/api/log (POST)     the studio reporting an export
//   /<slug>/files/<path>       the brand's own logos and fonts

function not_found(): void
{
    send_page(404, view_message('Page not found', 'Check the address you were given.'));
}

function route(): void
{
    $method = request_method();
    if ($method === 'HEAD') $method = 'GET';
    $path = request_path();

    if ($path === '/') {
        send_page(200, view_message('STMS Media brand hubs', 'Open the address you were given to sign in to your brand hub.'));
        return;
    }

    $parts = explode('/', substr($path, 1), 2);
    $slug = rawurldecode($parts[0]);
    $rest = $parts[1] ?? null;                       // null: no slash after the slug
    if (!valid_slug($slug) || reserved_slug($slug)) { not_found(); return; }
    if ($rest === null) { send_redirect('/' . $slug . '/', 301); return; }

    // exact paths: [method => handler]
    $exact = [
        ''               => ['GET' => 'route_home'],
        'login'          => ['POST' => 'route_login'],
        'logout'         => ['POST' => 'route_logout'],
        'api/brand.json' => ['GET' => 'route_brand_json'],
        'api/log'        => ['POST' => 'route_log'],
    ];
    if (isset($exact[$rest])) {
        $handlers = $exact[$rest];
        if (!isset($handlers[$method])) {
            send_text(405, 'Method not allowed', ['Allow: ' . implode(', ', array_keys($handlers))]);
            return;
        }
        $handlers[$method]($slug);
        return;
    }
    if (strncmp($rest, 'files/', 6) === 0 && strlen($rest) > 6) {
        if ($method !== 'GET') { send_text(405, 'Method not allowed', ['Allow: GET']); return; }
        route_file($slug, substr($rest, 6));
        return;
    }
    not_found();
}

function route_home(string $slug): void
{
    $brand = signed_in_brand($slug);
    if ($brand) { send_page(200, view_signed_in($brand, csrf_token())); return; }
    start_session(true);
    send_page(200, view_login($slug, csrf_token()));
}

function route_login(string $slug): void
{
    start_session(true);
    $password = $_POST['password'] ?? '';
    if (!csrf_ok($_POST['csrf'] ?? null) || !same_origin_ok() || !is_string($password)) {
        send_page(400, view_login($slug, csrf_token(), 'That did not work. Please try again.'));
        return;
    }
    $r = try_login($slug, $password);
    if ($r['result'] === 'blocked') {
        send_page(429, view_login($slug, csrf_token(), 'Too many tries. Please wait a few minutes and try again.'), ['Retry-After: ' . (LOGIN_WINDOW_MINUTES * 60)]);
        return;
    }
    if ($r['result'] !== 'ok') {
        // One message for every kind of failure: wrong password, empty password, no such brand.
        send_page(401, view_login($slug, csrf_token(), 'That password is not right.'));
        return;
    }
    sign_in_session($r['brand']);
    log_event((int)$r['brand']['id'], 'login');
    send_redirect('/' . $slug . '/', 303);
}

function route_logout(string $slug): void
{
    start_session(false);
    if (session_status() === PHP_SESSION_ACTIVE) {
        if (!csrf_ok($_POST['csrf'] ?? null) || !same_origin_ok()) {
            send_page(400, view_message('That did not work', 'Please go back and try again.'));
            return;
        }
        sign_out_session();
    }
    send_redirect('/' . $slug . '/', 303);
}

function route_brand_json(string $slug): void
{
    $brand = signed_in_brand($slug);
    if (!$brand) { send_forbidden_json(); return; }
    send_json(200, brand_json_for_client($brand));
}

function route_log(string $slug): void
{
    $brand = signed_in_brand($slug);
    if (!$brand) { send_forbidden_json(); return; }
    $type = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (strncmp($type, 'application/json', 16) !== 0) { send_json(415, ['error' => 'json_only']); return; }
    if (!same_origin_ok()) { send_json(403, ['error' => 'wrong_origin']); return; }
    $raw = file_get_contents('php://input', false, null, 0, 600);
    $data = json_decode((string)$raw, true);
    $event = is_array($data) ? ($data['event'] ?? null) : null;
    if (!is_string($event) || !in_array($event, CLIENT_EVENTS, true)) { send_json(400, ['error' => 'unknown_event']); return; }
    log_event((int)$brand['id'], $event);
    http_response_code(204);
    security_headers();
}

function route_file(string $slug, string $encodedRel): void
{
    $brand = signed_in_brand($slug);
    if (!$brand) { send_text(403, 'Not signed in'); return; }
    $file = resolve_brand_file($slug, $encodedRel);
    if ($file === null) { send_text(404, 'Not found'); return; }
    send_brand_file($file);
}
