// static/js/yem_yonetimi.js

// === 1. GLOBAL DEĞİŞKENLER ===
let tedarikciSecici = null;
let yemUrunSecici = null;
let isGirisInputUpdating = false; 
let isCikisInputUpdating = false;
let yemTarihPicker;

// Sayfalama ve Görünüm Ayarları
const YEMLER_SAYFA_BASI = 10;
const ISLEMLER_SAYFA_BASI = 10;
let mevcutYemSayfasi = 1;
let mevcutIslemSayfasi = 1;
let yemGorunum = localStorage.getItem('yemGorunum') || 'tablo';

// Sabitler (ID'ler HTML ile uyuşmalı)
const DOM = {
    formUrun: 'yem-urun-form',
    formIslem: 'yem-islem-form', // veya yem-giris-formu / yem-cikis-formu
    modalUrun: 'yemUrunModal',
    modalIslem: 'yemIslemModal',
    
    inputGirisKg: 'giris-miktar-kg-input',
    inputGirisCuval: 'giris-miktar-cuval-input',
    inputCikisKg: 'cikis-miktar-kg-input', // Çıkış modalındaki ID
    inputCikisCuval: 'cikis-miktar-cuval-input',
    
    inputBirimFiyat: 'islem-fiyat', // veya birim-fiyat-input
    inputToplamTutar: 'islem-toplam-tutar',
    
    selectUrun: '#yem-urun-sec',
    selectTedarikci: '#tedarikci-sec'
};

// === 2. BAŞLANGIÇ (INIT) ===
window.onload = function() {
    // Tab Yönetimi
    initTabs();
    
    // Tarih Seçici
    const tarihInput = document.getElementById('islem-tarih');
    if (tarihInput) {
        yemTarihPicker = flatpickr(tarihInput, {
            dateFormat: "Y-m-d", locale: "tr", defaultDate: "today", allowInput: true
        });
    }

    // Event Listener'lar - Ürün Kaydetme
    const urunForm = document.getElementById(DOM.formUrun);
    if(urunForm) urunForm.addEventListener('submit', yemUrunuKaydet);

    // Event Listener'lar - İşlem Kaydetme
    const islemForm = document.getElementById(DOM.formIslem);
    if(islemForm) islemForm.addEventListener('submit', yemIslemiKaydet);

    // Hesaplama Eventleri (Giriş)
    setupCalculationEvents();

    // İlk yükleme
    const activeTab = document.querySelector('.tab-link.text-brand-600');
    if(activeTab && activeTab.dataset.tab === 'islemler') {
        yemIslemleriniYukle(1);
    } else {
        yemUrunleriniYukle(1);
    }
};

// === 3. YARDIMCI FONKSİYONLAR (TOM SELECT FIX BURADA) ===

/**
 * TomSelect'i güvenli bir şekilde başlatır.
 * Eğer element üzerinde zaten bir instance varsa önce onu yok eder.
 */
function safeInitTomSelect(selector, options) {
    const el = document.querySelector(selector);
    if (!el) return null;

    // HATA ÇÖZÜMÜ: Zaten varsa yok et
    if (el.tomselect) {
        el.tomselect.destroy();
    }

    return new TomSelect(el, options);
}

function initTabs() {
    const tabLinks = document.querySelectorAll('.tab-link');
    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(e.target.dataset.tab);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId + '-content').classList.remove('hidden');
    
    document.querySelectorAll('.tab-link').forEach(btn => {
        btn.classList.remove('text-brand-600', 'border-brand-600');
        btn.classList.add('text-gray-500', 'border-transparent');
    });
    
    const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-500', 'border-transparent');
        activeBtn.classList.add('text-brand-600', 'border-brand-600');
    }

    if (tabId === 'urunler') yemUrunleriniYukle(1);
    else if (tabId === 'islemler') yemIslemleriniYukle(1);
}

// === 4. HESAPLAMA MANTIĞI (Çuval/KG Dönüşümü) ===

