# services/finans_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation
from constants import FinansIslemTipi, UserRole
from utils import sanitize_input 

logger = logging.getLogger(__name__)

class FinansService:
    """Finansal işlemler için servis katmanı."""

    def get_paginated_transactions(self, sirket_id: int, kullanici_id: int, rol: str, sayfa: int, limit: int = 5, tarih_str: str = None, tip: str = None):
        try:
            offset = (sayfa - 1) * limit
            params = {
                'p_sirket_id': sirket_id,
                'p_kullanici_id': kullanici_id,
                'p_rol': rol,
                'p_tarih_str': tarih_str,
                'p_tip': tip,
                'p_limit': limit,
                'p_offset': offset
            }
            response = g.supabase.rpc('get_paginated_finansal_islemleri', params).execute()

            if not response.data:
                return [], 0

            result_data = response.data
            islemler = result_data.get('data', [])
            toplam_kayit = result_data.get('count', 0)

            for islem in islemler:
                if 'tedarikci_isim' in islem:
                    islem['tedarikciler'] = {'isim': islem['tedarikci_isim']}
                if 'kullanici_adi' in islem:
                    islem['kullanicilar'] = {'kullanici_adi': islem['kullanici_adi']}

            return islemler, toplam_kayit
        except Exception as e:
            logger.error(f"Finansal işlemler listelenirken hata: {e}", exc_info=True)
            raise Exception("Finansal işlemler listelenemedi.")

    def add_transaction(self, sirket_id: int, kullanici_id: int, data: dict):
        try:
            islem_tipi = data.get('islem_tipi')
            tedarikci_id = data.get('tedarikci_id') # Artık None olabilir
            tutar = data.get('tutar')
            muhatap_adi = sanitize_input(data.get('muhatap_adi')) # Yeni alan (opsiyonel)
            aciklama = sanitize_input(data.get('aciklama')) or ""

            # Tedarikçi ID'si boş gelebilir, string 'null' veya boş string ise None yap
            if not tedarikci_id or str(tedarikci_id).lower() in ['null', '']:
                tedarikci_id = None

            # Eğer tedarikçi seçilmediyse ve muhatap adı girildiyse, bunu açıklamaya ekle
            # (Veritabanında ayrı sütun açmadığımız için bu pratik bir çözüm)
            if not tedarikci_id and muhatap_adi:
                aciklama = f"Muhatap: {muhatap_adi} - {aciklama}"
                aciklama = aciklama.strip(" -") # Eğer asıl açıklama boşsa tireyi temizle

            # Temel Validasyonlar
            if not islem_tipi or not tutar:
                raise ValueError("İşlem tipi ve tutar zorunludur.")
            
            # Eğer işlem tipi Ödeme/Avans/Tahsilat ise Tedarikçi ZORUNLU olmalı
            temel_tipler = [FinansIslemTipi.ODEME.value, FinansIslemTipi.AVANS.value, FinansIslemTipi.TAHSILAT.value]
            if islem_tipi in temel_tipler and not tedarikci_id:
                 raise ValueError(f"{islem_tipi} işlemi için bir tedarikçi seçmelisiniz.")

            gecerli_tipler = [tip.value for tip in FinansIslemTipi] 
            if islem_tipi not in gecerli_tipler:
                raise ValueError("Geçersiz işlem tipi.")

            tutar_decimal = Decimal(tutar)
            if tutar_decimal <= 0:
                raise ValueError("Tutar pozitif bir değer olmalıdır.")

            yeni_islem = {
                "sirket_id": sirket_id,
                "tedarikci_id": tedarikci_id, # None olabilir
                "kullanici_id": kullanici_id,
                "islem_tipi": islem_tipi,
                "tutar": str(tutar_decimal),
                "aciklama": aciklama if aciklama else None,
                "islem_tarihi": data.get('islem_tarihi') or None
            }
            if not yeni_islem["islem_tarihi"]:
                del yeni_islem["islem_tarihi"]

            # Ekleme işlemini yap ve veriyi geri al
            response = g.supabase.table('finansal_islemler').insert(yeni_islem).execute()
            
            return {
                "message": f"{islem_tipi} işlemi başarıyla kaydedildi.",
                "data": response.data[0]
            }

        except (InvalidOperation, TypeError):
            raise ValueError("Lütfen tutar için geçerli bir sayı girin.")
        except ValueError as ve:
            raise ve 
        except Exception as e:
            logger.error(f"Finansal işlem eklenirken hata: {e}", exc_info=True)
            raise Exception("İşlem sırasında bir sunucu hatası oluştu.")

    def update_transaction(self, islem_id: int, sirket_id: int, data: dict):
        try:
            mevcut_islem = g.supabase.table('finansal_islemler').select('islem_tipi') \
                .eq('id', islem_id).eq('sirket_id', sirket_id).single().execute()
            if not mevcut_islem.data:
                raise ValueError("İşlem bulunamadı.")

            guncellenecek_veri = {}
            if 'tutar' in data:
                tutar_decimal = Decimal(data['tutar'])
                if tutar_decimal <= 0:
                    raise ValueError("Tutar pozitif olmalıdır.")
                guncellenecek_veri['tutar'] = str(tutar_decimal)

            if 'aciklama' in data:
                guncellenecek_veri['aciklama'] = sanitize_input(data.get('aciklama')) or None

            if not guncellenecek_veri:
                raise ValueError("Güncellenecek veri bulunamadı.")

            g.supabase.table('finansal_islemler').update(guncellenecek_veri) \
                .eq('id', islem_id).eq('sirket_id', sirket_id).execute()

        except (InvalidOperation, TypeError):
            raise ValueError("Geçerli bir tutar girin.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Finansal işlem güncellenirken hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")

    def delete_transaction(self, islem_id: int, sirket_id: int):
        try:
            response = g.supabase.table('finansal_islemler').delete() \
                .eq('id', islem_id).eq('sirket_id', sirket_id).execute()

            if not response.data:
                raise ValueError("İşlem bulunamadı.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Finansal işlem silinirken hata: {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")

finans_service = FinansService()