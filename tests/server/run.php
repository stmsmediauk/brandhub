<?php
declare(strict_types=1);

// Server-side checks: sign-in, isolation, files, the usage log and the add-brand tool.
//
//   php tests/server/run.php           run every check
//   php tests/server/run.php --serve   set up the same test brands and keep the site running for poking about
//
// Needs MariaDB or MySQL and a git-ignored config.test.php (see docs/server.md).
// It ONLY touches the database named in config.test.php, and refuses unless that name ends in _test.

$ROOT = dirname(__DIR__, 2);
$serveOnly = in_array('--serve', $argv, true);

// ---------------------------------------------------------------- setup
$cfgFile = $ROOT . '/config.test.php';
if (!is_file($cfgFile)) { fwrite(STDERR, "Missing config.test.php. See docs/server.md.\n"); exit(2); }
$test = require $cfgFile;
$d = $test['db'];
if (substr((string)$d['name'], -5) !== '_test') { fwrite(STDERR, "Refusing: the test database name must end in _test.\n"); exit(2); }

$pdo = new PDO('mysql:host=' . $d['host'] . ';port=' . (int)$d['port'] . ';dbname=' . $d['name'] . ';charset=utf8mb4', $d['user'], $d['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
foreach (['usage_log', 'login_attempts', 'brand_versions', 'brands'] as $t) $pdo->exec("DROP TABLE IF EXISTS `$t`");
$pdo->exec(file_get_contents($ROOT . '/db/schema.sql'));

$tmp = sys_get_temp_dir() . '/stms-server-test-' . bin2hex(random_bytes(4));
$storage = $tmp . '/storage';
mkdir($storage . '/brands', 0700, true);
$secret = bin2hex(random_bytes(24));
function write_config(string $path, array $db, string $storage, string $secret): void
{
    file_put_contents($path, '<?php return ' . var_export(['db' => $db, 'secret' => $secret, 'storage_path' => $storage], true) . ';');
}
write_config($tmp . '/config.php', $d, $storage, $secret);
putenv('STMS_CONFIG=' . $tmp . '/config.php');

// Load the app's own functions so single functions can be tested directly.
define('APP_ROOT', $ROOT);
foreach (['security', 'config', 'http', 'db', 'session', 'brands', 'auth', 'usage', 'files', 'validate'] as $f) require $ROOT . '/app/' . $f . '.php';

// ---------------------------------------------------------------- the add-brand tool, run for real
function run_tool(array $args, ?string $stdin = null): array
{
    global $ROOT;
    $cmd = array_merge([PHP_BINARY, $ROOT . '/tools/add-brand.php'], $args);
    $p = proc_open($cmd, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if ($stdin !== null) fwrite($pipes[0], $stdin);
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    return ['code' => proc_close($p), 'out' => $out, 'err' => $err];
}
function password_from(string $err): ?string { return preg_match('/\n\s{6}(\S+)\n/', $err, $m) ? $m[1] : null; }

$FIX = $ROOT . '/tests/studio/fixtures/';
function add_brand(PDO $pdo, string $file, string $status = 'live'): string
{
    $r = run_tool(['new', $file, '--generate', '--status=' . $status]);
    if ($r['code'] !== 0) throw new RuntimeException("add-brand failed for $file: " . $r['err']);
    $pdo->exec($r['out']);
    $pw = password_from($r['err']);
    if (!$pw) throw new RuntimeException('no password captured');
    return $pw;
}
$PW = [
    'forma' => add_brand($pdo, $FIX . 'dark-sans.json'),
    'northlight' => add_brand($pdo, $FIX . 'light-serif.json'),
    'sandstone' => add_brand($pdo, $FIX . 'edge-midtones.json', 'draft'),
];

// Brand files, including things that must never be reachable.
$files = [
    'forma/logos/primary.svg' => '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect width="10" height="10"/></svg>',
    'forma/fonts/brand.woff2' => random_bytes(200),
    'forma/logos/.hidden.svg' => '<svg/>',
    'forma/logos/script.php' => '<?php echo "EXECUTED";',
    'forma/logos/data.json' => '{"a":1}',
    'northlight/logos/primary.svg' => '<svg xmlns="http://www.w3.org/2000/svg"><title>NORTHLIGHT SECRET</title></svg>',
    'notes.txt' => 'TOP SECRET: not inside any brand folder',
];
foreach ($files as $rel => $content) { $p = $storage . '/brands/' . $rel; @mkdir(dirname($p), 0700, true); file_put_contents($p, $content); }
symlink($storage . '/brands/notes.txt', $storage . '/brands/forma/logos/leak.svg');                       // points outside the brand folder
symlink($storage . '/brands/northlight/logos/primary.svg', $storage . '/brands/forma/logos/cross.svg');   // points into another brand

// ---------------------------------------------------------------- start the site
function free_port(): int { $s = stream_socket_server('tcp://127.0.0.1:0'); $n = stream_socket_get_name($s, false); fclose($s); return (int)substr($n, strrpos($n, ':') + 1); }
function start_server(int $port, string $configPath)
{
    global $ROOT;
    $env = array_merge(getenv(), ['STMS_CONFIG' => $configPath]);
    $p = proc_open([PHP_BINARY, '-S', '127.0.0.1:' . $port, '-t', $ROOT . '/public', $ROOT . '/tests/server/router.php'], [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes, $ROOT, $env);
    for ($i = 0; $i < 50; $i++) { $c = @fsockopen('127.0.0.1', $port, $e, $es, 0.2); if ($c) { fclose($c); return $p; } usleep(100000); }
    throw new RuntimeException('server did not start');
}
$port = free_port();
$server = start_server($port, $tmp . '/config.php');
define('BASE', 'http://127.0.0.1:' . $port);
register_shutdown_function(function () use (&$server, $tmp) { if (is_resource($server)) proc_terminate($server); exec('rm -rf ' . escapeshellarg($tmp)); });

if ($serveOnly) {
    echo "\nTest site running at " . BASE . "  (Ctrl+C to stop)\n";
    foreach (['forma', 'northlight', 'sandstone'] as $s) echo "  " . BASE . "/$s/   password: {$PW[$s]}\n";
    echo "These passwords are for this test database only and change every run.\n";
    while (true) sleep(1);
}

// ---------------------------------------------------------------- tiny browser
class Browser
{
    public $jar = [];
    public $rawCookies = [];
    public function req(string $method, string $path, array $o = []): array
    {
        $ch = curl_init(BASE . $path);
        $headers = $o['headers'] ?? [];
        if ($this->jar) $headers[] = 'Cookie: ' . implode('; ', array_map(function ($k, $v) { return "$k=$v"; }, array_keys($this->jar), $this->jar));
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true,
            CURLOPT_PATH_AS_IS => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_TIMEOUT => 30, CURLOPT_HTTPHEADER => $headers,
        ]);
        if (isset($o['body'])) curl_setopt($ch, CURLOPT_POSTFIELDS, $o['body']);
        $raw = curl_exec($ch);
        if ($raw === false) throw new RuntimeException('curl: ' . curl_error($ch));
        $hs = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $time = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $head = substr($raw, 0, $hs); $body = substr($raw, $hs);
        $h = [];
        foreach (explode("\r\n", $head) as $line) if (strpos($line, ':') !== false) { [$k, $v] = explode(':', $line, 2); $h[strtolower(trim($k))][] = trim($v); }
        foreach ($h['set-cookie'] ?? [] as $sc) {
            $this->rawCookies[] = $sc;
            [$nv] = explode(';', $sc, 2); [$n, $v] = array_pad(explode('=', $nv, 2), 2, '');
            if ($v === '' || stripos($sc, 'expires=Thu, 01 Jan 1970') !== false) unset($this->jar[$n]); else $this->jar[$n] = $v;
        }
        return ['status' => $status, 'headers' => $h, 'body' => $body, 'time' => $time];
    }
    public function get(string $p, array $o = []): array { return $this->req('GET', $p, $o); }
    public function post(string $p, array $fields, array $o = []): array { return $this->req('POST', $p, $o + ['body' => http_build_query($fields)]); }
    public function csrf(string $slug): string { $r = $this->get("/$slug/"); return preg_match('/name="csrf" value="([0-9a-f]+)"/', $r['body'], $m) ? $m[1] : ''; }
    public function login(string $slug, string $pw): array { return $this->post("/$slug/login", ['password' => $pw, 'csrf' => $this->csrf($slug)]); }
    public function session(): ?string { return $this->jar['stms_hub'] ?? null; }
}
function clear_attempts(): void { global $pdo; $pdo->exec('DELETE FROM login_attempts'); }
function norm(string $body, string $slug): string
{
    $b = preg_replace('/name="csrf" value="[0-9a-f]+"/', 'name="csrf" value="X"', $body);
    return str_replace($slug, 'SLUG', $b);
}
function hnames(array $r): array { $n = array_keys($r['headers']); sort($n); return array_values(array_diff($n, ['date', 'set-cookie', 'content-length', 'retry-after', 'connection', 'host', 'x-powered-by'])); }

// ---------------------------------------------------------------- test runner
$tests = []; $pass = 0; $fail = 0;
function test(string $name, callable $fn): void { global $tests; $tests[] = [$name, $fn]; }
function ok($c, string $m = 'not true'): void { if (!$c) throw new Exception($m); }
function eq($a, $b, string $m = 'values differ'): void { if ($a !== $b) throw new Exception($m . ': got ' . var_export($a, true) . ', wanted ' . var_export($b, true)); }
function has(string $hay, string $needle, string $m = ''): void { if (strpos($hay, $needle) === false) throw new Exception(($m ?: 'missing text') . ': ' . $needle); }
function lacks(string $hay, string $needle, string $m = ''): void { if (strpos($hay, $needle) !== false) throw new Exception(($m ?: 'must not contain') . ': ' . $needle); }
function signed_in(string $slug): Browser { global $PW; clear_attempts(); $b = new Browser(); $r = $b->login($slug, $PW[$slug]); ok($r['status'] === 303, "could not sign in to $slug: " . $r['status']); return $b; }

// ================================================================ sign-in
test('sign-in page: STMS branded, shows no brand name, nothing is learned about the brand', function () {
    $r = (new Browser)->get('/forma/');
    eq($r['status'], 200); has($r['body'], 'stms media'); has($r['body'], 'Sign in');
    lacks(strtolower(str_replace('/forma/', '', $r['body'])), 'forma', 'brand name must not appear');
    has($r['headers']['content-security-policy'][0], "default-src 'none'"); has($r['headers']['x-content-type-options'][0], 'nosniff');
});
test('a real brand and a made-up one get the identical sign-in page', function () {
    $a = (new Browser)->get('/forma/'); $b = (new Browser)->get('/nosuchbrand/'); $c = (new Browser)->get('/northlight/');
    eq($a['status'], $b['status']); eq(norm($a['body'], 'forma'), norm($b['body'], 'nosuchbrand'), 'page differs'); eq(norm($a['body'], 'forma'), norm($c['body'], 'northlight'));
    eq(hnames($a), hnames($b)); eq($a['headers']['content-security-policy'], $b['headers']['content-security-policy']);
});
test('session cookie: HttpOnly, SameSite=Lax, a session cookie, and NOT Secure on localhost', function () {
    $b = new Browser; $b->get('/forma/'); $c = $b->rawCookies[0] ?? '';
    has($c, 'stms_hub='); has($c, 'HttpOnly'); has($c, 'SameSite=Lax'); has($c, 'path=/'); lacks($c, 'Secure'); lacks(strtolower($c), 'max-age'); lacks(strtolower($c), 'expires');
});
test('cookie Secure flag logic: on for everything except a connection from this computer (headers cannot fake it)', function () {
    eq(cookie_is_secure(['REMOTE_ADDR' => '127.0.0.1']), false); eq(cookie_is_secure(['REMOTE_ADDR' => '::1']), false);
    eq(cookie_is_secure(['REMOTE_ADDR' => '203.0.113.9']), true); eq(cookie_is_secure([]), true);
    eq(cookie_is_secure(['REMOTE_ADDR' => '203.0.113.9', 'HTTP_HOST' => 'localhost', 'HTTP_X_FORWARDED_FOR' => '127.0.0.1']), true);
    // ...and that is what the session cookie really uses.
    $prod = session_cookie_options(['REMOTE_ADDR' => '203.0.113.9']); $local = session_cookie_options(['REMOTE_ADDR' => '127.0.0.1']);
    eq($prod, ['lifetime' => 0, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']); eq($local['secure'], false); eq($local['httponly'], true);
});
test('wrong password, empty password and unknown brand all give the SAME response', function () {
    global $PW; clear_attempts();
    $mk = function ($slug, $pw) { $b = new Browser; return $b->post("/$slug/login", ['password' => $pw, 'csrf' => $b->csrf($slug)]); };
    $a = $mk('forma', 'wrong-password-1'); clear_attempts();
    $e = $mk('forma', ''); clear_attempts();
    $u = $mk('nosuchbrand', 'wrong-password-1'); clear_attempts();
    $long = $mk('forma', str_repeat('x', 5000));
    foreach ([$e, $u, $long] as $x) eq($x['status'], 401);
    eq($a['status'], 401); has($a['body'], 'That password is not right.');
    eq(norm($a['body'], 'forma'), norm($e['body'], 'forma')); eq(norm($a['body'], 'forma'), norm($long['body'], 'forma'));
    eq(norm($a['body'], 'forma'), norm($u['body'], 'nosuchbrand'), 'unknown brand answers differently'); eq(hnames($a), hnames($u));
    lacks($a['body'], 'not found'); lacks($u['body'], 'exist');
});
test('similar timing: a wrong password costs about the same for a real brand and an unknown one', function () {
    $mk = function ($slug) { clear_attempts(); $b = new Browser; $tok = $b->csrf($slug); return $b->post("/$slug/login", ['password' => 'wrong-password-xyz', 'csrf' => $tok])['time']; };
    $known = []; $unknown = [];
    for ($i = 0; $i < 7; $i++) { $known[] = $mk('forma'); $unknown[] = $mk('ghost' . $i); }
    sort($known); sort($unknown); $mk_ = $known[3]; $mu = $unknown[3];
    ok($mk_ > 0.05, 'password check should take real time (' . round($mk_ * 1000) . 'ms)');
    ok(abs($mk_ - $mu) <= max(0.04, 0.25 * max($mk_, $mu)), 'known ' . round($mk_ * 1000) . 'ms vs unknown ' . round($mu * 1000) . 'ms');
    echo '      (median known ' . round($mk_ * 1000) . 'ms, unknown ' . round($mu * 1000) . 'ms)' . "\n";
});
test('sign-in form needs its token, and refuses other sites', function () {
    clear_attempts(); global $PW; $b = new Browser; $tok = $b->csrf('forma');
    eq($b->post('/forma/login', ['password' => $PW['forma']])['status'], 400, 'no token');
    eq($b->post('/forma/login', ['password' => $PW['forma'], 'csrf' => 'deadbeef'])['status'], 400, 'wrong token');
    eq($b->post('/forma/login', ['password' => $PW['forma'], 'csrf' => $tok], ['headers' => ['Origin: http://evil.example']])['status'], 400, 'other site');
    eq((new Browser)->post('/forma/login', ['password' => $PW['forma'], 'csrf' => $tok])['status'], 400, 'token from another session');
    eq($b->post('/forma/login', ['password' => $PW['forma'], 'csrf' => $tok])['status'], 303, 'the real thing still works');
});
test('repeated wrong passwords are slowed down, for a real brand and an unknown one alike, even for the right password', function () {
    global $PW, $pdo; clear_attempts();
    $try = function (Browser $b, $slug, $pw) { return $b->post("/$slug/login", ['password' => $pw, 'csrf' => $b->csrf($slug)]); };
    $kb = new Browser; $ub = new Browser; $k = []; $u = [];
    for ($i = 0; $i < 6; $i++) { $k[] = $try($kb, 'northlight', 'nope' . $i); $u[] = $try($ub, 'ghostbrand', 'nope' . $i); }
    for ($i = 0; $i < 5; $i++) { eq($k[$i]['status'], 401); eq($u[$i]['status'], 401); }
    eq($k[5]['status'], 429); eq($u[5]['status'], 429); ok(isset($k[5]['headers']['retry-after']), 'Retry-After');
    eq(norm($k[5]['body'], 'northlight'), norm($u[5]['body'], 'ghostbrand'), 'locked-out pages differ'); has($k[5]['body'], 'Too many tries');
    eq($try($kb, 'northlight', $PW['northlight'])['status'], 429, 'right password during lock-out');
    $other = new Browser;
    $pdo->exec("UPDATE login_attempts SET who = 'someone-else' WHERE slug = 'northlight'");
    eq($try($other, 'northlight', $PW['northlight'])['status'], 303, 'a different visitor is not locked out');
    clear_attempts();
    eq($try($kb, 'northlight', $PW['northlight'])['status'], 303, 'works again once the window is clear');
});
test('correct password: new session id, hub page, one login logged, misses cleared', function () {
    global $PW, $pdo; clear_attempts(); $pdo->exec('DELETE FROM usage_log');
    $b = new Browser; $b->get('/forma/'); $before = $b->session();
    $r = $b->post('/forma/login', ['password' => $PW['forma'], 'csrf' => $b->csrf('forma')]);
    eq($r['status'], 303); eq($r['headers']['location'][0], '/forma/'); ok($b->session() && $b->session() !== $before, 'session id must change on sign-in');
    $h = $b->get('/forma/'); eq($h['status'], 200); has($h['body'], 'FORMA'); has($h['body'], 'Sign out');
    eq((int)$pdo->query("SELECT COUNT(*) FROM usage_log WHERE event='login'")->fetchColumn(), 1);
});
test('a planted session id is never adopted (session fixation)', function () {
    global $PW; clear_attempts(); $b = new Browser; $b->jar['stms_hub'] = 'attackerchosenid1234567890abcdef';
    $b->get('/forma/'); ok($b->session() !== 'attackerchosenid1234567890abcdef', 'server adopted the planted id');
    $b->login('forma', $PW['forma']); ok($b->session() !== 'attackerchosenid1234567890abcdef');
});
test('draft brands can currently sign in (decision pending the admin screen)', function () {
    global $PW; $b = signed_in('sandstone'); has($b->get('/sandstone/')['body'], 'Sandstone');
});

// ================================================================ isolation
test('signed in to one brand: another brand’s page, record, files and log are all refused, exactly as for a brand that does not exist', function () {
    $f = signed_in('forma');
    $page = $f->get('/northlight/'); has($page['body'], 'Sign in'); lacks($page['body'], 'You are signed in'); lacks($page['body'], 'Sign out');
    foreach (['/api/brand.json', '/files/logos/primary.svg'] as $p) {
        $o = $f->get('/northlight' . $p); $g = $f->get('/ghostbrand' . $p);
        eq($o['status'], 403, 'other brand ' . $p); eq($g['status'], 403); eq($o['body'], $g['body'], 'answers differ for ' . $p);
    }
    eq($f->req('POST', '/northlight/api/log', ['body' => '{"event":"export"}', 'headers' => ['Content-Type: application/json']])['status'], 403);
    lacks($f->get('/northlight/api/brand.json')['body'], 'Northlight');
});
test('cookies do not move between brands: each brand’s session only opens its own brand', function () {
    $f = signed_in('forma'); $n = signed_in('northlight');
    eq($f->get('/forma/api/brand.json')['status'], 200); eq($n->get('/northlight/api/brand.json')['status'], 200);
    eq($n->get('/forma/api/brand.json')['status'], 403); eq($f->get('/northlight/api/brand.json')['status'], 403);
    $swap = new Browser; $swap->jar['stms_hub'] = $f->session(); eq($swap->get('/forma/api/brand.json')['status'], 200); eq($swap->get('/northlight/api/brand.json')['status'], 403);
});
test('brand record: right brand, address/status/version from the database, no password or hash anywhere', function () {
    $r = signed_in('forma')->get('/forma/api/brand.json'); $j = json_decode($r['body'], true);
    eq($r['status'], 200); eq($j['name'], 'FORMA'); eq($j['slug'], 'forma'); eq($j['status'], 'live'); eq($j['version'], 1); eq(count($j['palette']), 3);
    foreach (['$2y$', 'password', 'hash', 'secret'] as $bad) lacks(strtolower($r['body']), strtolower($bad), 'leak');
    has($r['headers']['content-type'][0], 'application/json'); has($r['headers']['cache-control'][0], 'no-store'); has($r['headers']['x-content-type-options'][0], 'nosniff');
    eq(signed_in('forma')->get('/forma/api/brand.json', [])['status'], 200);
});
test('a record that somehow holds secret-looking keys is stripped before it is sent', function () {
    global $pdo; clear_attempts();
    $cfg = json_decode(file_get_contents(dirname(__DIR__) . '/studio/fixtures/dark-sans.json'), true);
    $cfg['slug'] = 'leaky'; $cfg['name'] = 'Leaky'; $cfg['password'] = 'plaintext!'; $cfg['studio']['salt'] = 'abc'; $cfg['look']['nested'] = ['password_hash' => 'zzz', 'ok' => 1];
    $hash = password_hash('leaky-password-123', PASSWORD_BCRYPT, ['cost' => HASH_COST]);
    $pdo->prepare("INSERT INTO brands (slug, password_hash, status) VALUES ('leaky', ?, 'live')")->execute([$hash]);
    $id = (int)$pdo->lastInsertId(); $pdo->prepare('INSERT INTO brand_versions (brand_id, version, config) VALUES (?, 1, ?)')->execute([$id, json_encode($cfg)]);
    $b = new Browser; $b->login('leaky', 'leaky-password-123'); $r = $b->get('/leaky/api/brand.json');
    eq($r['status'], 200); foreach (['plaintext!', 'zzz', '"salt"', 'password'] as $bad) lacks($r['body'], $bad, 'leak'); has($r['body'], '"ok":1');
});
test('files: a brand gets its own logos and fonts with safe headers, and not another brand’s', function () {
    $f = signed_in('forma'); $n = signed_in('northlight');
    $s = $f->get('/forma/files/logos/primary.svg'); eq($s['status'], 200); eq($s['headers']['content-type'][0], 'image/svg+xml');
    has($s['headers']['content-security-policy'][0], 'sandbox'); has($s['headers']['x-content-type-options'][0], 'nosniff'); has($s['headers']['cache-control'][0], 'private');
    $w = $f->get('/forma/files/fonts/brand.woff2'); eq($w['status'], 200); eq($w['headers']['content-type'][0], 'font/woff2'); eq(strlen($w['body']), 200);
    has($n->get('/northlight/files/logos/primary.svg')['body'], 'NORTHLIGHT SECRET');
    eq($n->get('/forma/files/logos/primary.svg')['status'], 403); eq($f->get('/northlight/files/logos/primary.svg')['status'], 403);
    eq((new Browser)->get('/forma/files/logos/primary.svg')['status'], 403, 'not signed in');
});
test('files: path tricks, symbolic links, hidden files and non-image files are all refused', function () {
    $f = signed_in('forma');
    $paths = [
        '/forma/files/../../config.php', '/forma/files/%2e%2e/%2e%2e/config.php', '/forma/files/..%2f..%2fconfig.php', '/forma/files/%252e%252e/%252e%252e/config.php',
        '/forma/files/logos/..%5c..%5cnotes.txt', '/forma/files/logos/../../northlight/logos/primary.svg', '/forma/files/logos/%2e%2e/%2e%2e/northlight/logos/primary.svg',
        '/forma/files//etc/passwd', '/forma/files/etc/passwd', '/forma/files/%2Fetc%2Fpasswd', '/forma/files/....//....//notes.txt',
        '/forma/files/logos/', '/forma/files/logos', '/forma/files/.htaccess', '/forma/files/logos/.hidden.svg', '/forma/files/logos/leak.svg', '/forma/files/logos/cross.svg',
        '/forma/files/notes.txt', '/forma/files/logos/script.php', '/forma/files/logos/data.json', '/forma/files/' . str_repeat('a/', 150) . 'x.svg', '/forma/files/logos/primary.SVG.php', '/forma/files/logos/pr%20imary.svg',
    ];
    foreach ($paths as $p) {
        $r = $f->get($p);
        ok(in_array($r['status'], [400, 403, 404], true), "$p answered " . $r['status']);
        foreach (['TOP SECRET', 'NORTHLIGHT SECRET', 'EXECUTED', 'root:', '<?php', '"a":1'] as $m) lacks($r['body'], $m, "$p leaked");
    }
    foreach (['/forma/files/logos/..', '/forma/files/..'] as $p) ok($f->get($p)['status'] !== 200, $p);
});
test('an encoded null byte in an address can never reach anything it should not', function () {
    // Some web servers cut the address at the null byte before the app sees it. Either way, the
    // result must be a refusal, the same page the visitor was already allowed, or a sign-in page.
    $f = signed_in('forma'); $legit = file_get_contents($GLOBALS['storage'] . '/brands/forma/logos/primary.svg');
    foreach (['/forma/files/logos/primary.svg%00.png', '/forma/files/logos/primary.png%00', '/forma/files/%00/etc/passwd', '/forma/files/logos/..%00/../../northlight/logos/primary.svg', '/northlight/files/logos/primary.svg%00'] as $p) {
        $r = $f->get($p); ok(in_array($r['status'], [200, 400, 403, 404], true), "$p answered " . $r['status']);
        if ($r['status'] === 200) eq($r['body'], $legit, "$p returned something other than the visitor's own file");
        foreach (['NORTHLIGHT SECRET', 'TOP SECRET', 'root:'] as $m) lacks($r['body'], $m);
    }
    $p = (new Browser)->get('/fo%00rma/'); ok(in_array($p['status'], [200, 404], true)); lacks($p['body'], 'FORMA');
});
test('files: the same checks hold when the function is called directly', function () {
    global $storage;
    ok(resolve_brand_file('forma', 'logos/primary.svg') !== null);
    foreach (['../northlight/logos/primary.svg', 'logos/../../northlight/logos/primary.svg', '/etc/passwd', 'logos/leak.svg', 'logos/cross.svg', "logos/primary.svg\0.png", '.hidden.svg', 'logos/.hidden.svg', 'logos/script.php', 'logos/data.json', '', 'logos//primary.svg', 'logos\\primary.svg', 'logos/%2e%2e/x.svg'] as $p)
        eq(resolve_brand_file('forma', $p), null, "should refuse: " . json_encode($p));
    eq(resolve_brand_file('../northlight', 'logos/primary.svg'), null, 'bad slug'); eq(resolve_brand_file('nosuch', 'logos/primary.svg'), null);
});
test('the app’s own folders and secrets are not on the web: config, app code, storage, database files', function () {
    $b = new Browser;
    foreach (['/config.php', '/config.test.php', '/app/bootstrap.php', '/app/security.php', '/storage/brands/forma/logos/primary.svg', '/storage/notes.txt', '/db/schema.sql', '/tools/add-brand.php', '/tests/server/run.php', '/.htaccess', '/.env', '/index.php', '/../config.php', '/%2e%2e/config.php'] as $p) {
        $r = $b->get($p); ok($r['status'] === 404 || $r['status'] === 403 || $r['status'] === 400, "$p answered " . $r['status']);
        foreach (['<?php', 'password_hash', 'CREATE TABLE', 'TOP SECRET', 'DUMMY_HASH'] as $m) lacks($r['body'], $m, "$p leaked");
    }
});
test('addresses: no list of brands, bad or reserved names are 404, a missing slash is fixed, wrong methods get 405', function () {
    $b = new Browser;
    $root = $b->get('/'); eq($root['status'], 200); foreach (['forma', 'northlight', 'sandstone'] as $s) lacks(strtolower($root['body']), $s);
    foreach (['/FORMA/', '/-x/', '/a_b/', '/studio/', '/layouts/', '/api/', '/files/', '/' . str_repeat('a', 41) . '/', '/%2e%2e/'] as $p) eq($b->get($p)['status'], 404, $p);
    $r = $b->get('/forma'); eq($r['status'], 301); eq($r['headers']['location'][0], '/forma/');
    foreach ([['GET', '/forma/login', 'POST'], ['GET', '/forma/logout', 'POST'], ['POST', '/forma/', 'GET'], ['PUT', '/forma/api/brand.json', 'GET'], ['GET', '/forma/api/log', 'POST'], ['POST', '/forma/files/logos/primary.svg', 'GET']] as [$m, $p, $allow]) {
        $x = $b->req($m, $p); eq($x['status'], 405, "$m $p"); has($x['headers']['allow'][0], $allow);
    }
    eq($b->get('/studio/js/main.js')['status'], 200, 'static studio files are still served');
});
test('sign out: needs its token, ends the session for good, and the old cookie is dead', function () {
    $f = signed_in('forma'); $old = $f->session(); $tok = $f->csrf('forma');
    eq($f->post('/forma/logout', [])['status'], 400); eq($f->get('/forma/api/brand.json')['status'], 200, 'still signed in after a refused sign-out');
    eq($f->post('/forma/logout', ['csrf' => $tok], ['headers' => ['Origin: http://evil.example']])['status'], 400);
    eq($f->post('/forma/logout', ['csrf' => $tok])['status'], 303);
    $replay = new Browser; $replay->jar['stms_hub'] = $old; eq($replay->get('/forma/api/brand.json')['status'], 403, 'replayed old session');
    eq($f->get('/forma/api/brand.json')['status'], 403);
});
test('changing a brand’s password signs everyone out; removing a brand does too', function () {
    global $pdo, $PW; $n = signed_in('northlight'); eq($n->get('/northlight/api/brand.json')['status'], 200);
    $old = $pdo->query("SELECT password_hash FROM brands WHERE slug='northlight'")->fetchColumn();
    $pdo->prepare("UPDATE brands SET password_hash = ? WHERE slug = 'northlight'")->execute([password_hash('a-brand-new-password', PASSWORD_BCRYPT, ['cost' => HASH_COST])]);
    eq($n->get('/northlight/api/brand.json')['status'], 403, 'after password change');
    $pdo->prepare("UPDATE brands SET password_hash = ? WHERE slug = 'northlight'")->execute([$old]);
    $l = new Browser; clear_attempts(); $l->login('leaky', 'leaky-password-123'); eq($l->get('/leaky/api/brand.json')['status'], 200);
    $pdo->exec("DELETE FROM brands WHERE slug = 'leaky'"); eq($l->get('/leaky/api/brand.json')['status'], 403, 'after brand removed');
});
test('sessions end when idle too long', function () {
    $f = signed_in('forma'); eq($f->get('/forma/api/brand.json')['status'], 200);
    $dir = $GLOBALS['storage'] . '/sessions'; $file = $dir . '/sess_' . $f->session(); ok(is_file($file), 'session file');
    $data = file_get_contents($file); $data = preg_replace('/last\|i:\d+;/', 'last|i:' . (time() - SESSION_IDLE_SECONDS - 60) . ';', $data); file_put_contents($file, $data);
    eq($f->get('/forma/api/brand.json')['status'], 403, 'idle session must be refused');
});
test('stored text is escaped on the page (a hostile brand name cannot run anything)', function () {
    global $pdo; clear_attempts();
    $cfg = json_decode(file_get_contents(dirname(__DIR__) . '/studio/fixtures/dark-sans.json'), true);
    $cfg['slug'] = 'xss'; $cfg['name'] = '<img src=x onerror=alert(1)> & "quotes"';
    $pdo->prepare("INSERT INTO brands (slug, password_hash, status) VALUES ('xss', ?, 'live')")->execute([password_hash('xss-password-1234', PASSWORD_BCRYPT, ['cost' => HASH_COST])]);
    $pdo->prepare('INSERT INTO brand_versions (brand_id, version, config) VALUES (?, 1, ?)')->execute([(int)$pdo->lastInsertId(), json_encode($cfg)]);
    $b = new Browser; $b->login('xss', 'xss-password-1234'); $page = $b->get('/xss/')['body'];
    has($page, '&lt;img src=x onerror=alert(1)&gt;'); lacks($page, '<img src=x');
});

test('hub page: only when signed in, carries only this brand’s record, and runs only the site’s own script', function () {
    eq(strpos((new Browser)->get('/northlight/')['body'], 'brand-data'), false, 'no record before signing in');
    $b = signed_in('northlight'); $r = $b->get('/northlight/'); $page = $r['body'];
    ok(preg_match('#<script type="application/json" id="brand-data">(.*?)</script>#s', $page, $m) === 1, 'record block missing');
    $j = json_decode($m[1], true); eq($j['slug'], 'northlight'); eq($j['name'], 'Northlight');
    foreach (['FORMA', '"forma"', 'Sandstone', '$2y$', 'password'] as $bad) lacks($m[1], $bad, 'record');
    has($page, '<script type="module" src="/hub/hub.js"></script>'); has($page, 'Sign out'); has($page, 'name="csrf"');
    $csp = $r['headers']['content-security-policy'][0]; has($csp, "script-src 'self'"); lacks($csp, 'unsafe-eval'); lacks($csp, "script-src 'self' 'unsafe-inline'");
});
test('hub page: a hostile value in the record cannot end the script block', function () {
    $b = new Browser; $b->login('xss', 'xss-password-1234'); $page = $b->get('/xss/')['body'];
    preg_match('#<script type="application/json" id="brand-data">(.*?)</script>#s', $page, $m);
    lacks($m[1], '<'); lacks($m[1], '>'); eq(json_decode($m[1], true)['name'], '<img src=x onerror=alert(1)> & "quotes"');
});
test('"hub" is reserved: no brand can take the address the hub’s own files use', function () {
    ok(reserved_slug('hub')); eq((new Browser)->get('/hub/')['status'], 404);
});

// ================================================================ usage log
test('usage log: login, export and blocked export are recorded; a visitor cannot forge anything else', function () {
    global $pdo; $pdo->exec('DELETE FROM usage_log'); $f = signed_in('forma');
    $post = function ($body, $h = ['Content-Type: application/json']) use ($f) { return $f->req('POST', '/forma/api/log', ['body' => $body, 'headers' => $h]); };
    eq($post('{"event":"export"}')['status'], 204); eq($post('{"event":"blocked_export"}', ['Content-Type: application/json', 'Origin: ' . BASE])['status'], 204);
    eq($post('{"event":"login"}')['status'], 400, 'clients cannot log a login'); eq($post('{"event":"drop table"}')['status'], 400); eq($post('not json')['status'], 400); eq($post('{"event":"export"' . str_repeat(' ', 700) . '}')['status'], 400);
    eq($post('event=export', ['Content-Type: application/x-www-form-urlencoded'])['status'], 415);
    eq($post('{"event":"export"}', ['Content-Type: application/json', 'Origin: http://evil.example'])['status'], 403);
    eq((new Browser)->req('POST', '/forma/api/log', ['body' => '{"event":"export"}', 'headers' => ['Content-Type: application/json']])['status'], 403, 'not signed in');
    $rows = $pdo->query('SELECT event FROM usage_log ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);
    eq($rows, ['login', 'export', 'blocked_export']);
});
test('usage log holds brand, event and time only, and no visitor address is stored anywhere', function () {
    global $pdo, $d; $cols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = " . $pdo->quote($d['name']) . " AND TABLE_NAME = 'usage_log' ORDER BY ORDINAL_POSITION")->fetchAll(PDO::FETCH_COLUMN);
    eq($cols, ['id', 'brand_id', 'event', 'at']);
    clear_attempts(); $b = new Browser; $b->post('/forma/login', ['password' => 'nope-nope-nope', 'csrf' => $b->csrf('forma')]);
    $who = $pdo->query('SELECT who FROM login_attempts')->fetchAll(PDO::FETCH_COLUMN); ok(count($who) === 1 && preg_match('/^[0-9a-f]{64}$/', $who[0]) === 1, 'who is a keyed hash');
    ok($who[0] !== hash('sha256', '127.0.0.1'), 'it is keyed, not a plain hash of the address');
    foreach (['usage_log', 'login_attempts', 'brands', 'brand_versions'] as $t) foreach ($pdo->query("SELECT * FROM `$t`") as $row) foreach ($row as $v) { lacks((string)$v, '127.0.0.1'); lacks((string)$v, '::1'); }
});

// ================================================================ failures show nothing
foreach ([['wrong database password', function ($tmp, $d, $storage, $secret) { $d['pass'] = 'definitely-wrong'; write_config($tmp . '/bad.php', $d, $storage, $secret); return $tmp . '/bad.php'; }], ['missing config file', function () { return '/nonexistent/config.php'; }]] as [$label, $make]) {
    test("failure ($label): a plain message and nothing technical shown", function () use ($make, $tmp, $d, $storage, $secret, $label) {
        $p = $make($tmp, $d, $storage, $secret); $port2 = free_port(); $srv = start_server($port2, $p);
        try {
            $jar = tempnam(sys_get_temp_dir(), 'jar');
            $ch = curl_init('http://127.0.0.1:' . $port2 . '/forma/'); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar]);
            $page = (string)curl_exec($ch); $st0 = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
            preg_match('/name="csrf" value="([0-9a-f]+)"/', $page, $m);
            $ch = curl_init('http://127.0.0.1:' . $port2 . '/forma/login'); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar, CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query(['password' => 'whatever-password', 'csrf' => $m[1] ?? ''])]);
            $body = (string)curl_exec($ch); $st = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); unlink($jar);
            if ($label === 'missing config file') eq($st0, 500, 'page without config');
            eq($st, 500); has($body, 'Something went wrong');
            foreach (['SQLSTATE', 'Access denied', 'PDOException', 'stms_test', $d['pass'], 'definitely-wrong', '/Users/', 'Stack trace', 'config'] as $mm) lacks($body, $mm, 'leaked');
        } finally { proc_terminate($srv); }
    });
}

