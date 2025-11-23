// static/js/firma_yonetimi.js

let tedarikciSeciciTomSelect;

// ==========================================================
// 1. FONKSİYON TANIMLARI (ÖNCE YÜKLENMELİ)
// ==========================================================

async function verileriYukle() {
    const tbody = document.getElementById('kullanicilar-tablosu');
    const lisans = document.getElementById('lisans-bilgisi');
    const veriYok = document.getElementById('veri-yok-mesaji');
    
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Yükleniyor...</td></tr>';
    if(lisans) lisans.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-gray-400"></i>';

    try {
        const data = await api.fetchYonetimData();
        // API yanıtı array mi yoksa obje mi kontrol et
        // get_yonetim_data_api (firma.py) direkt listeyi dönüyor olabilir.
        let kullanicilar = [];
        let limit = 3; // Varsayılan limit

        if (Array.isArray(data)) {
             kullanicilar = data;
        } else if (data && data.kullanicilar) {
             kullanicilar = data.kullanicilar;
             limit = data.limit || 3;
        } else if (data && typeof data === 'object') {
             // Eğer data objesi direkt kullanıcı listesi değilse ve .kullanicilar yoksa
             // belki de kendisi listedir (bazı durumlarda)
             kullanicilar = Object.values(data); 
        }

        if (kullanicilar) {
             // Lisans bilgisini (varsa) göster
             lisansBilgisiniGoster(kullanicilar, limit);
             kullaniciTablosunuDoldur(kullanicilar);
        }
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '';
        gosterMesaj('Veriler yüklenemedi: ' + error.message, 'danger');
        if(lisans) lisans.innerText = '-';
    }
}

function lisansBilgisiniGoster(kullanicilar, limit) {
    const el = document.getElementById('lisans-bilgisi');
    if (!el) return;
    const toplayiciSayisi = kullanicilar.filter(k => k.rol === 'toplayici').length;
    const renk = toplayiciSayisi >= limit ? 'text-red-600 font-bold' : (toplayiciSayisi >= limit * 0.8 ? 'text-yellow-600' : 'text-green-600 font-bold');

    el.innerHTML = `
        <span class="text-gray-400 block text-[10px] uppercase tracking-wider">Toplayıcı Lisansı</span>
        <span class="${renk} text-lg">${toplayiciSayisi} <span class="text-gray-400 text-sm font-normal">/ ${limit}</span></span>
    `;
}

