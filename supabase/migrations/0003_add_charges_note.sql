-- Provenance for records where charge text could not be parsed from the
-- source. When the friend-site importer cannot extract any charge, it keeps
-- the record valid, stores charges_json as an empty array, and sets
-- charges_note = 'charges_not_parsed' so admins can spot records that need a
-- manual charge review.
--
-- Run this in the Supabase SQL editor before the next live friend-site
-- import. Safe to run repeatedly.

alter table public.arrests
  add column if not exists charges_note text;
