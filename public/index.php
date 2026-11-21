<?php
declare(strict_types=1);

// The single front door. The web server sends every address that is not a real
// file here (see .htaccess), and app/routes.php decides what to do with it.
//
// The app/ folder is looked for next to this web folder (the project layout on a
// computer), then in a private brands-app/ folder beside the hosting's web root
// (the live layout, where the web folder is public_html/brands).
$bootstrap = null;
foreach ([dirname(__DIR__) . '/app', dirname(__DIR__, 2) . '/brands-app/app'] as $dir) {
    if (is_file($dir . '/bootstrap.php')) { $bootstrap = $dir . '/bootstrap.php'; break; }
}
if ($bootstrap === null) {
    error_log('[brand-platform] app/ folder not found');
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Something went wrong');
}
require $bootstrap;
route();
