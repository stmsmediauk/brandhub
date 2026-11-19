<?php
declare(strict_types=1);

// The single front door. The web server sends every address that is not a real
// file here (see .htaccess), and app/routes.php decides what to do with it.
require dirname(__DIR__) . '/app/bootstrap.php';
route();
