BEGIN;
ALTER TABLE public.tedarikciler
  ADD COLUMN IF NOT EXISTS gecmis_borc numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gecmis_alacak numeric NOT NULL DEFAULT 0;
COMMIT;
