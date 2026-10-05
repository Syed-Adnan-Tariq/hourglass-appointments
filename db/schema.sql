-- Hourglass appointment assistant: PostgreSQL schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE appointment_status  AS ENUM ('confirmed', 'cancelled', 'completed');
CREATE TYPE appointment_source  AS ENUM ('chat', 'form');
CREATE TYPE chat_session_status AS ENUM ('active', 'completed');

-- Tenant root. Every other table carries business_id so the schema is SaaS-ready.
CREATE TABLE businesses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(120) NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid         NOT NULL REFERENCES businesses(id),
  email          varchar(255) NOT NULL,
  password_hash  varchar(100) NOT NULL,
  name           varchar(120) NOT NULL,
  created_at     timestamptz  NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness per business (the same email may exist in two tenants).
CREATE UNIQUE INDEX users_business_email_uq ON users (business_id, lower(email));

CREATE TABLE appointments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid               NOT NULL REFERENCES businesses(id),
  user_id      uuid               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service      varchar(80)        NOT NULL,
  starts_at    timestamptz        NOT NULL,
  ends_at      timestamptz        NOT NULL,
  status       appointment_status NOT NULL DEFAULT 'confirmed',
  source       appointment_source NOT NULL,
  notes        text,
  created_at   timestamptz        NOT NULL DEFAULT now(),
  updated_at   timestamptz        NOT NULL DEFAULT now(),
  CONSTRAINT appointments_time_order CHECK (ends_at > starts_at)
);
-- The database, not the app, is the last line of defence against double booking.
CREATE UNIQUE INDEX appointments_active_slot_uq
  ON appointments (business_id, starts_at) WHERE status <> 'cancelled';
CREATE INDEX appointments_user_starts_idx     ON appointments (user_id, starts_at DESC);
CREATE INDEX appointments_business_starts_idx ON appointments (business_id, starts_at);

CREATE TABLE chat_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid                NOT NULL REFERENCES businesses(id),
  user_id          uuid                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           chat_session_status NOT NULL DEFAULT 'active',
  messages         jsonb               NOT NULL DEFAULT '[]',  -- [{role, content, at}]
  extracted_state  jsonb               NOT NULL DEFAULT '{}',  -- {booking:{service,date,time,notes}, misses:n}
  created_at       timestamptz         NOT NULL DEFAULT now(),
  last_message_at  timestamptz         NOT NULL DEFAULT now()
);
-- "Resume my current conversation" is the hot query.
CREATE INDEX chat_sessions_user_active_idx
  ON chat_sessions (user_id, last_message_at DESC) WHERE status = 'active';

CREATE TABLE ai_interaction_logs (
  id          bigserial PRIMARY KEY,
  session_id  uuid        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  model       varchar(60) NOT NULL,
  request     jsonb       NOT NULL,
  response    jsonb,
  latency_ms  integer     NOT NULL,
  success     boolean     NOT NULL,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_logs_session_idx ON ai_interaction_logs (session_id, created_at);
CREATE INDEX ai_logs_failures_idx ON ai_interaction_logs (created_at) WHERE success = false;
