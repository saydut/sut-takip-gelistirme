// static/js/finans_yonetimi.js

let tedarikciSecici, tarihSecici;
let finansMevcutGorunum = 'tablo';
const KAYIT_SAYISI = 10;

window.onload = function() {
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" }, onChange: guncelBakiyeyiGetir });
    tarihSecici = flatpickr("#islem-tarihi-input", { enableTime: true, dateFormat: "Y-m-d H:i:S", locale: "tr" });
    
    finansMevcutGorunum = localStorage.getItem('finansGorunum') || 'tablo';
    gorunumuAyarla(finansMevcutGorunum);

    tedarikcileriDoldur();
    finansalIslemleriYukle(1);
    islemTipiDegisti(); // Başlangıçta doğru alanı göster
};

// --- YENİ: İşlem Tipi Değişince Çalışacak Fonksiyon ---
function islemTipiDegisti() {
    const tip = document.getElementById('islem-tipi-sec').value;
    const tedarikciDiv = document.getElementById('tedarikci-secim-alani');
    const muhatapDiv = document.getElementById('muhatap-giris-alani');
    const bakiyeInput = document.getElementById('tutar-input'); // Placeholder için

    if (['Diğer Gelir', 'Diğer Gider'].includes(tip)) {
        // Tedarikçisiz işlem
        tedarikciDiv.classList.add('hidden');
        muhatapDiv.classList.remove('hidden');
        if(tedarikciSecici) tedarikciSecici.clear(); // Seçimi temizle
        bakiyeInput.placeholder = "0.00"; // Bakiyeyi sıfırla
    } else {
        // Tedarikçili işlem
        tedarikciDiv.classList.remove('hidden');
        muhatapDiv.classList.add('hidden');
        document.getElementById('muhatap-input').value = ''; // Muhatabı temizle
    }
}

// --- GÖRÜNÜM ---
function gorunumuDegistir(v) { finansMevcutGorunum = v; localStorage.setItem('finansGorunum', v); gorunumuAyarla(v); finansalIslemleriYukle(1); }

function gorunumuAyarla(v) {
    document.getElementById('tablo-gorunumu').classList.add('hidden');
    document.getElementById('kart-gorunumu').classList.add('hidden');
    document.getElementById(`${v}-gorunumu`).classList.remove('hidden');

    const t = document.getElementById('btn-view-table');
    const c = document.getElementById('btn-view-card');
    const act = "p-1.5 rounded text-brand-600 bg-white shadow-sm";
    const inact = "p-1.5 rounded text-gray-500 hover:text-brand-600";
    if(v==='tablo') { t.className=act; c.className=inact; } else { c.className=act; t.className=inact; }
}

