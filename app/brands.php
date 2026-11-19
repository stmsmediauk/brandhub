<?php
declare(strict_types=1);

const BRAND_SELECT = 'SELECT b.id, b.slug, b.password_hash, b.status, b.current_version, v.config
    FROM brands b JOIN brand_versions v ON v.brand_id = b.id AND v.version = b.current_version';

function find_brand(string $slug): ?array
{
    if (!valid_slug($slug)) return null;
    $st = db()->prepare(BRAND_SELECT . ' WHERE b.slug = ?');
    $st->execute([$slug]);
    $row = $st->fetch();
    return $row ?: null;
}

function find_brand_by_id(int $id): ?array
{
    $st = db()->prepare(BRAND_SELECT . ' WHERE b.id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    return $row ?: null;
}

// Removes anything secret-looking, whatever level it is at. The brand record should
// never hold these (the add-brand tool refuses them), this is the second lock.
function strip_secrets($v)
{
    if (!is_array($v)) return $v;
    $out = [];
    foreach ($v as $k => $x) {
        if (is_string($k) && preg_match('/^(password|password_hash|secret|salt)$/i', $k)) continue;
        $out[$k] = strip_secrets($x);
    }
    return $out;
}

// The brand record the studio and hub are allowed to see. The address, status and
// version always come from the database row, never from the stored JSON.
function brand_json_for_client(array $row): array
{
    $cfg = json_decode((string)$row['config'], true);
    if (!is_array($cfg)) throw new RuntimeException('Brand ' . $row['slug'] . ' has an unreadable record');
    $cfg = strip_secrets($cfg);
    $cfg['slug'] = $row['slug'];
    $cfg['status'] = $row['status'];
    $cfg['version'] = (int)$row['current_version'];
    return $cfg;
}
