// static/js/reports.js

let detayliChart = null;
let baslangicTarihiSecici = null;
let bitisTarihiSecici = null;

function formatDateToYYYYMMDD(date) {
    if (!date) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function pdfIndir() {
    const ayEl = document.getElementById('rapor-ay');
    const yilEl = document.getElementById('rapor-yil');
    
    if (!ayEl || !yilEl) return;

    const ay = ayEl.value;
    const yil = yilEl.value;
    const url = `/api/rapor/aylik_pdf?ay=${ay}&yil=${yil}`;

    if (typeof indirVeAc === 'function') {
        await indirVeAc(url, 'pdf-indir-btn', {
            success: 'Rapor indirildi.',
            error: 'PDF oluşturulamadı.'
        });
    } else {
        window.open(url, '_blank');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Tarih Seçiciler
    const birAyOnce = new Date();
    birAyOnce.setMonth(birAyOnce.getMonth() - 1);

    const baslangicInput = document.getElementById("baslangic-tarihi");
    const bitisInput = document.getElementById("bitis-tarihi");

    if (baslangicInput && bitisInput && typeof flatpickr !== 'undefined') {
        baslangicTarihiSecici = flatpickr(baslangicInput, {
            dateFormat: "d.m.Y", altInput: true, altFormat: "d.m.Y", locale: "tr",
            defaultDate: birAyOnce,
            onChange: function(selectedDates) {
                if (bitisTarihiSecici && selectedDates.length > 0) {
                    bitisTarihiSecici.set('minDate', selectedDates[0]);
                }
            }
        });

        bitisTarihiSecici = flatpickr(bitisInput, {
            dateFormat: "d.m.Y", altInput: true, altFormat: "d.m.Y", locale: "tr",
            defaultDate: "today", minDate: birAyOnce
        });
    }

    // 2. Ay/Yıl Doldur
    if(typeof ayYilSecicileriniDoldur === 'function') {
        ayYilSecicileriniDoldur('rapor-ay', 'rapor-yil');
    }

    // 3. Grafikler ve Kartlar
    if (typeof window.charts !== 'undefined') {
        const haftalikCanvas = document.getElementById('haftalikRaporGrafigi');

        // Haftalık grafik (Canvas)
        if (haftalikCanvas) window.charts.haftalikGrafigiOlustur();
        
        // YENİ: 3'lü Pasta Grafiği (Eski usül ama 3 tane)
        if (typeof window.charts.ucPastaGrafigiOlustur === 'function') {
             window.charts.ucPastaGrafigiOlustur();
        }
    }

    // 5. İlk Detaylı Raporu Oluştur
    setTimeout(() => { raporOlustur(); }, 500);
});

// --- Yardımcı Fonksiyonlar ---
function ozetVerileriniDoldur(data) {
    const d = data || {};
    const setTxt = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
    setTxt('ozet-toplam-litre', `${parseFloat(d.totalLitre || 0).toFixed(2)} L`);
    setTxt('ozet-gunluk-ortalama', `${parseFloat(d.averageDailyLitre || 0).toFixed(2)} L`);
    setTxt('ozet-girdi-sayisi', d.entryCount || 0);
    setTxt('ozet-gun-sayisi', d.dayCount || 0);
    const container = document.getElementById('ozet-kartlari');
    if (container) container.classList.remove('hidden');
}

function tedarikciTablosunuDoldur(data) {
    const body = document.getElementById('tedarikci-dokum-tablosu');
    if (!body) return;
    body.innerHTML = '';
    const items = data || [];
    if (items.length === 0) {
        body.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-gray-500 text-sm">Veri yok.</td></tr>';
        return;
    }
    items.forEach(item => {
        // [DÜZELTME] 'entry_count' (yeni), 'entryCount' (eski) veya 0.
        const adet = item.entry_count !== undefined ? item.entry_count : (item.entryCount !== undefined ? item.entryCount : 0);
        
        body.innerHTML += `
        <tr class="hover:bg-gray-50 border-b border-gray-100 last:border-0">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">${utils.sanitizeHTML(item.name)}</td>
            <td class="px-4 py-3 text-sm text-right font-mono text-gray-600">${parseFloat(item.litre).toFixed(2)}</td>
            <td class="px-4 py-3 text-sm text-right text-gray-500">${adet}</td>
        </tr>`;
    });
}

function karlilikKartlariniDoldur(data) {
    const d = data || {};
    const fmt = (val) => `${parseFloat(val || 0).toFixed(2)} TL`;
    const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = fmt(val); };
    
    setTxt('karlilik-toplam-gelir', d.toplam_gelir);
    setTxt('karlilik-toplam-gider', d.toplam_gider);
    setTxt('karlilik-sut-geliri', d.sut_geliri);
    setTxt('karlilik-tahsilat-geliri', d.diger_gelirler);
    setTxt('karlilik-yem-gideri', d.yem_maliyeti);
    setTxt('karlilik-finans-gideri', d.sut_maliyeti);
    setTxt('karlilik-genel-masraf', d.diger_giderler);

    const netEl = document.getElementById('karlilik-net-kar');
    if(netEl) {
        const netVal = parseFloat(d.net_kar || 0);
        netEl.textContent = fmt(netVal);
        netEl.className = `text-2xl font-bold tracking-tight ${netVal >= 0 ? 'text-green-700' : 'text-red-700'}`;
    }
}

