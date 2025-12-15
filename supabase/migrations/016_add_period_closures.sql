-- 016_add_period_closures.sql
-- Amaç: period_closures tablosu + enum'a DEVIR ekleme + güvenli index

-- 0) islem_tipi sütununun gerçek enum adını bul ve 'DEVIR' yoksa ekle
DO $$
DECLARE
  tname text;
  has_value boolean;
BEGIN
  SELECT t.typname
    INTO tname
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE n.nspname = 'public'
    AND c.relname = 'finansal_islemler'
    AND a.attname = 'islem_tipi';

  IF tname IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_type tt
      JOIN pg_enum e ON tt.oid = e.enumtypid
      WHERE tt.typname = tname
        AND e.enumlabel = 'DEVIR'
    ) INTO has_value;

    IF NOT has_value THEN
      EXECUTE format('ALTER TYPE %I ADD VALUE %L', tname, 'DEVIR');
    END IF;
  END IF;
END$$;

-- 1) Yeni tablo (additive, mevcutları bozmaz)
CREATE TABLE IF NOT EXISTS public.period_closures (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sirket_id     uuid NOT NULL,
  period_yyyymm text NOT NULL CHECK (period_yyyymm ~ '^\d{6}$'),
  closed_by     uuid NOT NULL,
  closed_at     timestamptz NOT NULL DEFAULT now(),
  reopened_at   timestamptz,
  note          text,
  CONSTRAINT uq_period_closures UNIQUE (sirket_id, period_yyyymm)
);

-- 2) İndeksler
CREATE INDEX IF NOT EXISTS idx_period_closures_sirket_period
  ON public.period_closures (sirket_id, period_yyyymm);

CREATE INDEX IF NOT EXISTS idx_fin_islem_sirket_tedarikci_tarih
  ON public.finansal_islemler (sirket_id, tedarikci_id, islem_tarihi);

-- Eski/hataya yol açabilecek index adlarını temizlik (varsa)
DROP INDEX IF EXISTS public.idx_fin_islem_devir_ay;
DROP INDEX IF EXISTS public.idx_fin_islem_devir_date;

-- IMMUTABLE güvenli kısmi index (predicate'te fonksiyon yok / yalnızca ::text cast'ı)
CREATE INDEX IF NOT EXISTS idx_fin_islem_devir_sirket_tarih
  ON public.finansal_islemler (sirket_id, islem_tarihi)
  WHERE (islem_tipi::text = 'DEVIR');
