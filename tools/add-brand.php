<?php
declare(strict_types=1);

// Prints SQL to paste into phpMyAdmin. It never touches a database itself.
//
//   php tools/add-brand.php new brand.json [--generate] [--status=draft|live] > add-forma.sql
//   php tools/add-brand.php version brand.json > update-forma.sql
//   php tools/add-brand.php password <slug> [--generate] > new-password.sql
//
// The password is typed at a hidden prompt (twice) or, with --generate, made for you and
// shown ONCE on the screen. It is never an argument, so it never lands in your shell history.
// The SQL goes to standard output and everything else to the screen, so redirecting
// standard output into a file never puts the password in the file.

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('APP_ROOT', dirname(__DIR__));
require APP_ROOT . '/app/security.php';
require APP_ROOT . '/app/validate.php';

function fail(string $msg, int $code = 2): void
{
    fwrite(STDERR, "\nERROR: " . $msg . "\n");
    exit($code);
}

function usage(): void
{
    fwrite(STDERR, <<<'TXT'
Usage:
  php tools/add-brand.php new <brand.json> [--generate] [--status=draft|live]
  php tools/add-brand.php version <brand.json>
  php tools/add-brand.php password <slug> [--generate]

Paste the SQL (standard output) into phpMyAdmin with the right database selected.

TXT);
    exit(2);
}

function sql_str(string $s): string
{
    return "'" . str_replace(['\\', "'", "\0", "\n", "\r", "\x1a"], ['\\\\', "''", '\\0', '\\n', '\\r', '\\Z'], $s) . "'";
}

function generate_password(): string
{
    $alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';     // no look-alike letters
    $out = '';
    for ($i = 0; $i < 20; $i++) {
        $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        if ($i % 5 === 4 && $i < 19) $out .= '-';
    }
    return $out;
}

function read_hidden(string $label): string
{
    $tty = @fopen('/dev/tty', 'r+');
    if (!$tty) fail("There is no terminal to type a password into. Run this in a terminal, or use --generate.");
    fwrite($tty, $label);
    shell_exec('stty -echo < /dev/tty');
    register_shutdown_function(function () { shell_exec('stty echo < /dev/tty'); });
    $line = fgets($tty);
    shell_exec('stty echo < /dev/tty');
    fwrite($tty, "\n");
    return $line === false ? '' : rtrim($line, "\r\n");
}

function choose_password(bool $generate): string
{
    if ($generate) {
        $pw = generate_password();
        fwrite(STDERR, "\n================================================\n  Password for this brand (shown once):\n\n      $pw\n\n  Send it to the client. It is not saved anywhere.\n================================================\n");
        return $pw;
    }
    $a = read_hidden('New password (hidden): ');
    if (strlen($a) < 12) fail('Use at least 12 characters.');
    if (strlen($a) > 72) fail('Use at most 72 characters (the most bcrypt can use).');
    $b = read_hidden('Type it again: ');
    if (!hash_equals($a, $b)) fail('The two passwords did not match.');
    return $a;
}

function make_hash(string $pw): string
{
    return password_hash($pw, PASSWORD_BCRYPT, ['cost' => HASH_COST]);
}

function load_brand(string $file): array
{
    if (!is_file($file)) fail("File not found: $file");
    $json = file_get_contents($file);
    $b = json_decode((string)$json, true);
    if (json_last_error() !== JSON_ERROR_NONE) fail('That file is not valid JSON: ' . json_last_error_msg());
    $errors = validate_brand_config($b);
    if ($errors) {
        fwrite(STDERR, "\nThis brand record cannot be used yet:\n");
        foreach ($errors as $e) fwrite(STDERR, "  - $e\n");
        exit(1);
    }
    // The address, status and version are columns in the database, so they are not kept in the record.
    unset($b['status'], $b['version']);
    return $b;
}

function config_sql(array $b): string
{
    return sql_str((string)json_encode($b, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

// ---------------- arguments ----------------
$args = array_slice($argv, 1);
$cmd = array_shift($args);
$flags = []; $pos = [];
foreach ($args as $a) {
    if ($a === '--generate') $flags['generate'] = true;
    elseif (preg_match('/^--status=(draft|live)$/', $a, $m)) $flags['status'] = $m[1];
    elseif (strncmp($a, '--', 2) === 0) fail("Unknown option $a.");
    else $pos[] = $a;
}
if (!in_array($cmd, ['new', 'version', 'password'], true) || count($pos) !== 1) usage();

$stamp = "-- Made by tools/add-brand.php. Paste into phpMyAdmin (SQL tab) with the right database selected.\n";

if ($cmd === 'new') {
    $b = load_brand($pos[0]);
    $slug = $b['slug'];
    $status = $flags['status'] ?? 'draft';
    $hash = make_hash(choose_password(!empty($flags['generate'])));
    echo $stamp . "START TRANSACTION;\n"
       . 'INSERT INTO brands (slug, password_hash, status, current_version) VALUES (' . sql_str($slug) . ', ' . sql_str($hash) . ', ' . sql_str($status) . ", 1);\n"
       . 'INSERT INTO brand_versions (brand_id, version, config) VALUES (LAST_INSERT_ID(), 1, ' . config_sql($b) . ");\n"
       . "COMMIT;\n";
    fwrite(STDERR, "\nSQL for new brand \"$slug\" ($status) written. Nothing has been changed yet: paste it into phpMyAdmin.\n");
} elseif ($cmd === 'version') {
    $b = load_brand($pos[0]);
    $slug = $b['slug'];
    echo $stamp . "START TRANSACTION;\n"
       . 'SET @bid = (SELECT id FROM brands WHERE slug = ' . sql_str($slug) . ");\n"
       . "SET @v = (SELECT MAX(version) + 1 FROM brand_versions WHERE brand_id = @bid);\n"
       . 'INSERT INTO brand_versions (brand_id, version, config) VALUES (@bid, @v, ' . config_sql($b) . ");\n"
       . "UPDATE brands SET current_version = @v WHERE id = @bid;\n"
       . "COMMIT;\n";
    fwrite(STDERR, "\nSQL for a new version of \"$slug\" written. Earlier versions are kept.\n");
} else {
    $slug = $pos[0];
    if (!valid_slug($slug)) fail('That is not a valid brand address.');
    $hash = make_hash(choose_password(!empty($flags['generate'])));
    echo $stamp . 'UPDATE brands SET password_hash = ' . sql_str($hash) . ' WHERE slug = ' . sql_str($slug) . ";\n";
    fwrite(STDERR, "\nSQL to change the password of \"$slug\" written. Everyone signed in with the old one is signed out.\n");
}
