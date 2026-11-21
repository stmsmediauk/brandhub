# Server side: sign-in, isolation and the brand record

Slice 1 of build step 2. PHP 7.4 or newer (written to be safe on older hosting; tested on PHP 8.5) and MySQL or MariaDB. No framework, no Composer.

## How a request flows

Every address that is not a real file goes to `public/index.php` (one rewrite rule in `public/.htaccess`). `app/routes.php` is the only place that decides what an address means:

| Address | What it does |
|---|---|
| `/` | A plain STMS Media page. No list of brands. |
| `/<slug>/` | The sign-in page, or the hub page when signed in to that brand. The hub page carries that brand's record (as `/api/brand.json` gives it) and runs `/hub/hub.js`, with its own security policy allowing only the site's own script and the brand's fonts. |
| `POST /<slug>/login` | Checks the password. |
| `POST /<slug>/logout` | Signs out. |
| `/<slug>/api/brand.json` | The signed-in brand's record. |
| `POST /<slug>/api/log` | The studio reporting `export` or `blocked_export`. |
| `/<slug>/files/<path>` | The brand's own logos and fonts, from `storage/brands/<slug>/`. |

Static files under `public/` (the studio's and the hub's scripts, and the layouts) are served directly and are the same for every brand. Because of that, a brand cannot use `studio`, `hub`, `layouts`, `api`, `files` and similar words as its address (`RESERVED_SLUGS` in `app/security.php`).

## How isolation works

- The session remembers one brand. Every request for a brand's page, record, files or log checks that the brand in the address is that brand, against the database, every time.
- For a brand you are not signed in to, the answer is identical whether that brand exists or not: the same sign-in page, the same `403` for the record and files.
- Files are only served from `storage/brands/<slug>/`, by plain names with a known image or font extension. `..`, encoded dots, backslashes, hidden files, symbolic links that leave the folder, and everything else are refused.
- The password is stored only as a bcrypt hash and checked on the server. An unknown brand runs a dummy check, so it takes the same time.
- Wrong passwords are slowed down: 5 misses in 15 minutes per visitor per address (a keyed hash of the visitor's address, never the address) gives a "try again later" page, even for the right password.
- The sign-in form has a token and refuses other sites. Every page sends `no-store` and `nosniff` headers; SVG files are sent with a sandbox policy.
- The session cookie is HttpOnly, SameSite=Lax and a browser-session cookie, and **Secure everywhere except when the connection comes from the same computer** (localhost).
- Errors show a plain "Something went wrong". The detail goes to the server's error log.

## Local setup (once)

1. `brew install mariadb` and `brew services start mariadb`.
2. Make a test database and a user for it (the tests drop and recreate its tables, so the name must end in `_test`):
   ```
   mariadb -e "CREATE DATABASE stms_brand_test CHARACTER SET utf8mb4; CREATE USER 'stms_test'@'localhost' IDENTIFIED BY 'pick-a-password'; GRANT ALL ON stms_brand_test.* TO 'stms_test'@'localhost';"
   ```
3. Copy that into `config.test.php` in the project folder (Git ignores it):
   ```php
   <?php return ['db' => ['host' => '127.0.0.1', 'port' => 3306, 'name' => 'stms_brand_test', 'user' => 'stms_test', 'pass' => 'pick-a-password']];
   ```

## Running the checks

- `php tests/server/run.php`: builds the test database, adds three test brands with the real tool, starts the real site, and attacks it. Every line should say PASS.
- `php tests/server/run.php --serve`: same set-up, then keeps the site running and prints each test brand's address and password, so you can sign in by hand. The passwords are for the test database only and change every run.

## Putting a brand in the database

The tool prints SQL. It never touches a database, so you paste its output into phpMyAdmin (SQL tab, right database selected).

```
php tools/add-brand.php new brand.json --generate > add-brand.sql      # new brand, password made for you
php tools/add-brand.php new brand.json --status=live > add-brand.sql   # you type the password at a hidden prompt, twice
php tools/add-brand.php version brand.json > update.sql                # a new version of an existing brand (old versions are kept)
php tools/add-brand.php password <slug> --generate > password.sql      # change the password (signs everyone out)
```

- The password is never a command-line argument. With `--generate` it is shown once on screen and is not in the SQL file. Send it to the client; it cannot be recovered, only replaced.
- The brand JSON is checked first (palette 2 to 12 colours, valid HEX, fonts, formats, layouts, at least one light and one dark photo text colour, no stored password or `look.theme`). Problems are listed in plain words and no SQL is produced.
- `status` and `version` are not kept in the JSON: they are columns.

## Putting it on StackCP

First deployed on 21 November 2026. The real layout, the upload routine and the permissions rule are in the Deploy section of `README.md`. The steps below are how it was set up.

The web folder must contain only the contents of `public/`. The `app/`, `storage/`, `db/` and `tools/` folders and `config.php` must sit **outside** it (the `.htaccess` files in the project are a second lock if they are ever uploaded inside by mistake).

1. Create the database and import `db/schema.sql` in phpMyAdmin.
2. Copy `config.example.php` to `config.php` above the web folder and fill it in. Use a long random `secret`.
3. Upload `app/`, `public/` (into the web folder), `storage/` (empty: it fills itself).
4. Add the brand with the tool and paste its SQL.
5. Check `https://brands.stmsmedia.co.uk/<slug>/` signs in, and that the cookie is marked Secure in the browser's developer tools.

Confirmed there: `.htaccess` rewriting works, `storage/` is writable by PHP, the cookie is Secure over https. The website and the command line both run PHP 8.0.30 (the website was switched from 7.4 in My20i). The database is MariaDB 10.11.

## Not covered yet

The hub sections that need logo files (Logos, Please don't, Supporting marks), the studio served from the signed-in brand (the studio page still loads its brand from a path that does not exist yet), brand file uploads, and the admin screen. Draft versus live is not enforced.
