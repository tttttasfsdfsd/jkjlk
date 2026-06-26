-- EEXA Enterprise Migration 001
-- RBAC, Refresh Tokens, CSRF, AI Audit, Webhook Idempotency
-- Run: npm run db:migrate

-- ==================== ROLES ====================
CREATE TABLE IF NOT EXISTS `roles` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(50)  NOT NULL,
  `description` VARCHAR(255),
  `is_system`   BOOLEAN      NOT NULL DEFAULT FALSE,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `roles_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== PERMISSIONS ====================
CREATE TABLE IF NOT EXISTS `permissions` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `resource`    VARCHAR(100) NOT NULL,
  `action`      VARCHAR(50)  NOT NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `perm_res_act_idx` (`resource`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== ROLE_PERMISSIONS ====================
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `role_id`       BIGINT UNSIGNED NOT NULL,
  `permission_id` BIGINT UNSIGNED NOT NULL,
  UNIQUE INDEX `rp_role_perm_idx` (`role_id`, `permission_id`),
  INDEX `rp_role_idx` (`role_id`),
  FOREIGN KEY (`role_id`)       REFERENCES `roles`(`id`)       ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== USER_ROLES ====================
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `role_id`    BIGINT UNSIGNED NOT NULL,
  `company_id` BIGINT UNSIGNED,
  `granted_by` BIGINT UNSIGNED,
  `expires_at` TIMESTAMP,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `ur_user_role_co_idx` (`user_id`, `role_id`, `company_id`),
  INDEX `ur_user_idx`    (`user_id`),
  INDEX `ur_company_idx` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== ALTER SESSIONS ====================
ALTER TABLE `sessions`
  ADD COLUMN IF NOT EXISTS `jti`          VARCHAR(64)  NOT NULL DEFAULT '' AFTER `id`,
  ADD COLUMN IF NOT EXISTS `company_id`   BIGINT UNSIGNED AFTER `user_id`,
  ADD COLUMN IF NOT EXISTS `device_name`  VARCHAR(200)  AFTER `company_id`,
  ADD COLUMN IF NOT EXISTS `last_active_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `device_name`;

-- Drop old token column if present (replaced by jti)
-- ALTER TABLE `sessions` DROP COLUMN IF EXISTS `token`;

