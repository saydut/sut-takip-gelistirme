-- Finansal işlemlerde tedarikçi zorunluluğunu kaldır
-- Böylece "Diğer Gelir/Gider" işlemleri tedarikçisiz kaydedilebilir.

ALTER TABLE public.finansal_islemler
ALTER COLUMN tedarikci_id DROP NOT NULL;