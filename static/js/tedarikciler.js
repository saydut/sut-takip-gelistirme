// static/js/tedarikciler.js (TAILWIND UYUMLU)

let tedarikcilerMevcutGorunum = 'tablo';
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15;
let mevcutAramaTerimi = '';

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', async () => {
    // Görünüm Ayarları
    tedarikcilerMevcutGorunum = localStorage.getItem('tedarikciGorunum') || 'tablo';
    gorunumuAyarla(tedarikcilerMevcutGorunum);

    // Arama Dinleyicisi
    const arama = document.getElementById('arama-input');
    if(arama) arama.addEventListener('input', (e) => {
        mevcutAramaTerimi = e.target.value;
        verileriYukle(1);
    });

    await verileriYukle();
});

// --- MODAL YÖNETİMİ ---
// Artık base.html içindeki global toggleModal'ı veya ui.js'i kullanabiliriz.
// Ancak yerel bir override gerekirse:
function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (show) {
        el.classList.remove('hidden');
        // Input odaklama
        const input = el.querySelector('input');
        if(input) setTimeout(() => input.focus(), 100);
    } else {
        el.classList.add('hidden');
    }
}

// --- VERİ YÜKLEME ---
async function verileriYukle(sayfa = 1) {
    mevcutSayfa = sayfa;
    // Data Loader kullanarak veriyi çek ve render et
    await genelVeriYukleyici({
        apiURL: `/api/tedarikciler_liste?sayfa=${sayfa}&arama=${encodeURIComponent(mevcutAramaTerimi)}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'tedarikciler',
        tabloBodyId: 'tedarikciler-tablosu',
        kartContainerId: 'tedarikciler-kart-listesi',
        veriYokId: 'veri-yok-mesaji',
        sayfalamaId: 'tedarikci-sayfalama',
        tabloRenderFn: renderTable,
        kartRenderFn: renderCards,
        yukleFn: verileriYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: tedarikcilerMevcutGorunum
    });
}

// Tablo Oluşturucu
function renderTable(container, suppliers) {
    container.innerHTML = '';
    suppliers.forEach(s => {
        const toplamLitre = parseFloat(s.toplam_litre || 0).toFixed(2);
        
        container.innerHTML += `
        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${utils.sanitizeHTML(s.isim)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${utils.sanitizeHTML(s.telefon_no) || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-brand-600 font-bold">${toplamLitre} L</td>
            <td class="px-6 py-4 whitespace-nowrap text-center flex justify-center gap-2">
                <a href="/tedarikci/${s.id}" class="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Detay"><i class="fa-solid fa-eye"></i></a>
                <button onclick="tedarikciDuzenleAc(${s.id})" class="p-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 transition-colors" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
                <button onclick="silmeOnayiAc(${s.id}, '${s.isim.replace(/'/g, "\\'")}')" class="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Sil"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    });
}

// Kart Oluşturucu (Mobil Uyumlu)
function renderCards(container, suppliers) {
    container.innerHTML = '';
    suppliers.forEach(s => {
        const toplamLitre = parseFloat(s.toplam_litre || 0).toFixed(2);
        
        container.innerHTML += `
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 group">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-lg">
                        ${s.isim.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-900 text-base leading-tight">${utils.sanitizeHTML(s.isim)}</h3>
                        <p class="text-xs text-gray-400 mt-0.5"><i class="fa-solid fa-phone mr-1"></i>${s.telefon_no || '-'}</p>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-between items-center border-t border-gray-50 pt-3 mt-2">
                <div class="flex flex-col">
                    <span class="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Toplam Süt</span>
                    <span class="font-bold text-brand-600 text-lg">${toplamLitre} L</span>
                </div>
                <div class="flex gap-1">
                    <a href="/tedarikci/${s.id}" class="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"><i class="fa-solid fa-eye"></i></a>
                    <button onclick="tedarikciDuzenleAc(${s.id})" class="p-2 text-yellow-600 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="silmeOnayiAc(${s.id}, '${s.isim.replace(/'/g, "\\'")}')" class="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    });
}

// --- İŞLEMLER ---

// Yeni Ekle
function yeniTedarikciAc() {
    document.getElementById('tedarikciModalLabel').innerText = 'Yeni Tedarikçi Ekle';
    document.getElementById('edit-tedarikci-id').value = '';
    document.getElementById('tedarikci-form').reset();
    toggleModal('tedarikciModal', true);
}

// Düzenle
async function tedarikciDuzenleAc(id) {
    try {
        const s = await api.request(`/api/tedarikci/${id}`);
        document.getElementById('tedarikciModalLabel').innerText = 'Tedarikçi Düzenle';
        document.getElementById('edit-tedarikci-id').value = s.id;
        document.getElementById('tedarikci-isim-input').value = s.isim;
        document.getElementById('tedarikci-tc-input').value = s.tc_no || '';
        document.getElementById('tedarikci-tel-input').value = s.telefon_no || '';
        document.getElementById('tedarikci-adres-input').value = s.adres || '';
        toggleModal('tedarikciModal', true);
    } catch(e) { gosterMesaj('Bilgi alınamadı.', 'danger'); }
}

// Kaydet (Hem Yeni Hem Düzenleme)
async function tedarikciKaydet() {
    const btn = document.getElementById('kaydet-tedarikci-btn');
    const originalText = btn.innerHTML;
    
    const id = document.getElementById('edit-tedarikci-id').value;
    const veri = {
        isim: document.getElementById('tedarikci-isim-input').value.trim(),
        tc_no: document.getElementById('tedarikci-tc-input').value.trim(),
        telefon_no: document.getElementById('tedarikci-tel-input').value.trim(),
        adres: document.getElementById('tedarikci-adres-input').value.trim()
    };

    if(!veri.isim) { gosterMesaj('İsim zorunlu.', 'warning'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Kaydediliyor...';

    try {
        const res = id ? await api.updateTedarikci(id, veri) : await api.postTedarikci(veri);
        gosterMesaj(res.message, 'success');
        toggleModal('tedarikciModal', false);
        verileriYukle(id ? mevcutSayfa : 1);
    } catch(e) { 
        gosterMesaj(e.message, 'danger'); 
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Silme
function silmeOnayiAc(id, isim) {
    document.getElementById('silinecek-tedarikci-id').value = id;
    document.getElementById('silinecek-tedarikci-adi').innerText = isim;
    toggleModal('silmeOnayModal', true);
}

async function tedarikciSil() {
    const id = document.getElementById('silinecek-tedarikci-id').value;
    toggleModal('silmeOnayModal', false);
    
    // UI'dan sil (Optimistik)
    const row = document.querySelector(`button[onclick*="silmeOnayiAc(${id},"]`)?.closest('tr');
    if(row) row.remove();

    try {
        const res = await api.deleteTedarikci(id);
        gosterMesaj(res.message, 'success');
        verileriYukle(1);
    } catch(e) { 
        gosterMesaj(e.message, 'danger'); 
        verileriYukle(1); // Hata olursa listeyi geri getir
    }
}

// Görünüm Değiştir
function gorunumuDegistir(v) {
    tedarikcilerMevcutGorunum = v;
    localStorage.setItem('tedarikciGorunum', v);
    gorunumuAyarla(v);
    verileriYukle(mevcutSayfa);
}

function gorunumuAyarla(v) {
    document.getElementById('tablo-gorunumu').classList.add('hidden');
    document.getElementById('kart-gorunumu').classList.add('hidden');
    document.getElementById(v + '-gorunumu').classList.remove('hidden');
    
    const btnT = document.getElementById('btn-view-table');
    const btnC = document.getElementById('btn-view-card');
    
    if(v==='tablo') {
        btnT.classList.add('bg-white', 'shadow-sm', 'text-brand-600');
        btnT.classList.remove('text-gray-500');
        btnC.classList.remove('bg-white', 'shadow-sm', 'text-brand-600');
        btnC.classList.add('text-gray-500');
    } else {
        btnC.classList.add('bg-white', 'shadow-sm', 'text-brand-600');
        btnC.classList.remove('text-gray-500');
        btnT.classList.remove('bg-white', 'shadow-sm', 'text-brand-600');
        btnT.classList.add('text-gray-500');
    }
}