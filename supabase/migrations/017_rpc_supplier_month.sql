-- =========================================================
-- REPLACE RPCs for supplier monthly view (TEXT params)
-- Bu blok eski UUID parametreli sürümler varsa temizler.
-- =========================================================

-- Eski imzaları (UUID argümanlı) güvenle düşür
DROP FUNCTION IF EXISTS public.get_supplier_month_ekstre(uuid, uuid, int, int, text[], text[]);
DROP FUNCTION IF EXISTS public.get_supplier_month_kpi    (uuid, uuid, int, int, text[], text[]);

-- =========================================================
-- A) Tedarikçi aylık ekstre (Açılış + hareketler + running)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_supplier_month_ekstre(
  _sirket   TEXT,
  _supplier TEXT,
  _year     INT,
  _month    INT,
  _debits   TEXT[] DEFAULT ARRAY['FATURA','BORC','SATIN_ALMA','YEM_ALIMI','MASRAF','DIGER_GIDER'],
  _credits  TEXT[] DEFAULT ARRAY['ODEME','IADE','ALACAK','AVANS']
)
RETURNS TABLE(
  is_opening BOOLEAN,
  tarih      DATE,
  islem_tipi TEXT,
  aciklama   TEXT,
  borc       NUMERIC,
  alacak     NUMERIC,
  bakiye     NUMERIC
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
  SELECT
    make_date(_year, _month, 1)::date AS d_start,
    (make_date(_year, _month, 1) + INTERVAL '1 month')::date AS d_next
),
opening_tx AS (
  SELECT COALESCE(SUM(
    CASE
      WHEN fi.islem_tipi::text = ANY(_debits)  THEN fi.tutar
      WHEN fi.islem_tipi::text = ANY(_credits) THEN -fi.tutar
      ELSE 0
    END
  ),0) AS net
  FROM public.finansal_islemler fi, params p
  WHERE fi.sirket_id::text = _sirket
    AND fi.tedarikci_id::text = _supplier
    AND fi.islem_tarihi < p.d_start
),
opening_dev AS (
  SELECT COALESCE(SUM(d.tutar),0) AS net
  FROM public.ay_sonu_devirleri d, params p
  WHERE d.sirket_id::text = _sirket
    AND d.tedarikci_id::text = _supplier
    AND d.devir_tarihi < p.d_start
),
opening AS (
  SELECT (tx.net + dv.net) AS amount
  FROM opening_tx tx, opening_dev dv
),
period_rows AS (
  SELECT
    FALSE AS is_opening,
    fi.islem_tarihi::date AS tarih,
    fi.islem_tipi::text   AS islem_tipi,
    fi.aciklama           AS aciklama,
    CASE WHEN fi.islem_tipi::text = ANY(_debits)  THEN fi.tutar ELSE 0 END AS borc,
    CASE WHEN fi.islem_tipi::text = ANY(_credits) THEN fi.tutar ELSE 0 END AS alacak,
    fi.islem_tarihi AS ord_ts,
    fi.id           AS ord_id
  FROM public.finansal_islemler fi, params p
  WHERE fi.sirket_id::text = _sirket
    AND fi.tedarikci_id::text = _supplier
    AND fi.islem_tarihi >= p.d_start
    AND fi.islem_tarihi <  p.d_next
),
opening_row AS (
  SELECT
    TRUE  AS is_opening,
    p.d_start AS tarih,
    'ACILIS'::text AS islem_tipi,
    'Açılış (Geçmişten Devir)'::text AS aciklama,
    CASE WHEN o.amount > 0 THEN o.amount ELSE 0 END AS borc,
    CASE WHEN o.amount < 0 THEN -o.amount ELSE 0 END AS alacak,
    p.d_start::timestamptz - INTERVAL '1 microsecond' AS ord_ts,
    0::bigint AS ord_id
  FROM params p, opening o
),
unioned AS (
  SELECT * FROM opening_row
  UNION ALL
  SELECT * FROM period_rows
),
calc AS (
  SELECT
    u.is_opening, u.tarih, u.islem_tipi, u.aciklama, u.borc, u.alacak,
    SUM(u.borc - u.alacak) OVER (ORDER BY u.ord_ts, u.ord_id
                                 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS bakiye
  FROM unioned u
)
SELECT is_opening, tarih, islem_tipi, aciklama, ROUND(borc,2), ROUND(alacak,2), ROUND(bakiye,2)
FROM calc
ORDER BY tarih, is_opening DESC;
$$;

COMMENT ON FUNCTION public.get_supplier_month_ekstre IS
'Tedarikçi detayı için aylık ekstre: İlk satır Açılış (geçmiş devir), ardından hareketler ve running bakiye. Kaynak: finansal_islemler + ay_sonu_devirleri.';

-- ============================================
-- B) KPI özet (Hesap Özeti / Müstahsil)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_supplier_month_kpi(
  _sirket   TEXT,
  _supplier TEXT,
  _year     INT,
  _month    INT,
  _debits   TEXT[] DEFAULT ARRAY['FATURA','BORC','SATIN_ALMA','YEM_ALIMI','MASRAF','DIGER_GIDER'],
  _credits  TEXT[] DEFAULT ARRAY['ODEME','IADE','ALACAK','AVANS']
)
RETURNS TABLE(
  opening       NUMERIC,
  period_debit  NUMERIC,
  period_credit NUMERIC,
  closing       NUMERIC
)
LANGUAGE sql
STABLE
AS $$
WITH p AS (
  SELECT
    make_date(_year, _month, 1)::date AS d_start,
    (make_date(_year, _month, 1) + INTERVAL '1 month')::date AS d_next
),
open_tx AS (
  SELECT COALESCE(SUM(
    CASE
      WHEN fi.islem_tipi::text = ANY(_debits)  THEN fi.tutar
      WHEN fi.islem_tipi::text = ANY(_credits) THEN -fi.tutar
      ELSE 0
    END
  ),0) AS v
  FROM public.finansal_islemler fi, p
  WHERE fi.sirket_id::text = _sirket
    AND fi.tedarikci_id::text = _supplier
    AND fi.islem_tarihi < p.d_start
),
open_dev AS (
  SELECT COALESCE(SUM(d.tutar),0) AS v
  FROM public.ay_sonu_devirleri d, p
  WHERE d.sirket_id::text = _sirket
    AND d.tedarikci_id::text = _supplier
    AND d.devir_tarihi < p.d_start
),
period_mov AS (
  SELECT
    COALESCE(SUM(CASE WHEN fi.islem_tipi::text = ANY(_debits)  THEN fi.tutar ELSE 0 END),0) AS debit,
    COALESCE(SUM(CASE WHEN fi.islem_tipi::text = ANY(_credits) THEN fi.tutar ELSE 0 END),0) AS credit
  FROM public.finansal_islemler fi, p
  WHERE fi.sirket_id::text = _sirket
    AND fi.tedarikci_id::text = _supplier
    AND fi.islem_tarihi >= p.d_start
    AND fi.islem_tarihi <  p.d_next
),
o AS (
  SELECT (ot.v + od.v) AS opening FROM open_tx ot, open_dev od
)
SELECT
  ROUND(o.opening,2) AS opening,
  ROUND(pm.debit,2)  AS period_debit,
  ROUND(pm.credit,2) AS period_credit,
  ROUND(o.opening + pm.debit - pm.credit, 2) AS closing
FROM o, period_mov pm;
$$;

COMMENT ON FUNCTION public.get_supplier_month_kpi IS
'Tedarikçi aylık özet: opening (geçmişten gelen), period_debit, period_credit, closing. PDF rapor ve özetler için.';