function kullaniciTablosunuDoldur(kullanicilar) {
    const tbody = document.getElementById('kullanicilar-tablosu');
    const veriYok = document.getElementById('veri-yok-mesaji');
    
    tbody.innerHTML = '';
    if (!kullanicilar || kullanicilar.length === 0) {
        if(veriYok) veriYok.classList.remove('hidden');
        return;
    }
    if(veriYok) veriYok.classList.add('hidden');

    kullanicilar.forEach(k => {
        let tarih = '-';
        try { 
            if (k.created_at) {
                tarih = new Date(k.created_at).toLocaleDateString('tr-TR'); 
            }
        } catch(e){}

        let rolBadge = '';
        let rolText = k.rol;
        
        // Rol renklendirme ve isimlendirme
        switch(k.rol) {
            case 'firma_yetkilisi': rolBadge = 'bg-purple-100 text-purple-800'; rolText = 'Yetkili'; break;
            case 'toplayici': rolBadge = 'bg-blue-100 text-blue-800'; rolText = 'Toplayıcı'; break;
            case 'muhasebeci': rolBadge = 'bg-yellow-100 text-yellow-800'; rolText = 'Muhasebe'; break;
            case 'ciftci': rolBadge = 'bg-green-100 text-green-800'; rolText = 'Çiftçi'; break;
            case 'admin': rolBadge = 'bg-gray-800 text-white'; rolText = 'Yönetici'; break;
            default: rolBadge = 'bg-gray-100 text-gray-800';
        }

        let buttons = '';
        // Kullanıcı adı veya isim alanını güvenli şekilde al
        const ad = k.kullanici_adi || k.isim || 'İsimsiz'; 
        const safeName = ad.replace(/'/g, "\\'");
        
        if (k.rol !== 'firma_yetkilisi' && k.rol !== 'admin') {
            buttons += `<button onclick="kullaniciSifreModaliniAc(${k.id}, '${safeName}')" class="p-1.5 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100 mr-1" title="Şifre"><i class="fa-solid fa-key"></i></button>`;
            
            // Sadece Toplayıcı ve Muhasebeci için düzenleme butonu (Çiftçiler Tedarikçi sayfasından düzenlenir)
            if (['toplayici', 'muhasebeci'].includes(k.rol)) {
                buttons += `<button onclick="duzenlemeModaliniAc(${k.id})" class="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 mr-1" title="Düzenle"><i class="fa-solid fa-pen"></i></button>`;
            }
            
            buttons += `<button onclick="silmeOnayiAc(${k.id}, '${safeName}')" class="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100" title="Sil"><i class="fa-solid fa-trash"></i></button>`;
        } else {
            buttons = '<span class="text-xs text-gray-400 italic">İşlem Yok</span>';
        }

        tbody.innerHTML += `
            <tr id="kullanici-satir-${k.id}" class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 text-sm font-medium text-gray-900">${utils.sanitizeHTML(ad)}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 rounded text-xs font-medium ${rolBadge}">${rolText}</span></td>
                <td class="px-6 py-4 text-sm text-gray-500">${tarih}</td>
                <td class="px-6 py-4 text-center">${buttons}</td>
            </tr>
        `;
    });
}

async function yeniKullaniciEkle(e) {
    e.preventDefault();
    const btn = document.getElementById('kaydet-btn');
    const original = btn.innerHTML;
    
    // Formdan verileri al
    const kullaniciAdi = document.getElementById('kullanici-adi-input').value.trim();
    const sifre = document.getElementById('sifre-input').value;
    const telefon = document.getElementById('telefon-input').value.trim();
    const adres = document.getElementById('adres-input').value.trim();
    
    // Rol seçimi (Eğer dropdown varsa oradan, yoksa varsayılan 'toplayici' veya form yapısına göre)
    // HTML'de varsayılan olarak bir rol seçimi yoksa, genellikle 'toplayici' ekleniyor.
    // Ancak biz buraya gizli bir input veya varsayılan değer ekleyelim.
    const rol = 'toplayici'; // Varsayılan

    const veri = {
        kullanici_adi: kullaniciAdi,
        sifre: sifre,
        telefon: telefon,
        adres: adres,
        rol: rol 
    };

    if (!veri.kullanici_adi || !veri.sifre) { gosterMesaj('Kullanıcı adı ve şifre zorunlu.', 'warning'); return; }

    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    try {
        // API endpoint'i: /firma/api/toplayici_ekle (veya genel kullanıcı ekle)
        const res = await api.postToplayiciEkle(veri);
        gosterMesaj(res.message, 'success');
        document.getElementById('yeni-kullanici-form').reset();
        verileriYukle(); // Listeyi yenile
    } catch(err) { gosterMesaj(err.message, 'danger'); }
    finally { btn.disabled = false; btn.innerHTML = original; }
}

function silmeOnayiAc(id, ad) {
    document.getElementById('silinecek-kullanici-id').value = id;
    document.getElementById('silinecek-kullanici-adi').innerText = ad;
    toggleModal('silmeOnayModal', true);
}

async function kullaniciSil() {
    const id = document.getElementById('silinecek-kullanici-id').value;
    toggleModal('silmeOnayModal', false);
    
    // UI'dan silme animasyonu
    const row = document.getElementById(`kullanici-satir-${id}`);
    if(row) {
        row.classList.add('opacity-0', 'scale-95');
        setTimeout(() => row.remove(), 300);
    }

    try {
        const res = await api.deleteKullanici(id);
        gosterMesaj(res.message, 'success');
        // Lisans bilgisini güncellemek için tekrar yükle
        verileriYukle();
    } catch(err) { 
        gosterMesaj(err.message, 'danger'); 
        verileriYukle(); // Hata olursa listeyi geri getir
    }
}

async function duzenlemeModaliniAc(id) {
    const modalTitle = document.querySelector('#kullaniciDuzenleModal h3');
    const atamaAlani = document.getElementById('tedarikci-atama-alani');
    
    if(modalTitle) modalTitle.innerText = 'Yükleniyor...';
    
    const form = document.getElementById('kullanici-duzenle-form');
    if(form) form.reset();
    
    if(tedarikciSeciciTomSelect) tedarikciSeciciTomSelect.clear();
    if(atamaAlani) atamaAlani.classList.add('hidden');
    
    toggleModal('kullaniciDuzenleModal', true);

    try {
        // API'den detayları çek
        const data = await api.fetchKullaniciDetay(id);
        
        // Gelen veri yapısı: { kullanici_detay: {...}, tum_tedarikciler: [...] }
        const k = data.kullanici_detay; // Burası önemli, backend'den bu isimle geliyor
        
        if(modalTitle) modalTitle.innerText = `Düzenle: ${k.kullanici_adi}`;
        document.getElementById('edit-kullanici-id').value = k.id;
        document.getElementById('edit-kullanici-adi-input').value = k.kullanici_adi;
        document.getElementById('edit-telefon-input').value = k.telefon_no || '';
        document.getElementById('edit-adres-input').value = k.adres || '';

        // Sadece Toplayıcılar için Tedarikçi Atama alanını göster
        if (k.rol === 'toplayici' && atamaAlani && tedarikciSeciciTomSelect) {
            atamaAlani.classList.remove('hidden');
            
            // Dropdown seçeneklerini güncelle
            const options = data.tum_tedarikciler.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.isim) }));
            tedarikciSeciciTomSelect.clearOptions();
            tedarikciSeciciTomSelect.addOptions(options);
            
            // Mevcut atamaları seç
            if (k.atanan_tedarikciler && k.atanan_tedarikciler.length > 0) {
                tedarikciSeciciTomSelect.setValue(k.atanan_tedarikciler);
            }
        }
    } catch(e) { 
        console.error(e);
        gosterMesaj('Detay yüklenemedi: ' + e.message, 'danger'); 
        toggleModal('kullaniciDuzenleModal', false);
    }
}

