-- Require at least two non-empty name parts, matching the shared validator's \s.
-- Spell out ECMAScript whitespace rather than relying on locale-dependent [:space:].
alter table public.vanta_service_requests
  add constraint vanta_service_requests_full_name_check check (
    pg_catalog.cardinality(pg_catalog.array_remove(pg_catalog.regexp_split_to_array(
      name, U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+'), '')) >= 2
    and name = pg_catalog.btrim(name,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
  );
create or replace function public.vanta_submit_request(p_id uuid, p_name text, p_email text, p_service text, p_description text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  inserted_id uuid;
  existing public.vanta_service_requests%rowtype;
  normalized_name text := pg_catalog.btrim(p_name, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
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
