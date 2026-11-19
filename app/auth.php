<?php
declare(strict_types=1);

// The visitor's address, scrambled with the secret so the address itself is never stored.
function visitor_key(): string
{
    return hash_hmac('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'), (string)config()['secret']);
}

function login_blocked(string $slug, string $who): bool
{
    $st = db()->prepare('SELECT COUNT(*) FROM login_attempts WHERE slug = ? AND who = ? AND at > (NOW() - INTERVAL ' . (int)LOGIN_WINDOW_MINUTES . ' MINUTE)');
    $st->execute([$slug, $who]);
    return (int)$st->fetchColumn() >= LOGIN_MAX_MISSES;
}

function record_miss(string $slug, string $who): void
{
    db()->prepare('INSERT INTO login_attempts (slug, who) VALUES (?, ?)')->execute([$slug, $who]);
    db()->exec('DELETE FROM login_attempts WHERE at < (NOW() - INTERVAL 1 DAY)');
}

function clear_misses(string $slug, string $who): void
{
    db()->prepare('DELETE FROM login_attempts WHERE slug = ? AND who = ?')->execute([$slug, $who]);
}

// Result: ['result' => 'ok' | 'wrong' | 'blocked', 'brand' => row or null].
// A brand that does not exist goes through exactly the same steps as one that does:
// the same database lookups and one real password check (against a dummy hash), so
// neither the answer nor the time it takes reveals which brands exist.
function try_login(string $slug, string $password): array
{
    $who = visitor_key();
    if (login_blocked($slug, $who)) return ['result' => 'blocked', 'brand' => null];

    $brand = find_brand($slug);
    $hash = $brand ? (string)$brand['password_hash'] : DUMMY_HASH;
    if (strlen($password) > PASSWORD_MAX) $password = substr($password, 0, PASSWORD_MAX);
    $matches = password_verify($password, $hash);

    if ($brand && $matches && $password !== '') {
        clear_misses($slug, $who);
        return ['result' => 'ok', 'brand' => $brand];
    }
    record_miss($slug, $who);
    return ['result' => 'wrong', 'brand' => null];
}

// The brand this visitor is signed in to, but only if it is the brand in the address.
// Checked against the database every time: a changed password or a removed brand
// ends the session at once.
function signed_in_brand(string $slug): ?array
{
    if (!start_session(false)) return null;
    if (empty($_SESSION['brand_id']) || ($_SESSION['slug'] ?? '') !== $slug) return null;
    $row = find_brand_by_id((int)$_SESSION['brand_id']);
    if (!$row || $row['slug'] !== $slug) return null;
    if (!hash_equals(substr(hash('sha256', (string)$row['password_hash']), 0, 24), (string)($_SESSION['pw'] ?? ''))) return null;
    return $row;
}
