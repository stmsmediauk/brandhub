<?php
declare(strict_types=1);

// Settings shared by the web app and the add-brand tool. Keep them in one place
// so a hash made by the tool and a check made by the site always agree.

// bcrypt cost for every brand password. Raising it later is safe: old hashes keep working.
const HASH_COST = 12;

// A real hash of a throwaway string at the same cost. Checking a wrong password
// against an unknown brand uses this, so it takes as long as for a real brand.
const DUMMY_HASH = '$2y$12$rPVrIh5xYWkFXcVa7cA2GeVIQgblXTuDftvIX7P9ssyIl6YU1OZ1q';

// Longest password the site will even look at (bcrypt only reads the first 72 bytes).
const PASSWORD_MAX = 200;

// Wrong-password limits: this many misses from one visitor for one address, in this many minutes.
const LOGIN_MAX_MISSES = 5;
const LOGIN_WINDOW_MINUTES = 15;

// Sessions end after this long idle, or this long in total.
const SESSION_IDLE_SECONDS = 8 * 3600;
const SESSION_MAX_SECONDS = 24 * 3600;

// Address words the site itself uses. A brand cannot take one of these as its slug.
const RESERVED_SLUGS = ['studio', 'layouts', 'assets', 'api', 'files', 'static', 'public', 'login', 'logout', 'admin', 'app', 'storage', 'index', 'tests', 'docs', 'design', 'db', 'tools', 'www'];

function valid_slug(string $s): bool
{
    return (bool)preg_match('/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/', $s);
}

function reserved_slug(string $s): bool
{
    return in_array($s, RESERVED_SLUGS, true);
}
