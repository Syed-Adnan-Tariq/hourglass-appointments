-- Hourglass appointment assistant: MySQL 8.0.13+ schema (InnoDB, utf8mb4)
-- All timestamps are DATETIME(3) holding UTC; the API connects with timezone 'Z'.
SET NAMES utf8mb4;

-- Tenant root. Every other table carries business_id so the schema is SaaS-ready.
CREATE TABLE businesses (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  name        VARCHAR(120) NOT NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users (
  id             CHAR(36)     NOT NULL DEFAULT (UUID()),
  business_id    CHAR(36)     NOT NULL,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  name           VARCHAR(120) NOT NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- The default collation (utf8mb4_0900_ai_ci) is case-insensitive, so this is
  -- case-insensitive uniqueness per business (the same email may exist in two tenants).
  UNIQUE KEY users_business_email_uq (business_id, email),
  CONSTRAINT users_business_fk FOREIGN KEY (business_id) REFERENCES businesses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE appointments (
  id           CHAR(36)    NOT NULL DEFAULT (UUID()),
  business_id  CHAR(36)    NOT NULL,
  user_id      CHAR(36)    NOT NULL,
  service      VARCHAR(80) NOT NULL,
  starts_at    DATETIME(3) NOT NULL,
  ends_at      DATETIME(3) NOT NULL,
  status       ENUM('confirmed', 'cancelled', 'completed') NOT NULL DEFAULT 'confirmed',
  source       ENUM('chat', 'form') NOT NULL,
  notes        TEXT NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  -- MySQL has no partial indexes. This generated column is the slot while the appointment
  -- is active and NULL once cancelled; a UNIQUE index ignores NULLs, which gives the same effect.
  active_starts_at DATETIME(3) GENERATED ALWAYS AS (IF(status = 'cancelled', NULL, starts_at)) VIRTUAL,
  PRIMARY KEY (id),
  -- The database, not the app, is the last line of defence against double booking.
  UNIQUE KEY appointments_active_slot_uq (business_id, active_starts_at),
  KEY appointments_user_starts_idx (user_id, starts_at),
  KEY appointments_business_starts_idx (business_id, starts_at),
  CONSTRAINT appointments_time_order CHECK (ends_at > starts_at),
  CONSTRAINT appointments_business_fk FOREIGN KEY (business_id) REFERENCES businesses (id),
  CONSTRAINT appointments_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_sessions (
  id               CHAR(36)    NOT NULL DEFAULT (UUID()),
  business_id      CHAR(36)    NOT NULL,
  user_id          CHAR(36)    NOT NULL,
  status           ENUM('active', 'completed') NOT NULL DEFAULT 'active',
  messages         JSON        NOT NULL DEFAULT (JSON_ARRAY()),   -- [{role, content, at}]
  extracted_state  JSON        NOT NULL DEFAULT (JSON_OBJECT()),  -- {booking:{service,date,time,notes}, misses:n}
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_message_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- "Resume my current conversation" is the hot query: equality on user + status, newest first.
  KEY chat_sessions_user_status_idx (user_id, status, last_message_at),
  CONSTRAINT chat_sessions_business_fk FOREIGN KEY (business_id) REFERENCES businesses (id),
  CONSTRAINT chat_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ai_interaction_logs (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  session_id  CHAR(36)     NOT NULL,
  model       VARCHAR(60)  NOT NULL,
  request     JSON         NOT NULL,
  response    JSON         NULL,
  latency_ms  INT          NOT NULL,
  success     TINYINT(1)   NOT NULL,
  error       TEXT         NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ai_logs_session_idx (session_id, created_at),
  KEY ai_logs_success_idx (success, created_at),  -- find failures quickly
  CONSTRAINT ai_logs_session_fk FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