-- ==================== REFRESH TOKENS ====================
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `token`          VARCHAR(128) NOT NULL,  -- SHA-256 hash
  `session_id`     BIGINT UNSIGNED NOT NULL,
  `user_id`        BIGINT UNSIGNED NOT NULL,
  `family`         VARCHAR(64)  NOT NULL,
  `rotation_count` INT          NOT NULL DEFAULT 0,
  `used_at`        TIMESTAMP,
  `expires_at`     TIMESTAMP    NOT NULL,
  `revoked_at`     TIMESTAMP,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `rt_token_idx`   (`token`),
  INDEX `rt_session_idx` (`session_id`),
  INDEX `rt_user_idx`    (`user_id`),
  INDEX `rt_family_idx`  (`family`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== CSRF TOKENS ====================
CREATE TABLE IF NOT EXISTS `csrf_tokens` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `token`      VARCHAR(128) NOT NULL,
  `session_id` BIGINT UNSIGNED NOT NULL,
  `used_at`    TIMESTAMP,
  `expires_at` TIMESTAMP    NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `csrf_token_idx` (`token`),
  INDEX `csrf_sess_idx` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== WEBHOOK EVENTS ====================
CREATE TABLE IF NOT EXISTS `webhook_events` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `provider`     ENUM('stripe','moyasar') NOT NULL,
  `event_id`     VARCHAR(255) NOT NULL,
  `event_type`   VARCHAR(100) NOT NULL,
  `processed_at` TIMESTAMP,
  `status`       ENUM('pending','processed','failed') NOT NULL DEFAULT 'pending',
  `payload`      TEXT,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `webhook_event_idx` (`provider`, `event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== AI AUDIT LOGS ====================
CREATE TABLE IF NOT EXISTS `ai_audit_logs` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id`            BIGINT UNSIGNED NOT NULL,
  `company_id`         BIGINT UNSIGNED NOT NULL,
  `session_id`         VARCHAR(64),
  `prompt_tokens`      INT,
  `completion_tokens`  INT,
  `model`              VARCHAR(100),
  `injection_detected` BOOLEAN NOT NULL DEFAULT FALSE,
  `grounding_passed`   BOOLEAN NOT NULL DEFAULT TRUE,
  `latency_ms`         INT,
  `created_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `ai_audit_user_idx`    (`user_id`),
  INDEX `ai_audit_company_idx` (`company_id`),
  INDEX `ai_audit_ts_idx`      (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== ALTER REPORTS — companyId MANDATORY ====================
-- In production, first backfill NULLs before adding NOT NULL constraint
-- ALTER TABLE `reports` MODIFY `company_id` BIGINT UNSIGNED NOT NULL;

-- ==================== ALTER AUDIT_LOGS — add company_id + severity ====================
ALTER TABLE `audit_logs`
  ADD COLUMN IF NOT EXISTS `company_id` BIGINT UNSIGNED AFTER `user_id`,
  ADD COLUMN IF NOT EXISTS `severity` ENUM('info','warn','critical') NOT NULL DEFAULT 'info' AFTER `metadata`,
  ADD INDEX IF NOT EXISTS `audit_company_idx`  (`company_id`),
  ADD INDEX IF NOT EXISTS `audit_severity_idx` (`severity`);

-- ==================== SEED: SYSTEM ROLES ====================
INSERT IGNORE INTO `roles` (`name`, `description`, `is_system`) VALUES
  ('super_admin',   'Full platform access — operators only',        TRUE),
  ('company_owner', 'Full access to own company',                   TRUE),
  ('admin',         'Manage users and reports within company',      TRUE),
  ('manager',       'Create and view reports, manage analysts',     TRUE),
  ('analyst',       'Create and view reports',                      TRUE),
  ('viewer',        'Read-only access to reports',                  TRUE);

-- ==================== SEED: PERMISSIONS ====================
INSERT IGNORE INTO `permissions` (`resource`, `action`) VALUES
  ('reports',  'create'), ('reports',  'read'), ('reports',  'delete'), ('reports',  'export'),
  ('users',    'read'),   ('users',    'manage'),('users',   'invite'),
  ('billing',  'read'),   ('billing',  'manage'),
  ('ai',       'use'),
  ('uploads',  'create'), ('uploads',  'read'), ('uploads',  'delete'),
  ('audit',    'read'),
  ('platform', 'manage'), ('companies','manage');

-- ==================== SEED: ROLE_PERMISSIONS ====================
-- company_owner: all except platform:manage
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r, `permissions` p
WHERE r.name = 'company_owner' AND p.resource != 'platform';

-- admin: reports, users, ai, uploads, audit
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r, `permissions` p
WHERE r.name = 'admin'
AND CONCAT(p.resource,':',p.action) IN (
  'reports:create','reports:read','reports:delete','reports:export',
  'users:read','users:manage','users:invite',
  'ai:use',
  'uploads:create','uploads:read','uploads:delete',
  'audit:read'
);

-- manager: reports, ai, uploads
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r, `permissions` p
WHERE r.name = 'manager'
AND CONCAT(p.resource,':',p.action) IN (
  'reports:create','reports:read','reports:export',
  'users:read','ai:use',
  'uploads:create','uploads:read'
);

-- analyst: create/read/export reports, ai, uploads
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r, `permissions` p
WHERE r.name = 'analyst'
AND CONCAT(p.resource,':',p.action) IN (
  'reports:create','reports:read','reports:export',
  'ai:use','uploads:create','uploads:read'
);

-- viewer: read only
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r, `permissions` p
WHERE r.name = 'viewer'
AND CONCAT(p.resource,':',p.action) IN ('reports:read','uploads:read');

-- super_admin: all
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r, `permissions` p
WHERE r.name = 'super_admin';
