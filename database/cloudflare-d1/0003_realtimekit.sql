-- Cloudflare RealtimeKit integration metadata.
ALTER TABLE broadcast_sessions ADD COLUMN realtimekit_meeting_id TEXT;
ALTER TABLE broadcast_sessions ADD COLUMN realtimekit_livestream_id TEXT;
ALTER TABLE broadcast_sessions ADD COLUMN playback_url TEXT;
ALTER TABLE broadcast_sessions ADD COLUMN realtimekit_recording_id TEXT;
ALTER TABLE broadcast_sessions ADD COLUMN realtimekit_host_participant_id TEXT;
ALTER TABLE contributors ADD COLUMN realtimekit_participant_id TEXT;
ALTER TABLE recordings ADD COLUMN provider_type TEXT NOT NULL DEFAULT 'r2';
ALTER TABLE recordings ADD COLUMN provider_recording_id TEXT;
ALTER TABLE recordings ADD COLUMN download_url TEXT;
ALTER TABLE recordings ADD COLUMN status TEXT NOT NULL DEFAULT 'ready';
CREATE INDEX IF NOT EXISTS sessions_rtk_meeting_idx ON broadcast_sessions(realtimekit_meeting_id);
CREATE INDEX IF NOT EXISTS contributors_rtk_participant_idx ON contributors(realtimekit_participant_id);
CREATE INDEX IF NOT EXISTS recordings_provider_idx ON recordings(provider_type,provider_recording_id);
