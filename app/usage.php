<?php
declare(strict_types=1);

// The usage log holds the brand, the event and the time. Nothing else.
const USAGE_EVENTS = ['login', 'export', 'blocked_export'];
// What the studio page itself may report.
const CLIENT_EVENTS = ['export', 'blocked_export'];

function log_event(int $brandId, string $event): void
{
    if (!in_array($event, USAGE_EVENTS, true)) return;
    try {
        db()->prepare('INSERT INTO usage_log (brand_id, event) VALUES (?, ?)')->execute([$brandId, $event]);
    } catch (Throwable $e) {
        error_log('[brand-platform] usage log failed: ' . $e->getMessage());   // never breaks the visitor's request
    }
}