// --- Ana Raporlama Fonksiyonları ---

async function sutRaporuOlustur(baslangic, bitis) {
    const msg = document.getElementById('rapor-sonuc-mesaji');
    const title = document.getElementById('grafik-baslik');
    const canvas = document.getElementById('detayliRaporGrafigi');
    
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // [GÜVENLİ TEMİZLİK]
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        try {
            existingChart.destroy();
        } catch(e) {}
    }
    detayliChart = null;

    if(msg) { 
        msg.classList.remove('hidden'); 
        msg.innerHTML = '<div class="flex items-center justify-center text-brand-500"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Yükleniyor...</div>'; 
    }

    try {
        let veri = await api.fetchDetayliRapor(baslangic, bitis);
        if (Array.isArray(veri)) veri = veri.length > 0 ? veri[0] : null;

        if (!veri || !veri.chartData || !veri.chartData.labels || veri.chartData.labels.length === 0) {
            if(msg) {
                msg.textContent = "Seçilen aralıkta veri bulunamadı.";
                msg.className = "absolute inset-0 flex items-center justify-center text-gray-400 text-sm";
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if(title) title.textContent = "Rapor";
            tedarikciTablosunuDoldur([]);
            return;
        }

        if(msg) msg.classList.add('hidden');
        if(title) {
            const basTarih = new Date(baslangic).toLocaleDateString('tr-TR');
            const bitTarih = new Date(bitis).toLocaleDateString('tr-TR');
            title.textContent = `${basTarih} - ${bitTarih} Süt Raporu`;
        }

        ozetVerileriniDoldur(veri.summaryData);
        tedarikciTablosunuDoldur(veri.supplierBreakdown);

        detayliChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: veri.chartData.labels,
                datasets: [{
                    label: 'Toplanan Süt (Litre)',
                    data: veri.chartData.data,
                    fill: true,
                    tension: 0.3,
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#0284c7',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, grid: { borderDash: [4, 4] } }, 
                    x: { grid: { display: false } } 
                }
            }
        });
        
        if(typeof registerChart === 'function') registerChart(detayliChart);

    } catch (error) {
        console.error("Rapor hatası:", error);
        if(msg) {
            msg.textContent = "Hata oluştu.";
            msg.className = "absolute inset-0 flex items-center justify-center text-red-500 text-sm";
        }
    }
}

async function karlilikRaporuOlustur(baslangic, bitis) {
    const role = document.body.dataset.userRole;
    if (role !== 'admin' && role !== 'firma_yetkilisi') return;

    const container = document.getElementById('karlilik-raporu-container');
    const msg = document.getElementById('karlilik-sonuc-mesaji');
    const cards = document.getElementById('karlilik-kartlari');

    if(!container) return;
    container.classList.remove('hidden');
    if(cards) cards.classList.add('hidden');
    if(msg) { 
        msg.classList.remove('hidden'); 
        msg.innerHTML = '<div class="flex items-center justify-center text-brand-500"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Hesaplanıyor...</div>'; 
    }

    try {
        let data = await api.fetchKarlilikRaporu(baslangic, bitis);
        if (Array.isArray(data)) data = data.length > 0 ? data[0] : null;
        if (!data) throw new Error("Veri yok");
        
        karlilikKartlariniDoldur(data);
        
        if(msg) msg.classList.add('hidden');
        if(cards) cards.classList.remove('hidden');
    } catch (e) {
        if(msg) msg.innerHTML = `<span class="text-red-500">Hata: ${e.message}</span>`;
    }
}

async function raporOlustur() {
    if (!baslangicTarihiSecici || !bitisTarihiSecici) return;
    const d1 = baslangicTarihiSecici.selectedDates[0];
    const d2 = bitisTarihiSecici.selectedDates[0];
    const bas = d1 ? formatDateToYYYYMMDD(d1) : null;
    const bit = d2 ? formatDateToYYYYMMDD(d2) : null;

    if (!bas || !bit || !navigator.onLine) return;

    await Promise.allSettled([
        sutRaporuOlustur(bas, bit),
        karlilikRaporuOlustur(bas, bit)
    ]);
}