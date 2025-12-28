-- Tedarikçinin belirli bir tarihten önceki bakiyesini hesaplayan fonksiyon
-- Formül: Açılış Bakiyesi + (Eski Süt Alacakları) - (Eski Ödemeler) - (Eski Yem Borçları)

CREATE OR REPLACE FUNCTION get_supplier_balance_before_date(
  p_tedarikci_id UUID,
  p_date DATE
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_opening DECIMAL := 0;
  v_sut_alacak DECIMAL := 0;
  v_odeme_yapilan DECIMAL := 0;
  v_yem_borc DECIMAL := 0;
  v_result DECIMAL := 0;
BEGIN
  -- 1. Açılış Bakiyesini Al (Eğer NULL ise 0 al)
  SELECT COALESCE(opening_balance, 0) INTO v_opening
  FROM tedarikciler
  WHERE id = p_tedarikci_id;

  -- 2. Tarihten önceki Süt Alacaklarını Topla (Tedarikçinin şirketten alacağı)
  SELECT COALESCE(SUM(litre * fiyat), 0) INTO v_sut_alacak
  FROM sut_kayitlari
  WHERE tedarikci_id = p_tedarikci_id AND tarih < p_date;

  -- 3. Tarihten önceki Ödemeleri Topla (Şirketin tedarikçiye ödediği - Gider)
  SELECT COALESCE(SUM(tutar), 0) INTO v_odeme_yapilan
  FROM finans_kayitlari
  WHERE tedarikci_id = p_tedarikci_id 
    AND tur = 'Gider' -- Şirketten çıkan para
    AND tarih < p_date;

  -- 4. Tarihten önceki Yem Satışlarını Topla (Tedarikçinin şirkete borcu)
  SELECT COALESCE(SUM(toplam_fiyat), 0) INTO v_yem_borc
  FROM yem_kayitlari
  WHERE tedarikci_id = p_tedarikci_id AND tarih < p_date;

  -- Hesaplama: (Açılış + Süt) - (Ödeme + Yem)
  -- Pozitif sonuç: Şirket Tedarikçiye borçlu (Tedarikçi Alacaklı)
  -- Negatif sonuç: Tedarikçi Şirkete borçlu
  v_result := (v_opening + v_sut_alacak) - (v_odeme_yapilan + v_yem_borc);

  RETURN v_result;
END;
$$;