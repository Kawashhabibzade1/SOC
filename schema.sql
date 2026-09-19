-- ============================================================
-- SOC Radar - Database Schema
-- Phase 1: Data Layer
-- Run this inside the MariaDB container:
--   docker exec -i nextcloud-db mariadb -u root -p < schema.sql
-- ============================================================

-- 1. Create the isolated SOC database
CREATE DATABASE IF NOT EXISTS soc_radar
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- 2. Create a dedicated, least-privilege user for the collector
--    Replace 'StrongPassword123!' with a real secret
CREATE USER IF NOT EXISTS 'soc_collector'@'%' IDENTIFIED BY 'StrongPassword123!';
GRANT INSERT, SELECT ON soc_radar.* TO 'soc_collector'@'%';
FLUSH PRIVILEGES;

-- 3. Switch to the new database
USE soc_radar;

-- 4. Create the security_events table
CREATE TABLE IF NOT EXISTS security_events (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    timestamp     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    event_type    ENUM(
                    'SSH_FAILED',
                    'SSH_SUCCESS',
                    'SFTP_FAILED',
                    'SFTP_SUCCESS',
                    'FTP_FAILED',
                    'FTP_SUCCESS',
                    'XRDP_FAILED',
                    'XRDP_SUCCESS',
                    'FAIL2BAN_BLOCK',
                    'FAIL2BAN_UNBLOCK',
                    'UNKNOWN'
                  )               NOT NULL DEFAULT 'UNKNOWN',
    ip_address    VARCHAR(45)     NOT NULL,   -- supports IPv4 and IPv6
    targeted_user VARCHAR(128)    DEFAULT NULL,
    country       VARCHAR(100)    DEFAULT NULL,
    city          VARCHAR(100)    DEFAULT NULL,
    latitude      DECIMAL(9, 6)   DEFAULT NULL,
    longitude     DECIMAL(9, 6)   DEFAULT NULL,
    raw_log       TEXT            DEFAULT NULL, -- store original log line for auditing

    PRIMARY KEY (id),
    INDEX idx_timestamp   (timestamp),
    INDEX idx_event_type  (event_type),
    INDEX idx_ip_address  (ip_address),
    INDEX idx_country     (country)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Stores parsed security events from the SOC log collector';
