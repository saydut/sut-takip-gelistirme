CREATE OR REPLACE FUNCTION get_supplier_summary(
  p_sirket_id integer,
  p_tedarikci_id integer
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  total_sut_alacagi numeric;
  total_yem_borcu numeric;
  total_sirket_odemesi numeric; -- Şirketten Çiftçiye
  total_tahsilat numeric;       -- Çiftçiden Şirkete
  v_gecmis_borc numeric := 0;
  v_gecmis_alacak numeric := 0;
BEGIN
  SELECT COALESCE(gecmis_borc,0), COALESCE(gecmis_alacak,0)
  INTO v_gecmis_borc, v_gecmis_alacak
  FROM tedarikciler
  WHERE id = p_tedarikci_id AND sirket_id = p_sirket_id;

  SELECT COALESCE(SUM(litre*fiyat),0)
  INTO total_sut_alacagi
  FROM sut_girdileri
  WHERE sirket_id = p_sirket_id AND tedarikci_id = p_tedarikci_id;

  SELECT COALESCE(SUM(toplam_tutar),0)
  INTO total_yem_borcu
  FROM yem_islemleri
  WHERE sirket_id = p_sirket_id AND tedarikci_id = p_tedarikci_id;

  SELECT
    COALESCE(SUM(CASE WHEN islem_tipi IN ('Ödeme','Odeme','Avans') THEN tutar ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN islem_tipi = 'Tahsilat' THEN tutar ELSE 0 END),0)
  INTO total_sirket_odemesi, total_tahsilat
  FROM finans
  WHERE sirket_id = p_sirket_id AND tedarikci_id = p_tedarikci_id;

  RETURN json_build_object(
    'toplam_sut_alacagi', total_sut_alacagi,
    'toplam_yem_borcu', total_yem_borcu,
    'toplam_sirket_odemesi', total_sirket_odemesi,
    'toplam_tahsilat', total_tahsilat,
    'gecmis_borc', v_gecmis_borc,
    'gecmis_alacak', v_gecmis_alacak,
    -- Net = (Alacak + Geçmiş Alacak) - (Borç + Geçmiş Borç) - Şirket Ödemesi + Tahsilat
    'net_bakiye', (total_sut_alacagi + v_gecmis_alacak) - (total_yem_borcu + v_gecmis_borc) - total_sirket_odemesi + total_tahsilat
  );
END;
$$;
