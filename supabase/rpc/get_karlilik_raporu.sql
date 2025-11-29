-- Kârlılık Raporunu Hesaplayan Ana Fonksiyon (GÜNCELLENMİŞ VERSİYON)
-- Bu fonksiyon; Süt, Yem, Finans ve Masraf modüllerindeki tüm verileri birleştirir.

DROP FUNCTION IF EXISTS public.get_karlilik_raporu(integer, text, text);

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
    -- Tarih aralığı (Timestamp dönüşümü ile)
    v_start_ts timestamptz;
    v_end_ts timestamptz;
    v_start_date date;
    v_end_date date;
    
    -- Hesaplanan Değişkenler
    v_sut_maliyeti numeric := 0;
    v_sut_geliri numeric := 0;
    
    v_yem_maliyeti numeric := 0;
    v_yem_geliri numeric := 0;
    
    v_finans_giderleri numeric := 0; -- Finans tablosundaki giderler
    v_modul_giderleri numeric := 0;  -- Masraf modülündeki giderler
    v_toplam_diger_gider numeric := 0;
    
    v_diger_gelirler numeric := 0;
    
BEGIN
    -- Tarihleri hem Date hem Timestamp olarak ayarla
    v_start_date := p_start_date::date;
    v_end_date := p_end_date::date;
    
    -- Timezone hassasiyeti için (Günün başlangıcı ve bitişi)
    v_start_ts := (p_start_date::date)::timestamp AT TIME ZONE 'Europe/Istanbul';
    v_end_ts := ((p_end_date::date) + interval '1 day')::timestamp AT TIME ZONE 'Europe/Istanbul';

    -- 1. SÜT MALİYETİ (GİDER)
    -- Kaynak: 'sut_girdileri' tablosu (Çiftçiden alınan sütler)
    SELECT COALESCE(SUM(litre * fiyat), 0)
    INTO v_sut_maliyeti
    FROM public.sut_girdileri
    WHERE sirket_id = p_sirket_id
      AND taplanma_tarihi >= v_start_ts AND taplanma_tarihi < v_end_ts;

    -- 2. SÜT GELİRİ (GELİR)
    -- Kaynak: 'finansal_islemler' tablosu (İşlem Tipi: 'Süt Satışı')
    SELECT COALESCE(SUM(tutar), 0)
    INTO v_sut_geliri
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND islem_tipi = 'Süt Satışı'
      AND islem_tarihi >= v_start_ts AND islem_tarihi < v_end_ts;

    -- 3. YEM MALİYETİ (GİDER)
    -- Kaynak: 'yem_girisleri' tablosu (Stoğa giren yemler ve manuel artışlar)
    SELECT COALESCE(SUM(toplam_tutar), 0)
    INTO v_yem_maliyeti
    FROM public.yem_girisleri
    WHERE sirket_id = p_sirket_id
      AND created_at >= v_start_ts AND created_at < v_end_ts;

    -- 4. YEM GELİRİ (GELİR)
    -- Kaynak: 'finansal_islemler' tablosu (İşlem Tipi: 'Yem Satışı')
    -- Not: Yem satışları otomatik olarak finansal işlemlere 'Yem Satışı' olarak kaydediliyor.
    SELECT COALESCE(SUM(tutar), 0)
    INTO v_yem_geliri
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND islem_tipi = 'Yem Satışı'
      AND islem_tarihi >= v_start_ts AND islem_tarihi < v_end_ts;

    -- 5. DİĞER GİDERLER (HEM FİNANS HEM MASRAF MODÜLÜNDEN)
    
    -- A) Finans Modülünden ('Diğer Gider', 'Masraf', 'Prim', 'Süt Alımı', 'Yem Alımı' tipleri hariç tutulabilir ama biz manuel eklenenleri alıyoruz)
    SELECT COALESCE(SUM(tutar), 0)
    INTO v_finans_giderleri
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND islem_tipi IN ('Diğer Gider', 'Masraf', 'Prim')
      AND islem_tarihi >= v_start_ts AND islem_tarihi < v_end_ts;

    -- B) Masraf Modülünden ('genel_masraflar' tablosu)
    SELECT COALESCE(SUM(tutar), 0)
    INTO v_modul_giderleri
    FROM public.genel_masraflar
    WHERE sirket_id = p_sirket_id
      AND masraf_tarihi >= v_start_date AND masraf_tarihi <= v_end_date;

    -- İkisini topla
    v_toplam_diger_gider := v_finans_giderleri + v_modul_giderleri;

    -- 6. DİĞER GELİRLER
    -- Kaynak: 'finansal_islemler' tablosu (İşlem Tipi: 'Diğer Gelir')
    SELECT COALESCE(SUM(tutar), 0)
    INTO v_diger_gelirler
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND islem_tipi = 'Diğer Gelir'
      AND islem_tarihi >= v_start_ts AND islem_tarihi < v_end_ts;

    -- SONUÇLARI JSON OLARAK DÖNDÜR
    RETURN json_build_object(
        'sut_geliri', v_sut_geliri,
        'sut_maliyeti', v_sut_maliyeti,
        'sut_kari', (v_sut_geliri - v_sut_maliyeti),
        
        'yem_geliri', v_yem_geliri,
        'yem_maliyeti', v_yem_maliyeti, 
        'yem_kari', (v_yem_geliri - v_yem_maliyeti),
        
        'diger_gelirler', v_diger_gelirler,
        'diger_giderler', v_toplam_diger_gider, -- Finans + Masraf Tablosu Toplamı
        
        'toplam_gelir', (v_sut_geliri + v_yem_geliri + v_diger_gelirler),
        'toplam_gider', (v_sut_maliyeti + v_yem_maliyeti + v_toplam_diger_gider),
        
        'net_kar', (
            (v_sut_geliri + v_yem_geliri + v_diger_gelirler) - 
            (v_sut_maliyeti + v_yem_maliyeti + v_toplam_diger_gider)
        )
    );
END;
$$;