DROP FUNCTION IF EXISTS public.get_monthly_supplier_report_data(integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.get_monthly_supplier_report_data(
    p_sirket_id integer,
    p_tedarikci_id integer,
    p_start_date text,
    p_end_date text
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER -- RLS kurallarına uyması için
SET search_path = public
AS $$
DECLARE
    start_utc timestamptz;
    end_utc timestamptz;
    
    -- Sonuçları tutacak değişkenler
    json_sut json;
    json_yem json;
    json_finans json;
    
    toplam_sut_tutari numeric := 0;
    toplam_yem_borcu numeric := 0;
    toplam_odeme numeric := 0;
    toplam_tahsilat numeric := 0;
BEGIN
    -- Tarihleri ayarla
    start_utc := (p_start_date::date)::timestamp AT TIME ZONE 'Europe/Istanbul';
    end_utc := ((p_end_date::date) + interval '1 day')::timestamp AT TIME ZONE 'Europe/Istanbul';

    -- 1. SÜT VERİLERİNİ VE TOPLAMINI AYRI HESAPLA
    WITH sut_data AS (
        SELECT 
            fiyat,
            SUM(litre) as toplam_litre,
            SUM(litre * fiyat) as toplam_tutar
        FROM sut_girdileri
        WHERE sirket_id = p_sirket_id 
          AND tedarikci_id = p_tedarikci_id
          AND taplanma_tarihi >= start_utc AND taplanma_tarihi < end_utc
        GROUP BY fiyat
    )
    SELECT 
        COALESCE(json_agg(sut_data ORDER BY fiyat), '[]'::json),
        COALESCE(SUM(toplam_tutar), 0)
    INTO json_sut, toplam_sut_tutari
    FROM sut_data;

    -- 2. YEM VERİLERİNİ VE TOPLAMINI AYRI HESAPLA
    WITH yem_data AS (
        SELECT 
            yu.yem_adi,
            yi.islem_anindaki_birim_fiyat,
            SUM(yi.miktar_kg) as miktar_kg,
            SUM(yi.toplam_tutar) as toplam_tutar
        FROM yem_islemleri yi
        JOIN yem_urunleri yu ON yi.yem_urun_id = yu.id
        WHERE yi.sirket_id = p_sirket_id 
          AND yi.tedarikci_id = p_tedarikci_id
          AND yi.islem_tarihi >= start_utc AND yi.islem_tarihi < end_utc
        GROUP BY yu.yem_adi, yi.islem_anindaki_birim_fiyat
    )
    SELECT 
        COALESCE(json_agg(yem_data ORDER BY yem_adi), '[]'::json),
        COALESCE(SUM(toplam_tutar), 0)
    INTO json_yem, toplam_yem_borcu
    FROM yem_data;

    -- 3. FİNANS VERİLERİNİ VE TOPLAMLARI AYRI HESAPLA
    WITH finans_data AS (
        SELECT 
            islem_tarihi,
            islem_tipi,
            tutar,
            aciklama,
            to_char((islem_tarihi AT TIME ZONE 'Europe/Istanbul'), 'DD.MM.YYYY HH24:MI') as islem_tarihi_formatted
        FROM finansal_islemler
        WHERE sirket_id = p_sirket_id 
          AND tedarikci_id = p_tedarikci_id
          AND islem_tarihi >= start_utc AND islem_tarihi < end_utc
    )
    SELECT 
        COALESCE(json_agg(finans_data ORDER BY islem_tarihi), '[]'::json),
        COALESCE(SUM(CASE WHEN islem_tipi IN ('Ödeme', 'Avans') THEN tutar ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN islem_tipi = 'Tahsilat' THEN tutar ELSE 0 END), 0)
    INTO json_finans, toplam_odeme, toplam_tahsilat
    FROM finans_data;

    -- 4. SONUCU BİRLEŞTİR VE DÖNDÜR
    RETURN json_build_object(
        'sut_girdileri', json_sut,
        'yem_islemleri', json_yem,
        'finansal_islemler', json_finans,
        'ozet', json_build_object(
            'toplam_sut_tutari', toplam_sut_tutari,
            'toplam_yem_borcu', toplam_yem_borcu,
            'toplam_sirket_odemesi', toplam_odeme,
            'toplam_tahsilat', toplam_tahsilat
        )
    );
END;
$$;