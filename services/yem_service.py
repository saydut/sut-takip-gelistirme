# services/yem_service.py

import logging
from flask import g, session
from decimal import Decimal, InvalidOperation, DivisionByZero
from constants import UserRole
from utils import sanitize_input

logger = logging.getLogger(__name__)

class YemService:
    """Yem ürünleri ve işlemleri için servis katmanı."""

    def get_paginated_products(self, sirket_id: int, sayfa: int, limit: int = 10):
        """Yem ürünlerini sayfalayarak listeler."""
        try:
            offset = (sayfa - 1) * limit
            query = g.supabase.table('yem_urunleri').select(
                '*, cuval_agirligi_kg, cuval_fiyati, satis_fiyati, satis_cuval_fiyati', 
                count='exact'
            ).eq('sirket_id', sirket_id).order('yem_adi').range(offset, offset + limit - 1)
            response = query.execute()
            return response.data, response.count
        except Exception as e:
            logger.error(f"Yem ürünleri listelenirken hata oluştu: {e}", exc_info=True)
            raise Exception("Ürünler listelenirken bir hata oluştu.")

    def get_all_products_for_dropdown(self, sirket_id: int):
        """Dropdown menüler için tüm yem ürünlerini listeler."""
        try:
            response = g.supabase.table('yem_urunleri').select(
                'id, yem_adi, stok_miktari_kg, birim_fiyat, cuval_agirligi_kg, cuval_fiyati, satis_fiyati, satis_cuval_fiyati'
            ).eq('sirket_id', sirket_id).order('yem_adi').execute()
            return response.data
        except Exception as e:
            logger.error(f"Dropdown için yem ürünleri listesi alınırken hata: {e}", exc_info=True)
            raise Exception("Ürün listesi alınamadı.")

    def _prepare_product_data(self, sirket_id: int, data: dict):
        """Gelen veriye göre yem ürünü verisini hazırlar."""
        fiyatlandirma_tipi = data.get('fiyatlandirma_tipi')
        yem_adi = sanitize_input(data.get('yem_adi'))

        if not yem_adi:
            raise ValueError("Yem adı zorunludur.")

        urun_verisi = {
            "sirket_id": sirket_id,
            "yem_adi": yem_adi,
            "cuval_agirligi_kg": None,
            "cuval_fiyati": None,       # Alış Çuval Fiyatı
            "birim_fiyat": None,        # Alış KG Fiyatı
            "satis_cuval_fiyati": None, # Satış Çuval Fiyatı
            "satis_fiyati": None,       # Satış KG Fiyatı
            "stok_miktari_kg": None
         }

        try:
            def to_decimal(val):
                if not val: return Decimal('0')
                return Decimal(str(val).replace(',', '.'))

            if fiyatlandirma_tipi == 'cuval':
                cuval_fiyati = to_decimal(data.get('cuval_fiyati'))
                cuval_agirligi_kg = to_decimal(data.get('cuval_agirligi_kg'))
                stok_adedi = to_decimal(data.get('stok_adedi') or data.get('stok_miktari_kg'))
                satis_cuval_fiyati = to_decimal(data.get('satis_cuval_fiyati'))

                if cuval_fiyati < 0 or cuval_agirligi_kg < 0 or stok_adedi < 0:
                     pass 

                urun_verisi["birim_fiyat"] = str(cuval_fiyati / cuval_agirligi_kg) if cuval_agirligi_kg > 0 else "0"
                urun_verisi["satis_fiyati"] = str(satis_cuval_fiyati / cuval_agirligi_kg) if cuval_agirligi_kg > 0 else "0"
                urun_verisi["stok_miktari_kg"] = str(stok_adedi * cuval_agirligi_kg)
                urun_verisi["cuval_fiyati"] = str(cuval_fiyati)
                urun_verisi["cuval_agirligi_kg"] = str(cuval_agirligi_kg)
                urun_verisi["satis_cuval_fiyati"] = str(satis_cuval_fiyati)

            else: # KG fiyatı
                birim_fiyat = to_decimal(data.get('birim_fiyat'))
                stok_miktari_kg = to_decimal(data.get('stok_miktari_kg'))
                satis_fiyati = to_decimal(data.get('satis_fiyati'))
                
                urun_verisi["birim_fiyat"] = str(birim_fiyat)
                urun_verisi["satis_fiyati"] = str(satis_fiyati)
                urun_verisi["stok_miktari_kg"] = str(stok_miktari_kg)
                urun_verisi["satis_cuval_fiyati"] = None
                urun_verisi["cuval_fiyati"] = None
                urun_verisi["cuval_agirligi_kg"] = None

            return urun_verisi
            
        except (InvalidOperation, TypeError, DivisionByZero):
            raise ValueError("Lütfen tüm fiyat ve ağırlık alanlarına geçerli sayılar girin.")


    def add_product(self, sirket_id: int, data: dict):
        """Yeni bir yem ürünü ekler."""
        try:
            yeni_urun = self._prepare_product_data(sirket_id, data)
            response = g.supabase.table('yem_urunleri').insert(yeni_urun).execute()
            eklenen_urun = response.data[0]
            
            baslangic_stok = Decimal(eklenen_urun['stok_miktari_kg'])
            birim_fiyat = Decimal(eklenen_urun['birim_fiyat'])
            
            if baslangic_stok > 0 and birim_fiyat > 0:
                toplam_tutar = baslangic_stok * birim_fiyat
                kullanici_id = session.get('user', {}).get('id')
                
                giris_data = {
                    "sirket_id": sirket_id,
                    "yem_urun_id": eklenen_urun['id'],
                    "kullanici_id": kullanici_id,
                    "miktar_kg": str(baslangic_stok),
                    "islem_anindaki_birim_alis_fiyati": str(birim_fiyat),
                    "toplam_tutar": str(toplam_tutar),
                    "aciklama": "Ürün oluşturulurken girilen başlangıç stoğu"
                }
                g.supabase.table('yem_girisleri').insert(giris_data).execute()

            return eklenen_urun
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem ürünü eklenirken hata: {e}", exc_info=True)
            raise Exception("Ürün eklenirken bir sunucu hatası oluştu.")

    def update_product(self, id: int, sirket_id: int, data: dict):
        """Bir yem ürününü günceller."""
        try:
            eski_urun_res = g.supabase.table('yem_urunleri').select('birim_fiyat, stok_miktari_kg').eq('id', id).single().execute()
            
            if not eski_urun_res.data:
                 raise ValueError("Ürün bulunamadı.")

            eski_fiyat = Decimal(eski_urun_res.data.get('birim_fiyat', 0))
            eski_stok = Decimal(eski_urun_res.data.get('stok_miktari_kg', 0))

            guncel_veri = self._prepare_product_data(sirket_id, data)
            if 'sirket_id' in guncel_veri: del guncel_veri['sirket_id']

            response = g.supabase.table('yem_urunleri').update(guncel_veri).eq('id', id).eq('sirket_id', sirket_id).execute()
            if not response.data:
                raise ValueError("Ürün bulunamadı veya bu işlem için yetkiniz yok.")
            
            guncellenen_urun = response.data[0]
            yeni_fiyat = Decimal(guncellenen_urun.get('birim_fiyat', 0))
            yeni_stok = Decimal(guncellenen_urun.get('stok_miktari_kg', 0))

            if eski_fiyat != yeni_fiyat and yeni_fiyat > 0:
                girisler_res = g.supabase.table('yem_girisleri').select('id, miktar_kg').eq('yem_urun_id', id).eq('sirket_id', sirket_id).execute()
                if girisler_res.data:
                    for giris in girisler_res.data:
                        miktar = Decimal(giris['miktar_kg'])
                        yeni_tutar = miktar * yeni_fiyat
                        g.supabase.table('yem_girisleri').update({
                            'islem_anindaki_birim_alis_fiyati': str(yeni_fiyat),
                            'toplam_tutar': str(yeni_tutar)
                        }).eq('id', giris['id']).execute()
            
            stok_farki = yeni_stok - eski_stok
            if stok_farki != 0:
                kullanici_id = session.get('user', {}).get('id')
                toplam_tutar = stok_farki * yeni_fiyat
                aciklama = "Stok düzenleme: Manuel artış" if stok_farki > 0 else "Stok düzenleme: Manuel azalış/düzeltme"
                
                giris_data = {
                    "sirket_id": sirket_id,
                    "yem_urun_id": id,
                    "kullanici_id": kullanici_id,
                    "miktar_kg": str(stok_farki),
                    "islem_anindaki_birim_alis_fiyati": str(yeni_fiyat),
                    "toplam_tutar": str(toplam_tutar),
                    "aciklama": aciklama
                }
                g.supabase.table('yem_girisleri').insert(giris_data).execute()

            return guncellenen_urun

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem ürünü güncellenirken hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")


    def delete_product(self, id: int, sirket_id: int):
        """Bir yem ürününü siler."""
        try:
            islem_kontrol = g.supabase.table('yem_islemleri').select('id', count='exact').eq('yem_urun_id', id).eq('sirket_id', sirket_id).execute()

            if islem_kontrol.count > 0:
                raise ValueError("Bu yeme ait çıkış işlemleri olduğu için silinemiyor.")

            response = g.supabase.table('yem_urunleri').delete().eq('id', id).eq('sirket_id', sirket_id).execute()
            if not response.data:
                 if islem_kontrol.count == 0:
                     raise ValueError("Ürün bulunamadı veya bu işlem için yetkiniz yok.")

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem ürünü silinirken hata: {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")


    def get_paginated_transactions(self, sirket_id: int, kullanici_id: int, rol: str, sayfa: int, limit: int = 5):
        """Yem çıkış işlemlerini sayfalayarak listeler (DÜZELTİLDİ: RPC Yerine Standart Sorgu)."""
        try:
            offset = (sayfa - 1) * limit
            
            # RPC fonksiyonu yerine doğrudan tablo sorgusu kullanıyoruz.
            # Bu sayede veritabanındaki en güncel ve doğru veriyi çektiğimizden emin oluyoruz.
            query = g.supabase.table('yem_islemleri').select(
                '*, tedarikciler(isim), yem_urunleri(yem_adi), kullanicilar(kullanici_adi)', 
                count='exact'
            ).eq('sirket_id', sirket_id)

            # Rol bazlı filtreleme
            if rol == UserRole.TOPLAYICI.value:
                query = query.eq('kullanici_id', kullanici_id)

            # Sıralama ve Sayfalama
            query = query.order('islem_tarihi', desc=True).range(offset, offset + limit - 1)
            
            response = query.execute()

            if not response.data:
                return [], 0

            islemler = response.data
            toplam_kayit = response.count
            
            return islemler, toplam_kayit
            
        except Exception as e:
            logger.error(f"Yem işlemleri listelenirken hata: {e}", exc_info=True)
            raise Exception("Yem işlemleri listelenemedi.")

    def add_transaction(self, sirket_id: int, kullanici_id: int, data: dict):
        """Yeni bir yem çıkış işlemi yapar."""
        try:
            miktar_kg_str = data.get('miktar_kg')
            yem_urun_id = data.get('yem_urun_id')
            tedarikci_id = data.get('tedarikci_id')
            fiyat_tipi = data.get('fiyat_tipi') 
            birim_fiyat_str = data.get('birim_fiyat') 
            aciklama_str = sanitize_input(data.get('aciklama')) or None

            if not all([miktar_kg_str, yem_urun_id, tedarikci_id, fiyat_tipi, birim_fiyat_str]):
                raise ValueError("Eksik bilgi: Tedarikçi, yem, miktar, fiyat tipi ve birim fiyat zorunludur.")
            
            try:
                miktar_kg = Decimal(str(miktar_kg_str).replace(',', '.'))
                islem_anindaki_birim_fiyat = Decimal(str(birim_fiyat_str).replace(',', '.'))
            except (InvalidOperation, TypeError):
                 raise ValueError("Miktar ve Birim Fiyat geçerli bir sayı olmalıdır.")
            
            if miktar_kg <= 0 or islem_anindaki_birim_fiyat < 0:
                raise ValueError("Miktar pozitif, Birim Fiyat negatif olmayan bir değer olmalıdır.")

            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg, yem_adi') \
                .eq('id', yem_urun_id).eq('sirket_id', sirket_id).single().execute()
            if not urun_res.data:
                raise ValueError("Yem ürünü bulunamadı.")
            
            yem_adi = urun_res.data['yem_adi']
            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            if mevcut_stok < miktar_kg:
                raise ValueError(f"Yetersiz stok! Mevcut stok: {mevcut_stok} kg")

            toplam_tutar = miktar_kg * islem_anindaki_birim_fiyat

            yeni_islem = {
                "sirket_id": sirket_id,
                "tedarikci_id": tedarikci_id,
                "yem_urun_id": yem_urun_id,
                "kullanici_id": kullanici_id,
                "miktar_kg": str(miktar_kg),
                "fiyat_tipi": fiyat_tipi,
                "islem_anindaki_birim_fiyat": str(islem_anindaki_birim_fiyat),
                "toplam_tutar": str(toplam_tutar),
                "aciklama": aciklama_str
            }
            
            islem_response = g.supabase.table('yem_islemleri').insert(yeni_islem).execute()
            yeni_islem_id = islem_response.data[0]['id']

            yeni_stok = mevcut_stok - miktar_kg
            g.supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}).eq('id', yem_urun_id).execute()

            tedarikci_res = g.supabase.table('tedarikciler').select('isim').eq('id', tedarikci_id).single().execute()
            tedarikci_adi = tedarikci_res.data['isim'] if tedarikci_res.data else 'Bilinmeyen Tedarikçi'
            
            finans_aciklama = f"{tedarikci_adi} - {yem_adi} Satışı"
            if aciklama_str: finans_aciklama += f" ({aciklama_str})"

            yeni_finans_kaydi = {
                "sirket_id": sirket_id,
                "kullanici_id": kullanici_id,
                "tedarikci_id": tedarikci_id,
                "islem_tipi": "Yem Satışı", 
                "tutar": str(toplam_tutar),
                "aciklama": finans_aciklama,
                "yem_islem_id": yeni_islem_id 
            }
            g.supabase.table('finansal_islemler').insert(yeni_finans_kaydi).execute()
            return islem_response.data[0]

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi eklenirken hata: {e}", exc_info=True)
            raise Exception("İşlem sırasında bir hata oluştu.")


    def add_yem_girisi(self, sirket_id: int, kullanici_id: int, data: dict):
        """Yeni bir yem GİRİŞ işlemi yapar (Stok Artırır) ve Gider kaydı oluşturur."""
        try:
            miktar_kg_str = data.get('miktar_kg')
            yem_urun_id = data.get('yem_urun_id')
            birim_alis_fiyat_str = data.get('birim_alis_fiyati')
            aciklama_str = sanitize_input(data.get('aciklama')) or None

            if not all([miktar_kg_str, yem_urun_id, birim_alis_fiyat_str]):
                raise ValueError("Eksik bilgi: Yem ürünü, miktar ve alış fiyatı zorunludur.")
            try:
                miktar_kg = Decimal(str(miktar_kg_str).replace(',', '.'))
                islem_anindaki_birim_alis_fiyati = Decimal(str(birim_alis_fiyat_str).replace(',', '.'))
            except (InvalidOperation, TypeError):
                 raise ValueError("Miktar ve Birim Alış Fiyatı geçerli bir sayı olmalıdır.")
            if miktar_kg <= 0 or islem_anindaki_birim_alis_fiyati <= 0:
                raise ValueError("Miktar ve Birim Alış Fiyatı pozitif değerler olmalıdır.")

            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg').eq('id', yem_urun_id).eq('sirket_id', sirket_id).single().execute()
            if not urun_res.data: raise ValueError("Yem ürünü bulunamadı.")
            
            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            toplam_tutar = miktar_kg * islem_anindaki_birim_alis_fiyati

            yeni_giris = {
                "sirket_id": sirket_id,
                "yem_urun_id": yem_urun_id,
                "kullanici_id": kullanici_id,
                "miktar_kg": str(miktar_kg),
                "islem_anindaki_birim_alis_fiyati": str(islem_anindaki_birim_alis_fiyati),
                "toplam_tutar": str(toplam_tutar),
                "aciklama": aciklama_str
            }
            giris_response = g.supabase.table('yem_girisleri').insert(yeni_giris).execute()

            yeni_stok = mevcut_stok + miktar_kg
            g.supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}).eq('id', yem_urun_id).execute()
            return giris_response.data[0]
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem girişi eklenirken hata: {e}", exc_info=True)
            raise Exception("Stok girişi sırasında bir hata oluştu.")

    def delete_transaction(self, id: int, sirket_id: int):
        """Bir yem çıkış işlemini siler, stoğu iade eder VE FİNANS KAYDINI SİLER."""
        try:
            islem_res = g.supabase.table('yem_islemleri').select('yem_urun_id, miktar_kg').eq('id', id).eq('sirket_id', sirket_id).single().execute()
            if not islem_res.data:
                raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")

            iade_edilecek_miktar = Decimal(islem_res.data['miktar_kg'])
            urun_id = islem_res.data['yem_urun_id']

            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg').eq('id', urun_id).single().execute()
            if not urun_res.data:
                logger.warning(f"Silinen yem işlemine (ID: {id}) ait ürün (ID: {urun_id}) bulunamadı.")
            else:
                mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
                yeni_stok = mevcut_stok + iade_edilecek_miktar
                g.supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}).eq('id', urun_id).execute()

            g.supabase.table('finansal_islemler').delete().eq('yem_islem_id', id).eq('sirket_id', sirket_id).execute()
            g.supabase.table('yem_islemleri').delete().eq('id', id).execute()
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi silinirken hata: {e}", exc_info=True)
            raise Exception("İşlem iptal edilirken bir sunucu hatası oluştu.")

    def update_transaction(self, id: int, sirket_id: int, data: dict):
        """Bir yem çıkış işlemini (miktar ve fiyat) günceller."""
        try:
            # 1. Verileri Al
            yeni_miktar_str = data.get('yeni_miktar_kg')
            yeni_fiyat_str = data.get('yeni_birim_fiyat')

            if not yeni_miktar_str or not yeni_fiyat_str:
                 raise ValueError("Miktar ve fiyat boş olamaz.")

            try:
                # DÜZELTME: Virgül/Nokta değişimi
                yeni_miktar = Decimal(str(yeni_miktar_str).replace(',', '.'))
                yeni_fiyat = Decimal(str(yeni_fiyat_str).replace(',', '.'))

                if yeni_miktar <= 0 or yeni_fiyat < 0:
                    raise ValueError("Miktar pozitif, fiyat negatif olmayan bir değer olmalıdır.")
            except (InvalidOperation, TypeError):
                 raise ValueError("Lütfen geçerli sayısal değerler girin.")

            # 2. Mevcut İşlemi Bul
            mevcut_islem_res = g.supabase.table('yem_islemleri') \
                .select('miktar_kg, yem_urun_id, islem_anindaki_birim_fiyat, aciklama') \
                .eq('id', id).eq('sirket_id', sirket_id).single().execute()
            
            if not mevcut_islem_res.data:
                raise ValueError("Güncellenecek işlem bulunamadı.")

            eski_miktar = Decimal(mevcut_islem_res.data['miktar_kg'])
            urun_id = mevcut_islem_res.data['yem_urun_id']
            
            # 3. Stok Yönetimi (Sadece miktar farkı stoğu etkiler)
            fark = yeni_miktar - eski_miktar 

            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg, yem_adi') \
                .eq('id', urun_id).single().execute()
            if not urun_res.data:
                raise ValueError("Ürün stoğu bulunamadı. İşlem güncellenemiyor.")

            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            
            if fark > 0 and mevcut_stok < fark:
                raise ValueError(f"Yetersiz stok! Sadece {mevcut_stok} kg daha çıkış yapabilirsiniz.")

            yeni_stok = mevcut_stok - fark
            g.supabase.table('yem_urunleri').update({'stok_miktari_kg': str(yeni_stok)}) \
                .eq('id', urun_id).execute()

            # 4. Yeni Tutarı Hesapla (Yeni Miktar * Yeni Fiyat)
            yeni_toplam_tutar = yeni_miktar * yeni_fiyat

            # 5. Yem İşlemini Güncelle
            guncellenecek_islem = {
                'miktar_kg': str(yeni_miktar),
                'islem_anindaki_birim_fiyat': str(yeni_fiyat),
                'toplam_tutar': str(yeni_toplam_tutar)
            }
            
            yeni_aciklama = mevcut_islem_res.data.get('aciklama') 
            if 'aciklama' in data: 
                yeni_aciklama = sanitize_input(data.get('aciklama')) or None
                guncellenecek_islem['aciklama'] = yeni_aciklama
            
            g.supabase.table('yem_islemleri').update(guncellenecek_islem).eq('id', id).execute()
            
            # 6. Finansal Kaydı Güncelle
            finans_kaydi_res = g.supabase.table('finansal_islemler').select('id, aciklama') \
                .eq('yem_islem_id', id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single().execute()

            if finans_kaydi_res.data:
                # Açıklamayı güncelle
                finans_aciklama = finans_kaydi_res.data['aciklama']
                if ' (' in finans_aciklama:
                    finans_aciklama = finans_aciklama.split(' (')[0] 
                
                if yeni_aciklama:
                    finans_aciklama += f" ({yeni_aciklama})" 
                    
                g.supabase.table('finansal_islemler') \
                    .update({
                        'tutar': str(yeni_toplam_tutar), # YENİ TUTAR
                        'aciklama': finans_aciklama
                    }) \
                    .eq('id', finans_kaydi_res.data['id']) \
                    .execute()
            else:
                logger.warning(f"Güncellenecek yem işlemine (ID: {id}) ait finansal kayıt bulunamadı, sadece stok ve yem kaydı güncellendi.")

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi güncellenirken hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")


yem_service = YemService()