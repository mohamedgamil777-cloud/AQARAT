-- Run ONLY after the new site (phone + PIN login) is live on Vercel.
-- Removes the old name+phone submit, so the only way in for a broker is broker_login.
drop function if exists submit_listing(text, text, text, text, text, integer, integer, integer, text, timestamptz, text[], text[]);
