-- Server-managed compositing/egress lifecycle and a single trusted renderer per session.
create table if not exists production_engine_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references broadcast_sessions(id) on delete cascade,
  control_code_hash text not null unique,
  ingress_id text,
  egress_id text,
  recording_object_key text,
  selected_source_identity text,
  selected_asset_id uuid references media_assets(id) on delete set null,
  status text not null default 'starting' check (status in ('starting','running','stopping','ended','failed')),
  last_error text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists production_engine_runs_status_idx on production_engine_runs(status, updated_at);

alter table production_engine_runs enable row level security;
-- No client-facing policies: only the API's service-role connection may read/write engine state.

-- Claim queued commands atomically. This prevents a second worker instance from processing
-- the same command if the production service is later horizontally scaled.
create or replace function claim_production_commands(p_session_id uuid, p_limit integer default 25)
returns setof production_commands
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select id
    from production_commands
    where session_id = p_session_id and status = 'pending'
    order by created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update production_commands as command
  set status = 'processing'
  from picked
  where command.id = picked.id
  returning command.*;
end;
$$;

revoke all on function claim_production_commands(uuid, integer) from public, anon, authenticated;
grant execute on function claim_production_commands(uuid, integer) to service_role;
