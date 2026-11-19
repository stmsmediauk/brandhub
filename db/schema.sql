-- Draft schema. Matches docs/data-shapes.md. Review before running.

CREATE TABLE brands (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(60) NOT NULL UNIQUE,            -- the address, e.g. forma
  password_hash VARCHAR(255) NOT NULL,         -- one shared password per brand, hashed
  status ENUM('draft','live') NOT NULL DEFAULT 'draft',
  current_version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE brand_versions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  brand_id INT UNSIGNED NOT NULL,
  version INT UNSIGNED NOT NULL,
  config JSON NOT NULL,                        -- the full brand record
  saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY brand_version (brand_id, version),
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

CREATE TABLE usage_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  brand_id INT UNSIGNED NOT NULL,
  event VARCHAR(40) NOT NULL,                  -- login, export, blocked_export
  layout VARCHAR(40) NULL,
  format VARCHAR(20) NULL,
  file_type VARCHAR(10) NULL,                  -- png or jpg
  detail VARCHAR(255) NULL,
  at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY brand_at (brand_id, at),
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);
