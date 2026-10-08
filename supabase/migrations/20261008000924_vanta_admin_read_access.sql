-- Admin read access. Run scripts/setup-admin.mjs, then its generated admin-access.sql after this migration.
create schema if not exists vanta_private;
revoke all on schema vanta_private from public, anon, authenticated;

create table vanta_private.admin_settings (
  singleton boolean primary key default true check (singleton),
  token_sha256 text not null check (token_sha256 ~ '^[0-9a-f]{64}$')
);
alter table vanta_private.admin_settings enable row level security;
revoke all on table vanta_private.admin_settings from public, anon, authenticated;

create table vanta_private.admin_login_attempts (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  bucket_start timestamptz not null,
  attempts integer not null check (attempts between 1 and 11)
);
alter table vanta_private.admin_login_attempts enable row level security;
revoke all on table vanta_private.admin_login_attempts from public, anon, authenticated;

create function public.vanta_admin_requests(
  p_token text, p_page integer default 1, p_query text default ''
) returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  expected_hash text;
  search_pattern text;
  result jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise sqlstate 'PT401' using message = 'unauthorized';
  end if;
  select token_sha256 into expected_hash from vanta_private.admin_settings where singleton = true;
  if expected_hash is null or expected_hash is distinct from
    pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex') then
    raise sqlstate 'PT401' using message = 'unauthorized';
  end if;

  if p_page is null or p_page < 1 or p_page > 10000 or p_query is null
    or pg_catalog.char_length(p_query) > 100 or p_query ~ '[[:cntrl:]]' then
    raise sqlstate 'PT400' using message = 'invalid_request';
  end if;
  -- Escape the escape character first: %, _ and \ are literal search text.
  search_pattern := '%' || pg_catalog.replace(pg_catalog.replace(
    pg_catalog.replace(p_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';

  -- COUNT and page share one SQL snapshot. NOT MATERIALIZED allows the bounded
  -- page and count branches to be planned independently without copying all rows.
  with matching as not materialized (
    select id, name, email, service, description, created_at
    from public.vanta_service_requests
    where p_query = ''
      or id::text ilike search_pattern escape E'\\'
      or name ilike search_pattern escape E'\\'
      or email ilike search_pattern escape E'\\'
  ), paged as (
    select id, name, email, service, description, created_at
    from matching
    order by created_at desc, id desc
    limit 50 offset ((p_page - 1) * 50)
  )
  select pg_catalog.jsonb_build_object(
    'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row_data)
      order by row_data.created_at desc, row_data.id desc) from paged as row_data), '[]'::jsonb),
    'total', (select pg_catalog.count(*) from matching),
    'page', p_page,
    'pageSize', 50
  ) into result;
  return result;
end;
$$;
revoke all on function public.vanta_admin_requests(text, integer, text) from public, anon, authenticated;
grant execute on function public.vanta_admin_requests(text, integer, text) to anon;
comment on function public.vanta_admin_requests(text, integer, text)
  is 'Token-gated read only API. Returns bounded VANTA request rows; no write/delete operations.';

create function public.vanta_admin_login_attempt(p_token text, p_key text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  expected_hash text;
  current_bucket timestamptz;
  latest_bucket timestamptz;
  attempt_count integer;
  retry_seconds integer;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise sqlstate 'PT401' using message = 'unauthorized';
  end if;
  select token_sha256 into expected_hash from vanta_private.admin_settings where singleton = true;
  if expected_hash is null or expected_hash is distinct from
    pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex') then
    raise sqlstate 'PT401' using message = 'unauthorized';
  end if;
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    raise sqlstate 'PT400' using message = 'invalid_request';
  end if;

  current_bucket := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp()) / 300) * 300
  );
  -- The unique key and ON CONFLICT update lock the row atomically. The stored
  -- bucket never moves backwards if a request waited across a window boundary.
  insert into vanta_private.admin_login_attempts as ledger (key_hash, bucket_start, attempts)
  values (p_key, current_bucket, 1)
  on conflict (key_hash) do update
  set bucket_start = greatest(ledger.bucket_start, excluded.bucket_start),
      attempts = case when ledger.bucket_start < excluded.bucket_start then 1
        else least(ledger.attempts + 1, 11) end
  returning ledger.attempts, ledger.bucket_start into attempt_count, latest_bucket;

  if attempt_count <= 10 then
    return pg_catalog.jsonb_build_object('allowed', true, 'retryAfter', 0);
  end if;
  retry_seconds := greatest(1, least(300, pg_catalog.ceil(extract(epoch from
    (latest_bucket + interval '5 minutes' - pg_catalog.clock_timestamp())))::integer));
  return pg_catalog.jsonb_build_object('allowed', false, 'retryAfter', retry_seconds);
end;
$$;
revoke all on function public.vanta_admin_login_attempt(text, text) from public, anon, authenticated;
grant execute on function public.vanta_admin_login_attempt(text, text) to anon;
comment on function public.vanta_admin_login_attempt(text, text)
  is 'Token-gated durable login limiter: ten attempts per hashed key per fixed five-minute bucket.';
