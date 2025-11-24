-- ÖNCEKİ HATALI VE ÇAKIŞAN FONKSİYONLARI TEMİZLE
DROP FUNCTION IF EXISTS public.get_karlilik_raporu(integer, text, text);
DROP FUNCTION IF EXISTS public.get_karlilik_raporu(bigint, text, text);

-- YENİ VE DÜZELTİLMİŞ FONKSİYON
CREATE OR REPLACE FUNCTION public.get_karlilik_raporu (
  p_sirket_id integer,
  p_start_date text,
  p_end_date text
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_start_date timestamp with time zone;
    v_end_date timestamp with time zone;
    
    -- Operasyonel Değerler
    v_sut_maliyeti numeric := 0; 
    v_sut_geliri numeric := 0;   
    v_yem_maliyeti numeric := 0; 
    v_yem_geliri numeric := 0;   
    
    -- Finansal Tablodan Gelen Diğer Kalemler
    v_diger_giderler numeric := 0; 
    v_diger_gelirler numeric := 0;
    
BEGIN
    -- Tarihleri UTC ve Timezone uyumlu hale getir
    v_start_date := (p_start_date::date)::timestamp AT TIME ZONE 'Europe/Istanbul';
    v_end_date := ((p_end_date::date) + interval '1 day')::timestamp AT TIME ZONE 'Europe/Istanbul';

    -- 1. Süt Maliyeti (GİDER) -> sut_girdileri
    SELECT COALESCE(SUM(litre * fiyat), 0)
    INTO v_sut_maliyeti
    FROM public.sut_girdileri
    WHERE sirket_id = p_sirket_id
      AND taplanma_tarihi >= v_start_date AND taplanma_tarihi < v_end_date;

    -- 2. Süt Geliri (GELİR) -> sut_satis_islemleri
    -- DÜZELTME: Tabloda 'firma_id' kullanıldığı için burada 'firma_id' kullanıyoruz.
    SELECT COALESCE(SUM(toplam_tutar), 0)
    INTO v_sut_geliri
    FROM public.sut_satis_islemleri
    WHERE firma_id = p_sirket_id
      AND islem_tarihi >= v_start_date AND islem_tarihi < v_end_date;

    -- 3. Yem Geliri (GELİR) -> yem_islemleri
    SELECT COALESCE(SUM(toplam_tutar), 0)
    INTO v_yem_geliri
    FROM public.yem_islemleri
    WHERE sirket_id = p_sirket_id
      AND islem_tarihi >= v_start_date AND islem_tarihi < v_end_date;

    -- 4. Yem Maliyeti (GİDER) -> yem_girisleri
    SELECT COALESCE(SUM(toplam_tutar), 0)
    INTO v_yem_maliyeti
    FROM public.yem_girisleri
    WHERE sirket_id = p_sirket_id
      AND created_at >= v_start_date AND created_at < v_end_date;

    -- 5. Genel Giderler (GİDER) -> genel_masraflar
    SELECT COALESCE(SUM(tutar), 0)
    INTO v_diger_giderler
    FROM public.genel_masraflar
    WHERE sirket_id = p_sirket_id
      AND created_at >= v_start_date AND created_at < v_end_date;

    -- 6. Diğer Gelirler -> finansal_islemler
    SELECT COALESCE(SUM(tutar), 0)
    INTO v_diger_gelirler
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND islem_tipi = 'Diğer Gelir'
      AND islem_tarihi >= v_start_date AND islem_tarihi < v_end_date;

    -- Sonuçları JSON olarak döndür
    RETURN json_build_object(
        'sut_geliri', v_sut_geliri,
        'sut_maliyeti', v_sut_maliyeti,
        'sut_kari', (v_sut_geliri - v_sut_maliyeti),
        
        'yem_geliri', v_yem_geliri,
        'yem_maliyeti', v_yem_maliyeti, 
        'yem_kari', (v_yem_geliri - v_yem_maliyeti),
        
        'diger_gelirler', v_diger_gelirler,
        'diger_giderler', v_diger_giderler,
        
        'toplam_gelir', (v_sut_geliri + v_yem_geliri + v_diger_gelirler),
        'toplam_gider', (v_sut_maliyeti + v_yem_maliyeti + v_diger_giderler),
        
        'net_kar', (
            (v_sut_geliri + v_yem_geliri + v_diger_gelirler) - 
            (v_sut_maliyeti + v_yem_maliyeti + v_diger_giderler)
        )
    );
END;
$$;