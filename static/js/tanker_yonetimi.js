// static/js/tanker_yonetimi.js

// === GLOBAL DEĞİŞKENLER ===
let tankerAtamaSecici;
let tumTankerler = []; 
let tumToplayicilar = []; 
let tankerMap = new Map(); 
let seciliToplayiciId = null; 

// === SAYFA YÜKLENİNCE ===
document.addEventListener('DOMContentLoaded', function() {
    
    // TomSelect Başlat
    const selectEl = document.getElementById("tanker-atama-secici");
    if (selectEl) {
        tankerAtamaSecici = new TomSelect(selectEl, {
            create: false,
            sortField: { field: "text", direction: "asc" },
            placeholder: "Tanker seçin..."
        });
    }
    
    // Arama Dinleyicisi
    const aramaInput = document.getElementById('toplayici-arama-input');
    if (aramaInput) {
        aramaInput.addEventListener('input', (e) => {
            renderToplayiciListesi(tumToplayicilar, e.target.value);
        });
    }

    // Form Dinleyicisi
    const form = document.getElementById('yeni-tanker-form');
    if(form) {
        form.addEventListener('submit', (e) => { 
            e.preventDefault(); 
            tankerEkle(); 
        });
    }

    // Satış Fiyatı Değiştiğinde Tutar Hesapla
    const satisFiyatInput = document.getElementById('satis-fiyat-input');
    if (satisFiyatInput) {
        satisFiyatInput.addEventListener('input', hesaplaSatisTutari);
    }

    // İlk Yükleme
    tankerleriYukle();
});

// HTML'den çağrılan Tab Değişim Tetikleyicisi
window.onTabChanged = function(tabName) {
    if (tabName === 'durum') {
        tankerleriYukle();
    } else if (tabName === 'atama') {
        // Veri yoksa veya bayatsa yükle
        if (tumToplayicilar.length === 0) {
            loadAtamaSekmesi();
        }
    }
};

// --- TANKER LİSTELEME ---

async function tankerleriYukle() {
    const container = document.getElementById('tanker-listesi-container');
    const veriYokMesaji = document.getElementById('tanker-veri-yok');
    
    if (!container) return;

    // Yükleniyor göstergesi (Tailwind)
    container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500"><i class="fa-solid fa-circle-notch fa-spin text-brand-500 mr-2"></i> Yükleniyor...</div>';
    if (veriYokMesaji) veriYokMesaji.classList.add('hidden');

    try {
        // forceRefresh = true ile taze veri çek
        if (typeof store !== 'undefined' && store.getTankers) {
            tumTankerler = await store.getTankers(true);
        } else {
            tumTankerler = await api.request('/tanker/api/listele');
        }

        if (!tumTankerler || tumTankerler.length === 0) {
            container.innerHTML = '';
            if (veriYokMesaji) veriYokMesaji.classList.remove('hidden');
            return;
        }

        renderTankerListesi(tumTankerler);

    } catch (error) {
        container.innerHTML = `<div class="col-span-full text-center text-red-500 py-4">Hata: ${error.message}</div>`;
    }
}

