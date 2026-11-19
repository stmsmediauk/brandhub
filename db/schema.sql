-- Matches docs/data-shapes.md. Real MySQL / MariaDB SQL (utf8mb4).
-- Safe to run on an empty database. Never run on a live one without a backup.

CREATE TABLE brands (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(40) NOT NULL UNIQUE,            -- the address, e.g. forma. Lower case letters, digits and hyphens
  password_hash VARCHAR(255) NOT NULL,         -- one shared password per brand, bcrypt hash only
  status ENUM('draft','live') NOT NULL DEFAULT 'draft',
  current_version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE brand_versions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  brand_id INT UNSIGNED NOT NULL,
  version INT UNSIGNED NOT NULL,
  config LONGTEXT NOT NULL,                    -- the full brand record as JSON (never the password)
  saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY brand_version (brand_id, version),
  CONSTRAINT fk_versions_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Brand, event and time. Nothing else: no address, no layout, no file name.
CREATE TABLE usage_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  brand_id INT UNSIGNED NOT NULL,
  event VARCHAR(20) NOT NULL,                  -- login, export or blocked_export
  at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY brand_at (brand_id, at),
  CONSTRAINT fk_usage_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wrong-password attempts, only to slow down guessing. Kept for a day at most.
-- `slug` is whatever was typed in the address, whether or not that brand exists,
-- so a real brand and a made-up one are treated identically.
-- `who` is a keyed hash of the visitor's address. The address itself is never stored.
CREATE TABLE login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(40) NOT NULL,
  who CHAR(64) NOT NULL,
  at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY slug_who_at (slug, who, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
