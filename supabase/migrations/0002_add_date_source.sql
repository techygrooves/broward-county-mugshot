-- Adds provenance for imported dates. When a friend-site record has no
-- explicit booking/arrest date and we fall back to the WordPress post
-- (published) date, the title, or a body date, date_source records that
-- so admins can tell an authoritative booking date from an inferred one.
--
-- Values used by the friend-site importer:
--   booking_label                 -> explicit "Booking Date" on the page
--   arrest_label                  -> explicit "Arrest Date" on the page
--   imported_from_friend_site_date-> inferred (WP published / title / body)
--
-- Run this in the Supabase SQL editor before the next live friend-site
-- import. Safe to run repeatedly.

alter table public.arrests
  add column if not exists date_source text;
