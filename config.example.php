<?php
// Copy to config.php (never commit config.php) and fill in the real values from StackCP.
return [
    'db' => [
        'host' => 'localhost',
        'name' => 'your_database',
        'user' => 'your_user',
        'pass' => 'your_password',
    ],
    // A long random string used when signing session cookies.
    'secret' => 'change-me',
    // Where per-brand files (logos, fonts) are stored, outside the public folder.
    'storage_path' => __DIR__ . '/storage',
];
