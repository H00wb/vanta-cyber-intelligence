create table public.vanta_service_requests (
  id uuid primary key check (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  name text not null check (char_length(name) between 2 and 100 and name = btrim(name) and name !~ '[[:cntrl:]]'),
  email text not null check (char_length(email) between 3 and 254 and email = lower(btrim(email)) and email !~ '[[:cntrl:]]' and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  service text not null check (service in ('threat-intelligence', 'attack-surface', 'incident-correlation', 'risk-mapping')),
  description text not null check (char_length(description) between 20 and 2000 and description = btrim(description) and regexp_replace(description, E'[\t\n\r]', '', 'g') !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now()
);
alter table public.vanta_service_requests enable row level security;
revoke all on table public.vanta_service_requests from public, anon, authenticated;

-- The public form can only create a request or confirm an identical retry.
-- No arbitrary SQL, read/list endpoint, or elevated API key is exposed.
create function public.vanta_submit_request(p_id uuid, p_name text, p_email text, p_service text, p_description text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  inserted_id uuid;
  existing public.vanta_service_requests%rowtype;
  normalized_name text := regexp_replace(p_name, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  normalized_email text := lower(regexp_replace(p_email, '^[[:space:]]+|[[:space:]]+$', '', 'g'));
  normalized_description text := regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  insert into public.vanta_service_requests (id, name, email, service, description)
  values (p_id, normalized_name, normalized_email, p_service, normalized_description)
  on conflict (id) do nothing returning id into inserted_id;
  if inserted_id is not null then
    return jsonb_build_object('id', inserted_id, 'replayed', false);
  end if;
  -- A separate VOLATILE statement sees a concurrent winner's committed row.
  select * into existing from public.vanta_service_requests where id = p_id;
  if not found then raise exception 'record_not_confirmed'; end if;
  if existing.name is distinct from normalized_name or existing.email is distinct from normalized_email
    or existing.service is distinct from p_service or existing.description is distinct from normalized_description then
    raise sqlstate 'PT409' using message = 'submission_conflict';
  end if;
  return jsonb_build_object('id', existing.id, 'replayed', true);
end;
$$;
revoke all on function public.vanta_submit_request(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.vanta_submit_request(uuid, text, text, text, text) to anon, authenticated;
comment on function public.vanta_submit_request(uuid, text, text, text, text) is 'Anonymous request creation only. Returns no visitor fields. Validated by table constraints.';