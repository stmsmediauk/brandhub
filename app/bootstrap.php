<?php
declare(strict_types=1);

// Starts every request. Written to run on PHP 7.4 or newer.
define('APP_ROOT', dirname(__DIR__));

mb_internal_encoding('UTF-8');
ini_set('display_errors', '0');   // visitors never see error details
ini_set('log_errors', '1');
error_reporting(E_ALL);

require __DIR__ . '/security.php';
require __DIR__ . '/config.php';
require __DIR__ . '/http.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session.php';
require __DIR__ . '/brands.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/usage.php';
require __DIR__ . '/files.php';
require __DIR__ . '/views.php';
require __DIR__ . '/routes.php';

// Anything unexpected becomes a plain message. The detail goes to the server log only.
set_exception_handler(function ($e) {
    error_log('[brand-platform] ' . get_class($e) . ': ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        send_page(500, view_message('Something went wrong', 'Please try again in a moment. If it keeps happening, contact STMS Media.'));
    }
    exit;
});