function renderTankerListesi(tankerler) {
    const container = document.getElementById('tanker-listesi-container');
    container.innerHTML = ''; 

    tankerler.forEach(tanker => {
        const kapasite = parseFloat(tanker.kapasite_litre);
        const doluluk = parseFloat(tanker.mevcut_doluluk);
        const yuzde = kapasite > 0 ? Math.min(100, Math.max(0, (doluluk / kapasite) * 100)) : 0;
        const safeTankerAdi = utils.sanitizeHTML(tanker.tanker_adi);

        // Renk belirleme (Tailwind)
        let colorClass = 'bg-green-500';
        let textClass = 'text-green-600';
        if (yuzde > 75) { colorClass = 'bg-yellow-500'; textClass = 'text-yellow-600'; }
        if (yuzde > 95) { colorClass = 'bg-red-500'; textClass = 'text-red-600'; }

        // Satış Butonu Durumu (Boşsa pasif, doluysa aktif)
        const isBos = doluluk <= 0;
        const satisBtnClass = isBos 
            ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer';
        
        const satisOnClick = isBos ? '' : `onclick="tankerSatisModaliniAc(${tanker.id}, '${safeTankerAdi.replace(/'/g, "\\'")}', ${doluluk})"`;
        const satisBtnText = isBos ? 'Boş Tanker' : 'Satış/Boşaltma';
        const satisIcon = isBos ? 'fa-ban' : 'fa-hand-holding-dollar';

        const cardHtml = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow" id="tanker-kart-${tanker.id}">
                <div class="p-5">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h5 class="font-bold text-gray-900 text-lg">${safeTankerAdi}</h5>
                            <p class="text-xs text-gray-500 mt-1">Kapasite: ${kapasite} L</p>
                        </div>
                        <div class="flex gap-1">
                            <button class="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50" 
                                    onclick="tankerSilmeyiOnayla(${tanker.id}, '${safeTankerAdi.replace(/'/g, "\\'")}')" title="Sil">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="mb-2 flex justify-between items-end">
                        <span class="text-sm font-medium text-gray-600">Doluluk</span>
                        <span class="text-sm font-bold ${textClass}">${doluluk.toFixed(0)} L (${yuzde.toFixed(0)}%)</span>
                    </div>
                    
                    <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div class="${colorClass} h-3 rounded-full transition-all duration-500" style="width: ${yuzde}%"></div>
                    </div>
                    
                    <div class="mt-5 pt-4 border-t border-gray-100">
                        <button class="w-full py-2 px-3 rounded-lg text-sm font-medium flex justify-center items-center transition-colors ${satisBtnClass}" ${satisOnClick} ${isBos ? 'disabled' : ''}>
                            <i class="fa-solid ${satisIcon} mr-2"></i> ${satisBtnText}
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

// --- YENİ TANKER EKLEME ---

function yeniTankerModaliniAc() {
    document.getElementById('yeni-tanker-form').reset();
    toggleModal('yeniTankerModal', true);
}

async function tankerEkle() {
    const btn = document.getElementById('kaydet-tanker-btn');
    const originalText = btn.innerText;

    const tankerAdiInput = document.getElementById('tanker-adi-input');
    const kapasiteInput = document.getElementById('tanker-kapasite-input');

    const veri = {
        tanker_adi: tankerAdiInput.value.trim(),
        kapasite_litre: kapasiteInput.value 
    };

    if (!veri.tanker_adi || !veri.kapasite_litre || parseFloat(veri.kapasite_litre) <= 0) {
        gosterMesaj('Lütfen geçerli bir ad ve kapasite girin.', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    try {
        const result = await api.request('/tanker/api/ekle', {
            method: 'POST',
            body: JSON.stringify(veri),
            headers: { 'Content-Type': 'application/json' }
        });
        
        gosterMesaj(result.message, 'success');
        toggleModal('yeniTankerModal', false);
        
        // Store'u zorla güncelle (Cache temizle)
        if (typeof store !== 'undefined' && store.setCache) {
             store.setCache('tankers', null); // Cache'i manuel temizle
        }
        
        // Listeyi yeniden çek
        await tankerleriYukle(); 
        tumToplayicilar = []; // Atama listesini de sıfırla ki tekrar çeksin

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// --- SATIŞ İŞLEMLERİ (YENİ EKLENDİ) ---

function tankerSatisModaliniAc(id, ad, miktar) {
    document.getElementById('satis-tanker-id').value = id;
    document.getElementById('satis-tanker-adi').textContent = ad;
    document.getElementById('satis-miktar').textContent = miktar;
    document.getElementById('satis-miktar').dataset.value = miktar; // Hesaplama için sakla
    
    document.getElementById('satis-fiyat-input').value = '';
    document.getElementById('satis-toplam-tutar').value = '';
    document.getElementById('satis-aciklama-input').value = '';
    
    toggleModal('tankerSatisModal', true);
}

function hesaplaSatisTutari() {
    const miktar = parseFloat(document.getElementById('satis-miktar').dataset.value || 0);
    const fiyat = parseFloat(document.getElementById('satis-fiyat-input').value || 0);
    const toplamEl = document.getElementById('satis-toplam-tutar');
    
    if (miktar > 0 && fiyat > 0) {
        const toplam = (miktar * fiyat).toFixed(2);
        toplamEl.value = `${toplam} TL`;
    } else {
        toplamEl.value = '';
    }
}

async function tankerSatisiniTamamla() {
    const id = document.getElementById('satis-tanker-id').value;
    const fiyat = document.getElementById('satis-fiyat-input').value;
    const aciklama = document.getElementById('satis-aciklama-input').value;
    
    if (!fiyat || parseFloat(fiyat) <= 0) {
        gosterMesaj('Lütfen geçerli bir satış fiyatı girin.', 'warning');
        return;
    }

    // Butonu kilitleme vs. eklenebilir (Basitlik için atlandı)
    
    try {
        const result = await api.request(`/tanker/api/sat_ve_bosalt/${id}`, {
            method: 'POST',
            body: JSON.stringify({ 
                birim_fiyat: parseFloat(fiyat), 
                aciklama: aciklama 
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        gosterMesaj(result.message, 'success');
        toggleModal('tankerSatisModal', false);
        
        // Listeleri güncelle
        if (typeof store !== 'undefined' && store.getTankers) {
             await store.getTankers(true); 
        }
        await tankerleriYukle();
        
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    }
}

// --- ATAMA İŞLEMLERİ ---

async function loadAtamaSekmesi() {
    const listeContainer = document.getElementById('toplayici-atama-listesi');
    const veriYokMesaji = document.getElementById('toplayici-veri-yok');
    
    if (!listeContainer) return;

    listeContainer.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Yükleniyor...</div>';
    if (veriYokMesaji) veriYokMesaji.classList.add('hidden');

    try {
        let tankerler;
        if (typeof store !== 'undefined' && store.getTankers) {
            tankerler = await store.getTankers(true);
        } else {
            tankerler = await api.request('/tanker/api/listele');
        }
        
        const response = await api.request('/tanker/api/atamalar');
        const atamalar = response.atamalar || [];
        const rawToplayicilar = response.toplayicilar || [];
        tumTankerler = tankerler || []; 

        tumToplayicilar = rawToplayicilar.map(t => {
            const atama = atamalar.find(a => a.toplayici_user_id === t.id);
            let atananTankerAdi = 'Atanmamış';
            if (atama && atama.tanker_id) {
                 const tnk = tumTankerler.find(x => x.id === atama.tanker_id);
                 if (tnk) atananTankerAdi = tnk.tanker_adi;
            }

            return {
                ...t,
                atanan_tanker_id: atama ? atama.tanker_id : null,
                atanan_tanker_adi: atananTankerAdi
            };
        });

        if (tumToplayicilar.length === 0) {
            listeContainer.innerHTML = '';
            if (veriYokMesaji) veriYokMesaji.classList.remove('hidden');
        } else {
            renderToplayiciListesi(tumToplayicilar);
        }
        
        renderTankerSecici(tumTankerler);

    } catch (error) {
        listeContainer.innerHTML = '';
        gosterMesaj(`Hata: ${error.message}`, 'danger');
    }
}

function renderToplayiciListesi(toplayicilar, filtre = '') {
    const container = document.getElementById('toplayici-atama-listesi');
    container.innerHTML = '';
    
    const arama = filtre.toLowerCase().trim();
    let count = 0;

    toplayicilar.forEach(t => {
        if (arama && !t.kullanici_adi.toLowerCase().includes(arama)) return;
        count++;

        const tankerAdi = t.atanan_tanker_adi || 'Atanmamış';
        const tankerId = t.atanan_tanker_id || 0;
        const badgeColor = t.atanan_tanker_id ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200';
        
        const isActive = seciliToplayiciId == t.id ? 'bg-brand-50 border-brand-200 ring-1 ring-brand-200' : 'hover:bg-gray-50 border-transparent';

        container.innerHTML += `
            <div class="cursor-pointer p-3 rounded-lg border transition-all mb-1 ${isActive}"
                 onclick="atamaIcinToplayiciSec(this, ${t.id}, '${utils.sanitizeHTML(t.kullanici_adi)}', ${tankerId})">
                <div class="flex justify-between items-center">
                    <h6 class="font-medium text-gray-900">${utils.sanitizeHTML(t.kullanici_adi)}</h6>
                    <span class="text-xs px-2 py-1 rounded-full border ${badgeColor} font-medium">${tankerAdi}</span>
                </div>
            </div>
        `;
    });

    if (count === 0) container.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">Sonuç bulunamadı.</div>';
}

function renderTankerSecici(tankerler) {
    if (!tankerAtamaSecici) return;

    tankerAtamaSecici.clear();
    tankerAtamaSecici.clearOptions();
    tankerAtamaSecici.addOption({ value: 0, text: "--- Tanker Atanmamış ---" });
    
    tankerler.forEach(t => {
        tankerAtamaSecici.addOption({
            value: t.id,
            text: `${utils.sanitizeHTML(t.tanker_adi)} (${t.kapasite_litre} L)`
        });
    });
}

function atamaIcinToplayiciSec(el, id, ad, tankerId) {
    seciliToplayiciId = id;
    
    const list = document.getElementById('toplayici-atama-listesi');
    Array.from(list.children).forEach(child => {
        child.classList.remove('bg-brand-50', 'border-brand-200', 'ring-1', 'ring-brand-200');
        child.classList.add('border-transparent');
    });
    el.classList.remove('border-transparent');
    el.classList.add('bg-brand-50', 'border-brand-200', 'ring-1', 'ring-brand-200');

    const panelBekliyor = document.getElementById('atama-paneli-secim-bekliyor');
    const panelSag = document.getElementById('atama-paneli-sag');
    
    if (panelBekliyor) panelBekliyor.style.display = 'none';
    if (panelSag) panelSag.style.display = 'block';
    
    const adEl = document.getElementById('atama-toplayici-adi');
    const idEl = document.getElementById('atanacak-toplayici-id');
    
    if (adEl) adEl.innerText = ad;
    if (idEl) idEl.value = id;
    
    if (tankerAtamaSecici) tankerAtamaSecici.setValue(tankerId || 0);
}

async function tankerAta() {
    const toplayiciId = document.getElementById('atanacak-toplayici-id').value;
    const tankerId = tankerAtamaSecici ? tankerAtamaSecici.getValue() : null;
    const btn = document.getElementById('atama-kaydet-btn');
    const original = btn ? btn.innerText : 'Kaydet';

    if (!toplayiciId) return;

    if (btn) {
        btn.disabled = true; 
        btn.innerText = 'Kaydediliyor...';
    }

    try {
        await api.request('/tanker/api/ata', {
            method: 'POST',
            body: JSON.stringify({ toplayici_id: parseInt(toplayiciId), tanker_id: parseInt(tankerId) }),
            headers: { 'Content-Type': 'application/json' }
        });

        gosterMesaj('Atama başarıyla güncellendi.', 'success');
        
        const index = tumToplayicilar.findIndex(t => t.id == toplayiciId);
        if (index !== -1) {
            tumToplayicilar[index].atanan_tanker_id = parseInt(tankerId) || null;
            const tnk = tumTankerler.find(t => t.id == tankerId);
            tumToplayicilar[index].atanan_tanker_adi = tnk ? tnk.tanker_adi : 'Atanmamış';
        }
        
        const aramaInput = document.getElementById('toplayici-arama-input');
        renderToplayiciListesi(tumToplayicilar, aramaInput ? aramaInput.value : '');
        
        const panelBekliyor = document.getElementById('atama-paneli-secim-bekliyor');
        const panelSag = document.getElementById('atama-paneli-sag');
        if (panelBekliyor) panelBekliyor.style.display = 'block';
        if (panelSag) panelSag.style.display = 'none';
        
        seciliToplayiciId = null;

    } catch (e) {
        gosterMesaj(e.message, 'danger');
    } finally {
        if (btn) {
            btn.disabled = false; 
            btn.innerText = original;
        }
    }
}

function atamaKaldir() {
    if (tankerAtamaSecici) tankerAtamaSecici.setValue(0);
    tankerAta();
}

// --- SİLME ---

function tankerSilmeyiOnayla(id, ad) {
    if(confirm(`'${ad}' tankerini silmek istediğinize emin misiniz?`)) {
        tankerSil(id);
    }
}

async function tankerSil(id) {
    try {
        await api.request(`/tanker/api/sil/${id}`, { method: 'DELETE' });
        gosterMesaj('Tanker silindi.', 'success');
        
        if (typeof store !== 'undefined' && store.getTankers) {
             await store.getTankers(true);
        }
        tankerleriYukle();
        
        tumToplayicilar = []; 

    } catch (e) {
        gosterMesaj(e.message, 'danger');
    }
}

// Basit Modal Kontrolü (Eğer ui.js içinde yoksa veya override edilecekse)
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    if (show) {
        modal.classList.remove('hidden');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('role', 'dialog');
    } else {
        modal.classList.add('hidden');
        modal.removeAttribute('aria-modal');
        modal.removeAttribute('role');
    }
}