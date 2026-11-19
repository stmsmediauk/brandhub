<?php
declare(strict_types=1);

// Every page here is STMS Media branded, whichever brand it is for. (The STMS colours
// are placeholders, as in design/Login.dc.html.) Brand names are escaped with h().

function page_css(): string
{
    return <<<'CSS'
:root{--bg:#fff;--surface:#F5F5F3;--ink:#0A0A0A;--muted:#5A5A57;--line:#DADAD6;--accent:#FF00FF;--onAccent:#0A0A0A;--r:4px;--hero:#FF00FF;--heroInk:#0A0A0A}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Inter',system-ui,sans-serif;font-size:16px;line-height:1.5}
a{color:inherit}
.wrap{display:flex;flex-wrap:wrap;min-height:100vh}
.hero{flex:1 1 520px;min-height:340px;background:var(--hero);color:var(--heroInk);padding:56px 64px;display:flex;flex-direction:column;justify-content:space-between;gap:48px}
.logo{font-weight:700;letter-spacing:-.03em;text-transform:lowercase;font-size:26px}
.eyebrow{font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-family:ui-monospace,Menlo,monospace}
.big{margin:18px 0 0;font-weight:700;letter-spacing:-.03em;text-transform:lowercase;font-size:clamp(38px,5vw,64px);line-height:1.02;max-width:520px}
.sub{font-size:14px;margin:0;opacity:.82}
.pane{flex:1 1 440px;display:flex;align-items:center;justify-content:center;padding:48px 32px}
form,.box{width:100%;max-width:400px;display:flex;flex-direction:column;gap:22px}
h1{margin:0;font-weight:700;letter-spacing:-.03em;font-size:32px;line-height:1.1;text-transform:lowercase}
p{margin:0}
.muted{color:var(--muted)}
label{font-size:14px;font-weight:600}
input[type=password]{width:100%;padding:15px 16px;border-radius:var(--r);border:1.5px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;min-height:52px}
input:focus-visible,button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
button,.btn{background:var(--accent);color:var(--onAccent);border:none;border-radius:var(--r);padding:16px 24px;font:inherit;font-weight:600;min-height:52px;cursor:pointer;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.btn.ghost,button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.alert{padding:12px 14px;border-radius:var(--r);background:#FDECEC;color:#8A1C1C;font-size:14.5px}
.field{display:flex;flex-direction:column;gap:8px}
CSS;
}

function page_shell(string $title, string $body): string
{
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex, nofollow"><title>' . h($title) . '</title>'
        . '<link rel="preconnect" href="https://fonts.googleapis.com">'
        . '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">'
        . '<style>' . page_css() . '</style></head><body>' . $body . '</body></html>';
}

function hero_panel(): string
{
    return '<section class="hero"><span class="logo">stms media</span><div><span class="eyebrow">STMS Media · Brand hub</span>'
        . '<p class="big">Your brand hub, in one place.</p></div>'
        . '<p class="sub">Logos, colours, fonts and an artwork studio that keeps everything on brand.</p></section>';
}

// The sign-in page. It is identical for a real brand and one that does not exist.
function view_login(string $slug, string $csrf, ?string $error = null): string
{
    $err = $error !== null ? '<div class="alert" role="alert">' . h($error) . '</div>' : '';
    $form = '<form method="post" action="/' . h($slug) . '/login" autocomplete="off">'
        . '<div class="field"><h1>Sign in</h1><p class="muted">Enter your password to open your brand hub.</p></div>' . $err
        . '<div class="field"><label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" maxlength="' . (int)PASSWORD_MAX . '"></div>'
        . '<input type="hidden" name="csrf" value="' . h($csrf) . '">'
        . '<button type="submit">Open my brand hub</button>'
        . '<p class="muted" style="font-size:13.5px">Lost the password? Contact STMS Media.</p></form>';
    return page_shell('Brand hub sign in', '<div class="wrap">' . hero_panel() . '<section class="pane">' . $form . '</section></div>');
}

function view_message(string $title, string $text): string
{
    $box = '<div class="box"><h1>' . h($title) . '</h1><p class="muted">' . h($text) . '</p></div>';
    return page_shell($title, '<div class="wrap">' . hero_panel() . '<section class="pane">' . $box . '</section></div>');
}

// Placeholder for the signed-in page until the hub is built (slice 2).
function view_signed_in(array $brand, string $csrf): string
{
    $name = (string)(json_decode((string)$brand['config'], true)['name'] ?? $brand['slug']);
    $box = '<div class="box"><h1>' . h($name) . '</h1><p class="muted">You are signed in. The brand hub is coming next.</p>'
        . '<form method="post" action="/' . h((string)$brand['slug']) . '/logout" style="max-width:none">'
        . '<input type="hidden" name="csrf" value="' . h($csrf) . '"><button class="ghost" type="submit">Sign out</button></form></div>';
    return page_shell($name . ' brand hub', '<div class="wrap">' . hero_panel() . '<section class="pane">' . $box . '</section></div>');
}
