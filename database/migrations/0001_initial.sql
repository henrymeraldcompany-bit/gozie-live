-- GOZIE LIVE initial relational schema (PostgreSQL)
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists broadcast_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  scheduled_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','failed')),
  live_started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists contributors (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references broadcast_sessions(id) on delete cascade,
  display_name text not null,
  provider_identity text,
  status text not null default 'invited' check (status in ('invited','connected','publishing','disconnected','removed')),
  audio_muted boolean not null default false,
  created_at timestamptz not null default now(),
  unique(session_id, provider_identity)
);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references broadcast_sessions(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  asset_kind text not null check (asset_kind in ('image','video','audio')),
  object_key text not null,
  content_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists recordings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references broadcast_sessions(id) on delete cascade,
  object_key text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists sessions_owner_created_idx on broadcast_sessions(owner_id, created_at desc);
create index if not exists contributors_session_status_idx on contributors(session_id, status);
create index if not exists recordings_expiry_idx on recordings(expires_at) where deleted_at is null;

-- Enforce owner-only access and row-level security policies before connecting a public client.
-- Recording expiry must be enforced by a trusted scheduled server job and object-storage deletion.
