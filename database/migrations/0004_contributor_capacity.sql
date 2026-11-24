-- Contributor slot admission and presence expiry.
alter table contributors
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists leave_secret_hash text;

create index if not exists contributors_active_presence_idx
  on contributors(session_id, last_seen_at)
  where status in ('connected', 'publishing');

create or replace function admit_contributor(
  p_session_id uuid,
  p_display_name text,
  p_provider_identity text,
  p_leave_secret_hash text,
  p_max integer default 200
)
returns setof contributors
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count integer;
begin
  perform 1
    from broadcast_sessions
    where id = p_session_id and status in ('scheduled', 'live')
    for update;

  if not found then
    raise exception 'SESSION_NOT_JOINABLE';
  end if;

  update contributors
    set status = 'disconnected'
    where session_id = p_session_id
      and status in ('connected', 'publishing')
      and last_seen_at < now() - interval '60 seconds';

  select count(*) into active_count
    from contributors
    where session_id = p_session_id
      and status in ('connected', 'publishing');

  if active_count >= least(greatest(coalesce(p_max, 200), 1), 200) then
    raise exception 'CAMERA_CAPACITY_REACHED';
  end if;

  return query
    insert into contributors (
      session_id, display_name, provider_identity, status, last_seen_at, leave_secret_hash
    )
    values (
      p_session_id, left(trim(p_display_name), 80), p_provider_identity,
      'connected', now(), p_leave_secret_hash
    )
    returning *;
end;
$$;

create or replace function refresh_contributor_presence(
  p_contributor_id uuid,
  p_leave_secret_hash text,
  p_leave boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update contributors
    set status = case when p_leave then 'disconnected' else 'connected' end,
        last_seen_at = now()
    where id = p_contributor_id
      and leave_secret_hash = p_leave_secret_hash
      and status <> 'removed';

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function admit_contributor(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function refresh_contributor_presence(uuid, text, boolean) from public, anon, authenticated;
grant execute on function admit_contributor(uuid, text, text, text, integer) to service_role;
grant execute on function refresh_contributor_presence(uuid, text, boolean) to service_role;
