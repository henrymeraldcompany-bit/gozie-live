-- GOZIE LIVE Cloudflare D1 schema (SQLite).
-- Applied to the dedicated APAC database gozie-live-db.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, display_name TEXT NOT NULL,
 email_verified INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS email_verification_codes (
 email TEXT PRIMARY KEY COLLATE NOCASE, code_hash TEXT NOT NULL,
 expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS broadcast_sessions (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled',
 scheduled_at TEXT, live_started_at TEXT, ended_at TEXT,
 contributor_code_hash TEXT, viewer_code_hash TEXT, public_id TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sessions_owner_created_idx ON broadcast_sessions(owner_id,created_at DESC);
CREATE TABLE IF NOT EXISTS contributors (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
 display_name TEXT NOT NULL, provider_identity TEXT, status TEXT NOT NULL DEFAULT 'invited',
 audio_muted INTEGER NOT NULL DEFAULT 0, last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 leave_secret_hash TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS contributors_session_status_idx ON contributors(session_id,status);
CREATE TABLE IF NOT EXISTS media_assets (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, asset_kind TEXT NOT NULL,
 object_key TEXT NOT NULL, content_type TEXT NOT NULL, file_name TEXT, size_bytes INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS recordings (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
 object_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TEXT NOT NULL, deleted_at TEXT, size_bytes INTEGER, duration_seconds INTEGER
);
CREATE INDEX IF NOT EXISTS recordings_expiry_idx ON recordings(expires_at) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS production_commands (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
 requested_by TEXT NOT NULL REFERENCES users(id), command_type TEXT NOT NULL,
 payload TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, processed_at TEXT, error_message TEXT
);
CREATE INDEX IF NOT EXISTS production_commands_pending_idx ON production_commands(session_id,status,created_at);
CREATE TABLE IF NOT EXISTS viewer_presence (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
 identity TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS viewer_presence_session_expiry_idx ON viewer_presence(session_id,expires_at);
CREATE TABLE IF NOT EXISTS production_engine_runs (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
 control_code_hash TEXT NOT NULL UNIQUE, ingress_id TEXT, egress_id TEXT,
 recording_object_key TEXT, selected_source_identity TEXT, selected_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'starting', last_error TEXT, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ended_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS production_engine_runs_status_idx ON production_engine_runs(status,updated_at);
