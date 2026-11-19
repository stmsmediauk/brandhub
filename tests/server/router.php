<?php
ini_set('display_errors', '0');
// Development only: lets "php -S" behave like the .htaccess rule on the real server.
// Serve a real file inside public/ as itself, send everything else to index.php.
$public = realpath(__DIR__ . '/../../public');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$decoded = rawurldecode((string)$path);
$file = strpos($decoded, "\0") === false ? realpath($public . $decoded) : false;
// Like Apache, never serve hidden files (.htaccess, .env, ...) or PHP source as plain files.
$hidden = strpos('/' . ltrim((string)$path, '/'), '/.') !== false;
if ($path !== '/' && !$hidden && $file !== false && is_file($file) && strpos($file, $public . DIRECTORY_SEPARATOR) === 0 && substr($file, -4) !== '.php') {
    return false;   // a real static file: let the built-in server send it
}
require $public . '/index.php';