function setupCalculationEvents() {
    // Giriş (Alım) Tarafı
    const inKg = document.getElementById(DOM.inputGirisKg);
    const inCuval = document.getElementById(DOM.inputGirisCuval);
    
    if(inKg && inCuval) {
        inKg.addEventListener('input', () => {
            if(isGirisInputUpdating) return;
            isGirisInputUpdating = true;
            // KG girildiğinde Çuval hesapla (Varsayılan 50kg çuval ise)
            // Not: Gerçek uygulamada seçilen yemin çuval ağırlığını almalısın.
            const cuvalAgirligi = getSeciliUrunCuvalAgirligi() || 50; 
            const val = parseFloat(inKg.value) || 0;
            inCuval.value = (val / cuvalAgirligi).toFixed(2);
            fiyatHesapla();
            isGirisInputUpdating = false;
        });

        inCuval.addEventListener('input', () => {
            if(isGirisInputUpdating) return;
            isGirisInputUpdating = true;
            const cuvalAgirligi = getSeciliUrunCuvalAgirligi() || 50;
            const val = parseFloat(inCuval.value) || 0;
            inKg.value = (val * cuvalAgirligi).toFixed(2);
            fiyatHesapla();
            isGirisInputUpdating = false;
        });
    }
    
    // Fiyat değişirse toplam tutarı güncelle
    const inFiyat = document.getElementById(DOM.inputBirimFiyat);
    if(inFiyat) {
        inFiyat.addEventListener('input', fiyatHesapla);
    }
}

function getSeciliUrunCuvalAgirligi() {
    // Seçilen ürünün datasından çuval ağırlığını çek
    // TomSelect kullanıyorsak option datasından alabiliriz
    if(!yemUrunSecici) return 50;
    const val = yemUrunSecici.getValue();
    if(!val) return 50;
    
    const opt = yemUrunSecici.options[val];
    return opt ? (parseFloat(opt.cuval_kg) || 50) : 50;
}

function fiyatHesapla() {
    const miktar = parseFloat(document.getElementById(DOM.inputGirisKg)?.value) || 0;
    const fiyat = parseFloat(document.getElementById(DOM.inputBirimFiyat)?.value) || 0;
    const toplamInput = document.getElementById(DOM.inputToplamTutar);
    
    if(toplamInput) {
        toplamInput.value = (miktar * fiyat).toFixed(2);
    }
}


// === 5. VERİ YÜKLEME VE DROPDOWN İŞLEMLERİ ===

async function dropdownlariHazirla() {
    try {
        // 1. Yem Ürünleri Dropdown (TomSelect Fix Uygulanmış)
        const urunData = await api.fetchYemUrunleriListe();
        
        // Seçenekleri hazırla
        const options = urunData.map(u => ({
            value: u.id,
            text: `${u.yem_adi} (${u.marka || '-'}) - Stok: ${u.stok_miktari} kg`,
            fiyat: u.birim_fiyat,
            cuval_kg: u.cuval_agirligi || 50 // Veritabanında varsa
        }));

        // Eski TomSelect'i temizle ve yenisini kur
        yemUrunSecici = safeInitTomSelect(DOM.selectUrun, {
            valueField: 'value',
            labelField: 'text',
            searchField: 'text',
            options: options,
            create: false,
            placeholder: "Yem ürünü seçiniz...",
            onChange: function(value) {
                if(!value) return;
                const item = this.options[value];
                // Seçilen ürünün fiyatını otomatik doldur
                const fiyatInput = document.getElementById(DOM.inputBirimFiyat);
                if(fiyatInput && item.fiyat) {
                    fiyatInput.value = item.fiyat;
                    fiyatHesapla();
                }
            }
        });

        // 2. Tedarikçiler Dropdown
        const tedData = await api.fetchTedarikciler();
        // API'den gelen veri formatı: [{id: 1, isim: "ABC"}, ...] 
        // TomSelect formatına dönüştür
        const tedOptions = tedData.map(t => ({ value: t.id, text: t.isim }));

        tedarikciSecici = safeInitTomSelect(DOM.selectTedarikci, {
            valueField: 'value',
            labelField: 'text',
            searchField: 'text',
            options: tedOptions,
            create: false,
            placeholder: "Tedarikçi/Firma seçiniz..."
        });

    } catch (e) {
        console.error("Dropdown hatası:", e);
        gosterMesaj("Liste yüklenirken hata oluştu.", "danger");
    }
}

// === 6. YEM ÜRÜNLERİ LİSTELEME ===

