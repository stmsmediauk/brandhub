<?php
declare(strict_types=1);

const SESSION_NAME = 'stms_hub';

// The cookie is Secure everywhere except when the connection comes from this computer.
function cookie_is_secure(array $server): bool
{
    return !is_local_request($server);
}

// Exactly what is sent to the browser for the session cookie.
function session_cookie_options(array $server): array
{
    return [
        'lifetime' => 0,          // gone when the browser closes
        'path' => '/',
        'secure' => cookie_is_secure($server),
        'httponly' => true,       // page scripts cannot read it
        'samesite' => 'Lax',
    ];
}

function session_dir(): string
{
    $dir = rtrim((string)config()['storage_path'], '/') . '/sessions';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir;
}

// Starts the session. When $create is false, no session (and no cookie) is made
// for a visitor who does not already have one.
function start_session(bool $create): bool
{
    if (session_status() === PHP_SESSION_ACTIVE) return true;
    if (!$create && !isset($_COOKIE[SESSION_NAME])) return false;
    ini_set('session.use_strict_mode', '1');     // unknown session ids are never accepted
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.gc_maxlifetime', (string)SESSION_MAX_SECONDS);
    session_name(SESSION_NAME);
    session_save_path(session_dir());
    session_set_cookie_params(session_cookie_options($_SERVER));
    session_start();
    // Sessions end after being idle too long or open too long.
    $now = time();
    if (isset($_SESSION['born'])) {
        if ($now - (int)($_SESSION['last'] ?? 0) > SESSION_IDLE_SECONDS || $now - (int)$_SESSION['born'] > SESSION_MAX_SECONDS) {
            $_SESSION = [];
        }
    }
    if (isset($_SESSION['born'])) $_SESSION['last'] = $now;
    return true;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return (string)$_SESSION['csrf'];
}

function csrf_ok($given): bool
{
    return is_string($given) && !empty($_SESSION['csrf']) && hash_equals((string)$_SESSION['csrf'], $given);
}

// Called after a correct password. A new session id stops anyone who planted an old one.
function sign_in_session(array $brand): void
{
    session_regenerate_id(true);
    $_SESSION = [
        'brand_id' => (int)$brand['id'],
        'slug' => (string)$brand['slug'],
        // If the password is changed, every session made with the old one stops working.
        'pw' => substr(hash('sha256', (string)$brand['password_hash']), 0, 24),
        'born' => time(),
        'last' => time(),
        'csrf' => bin2hex(random_bytes(32)),
    ];
}

function sign_out_session(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) return;
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(SESSION_NAME, '', [
        'expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'],
        'httponly' => true, 'samesite' => 'Lax',
    ]);
    session_destroy();
}
