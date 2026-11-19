<?php
declare(strict_types=1);

// Reads config.php (or the file named by the STMS_CONFIG setting, used by the tests).
function config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $path = getenv('STMS_CONFIG') ?: APP_ROOT . '/config.php';
        if (!is_file($path)) {
            throw new RuntimeException('Missing config file: copy config.example.php to config.php');
        }
        $cfg = require $path;
        foreach (['db', 'secret', 'storage_path'] as $k) {
            if (!isset($cfg[$k])) throw new RuntimeException('config.php is missing "' . $k . '"');
        }
        if (strlen((string)$cfg['secret']) < 16 || $cfg['secret'] === 'change-me-to-a-long-random-string') {
            throw new RuntimeException('config.php "secret" must be a long random string');
        }
    }
    return $cfg;
}