async function yemUrunleriniYukle(sayfa) {
    mevcutYemSayfasi = sayfa;
    const container = document.getElementById('yem-urunleri-tbody'); // Tablo body ID
    if(!container) return;

    container.innerHTML = '<tr><td colspan="6" class="text-center p-4"><i class="fa-solid fa-circle-notch fa-spin text-brand-500"></i></td></tr>';

    try {
        const res = await api.fetchYemUrunleri(sayfa);
        container.innerHTML = '';
        
        if(!res.urunler || res.urunler.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-gray-400">Kayıt bulunamadı.</td></tr>';
            return;
        }

        res.urunler.forEach(u => {
            container.innerHTML += `
                <tr class="hover:bg-gray-50 border-b border-gray-100">
                    <td class="px-6 py-4 font-medium text-gray-900">${utils.sanitizeHTML(u.yem_adi)}</td>
                    <td class="px-6 py-4 text-gray-500">${utils.sanitizeHTML(u.marka || '-')}</td>
                    <td class="px-6 py-4 text-right font-mono text-gray-600">${parseFloat(u.birim_fiyat).toFixed(2)} ₺</td>
                    <td class="px-6 py-4 text-right font-bold text-gray-800">${parseFloat(u.stok_miktari).toFixed(2)} kg</td>
                    <td class="px-6 py-4 text-right text-sm text-gray-500">
                        ${(parseFloat(u.stok_miktari) / (u.cuval_agirligi || 50)).toFixed(1)} Çuval
                    </td>
                    <td class="px-6 py-4 text-center space-x-2">
                        <button onclick="yemUrunuDuzenle(${u.id}, this)" 
                            data-ad="${utils.sanitizeHTML(u.yem_adi)}"
                            data-marka="${utils.sanitizeHTML(u.marka)}"
                            data-fiyat="${u.birim_fiyat}"
                            class="text-blue-600 hover:text-blue-800"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="yemUrunuSil(${u.id})" class="text-red-600 hover:text-red-800"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        
        ui.sayfalamaNavOlustur('yem-urun-sayfalama', res.toplam_kayit, sayfa, YEMLER_SAYFA_BASI, yemUrunleriniYukle);

    } catch(e) {
        container.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">${e.message}</td></tr>`;
    }
}

// === 7. İŞLEMLERİ LİSTELEME ===

async function yemIslemleriniYukle(sayfa) {
    mevcutIslemSayfasi = sayfa;
    const container = document.getElementById('yem-islemleri-tbody');
    if(!container) return;

    container.innerHTML = '<tr><td colspan="7" class="text-center p-4"><i class="fa-solid fa-circle-notch fa-spin text-brand-500"></i></td></tr>';

    try {
        const res = await api.fetchYemIslemleri(sayfa);
        container.innerHTML = '';

        if(!res.islemler || res.islemler.length === 0) {
            container.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-gray-400">İşlem kaydı yok.</td></tr>';
            return;
        }

        res.islemler.forEach(i => {
            const tarih = new Date(i.islem_tarihi).toLocaleDateString('tr-TR');
            const tipBadge = i.islem_tipi === 'alim' 
                ? '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Alım</span>'
                : '<span class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">Dağıtım</span>';
            
            const miktarClass = i.islem_tipi === 'alim' ? 'text-green-600' : 'text-red-600';
            const sign = i.islem_tipi === 'alim' ? '+' : '-';

            container.innerHTML += `
                <tr class="hover:bg-gray-50 border-b border-gray-100">
                    <td class="px-6 py-4 text-gray-500 text-sm">${tarih}</td>
                    <td class="px-6 py-4">${tipBadge}</td>
                    <td class="px-6 py-4 font-medium">${utils.sanitizeHTML(i.yem_urunleri?.yem_adi || '-')}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">${utils.sanitizeHTML(i.tedarikciler?.isim || '-')}</td>
                    <td class="px-6 py-4 text-right font-bold ${miktarClass}">${sign}${parseFloat(i.miktar_kg).toFixed(2)} kg</td>
                    <td class="px-6 py-4 text-right text-sm">${parseFloat(i.toplam_tutar).toFixed(2)} ₺</td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="islemSil(${i.id})" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        ui.sayfalamaNavOlustur('yem-islem-sayfalama', res.toplam_kayit, sayfa, ISLEMLER_SAYFA_BASI, yemIslemleriniYukle);

    } catch(e) {
        console.error(e);
    }
}

// === 8. MODAL VE FORM İŞLEMLERİ ===

function yeniUrunModalAc() {
    document.getElementById(DOM.formUrun).reset();
    document.getElementById('urun-id').value = '';
    document.getElementById('modal-urun-title').innerText = 'Yeni Yem Ürünü';
    toggleModal(DOM.modalUrun, true);
}

function yemUrunuDuzenle(id, btn) {
    const ad = btn.dataset.ad;
    const marka = btn.dataset.marka;
    const fiyat = btn.dataset.fiyat;
    
    document.getElementById('urun-id').value = id;
    document.getElementById('urun-adi').value = ad;
    document.getElementById('urun-marka').value = marka;
    document.getElementById('urun-fiyat').value = fiyat;
    
    document.getElementById('modal-urun-title').innerText = 'Yem Ürünü Düzenle';
    toggleModal(DOM.modalUrun, true);
}

async function yemUrunuKaydet(e) {
    e.preventDefault();
    const id = document.getElementById('urun-id').value;
    const veri = {
        yem_adi: document.getElementById('urun-adi').value,
        marka: document.getElementById('urun-marka').value,
        birim_fiyat: document.getElementById('urun-fiyat').value
    };

    try {
        if(id) await api.updateYemUrunu(id, veri);
        else await api.postYemUrunu(veri);
        
        gosterMesaj('Ürün kaydedildi.', 'success');
        toggleModal(DOM.modalUrun, false);
        yemUrunleriniYukle(mevcutYemSayfasi);
        // Dropdown'ları güncellemek için sayfayı yenilemek yerine
        // dropdownlariHazirla() tekrar çağrılabilir ama 
        // basitlik için şimdilik böyle bırakıyoruz.
    } catch(err) {
        gosterMesaj(err.message, 'danger');
    }
}

// İşlem Modalı Açma (Giriş veya Çıkış)
async function yeniIslemModalAc(tip) {
    // Önce dropdownları hazırla (async olduğu için await)
    await dropdownlariHazirla();

    const form = document.getElementById(DOM.formIslem);
    form.reset();
    if(yemTarihPicker) yemTarihPicker.setDate(new Date());
    
    // Tip'e göre UI düzenle
    document.getElementById('islem-tipi').value = tip; // Hidden input
    
    // Modal Başlığı
    const baslik = tip === 'alim' ? 'Stok Girişi (Alım)' : 'Yem Dağıtımı (Çıkış)';
    document.getElementById('modal-islem-title').innerText = baslik;
    
    // Giriş ise Fiyat alanı aktif, Çıkış ise pasif olabilir (stok maliyetinden düşülecekse)
    // Ancak senin sistemde çıkışta da fiyat girilebilir veya otomatik gelebilir.
    
    toggleModal(DOM.modalIslem, true);
}

async function yemIslemiKaydet(e) {
    e.preventDefault();
    
    // TomSelect'ten değerleri al
    const urunId = yemUrunSecici ? yemUrunSecici.getValue() : document.querySelector(DOM.selectUrun).value;
    const tedarikciId = tedarikciSecici ? tedarikciSecici.getValue() : document.querySelector(DOM.selectTedarikci).value;
    
    const tip = document.getElementById('islem-tipi').value;
    
    // Validasyon
    if(!urunId) { gosterMesaj('Lütfen bir ürün seçin.', 'warning'); return; }
    if(tip === 'dagitim' && !tedarikciId) { gosterMesaj('Dağıtım yapılacak üreticiyi seçin.', 'warning'); return; }

    const veri = {
        yem_urun_id: urunId,
        tedarikci_id: tedarikciId || null, // Alımda boş olabilir (stok girişi)
        islem_tipi: tip,
        miktar_kg: document.getElementById(DOM.inputGirisKg).value, // ID dinamik olabilir, modal yapına göre
        birim_fiyat: document.getElementById(DOM.inputBirimFiyat).value,
        islem_tarihi: document.getElementById('islem-tarih').value
    };

    try {
        await api.postYemIslemi(veri);
        gosterMesaj('İşlem başarıyla kaydedildi.', 'success');
        toggleModal(DOM.modalIslem, false);
        yemIslemleriniYukle(1);
        // Stok güncellendiği için ürün listesini de yenile
        yemUrunleriniYukle(1);
    } catch(err) {
        gosterMesaj(err.message, 'danger');
    }
}

async function yemUrunuSil(id) {
    if(!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
    try {
        await api.deleteYemUrunu(id);
        gosterMesaj('Ürün silindi.', 'success');
        yemUrunleriniYukle(1);
    } catch(e) { gosterMesaj(e.message, 'danger'); }
}

async function islemSil(id) {
    if(!confirm('Bu işlemi silmek istediğinize emin misiniz? Stok geri alınacaktır.')) return;
    try {
        await api.deleteYemIslemi(id);
        gosterMesaj('İşlem iptal edildi.', 'success');
        yemIslemleriniYukle(mevcutIslemSayfasi);
        yemUrunleriniYukle(mevcutYemSayfasi);
    } catch(e) { gosterMesaj(e.message, 'danger'); }
}