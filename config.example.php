<?php
// Copy to config.php (never commit config.php) and fill in the real values from StackCP.
return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'your_database',
        'user' => 'your_user',
        'pass' => 'your_password',
    ],
    // A long random string. Used to scramble visitor addresses before they are
    // used to slow down password guessing. Never share it.
    'secret' => 'change-me-to-a-long-random-string',
    // Where per-brand files (logos, fonts) and PHP sessions are kept. Must be OUTSIDE
    // the web folder. Brand files go in <storage_path>/brands/<slug>/.
    'storage_path' => __DIR__ . '/storage',
];
