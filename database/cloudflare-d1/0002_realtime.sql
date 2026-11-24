-- Cloudflare D1 follow-up migration: SFU publisher sessions and subscriptions.
ALTER TABLE contributors ADD COLUMN publisher_session_id TEXT;
ALTER TABLE broadcast_sessions ADD COLUMN programme_uid TEXT;
CREATE TABLE IF NOT EXISTS media_subscriptions (
 id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 sfu_session_id TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS media_subscriptions_owner_idx ON media_subscriptions(owner_id,session_id);
CREATE TABLE IF NOT EXISTS contributor_publications (
 id TEXT PRIMARY KEY,
 contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
 session_id TEXT NOT NULL REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
 sfu_session_id TEXT NOT NULL,
 track_name TEXT NOT NULL,
 kind TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(contributor_id,track_name)
);
CREATE INDEX IF NOT EXISTS contributor_publications_session_idx ON contributor_publications(session_id);
