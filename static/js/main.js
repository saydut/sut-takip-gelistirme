// static/js/main.js

window.anaPanelMevcutGorunum = localStorage.getItem('anaPanelGorunum') || 'liste';
window.anaPanelMevcutSayfa = 1;
let kullaniciRolu = null;

// === GLOBAL FONKSİYONLAR ===

function filtreyiTemizle() {
    if(ui.tarihFiltreleyici) {
        ui.tarihFiltreleyici.setDate(new Date(), true);
    }
}

function gorunumuDegistir(v) {
    window.anaPanelMevcutGorunum = v;
    localStorage.setItem('anaPanelGorunum', v);
    
    const btnL = document.getElementById('btn-view-list');
    const btnC = document.getElementById('btn-view-card');
    if(btnL && btnC) {
        if(v==='liste') {
            btnL.classList.add('text-brand-600', 'bg-white', 'shadow-sm');
            btnC.classList.remove('text-brand-600', 'bg-white', 'shadow-sm');
        } else {
            btnC.classList.add('text-brand-600', 'bg-white', 'shadow-sm');
            btnL.classList.remove('text-brand-600', 'bg-white', 'shadow-sm');
        }
    }

    const listeDiv = document.getElementById('liste-gorunumu');
    const kartDiv = document.getElementById('kart-gorunumu');
    if(listeDiv) listeDiv.classList.toggle('hidden', v !== 'liste');
    if(kartDiv) kartDiv.classList.toggle('hidden', v !== 'kart');

    const tarih = ui.tarihFiltreleyici ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
    girdileriGoster(window.anaPanelMevcutSayfa, tarih);
}

// === ANA MANTIK ===

window.onload = async function() {
    const path = window.location.pathname;
    if (path.includes('login') || path.includes('register')) return;

    kullaniciRolu = document.body.dataset.userRole;
    
    if (kullaniciRolu === 'ciftci') {
        if (typeof initCiftciPanel === 'function') await initCiftciPanel();
        return;
    }

    setupComponents();
    await verileriYukle();

    const btn = document.getElementById('kaydet-girdi-btn');
    if(btn) btn.addEventListener('click', sutGirdisiEkle);
};

function setupComponents() {
    const tarihInput = document.getElementById('tarih-filtre');
    if(tarihInput && typeof flatpickr !== 'undefined') {
        ui.tarihFiltreleyici = flatpickr(tarihInput, {
            dateFormat: "d.m.Y", defaultDate: "today", locale: "tr",
            onChange: () => verileriYukle()
        });
    }

    const selectEl = document.getElementById('tedarikci-sec');
    if(selectEl && typeof TomSelect !== 'undefined') {
        ui.tedarikciSecici = new TomSelect(selectEl, {
            create: false, sortField: { field: "text", direction: "asc" },
            onChange: (val) => { if(val) guncelFiyatiGetir(val); }
        });
    }
}

async function verileriYukle() {
    const tarih = ui.tarihFiltreleyici ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
    
    try {
        const ozet = await api.fetchGunlukOzet(tarih);
        // ui.js'in bu fonksiyonu utils.formatNumber kullanır, artık hata vermeyecek
        ui.updateOzetPanels(ozet, tarih);
    } catch(e) {}

    try {
        if(ui.tedarikciSecici && Object.keys(ui.tedarikciSecici.options).length === 0) {
            const t = await store.getTedarikciler();
            ui.doldurTedarikciSecici(t);
        }
    } catch(e) {}

    await guncelFiyatiGetir();
    await girdileriGoster(1, tarih);
}

async function girdileriGoster(sayfa, tarih) {
    window.anaPanelMevcutSayfa = sayfa;
    ui.showGirdilerLoadingSkeleton(window.anaPanelMevcutGorunum);
    
    try {
        const data = await api.request(`/api/sut_girdileri?tarih=${tarih}&sayfa=${sayfa}&_t=${Date.now()}`);
        const bekleyenler = await bekleyenGirdileriGetir();
        const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler(data, bekleyenler, tarih);
        
        ui.renderGirdiler(tumGirdiler, window.anaPanelMevcutGorunum);
        ui.sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, sayfa, 6, (p) => girdileriGoster(p, tarih));

    } catch(e) {
        ui.renderGirdiler([], window.anaPanelMevcutGorunum);
    }
}

async function guncelFiyatiGetir(tedarikciId = null) {
    const input = document.getElementById('fiyat-input');
    if(!input) return;

    const tarih = ui.tarihFiltreleyici ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
    input.placeholder = "Fiyat aranıyor...";
    
    try {
        const tarife = await api.fetchTarifeFiyat(tarih);
        if(tarife && tarife.fiyat) {
            input.value = parseFloat(tarife.fiyat).toFixed(2);
            return;
        }
    } catch(e) { }

    if(tedarikciId) {
        try {
            const son = await api.fetchSonFiyat(tedarikciId);
            if(son && son.fiyat) {
                input.value = parseFloat(son.fiyat).toFixed(2);
                return;
            }
        } catch(e){}
    }
    
    input.placeholder = "Fiyat Giriniz";
    input.value = '';
}

async function sutGirdisiEkle() {
    const veri = ui.getGirdiFormVerisi();
    const litre = parseFloat(veri.litre);
    let fiyat = parseFloat(veri.fiyat); 
    
    if (isNaN(fiyat)) fiyat = 0;

    if (!veri.tedarikciId) { gosterMesaj('Lütfen tedarikçi seçin.', 'warning'); return; }
    if (isNaN(litre) || litre <= 0) { gosterMesaj('Geçerli bir litre girin.', 'warning'); return; }
    if (fiyat <= 0) { gosterMesaj('Lütfen birim fiyatı girin.', 'warning'); return; }

    ui.toggleGirdiKaydetButton(true);

    if (!navigator.onLine) {
        try {
            const ok = await kaydetCevrimdisi({
                tedarikci_id: parseInt(veri.tedarikciId),
                litre: litre,
                fiyat: fiyat
            });
            if(ok) { ui.resetGirdiFormu(); verileriYukle(); }
        } catch(e) { gosterMesaj(e.message, 'danger'); }
        finally { ui.toggleGirdiKaydetButton(false); }
        return;
    }

    try {
        await api.postSutGirdisi({
            tedarikci_id: veri.tedarikciId,
            litre: litre,
            fiyat: fiyat
        });
        gosterMesaj('Girdi başarıyla kaydedildi.', 'success');
        ui.resetGirdiFormu();
        guncelFiyatiGetir(); 
        verileriYukle();
    } catch(e) {
        gosterMesaj(e.message, 'danger');
    } finally {
        ui.toggleGirdiKaydetButton(false);
    }
}