async function kullaniciGuncelle() {
    const id = document.getElementById('edit-kullanici-id').value;
    const btn = document.getElementById('guncelle-btn');
    const veri = {
        kullanici_adi: document.getElementById('edit-kullanici-adi-input').value.trim(),
        sifre: document.getElementById('edit-sifre-input').value, // Boş olabilir
        telefon_no: document.getElementById('edit-telefon-input').value.trim(),
        adres: document.getElementById('edit-adres-input').value.trim(),
        atanan_tedarikciler: tedarikciSeciciTomSelect ? tedarikciSeciciTomSelect.getValue() : []
    };

    if(btn) btn.disabled = true;
    try {
        const res = await api.updateKullanici(id, veri);
        gosterMesaj(res.message, 'success');
        toggleModal('kullaniciDuzenleModal', false);
        verileriYukle();
    } catch(e) { gosterMesaj(e.message, 'danger'); }
    finally { if(btn) btn.disabled = false; }
}

function kullaniciSifreModaliniAc(id, ad) {
    document.getElementById('kullanici-sifre-ayarla-id').value = id;
    document.getElementById('kullanici-sifre-ayarla-kullanici').innerText = ad;
    document.getElementById('kullanici-yeni-sifre-input').value = '';
    document.getElementById('kullanici-yeni-sifre-tekrar-input').value = '';
    toggleModal('kullaniciSifreAyarlaModal', true);
}

async function kullaniciSifreKaydet() {
    const idInput = document.getElementById('kullanici-sifre-ayarla-id');
    const yeniSifreInput = document.getElementById('kullanici-yeni-sifre-input');
    const yeniSifreTekrarInput = document.getElementById('kullanici-yeni-sifre-tekrar-input');
    
    // DÜZELTME: Artık ID ile seçiyoruz, hata vermeyecek.
    const kaydetButton = document.getElementById('sifre-kaydet-btn'); 
    
    if (!idInput || !yeniSifreInput || !yeniSifreTekrarInput || !kaydetButton) {
        console.error("Gerekli elementler bulunamadı.");
        return;
    }

    const id = idInput.value;
    const yeniSifre = yeniSifreInput.value;
    const yeniSifreTekrar = yeniSifreTekrarInput.value;
    const originalButtonText = kaydetButton.innerHTML;

    if (!yeniSifre || !yeniSifreTekrar) {
        gosterMesaj('Lütfen yeni şifreyi ve tekrarını girin.', 'warning');
        return;
    }
    if (yeniSifre !== yeniSifreTekrar) {
        gosterMesaj('Girilen yeni şifreler eşleşmiyor.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;

    try {
        const result = await api.postKullaniciSifreSetle(id, { yeni_sifre: yeniSifre });
        gosterMesaj(result.message, 'success');
        toggleModal('kullaniciSifreAyarlaModal', false);
    } catch (error) {
        gosterMesaj(error.message || 'Şifre ayarlanırken hata oluştu.', 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

// ==========================================================
// 2. SAYFA YÜKLENİNCE ÇALIŞAN KOD (EN SONA)
// ==========================================================

window.onload = function() {
    // Form Dinleyicisi
    const form = document.getElementById('yeni-kullanici-form');
    if(form) form.addEventListener('submit', yeniKullaniciEkle);

    // TomSelect - Tedarikçi Atama için
    const selectEl = document.getElementById('edit-tedarikci-sec');
    if(selectEl) {
        tedarikciSeciciTomSelect = new TomSelect(selectEl, {
            plugins: ['remove_button'],
            create: false,
            sortField: { field: "text", direction: "asc" },
            placeholder: "Tedarikçileri Seçin...",
            maxItems: null // Sınırsız seçim
        });
    }

    verileriYukle();
};