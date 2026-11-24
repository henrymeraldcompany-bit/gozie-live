-- Production controls, viewer presence, and row-level security.
alter table broadcast_sessions
  add column if not exists contributor_code_hash text,
  add column if not exists viewer_code_hash text,
  add column if not exists public_id text not null default encode(gen_random_bytes(12), 'hex');

create unique index if not exists broadcast_sessions_public_id_idx on broadcast_sessions(public_id);
create index if not exists broadcast_sessions_contributor_code_idx on broadcast_sessions(contributor_code_hash);
create index if not exists broadcast_sessions_viewer_code_idx on broadcast_sessions(viewer_code_hash);

alter table media_assets
  add column if not exists file_name text,
  add column if not exists size_bytes bigint;

alter table recordings
  add column if not exists size_bytes bigint,
  add column if not exists duration_seconds integer;

create table if not exists production_commands (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references broadcast_sessions(id) on delete cascade,
  requested_by uuid not null references profiles(id) on delete cascade,
  command_type text not null check (command_type in ('select-source','mute-contributor','set-audio-mix','set-media-source','start-recording','stop-recording')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','applied','failed')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);
create index if not exists production_commands_pending_idx on production_commands(session_id, status, created_at);

create table if not exists viewer_presence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references broadcast_sessions(id) on delete cascade,
  identity text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists viewer_presence_session_expiry_idx on viewer_presence(session_id, expires_at);

alter table profiles enable row level security;
alter table broadcast_sessions enable row level security;
alter table contributors enable row level security;
alter table media_assets enable row level security;
alter table recordings enable row level security;
alter table production_commands enable row level security;
alter table viewer_presence enable row level security;

drop policy if exists "profiles_read_own" on profiles;
create policy "profiles_read_own" on profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "sessions_owner_all" on broadcast_sessions;
create policy "sessions_owner_all" on broadcast_sessions for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "contributors_owner_read" on contributors;
create policy "contributors_owner_read" on contributors for select using (
  exists (select 1 from broadcast_sessions s where s.id = contributors.session_id and s.owner_id = auth.uid())
);
drop policy if exists "assets_owner_all" on media_assets;
create policy "assets_owner_all" on media_assets for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "recordings_owner_read" on recordings;
create policy "recordings_owner_read" on recordings for select using (
  exists (select 1 from broadcast_sessions s where s.id = recordings.session_id and s.owner_id = auth.uid())
);
drop policy if exists "commands_owner_read" on production_commands;
create policy "commands_owner_read" on production_commands for select using (
  exists (select 1 from broadcast_sessions s where s.id = production_commands.session_id and s.owner_id = auth.uid())
);

-- Anonymous viewers and contributors do not access these tables directly; the API service role
-- verifies high-entropy share codes and performs narrowly scoped operations.
