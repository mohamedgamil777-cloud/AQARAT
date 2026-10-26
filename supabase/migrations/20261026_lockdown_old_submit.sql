-- Run after the new site (phone + PIN login) is live. Switches off the old name+phone submit,
-- so the only way in for a broker is broker_login. (Overwrites instead of DROP — same effect.)
create or replace function submit_listing(p_invite text, p_name text, p_phone text, p_raw text, p_area text, p_price integer,
  p_size integer, p_floors integer, p_map text, p_visit timestamptz, p_features text[], p_photos text[])
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  raise exception 'NOT_ALLOWED';
end $$;