// ================================================================ the add-brand tool
test('add-brand: the password is never taken from the command line, and the SQL never contains it', function () {
    global $FIX; $r = run_tool(['new', $FIX . 'dark-sans.json', 'hunter2hunter2']); eq($r['code'], 2); eq($r['out'], '', 'no SQL on a refused run');
    $r = run_tool(['new', $FIX . 'dark-sans.json', '--password=hunter2hunter2']); eq($r['code'], 2); eq($r['out'], '');
    $r = run_tool(['new', $FIX . 'dark-sans.json', '--generate']); eq($r['code'], 0); $pw = password_from($r['err']); ok($pw && strlen($pw) === 23, 'generated password shown on screen');
    lacks($r['out'], $pw, 'SQL contains the password'); lacks($r['out'], str_replace('-', '', $pw)); eq(substr_count($r['err'], $pw), 1, 'shown exactly once');
    ok(preg_match("/'(\\\$2y\\\$12\\\$[^']+)'/", $r['out'], $m) === 1, 'bcrypt cost 12 hash'); ok(password_verify($pw, $m[1]));
});
test('add-brand: the typed-password prompt is hidden, asks twice and works (run in a real terminal)', function () {
    global $ROOT, $pdo; if (!trim((string)shell_exec('command -v script'))) { echo "      (skipped: no 'script' command)\n"; return; }
    $typed = 'a-typed-password-1';
    $cmd = 'cd ' . escapeshellarg($ROOT) . ' && (sleep 1; printf "%s\n" ' . escapeshellarg($typed) . '; sleep 1; printf "%s\n" ' . escapeshellarg($typed) . '; sleep 1) | script -q /dev/null ' . escapeshellarg(PHP_BINARY) . ' tools/add-brand.php password forma 2>&1';
    $out = (string)shell_exec($cmd);
    lacks($out, $typed, 'the typed password was echoed or printed'); ok(preg_match("/'(\\\$2y\\\$12\\\$[^']+)'/", $out, $m) === 1, 'no hash produced: ' . substr($out, 0, 300)); ok(password_verify($typed, $m[1]), 'hash does not match what was typed');
    $bad = (string)shell_exec('cd ' . escapeshellarg($ROOT) . ' && (sleep 1; printf "short\n"; sleep 1) | script -q /dev/null ' . escapeshellarg(PHP_BINARY) . ' tools/add-brand.php password forma 2>&1'); has($bad, 'at least 12');
});
test('add-brand: round trip. Names with quotes, backslashes and SQL survive, nothing else is touched', function () {
    global $pdo, $FIX; $cfg = json_decode(file_get_contents($FIX . 'light-serif.json'), true);
    $cfg['slug'] = 'oneil'; $cfg['name'] = "O'Neil \\ \"Co\"; DROP TABLE brands; -- é 漢"; $cfg['status'] = 'live'; $cfg['version'] = 99; $f = sys_get_temp_dir() . '/oneil-' . bin2hex(random_bytes(3)) . '.json';
    file_put_contents($f, json_encode($cfg)); $r = run_tool(['new', $f, '--generate']); eq($r['code'], 0, $r['err']); $pdo->exec($r['out']); unlink($f);
    $row = $pdo->query("SELECT b.slug, b.status, b.current_version, v.config FROM brands b JOIN brand_versions v ON v.brand_id = b.id WHERE b.slug = 'oneil'")->fetch();
    $stored = json_decode($row['config'], true); eq($stored['name'], $cfg['name']); eq($row['status'], 'draft'); eq((int)$row['current_version'], 1); ok(!isset($stored['version']) && !isset($stored['status']), 'status and version are columns, not stored in the record');
    ok((int)$pdo->query('SELECT COUNT(*) FROM brands')->fetchColumn() >= 3, 'brands table intact');
});
test('add-brand: records that break the rules are refused with plain reasons and no SQL', function () {
    global $FIX; $base = json_decode(file_get_contents($FIX . 'dark-sans.json'), true);
    $cases = [
        'look.theme' => [function ($c) { $c['look']['theme'] = 'dark'; return $c; }, 'look.theme is no longer stored'],
        'password key' => [function ($c) { $c['password'] = 'x'; return $c; }, 'must not be stored'],
        'nested secret' => [function ($c) { $c['studio']['secret'] = 'x'; return $c; }, 'studio.secret'],
        'one colour' => [function ($c) { $c['palette'] = [$c['palette'][0]]; return $c; }, '2 to 12'],
        'thirteen colours' => [function ($c) { $c['palette'] = array_fill(0, 13, $c['palette'][0]); return $c; }, '2 to 12'],
        'bad hex' => [function ($c) { $c['palette'][1]['hex'] = 'blue'; return $c; }, 'no valid HEX'],
        'reserved slug' => [function ($c) { $c['slug'] = 'studio'; return $c; }, 'used by the site itself'],
        'bad slug' => [function ($c) { $c['slug'] = 'Fo Rma'; return $c; }, 'slug must be'],
        'no light text colour' => [function ($c) { $c['studio']['photo_text_colours'] = ['#0B0D0E', '#111111']; return $c; }, 'light and one dark'],
        'unknown format' => [function ($c) { $c['studio']['formats'] = ['2:3']; return $c; }, 'unknown format'],
        'http library' => [function ($c) { $c['library'] = 'http://x.example'; return $c; }, 'https://'],
        'layout path' => [function ($c) { $c['studio']['layouts'] = ['../x']; return $c; }, 'bad layout id'],
    ];
    foreach ($cases as $name => [$mutate, $expect]) {
        $f = sys_get_temp_dir() . '/bad-' . bin2hex(random_bytes(3)) . '.json'; file_put_contents($f, json_encode($mutate($base)));
        $r = run_tool(['new', $f, '--generate']); unlink($f);
        eq($r['code'], 1, "$name should be refused"); eq($r['out'], '', "$name produced SQL"); has($r['err'], $expect, $name);
    }
    $r = run_tool(['new', '/no/such/file.json', '--generate']); eq($r['code'], 2); $r = run_tool(['frobnicate']); eq($r['code'], 2);
});
test('add-brand: a new version keeps the old one, and the site serves the new one at once', function () {
    global $pdo, $FIX, $PW; clear_attempts(); $cfg = json_decode(file_get_contents($FIX . 'dark-sans.json'), true); $cfg['name'] = 'FORMA Two';
    $f = sys_get_temp_dir() . '/v2-' . bin2hex(random_bytes(3)) . '.json'; file_put_contents($f, json_encode($cfg));
    $r = run_tool(['version', $f]); unlink($f); eq($r['code'], 0, $r['err']); $b = signed_in('forma'); eq(json_decode($b->get('/forma/api/brand.json')['body'], true)['version'], 1);
    $pdo->exec($r['out']);
    $j = json_decode($b->get('/forma/api/brand.json')['body'], true); eq($j['name'], 'FORMA Two'); eq($j['version'], 2);
    eq((int)$pdo->query("SELECT COUNT(*) FROM brand_versions v JOIN brands b ON b.id = v.brand_id WHERE b.slug = 'forma'")->fetchColumn(), 2, 'old version kept');
    eq(json_decode($pdo->query("SELECT v.config FROM brand_versions v JOIN brands b ON b.id = v.brand_id WHERE b.slug = 'forma' AND v.version = 1")->fetchColumn(), true)['name'], 'FORMA', 'version 1 untouched');
});
test('add-brand: changing a password changes who can sign in', function () {
    global $pdo, $PW; clear_attempts(); $r = run_tool(['password', 'sandstone', '--generate']); eq($r['code'], 0, $r['err']); $new = password_from($r['err']); $pdo->exec($r['out']);
    $b = new Browser; eq($b->login('sandstone', $PW['sandstone'])['status'], 401, 'old password refused'); clear_attempts(); eq($b->login('sandstone', $new)['status'], 303, 'new password works');
});

// ---------------------------------------------------------------- go
echo "Server checks against " . BASE . " (database " . $d['name'] . ")\n\n";
foreach ($tests as [$name, $fn]) {
    try { $fn(); $pass++; echo "PASS  $name\n"; }
    catch (Throwable $e) { $fail++; echo "FAIL  $name\n      -> " . $e->getMessage() . "\n"; }
}
echo "\nSUMMARY $pass passed, $fail failed\n";
exit($fail ? 1 : 0);