// --- VERİ ---
async function finansalIslemleriYukle(sayfa=1) {
    await genelVeriYukleyici({
        apiURL: `/finans/api/islemler?sayfa=${sayfa}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'finansal-islemler-tablosu',
        kartContainerId: 'finansal-islemler-kart-listesi',
        veriYokId: 'veri-yok-mesaji',
        sayfalamaId: 'finans-sayfalama',
        tabloRenderFn: renderFinansAsTable,
        kartRenderFn: renderFinansAsCards,
        yukleFn: finansalIslemleriYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: finansMevcutGorunum
    });
}

// --- RENDER (Tailwind) ---
function renderFinansAsTable(container, islemler) {
    container.innerHTML = '';
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        // Renk Sınıfları
        let tipClass, tutarClass;
        if (['Tahsilat', 'Diğer Gelir', 'Yem Satışı', 'Süt Satışı'].includes(islem.islem_tipi)) {
            tipClass = 'bg-blue-50 text-blue-700 border-blue-100';
            tutarClass = 'text-green-600'; // Gelirler yeşil
        } else {
            tipClass = islem.islem_tipi === 'Ödeme' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100';
            tutarClass = 'text-red-600'; // Giderler kırmızı
        }

        // Muhatap Adı Gösterimi (Tedarikçi yoksa açıklamadaki 'Muhatap:' kısmını veya '-' göster)
        let muhatapAdi = islem.tedarikciler?.isim;
        if (!muhatapAdi) {
             // Açıklamadan "Muhatap: X - " kısmını parse etmeye çalışabiliriz veya direkt "-" diyebiliriz.
             // Ama basitlik için, eğer tedarikçi yoksa ve açıklama varsa açıklamayı, yoksa 'Diğer' yazalım.
             muhatapAdi = '<span class="text-gray-400 italic">Diğer</span>';
        } else {
            muhatapAdi = utils.sanitizeHTML(muhatapAdi);
        }
        
        container.innerHTML += `
            <tr id="finans-islem-${islem.id}" class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${tarih}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${muhatapAdi}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm"><span class="px-2 py-1 rounded-md text-xs font-semibold border ${tipClass}">${utils.sanitizeHTML(islem.islem_tipi)}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold ${tutarClass}">${parseFloat(islem.tutar).toFixed(2)} TL</td>
                <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">${utils.sanitizeHTML(islem.aciklama) || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <button onclick="duzenleModaliniAc(${islem.id}, '${islem.tutar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="silmeOnayiAc(${islem.id})" class="text-red-600 hover:text-red-800"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
    });
}

function renderFinansAsCards(container, islemler) {
    container.innerHTML = '';
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short' });
        
        let borderClass = 'border-l-4 border-gray-200';
        let tutarClass = 'text-gray-800';
        let badgeClass = 'bg-gray-100 text-gray-800';

        if (['Tahsilat', 'Diğer Gelir'].includes(islem.islem_tipi)) {
             borderClass = 'border-l-4 border-l-blue-500'; 
             tutarClass = 'text-green-600'; 
             badgeClass = 'bg-blue-100 text-blue-800';
        } else {
             borderClass = islem.islem_tipi === 'Ödeme' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-yellow-500';
             tutarClass = 'text-red-600';
             badgeClass = islem.islem_tipi === 'Ödeme' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
        }

        const muhatap = islem.tedarikciler?.isim ? utils.sanitizeHTML(islem.tedarikciler.isim) : 'Diğer';

        container.innerHTML += `
            <div class="col-span-1" id="finans-islem-${islem.id}">
                <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm ${borderClass}">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-bold text-gray-900">${muhatap}</h4>
                        <span class="text-xs text-gray-400">${tarih}</span>
                    </div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-semibold ${badgeClass} px-2 py-1 rounded">${utils.sanitizeHTML(islem.islem_tipi)}</span>
                        <span class="font-mono font-bold ${tutarClass}">${parseFloat(islem.tutar).toFixed(2)} TL</span>
                    </div>
                    <p class="text-sm text-gray-500 mb-3 italic">${utils.sanitizeHTML(islem.aciklama) || ''}</p>
                    <div class="flex justify-end gap-2">
                        <button onclick="duzenleModaliniAc(${islem.id}, '${islem.tutar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')" class="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button onclick="silmeOnayiAc(${islem.id})" class="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

// --- MANTIK ---
async function tedarikcileriDoldur() {
    try {
        const t = await store.getTedarikciler();
        tedarikciSecici.clearOptions();
        tedarikciSecici.addOptions(t.map(x => ({ value: x.id, text: utils.sanitizeHTML(x.isim) })));
    } catch(e) { gosterMesaj('Tedarikçiler yüklenemedi.', 'danger'); }
}

async function guncelBakiyeyiGetir(id) {
    const inp = document.getElementById('tutar-input');
    if(!inp) return;
    
    // Tedarikçi seçili değilse bakiye gösterme
    if(!id) { inp.placeholder="0.00"; return; }
    
    inp.placeholder="Yükleniyor...";
    try {
        const ozet = await api.request(`/api/tedarikci/${id}/ozet`);
        const net = parseFloat(ozet.net_bakiye||0);
        inp.placeholder = `Bakiye: ${net.toFixed(2)} TL (${net>0?'Alacak':'Borç'})`;
    } catch(e) { inp.placeholder="Bakiye alınamadı"; }
}

function formuTemizle() {
    document.getElementById('islem-tipi-sec').value = 'Ödeme';
    islemTipiDegisti(); // UI'yı sıfırla
    tedarikciSecici.clear();
    document.getElementById('muhatap-input').value = '';
    document.getElementById('tutar-input').value = '';
    document.getElementById('aciklama-input').value = '';
    if(tarihSecici) tarihSecici.clear();
}

async function finansalIslemKaydet() {
    const islemTipi = document.getElementById('islem-tipi-sec').value;
    const tedarikciId = tedarikciSecici.getValue();
    const muhatapAdi = document.getElementById('muhatap-input').value.trim();
    
    const veri = {
        islem_tipi: islemTipi,
        tedarikci_id: tedarikciId || null, // Boşsa null gönder
        muhatap_adi: muhatapAdi,
        tutar: document.getElementById('tutar-input').value,
        islem_tarihi: tarihSecici && tarihSecici.selectedDates[0] ? tarihSecici.selectedDates[0].toISOString().slice(0, 19).replace('T', ' ') : null,
        aciklama: document.getElementById('aciklama-input').value.trim()
    };

    // Validasyon: Eğer tedarikçili bir işlem tipiyse tedarikçi şart
    if (['Ödeme', 'Avans', 'Tahsilat'].includes(islemTipi) && !veri.tedarikci_id) {
        gosterMesaj('Lütfen bir tedarikçi seçin.', 'warning'); return;
    }
    // Diğer işlem tiplerindeyse en azından muhatap veya açıklama olsa iyi olur ama zorunlu değil.
    // Tutar zorunlu
    if (!veri.islem_tipi || !veri.tutar || parseFloat(veri.tutar) <= 0) { 
        gosterMesaj('Lütfen tutarı ve işlem tipini girin.', 'warning'); return; 
    }

    if (!navigator.onLine) {
        const ok = await kaydetFinansIslemiCevrimdisi(veri);
        if(ok) { formuTemizle(); await finansalIslemleriYukle(1); }
        return;
    }
    try {
        const res = await api.postFinansalIslem(veri);
        gosterMesaj(res.message, 'success');
        formuTemizle(); await finansalIslemleriYukle(1);
    } catch(e) { gosterMesaj(e.message, 'danger'); }
}

function silmeOnayiAc(id) {
    document.getElementById('silinecek-islem-id').value = id;
    toggleModal('silmeOnayModal', true);
}

async function finansalIslemSil() {
    const id = document.getElementById('silinecek-islem-id').value;
    toggleModal('silmeOnayModal', false);
    if (!navigator.onLine) { gosterMesaj("Silme için internet gerekli.", "warning"); return; }
    
    // UI'dan sil (Optimistik)
    const el = document.getElementById(`finans-islem-${id}`);
    if(el) el.remove();

    try {
        const res = await api.deleteFinansalIslem(id);
        gosterMesaj(res.message, 'success');
        await finansalIslemleriYukle(1);
    } catch(e) { gosterMesaj(e.message, 'danger'); await finansalIslemleriYukle(1); }
}

function duzenleModaliniAc(id, tutar, aciklama) {
    document.getElementById('edit-islem-id').value = id;
    document.getElementById('edit-tutar-input').value = parseFloat(tutar);
    document.getElementById('edit-aciklama-input').value = aciklama;
    toggleModal('duzenleModal', true);
}

async function finansalIslemGuncelle() {
    const id = document.getElementById('edit-islem-id').value;
    const veri = { tutar: document.getElementById('edit-tutar-input').value, aciklama: document.getElementById('edit-aciklama-input').value.trim() };
    if (!navigator.onLine) { gosterMesaj("Düzenleme için internet gerekli.", "warning"); return; }
    try {
        const res = await api.updateFinansalIslem(id, veri);
        gosterMesaj(res.message, 'success');
        toggleModal('duzenleModal', false);
        await finansalIslemleriYukle(1);
    } catch(e) { gosterMesaj(e.message, 'danger'); }
}