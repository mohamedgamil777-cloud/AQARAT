-- What the owner is looking for, shown to every broker: size range, monthly rent range, ground-floor preference.
alter table hunts add column if not exists brief jsonb not null
  default '{"size_min":500,"size_max":1000,"price_min":90000,"price_max":150000,"ground":true}'::jsonb;

create or replace function broker_invite(p_invite text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('title', title, 'owner_name', owner_name, 'features', to_jsonb(features), 'brief', brief)
  from hunts where broker_token = p_invite
$$;

create or replace function broker_view(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'broker', jsonb_build_object('name', b.name, 'phone', b.phone, 'has_pin', b.pin_hash is not null),
    'hunt', jsonb_build_object('owner_name', h.owner_name, 'owner_phone', h.owner_phone, 'invite', h.broker_token,
      'features', to_jsonb(h.features), 'brief', h.brief),
    'listings', coalesce((select jsonb_agg(_listing_json(l, false) order by l.created_at desc) from listings l where l.broker_id = b.id), '[]'::jsonb))
  from brokers b join hunts h on h.id = b.hunt_id where b.token = p_token
$$;

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
      'owner_phone', h.owner_phone, 'features', to_jsonb(h.features), 'invite', h.broker_token, 'brief', h.brief,
      'partner_token', case when v.role = 'owner' then h.partner_token end),
    'listings', coalesce((select jsonb_agg(_listing_json(l, true) order by l.created_at desc) from listings l where l.hunt_id = h.id), '[]'::jsonb),
    'duplicates', coalesce((select jsonb_agg(jsonb_build_object('a', d.a, 'b', d.b, 'reasons', to_jsonb(d.reasons), 'created_at', d.created_at) order by d.created_at desc)
       from listing_duplicates d where d.hunt_id = h.id and not d.dismissed and cardinality(d.reasons) > 0), '[]'::jsonb),
    'brokers', case when v.role = 'owner' then coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'phone', b.phone, 'has_pin', b.pin_hash is not null,
        'locked', coalesce(b.locked_until > now(), false), 'created_at', b.created_at,
        'listings', (select count(*) from listings l where l.broker_id = b.id)) order by b.created_at desc)
       from brokers b where b.hunt_id = h.id), '[]'::jsonb) end);
end $$;

-- Owner edits the brief from settings. Empty number = no limit on that side.
create or replace function owner_set_brief(p_token text, p_size_min int, p_size_max int, p_price_min int, p_price_max int, p_ground boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (p_size_min is not null and p_size_max is not null and p_size_min > p_size_max)
     or (p_price_min is not null and p_price_max is not null and p_price_min > p_price_max) then
    raise exception 'BAD_RANGE';
  end if;
  update hunts set brief = jsonb_build_object('size_min', p_size_min, 'size_max', p_size_max,
      'price_min', p_price_min, 'price_max', p_price_max, 'ground', coalesce(p_ground, false))
   where owner_token = p_token;
  if not found then raise exception 'OWNER_ONLY'; end if;
end $$;
