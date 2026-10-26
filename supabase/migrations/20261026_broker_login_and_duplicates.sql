-- Brokers log in with mobile + 4-digit PIN; each broker only ever gets his own token.
-- Owner + partner keep seeing everything. Possible duplicate buildings are detected and flagged to them.

create extension if not exists pg_trgm with schema extensions;

-- ── Phone normalisation: any Egyptian mobile spelling → 01xxxxxxxxx ─────────────────────────────
create or replace function _norm_phone(p text) returns text
language sql immutable set search_path = public as $$
  select case
    when d ~ '^201[0-9]{9}$' then '0' || substr(d, 3)
    when d ~ '^1[0-9]{9}$'   then '0' || d
    else d end
  from (select regexp_replace(regexp_replace(
          translate(coalesce(p, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'),
          '\D', '', 'g'), '^00', '') d) x
$$;

update brokers set phone = _norm_phone(phone) where phone <> _norm_phone(phone);

alter table brokers
  add column if not exists pin_hash text,
  add column if not exists failed_logins int not null default 0,
  add column if not exists locked_until timestamptz;

alter table photos add column if not exists dhash text;

-- ── Login ───────────────────────────────────────────────────────────────────────────────────────
-- Returns {token,name} or {error, left?}. Errors are returned (not raised) so the failed-attempt
-- counter survives; 5 wrong PINs lock the number for 15 minutes.
create or replace function broker_login(p_invite text, p_phone text, p_pin text, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare h hunts; b brokers; ph text := _norm_phone(p_phone);
begin
  select * into h from hunts where broker_token = p_invite;
  if h.id is null then return jsonb_build_object('error', 'INVITE_NOT_FOUND'); end if;
  if ph !~ '^01[0125][0-9]{8}$' then return jsonb_build_object('error', 'BAD_PHONE'); end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then return jsonb_build_object('error', 'BAD_PIN'); end if;

  select * into b from brokers where hunt_id = h.id and phone = ph for update;

  if b.id is null then
    if coalesce(trim(p_name), '') = '' then return jsonb_build_object('error', 'NEW_BROKER'); end if;
    insert into brokers(hunt_id, name, phone, pin_hash)
      values (h.id, trim(p_name), ph, crypt(p_pin, gen_salt('bf', 8)))
      returning * into b;
    return jsonb_build_object('token', b.token, 'name', b.name, 'new', true);
  end if;

  if b.locked_until > now() then
    return jsonb_build_object('error', 'LOCKED', 'minutes', ceil(extract(epoch from b.locked_until - now()) / 60));
  end if;

  if b.pin_hash is null then
    -- Broker created before PINs existed: the first PIN he types becomes his PIN.
    update brokers set pin_hash = crypt(p_pin, gen_salt('bf', 8)), failed_logins = 0, locked_until = null
      where id = b.id;
    return jsonb_build_object('token', b.token, 'name', b.name);
  end if;

  if crypt(p_pin, b.pin_hash) = b.pin_hash then
    update brokers set failed_logins = 0, locked_until = null where id = b.id;
    return jsonb_build_object('token', b.token, 'name', b.name);
  end if;

  if b.failed_logins + 1 >= 5 then
    update brokers set failed_logins = 0, locked_until = now() + interval '15 minutes' where id = b.id;
    return jsonb_build_object('error', 'LOCKED', 'minutes', 15);
  end if;
  update brokers set failed_logins = failed_logins + 1 where id = b.id;
  return jsonb_build_object('error', 'WRONG_PIN', 'left', 5 - (b.failed_logins + 1));
end $$;

-- Broker changes his own PIN while logged in.
create or replace function broker_change_pin(p_token text, p_old text, p_new text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare b brokers;
begin
  select * into b from brokers where token = p_token;
  if b.id is null then raise exception 'NOT_ALLOWED'; end if;
  if b.pin_hash is not null and crypt(coalesce(p_old, ''), b.pin_hash) <> b.pin_hash then raise exception 'WRONG_PIN'; end if;
  if coalesce(p_new, '') !~ '^[0-9]{4}$' then raise exception 'BAD_PIN'; end if;
  update brokers set pin_hash = crypt(p_new, gen_salt('bf', 8)) where id = b.id;
end $$;

-- ── Duplicate detection ─────────────────────────────────────────────────────────────────────────
create table if not exists listing_duplicates (
  a uuid not null references listings(id) on delete cascade,
  b uuid not null references listings(id) on delete cascade,
  hunt_id uuid not null references hunts(id) on delete cascade,
  reasons text[] not null,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table listing_duplicates enable row level security;
revoke all on listing_duplicates from anon, authenticated;

-- Same spot on the map: coordinates rounded to ~10 m when the link carries them, else the link itself.
create or replace function _map_key(u text) returns text
language sql immutable set search_path = public as $$
  select case
    when u is null or trim(u) = '' then null
    when m is not null then 'c:' || round(m[1]::numeric, 4) || ',' || round(m[2]::numeric, 4)
    else 'u:' || regexp_replace(trim(u), '[?#].*$', '') end
  from (select regexp_match(coalesce(u, ''), '[@=/](-?[0-9]{1,2}\.[0-9]{3,})\s*,\s*(-?[0-9]{1,3}\.[0-9]{3,})') m) x
$$;

create or replace function _near(a numeric, b numeric, tol numeric) returns boolean
language sql immutable as $$ select a is not null and b is not null and abs(a - b) <= greatest(abs(a), abs(b)) * tol $$;

-- Re-checks one building against every other building in the same hunt.
create or replace function _detect_duplicates(p_listing uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare l listings; o listings; r text[]; same_photos int; mk text;
begin
  select * into l from listings where id = p_listing;
  if l.id is null then return; end if;
  mk := _map_key(l.map_url);

  delete from listing_duplicates where not dismissed and (a = l.id or b = l.id);

  for o in select * from listings where hunt_id = l.hunt_id and id <> l.id loop
    r := '{}';

    if mk is not null and mk = _map_key(o.map_url) then r := array_append(r, 'map'); end if;

    select count(*) into same_photos
      from photos p1 join photos p2 on p2.listing_id = o.id
     where p1.listing_id = l.id and p1.dhash is not null and p2.dhash is not null
       and bit_count(('x' || p1.dhash)::bit(64) # ('x' || p2.dhash)::bit(64)) <= 12;  -- same photo re-sent ≈ 0-12 bits apart; different photos ≈ 28+
    if same_photos > 0 then r := array_append(r, 'photos'); end if;

    -- The same forwarded WhatsApp message.
    if length(l.raw_text) >= 40 and length(o.raw_text) >= 40 and similarity(l.raw_text, o.raw_text) >= 0.6 then
      r := array_append(r, 'text');
    end if;

    -- Similar address plus at least one matching number.
    if length(coalesce(l.area, '')) >= 4 and length(coalesce(o.area, '')) >= 4
       and similarity(l.area, o.area) >= 0.45
       and (_near(l.size_m2, o.size_m2, 0.05) or (l.floors is not null and l.floors = o.floors) or _near(l.price, o.price, 0.05)) then
      r := array_append(r, 'area');
    end if;

    if cardinality(r) > 0 then
      insert into listing_duplicates(a, b, hunt_id, reasons)
        values (least(l.id, o.id), greatest(l.id, o.id), l.hunt_id, r)
        on conflict (a, b) do update set reasons = excluded.reasons;
    end if;
  end loop;
end $$;

-- ── Broker submit (token instead of name/phone) ─────────────────────────────────────────────────
create or replace function broker_submit(p_token text, p_raw text, p_area text, p_price integer, p_size integer,
  p_floors integer, p_map text, p_visit timestamptz, p_features text[], p_photos text[], p_hashes text[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b brokers; h hunts; lid uuid; i int;
begin
  select * into b from brokers where token = p_token;
  if b.id is null then raise exception 'NOT_ALLOWED'; end if;
  select * into h from hunts where id = b.hunt_id;
  if p_price is null or p_price <= 0 then raise exception 'PRICE_REQUIRED'; end if;
  if coalesce(array_length(p_photos, 1), 0) > 40 then raise exception 'TOO_MANY_PHOTOS'; end if;

  insert into listings(hunt_id, broker_id, raw_text, area, price, size_m2, floors, map_url, suggested_visit, features)
    values (h.id, b.id, coalesce(p_raw, ''), nullif(trim(p_area), ''), p_price, p_size, p_floors, nullif(trim(p_map), ''), p_visit,
            coalesce((select array_agg(f) from unnest(p_features) f where f = any(h.features)), '{}'))
    returning id into lid;
  for i in 1..coalesce(array_length(p_photos, 1), 0) loop
    if p_photos[i] like 'u/%' then
      insert into photos(listing_id, path, sort, dhash)
        values (lid, p_photos[i], i, case when p_hashes[i] ~ '^[0-9a-f]{16}$' then p_hashes[i] end);
    end if;
  end loop;
  perform _detect_duplicates(lid);
  return jsonb_build_object('listing_id', lid);
end $$;

-- Old phone-only submit stays for already-open browser tabs until the new site is live, but now also checks duplicates.
-- It is dropped by the follow-up "lockdown" migration.
create or replace function submit_listing(p_invite text, p_name text, p_phone text, p_raw text, p_area text, p_price integer,
  p_size integer, p_floors integer, p_map text, p_visit timestamptz, p_features text[], p_photos text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare h hunts; b brokers; lid uuid; i int; ph text := _norm_phone(p_phone);
begin
  select * into h from hunts where broker_token = p_invite;
  if h.id is null then raise exception 'INVITE_NOT_FOUND'; end if;
  if coalesce(trim(p_name),'') = '' or ph = '' then raise exception 'NAME_PHONE_REQUIRED'; end if;
  if coalesce(array_length(p_photos,1),0) > 40 then raise exception 'TOO_MANY_PHOTOS'; end if;
  select * into b from brokers where hunt_id = h.id and phone = ph;
  if b.pin_hash is not null then raise exception 'NOT_ALLOWED'; end if;  -- PIN-protected brokers must log in
  insert into brokers(hunt_id, name, phone) values (h.id, trim(p_name), ph)
    on conflict (hunt_id, phone) do update set name = excluded.name
    returning * into b;
  insert into listings(hunt_id, broker_id, raw_text, area, price, size_m2, floors, map_url, suggested_visit, features)
    values (h.id, b.id, coalesce(p_raw,''), nullif(trim(p_area),''), p_price, p_size, p_floors, nullif(trim(p_map),''), p_visit,
            coalesce((select array_agg(f) from unnest(p_features) f where f = any(h.features)), '{}'))
    returning id into lid;
  for i in 1..coalesce(array_length(p_photos,1),0) loop
    if p_photos[i] like 'u/%' then insert into photos(listing_id, path, sort) values (lid, p_photos[i], i); end if;
  end loop;
  perform _detect_duplicates(lid);
  return jsonb_build_object('broker_token', b.token, 'listing_id', lid);
end $$;

-- Edit now also takes photo hashes and re-checks duplicates.
drop function if exists broker_edit_listing(text, uuid, text, text, integer, integer, integer, text, text[], text[], text[]);
create or replace function broker_edit_listing(p_token text, p_listing uuid, p_raw text, p_area text, p_price integer, p_size integer,
  p_floors integer, p_map text, p_features text[], p_remove text[], p_add text[], p_hashes text[] default null)
returns void language plpgsql security definer set search_path = public as $$
declare l listings; h hunts; next_sort int; i int; changed text[] := '{}'; removed int;
begin
  select li.* into l from listings li join brokers b on b.id = li.broker_id where li.id = p_listing and b.token = p_token;
  if l.id is null then raise exception 'NOT_ALLOWED'; end if;
  if p_price is null or p_price <= 0 then raise exception 'PRICE_REQUIRED'; end if;
  select * into h from hunts where id = l.hunt_id;

  delete from photos where listing_id = l.id and path = any(coalesce(p_remove, '{}'));
  get diagnostics removed = row_count;
  if (select count(*) from photos where listing_id = l.id) + coalesce(array_length(p_add,1),0) > 40 then
    raise exception 'TOO_MANY_PHOTOS';
  end if;
  select coalesce(max(sort),0) into next_sort from photos where listing_id = l.id;
  for i in 1..coalesce(array_length(p_add,1),0) loop
    if p_add[i] like 'u/%' then
      insert into photos(listing_id, path, sort, dhash)
        values (l.id, p_add[i], next_sort + i, case when p_hashes[i] ~ '^[0-9a-f]{16}$' then p_hashes[i] end);
    end if;
  end loop;

  if p_price is distinct from l.price then changed := array_append(changed, 'price'); end if;
  if p_raw is not null and p_raw is distinct from l.raw_text then changed := array_append(changed, 'text'); end if;
  if nullif(trim(p_area),'') is not null and trim(p_area) is distinct from l.area then changed := array_append(changed, 'area'); end if;
  if p_size is not null and p_size is distinct from l.size_m2 then changed := array_append(changed, 'size'); end if;
  if p_floors is not null and p_floors is distinct from l.floors then changed := array_append(changed, 'floors'); end if;
  if removed > 0 or coalesce(array_length(p_add,1),0) > 0 then changed := array_append(changed, 'photos'); end if;

  update listings set
    raw_text = coalesce(p_raw, raw_text),
    area = coalesce(nullif(trim(p_area),''), area),
    price = p_price,
    size_m2 = coalesce(p_size, size_m2),
    floors = coalesce(p_floors, floors),
    map_url = coalesce(nullif(trim(p_map),''), map_url),
    features = (select coalesce(array_agg(distinct f), '{}') from unnest(features || coalesce((select array_agg(x) from unnest(p_features) x where x = any(h.features)), '{}')) f),
    edited_at = case when cardinality(changed) > 0 then now() else edited_at end,
    edited_fields = case when cardinality(changed) > 0 then changed else edited_fields end
  where id = l.id;
  perform _detect_duplicates(l.id);
end $$;

-- Broker view: also says whether he has a PIN yet (for the "set your PIN" prompt).
create or replace function broker_view(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'broker', jsonb_build_object('name', b.name, 'phone', b.phone, 'has_pin', b.pin_hash is not null),
    'hunt', jsonb_build_object('owner_name', h.owner_name, 'owner_phone', h.owner_phone, 'invite', h.broker_token, 'features', to_jsonb(h.features)),
    'listings', coalesce((select jsonb_agg(_listing_json(l, false) order by l.created_at desc) from listings l where l.broker_id = b.id), '[]'::jsonb))
  from brokers b join hunts h on h.id = b.hunt_id where b.token = p_token
$$;

-- ── Owner / partner side ────────────────────────────────────────────────────────────────────────
create or replace function viewer_view(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v record; h hunts;
begin
  select * into v from _viewer_role(p_token);
  if v.hunt_id is null then return null; end if;
  select * into h from hunts where id = v.hunt_id;
  return jsonb_build_object(
    'role', v.role,
    'hunt', jsonb_build_object('title', h.title, 'owner_name', h.owner_name, 'partner_name', h.partner_name,
      'owner_phone', h.owner_phone, 'features', to_jsonb(h.features), 'invite', h.broker_token,
      'partner_token', case when v.role = 'owner' then h.partner_token end),
    'listings', coalesce((select jsonb_agg(_listing_json(l, true) order by l.created_at desc) from listings l where l.hunt_id = h.id), '[]'::jsonb),
    'duplicates', coalesce((select jsonb_agg(jsonb_build_object('a', d.a, 'b', d.b, 'reasons', to_jsonb(d.reasons), 'created_at', d.created_at) order by d.created_at desc)
       from listing_duplicates d where d.hunt_id = h.id and not d.dismissed), '[]'::jsonb),
    'brokers', case when v.role = 'owner' then coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'phone', b.phone, 'has_pin', b.pin_hash is not null,
        'locked', coalesce(b.locked_until > now(), false), 'created_at', b.created_at,
        'listings', (select count(*) from listings l where l.broker_id = b.id)) order by b.created_at desc)
       from brokers b where b.hunt_id = h.id), '[]'::jsonb) end);
end $$;

-- "Not a duplicate" — hides the warning for this pair for good.
create or replace function viewer_dismiss_duplicate(p_token text, p_a uuid, p_b uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from _viewer_role(p_token);
  if v.hunt_id is null then raise exception 'NOT_ALLOWED'; end if;
  update listing_duplicates set dismissed = true
   where hunt_id = v.hunt_id and a = least(p_a, p_b) and b = greatest(p_a, p_b);
end $$;

-- Owner gives a broker a new PIN (forgot PIN / phone changed hands). Old sessions are logged out.
create or replace function owner_reset_broker_pin(p_token text, p_broker uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare h hunts; pin text := lpad((floor(random() * 10000))::int::text, 4, '0');
begin
  select * into h from hunts where owner_token = p_token;
  if h.id is null then raise exception 'OWNER_ONLY'; end if;
  update brokers set pin_hash = crypt(pin, gen_salt('bf', 8)), failed_logins = 0, locked_until = null,
                     token = encode(gen_random_bytes(12), 'hex')
   where id = p_broker and hunt_id = h.id;
  if not found then raise exception 'NOT_ALLOWED'; end if;
  return jsonb_build_object('pin', pin);
end $$;

-- ── Grants: only the public RPCs are callable from the browser ──────────────────────────────────
revoke all on function _norm_phone(text), _map_key(text), _near(numeric, numeric, numeric), _detect_duplicates(uuid) from public, anon, authenticated;
revoke all on function broker_login(text, text, text, text), broker_change_pin(text, text, text),
  broker_submit(text, text, text, integer, integer, integer, text, timestamptz, text[], text[], text[]),
  broker_edit_listing(text, uuid, text, text, integer, integer, integer, text, text[], text[], text[], text[]),
  viewer_dismiss_duplicate(text, uuid, uuid), owner_reset_broker_pin(text, uuid) from public;
grant execute on function broker_login(text, text, text, text), broker_change_pin(text, text, text),
  broker_submit(text, text, text, integer, integer, integer, text, timestamptz, text[], text[], text[]),
  broker_edit_listing(text, uuid, text, text, integer, integer, integer, text, text[], text[], text[], text[]),
  viewer_dismiss_duplicate(text, uuid, uuid), owner_reset_broker_pin(text, uuid) to anon, authenticated;

-- Check what's already there.
select _detect_duplicates(id) from listings;
