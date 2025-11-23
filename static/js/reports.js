// static/js/reports.js

let detayliChart = null;
let baslangicTarihiSecici = null;
let bitisTarihiSecici = null;

// Tarih Formatlama (API için)
function formatDateToYYYYMMDD(date) {
    if (!date) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// PDF İndirme
async function pdfIndir() {
    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const url = `/api/rapor/aylik_pdf?ay=${ay}&yil=${yil}`;

    if (typeof indirVeAc === 'function') {
        await indirVeAc(url, 'pdf-indir-btn', {
            success: 'Rapor başarıyla indirildi.',
            error: 'PDF oluşturulurken bir hata meydana geldi.'
        });
    } else {
        console.error("utils.js yüklenemedi.");
        alert("İndirme başlatılamadı.");
    }
}

// Sayfa Başlangıcı - GÜNCELLENDİ: DOMContentLoaded Kullanılıyor
document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Flatpickr Başlatma
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

    // 2. Ay/Yıl Seçicileri
    if(typeof ayYilSecicileriniDoldur === 'function') {
        ayYilSecicileriniDoldur('rapor-ay', 'rapor-yil');
    }

    // 3. Küçük Grafikler (Haftalık ve Pasta Grafik) - GÜVENLİ KONTROL
    // charts objesinin ve Chart.js'in yüklendiğinden emin olalım
    if (typeof charts !== 'undefined' && typeof Chart !== 'undefined') {
        // DOM elementlerinin varlığını kontrol et
        const haftalikCanvas = document.getElementById('haftalikRaporGrafigi');
        const tedarikciCanvas = document.getElementById('tedarikciDagilimGrafigi');

        if (haftalikCanvas) {
            charts.haftalikGrafigiOlustur();
        } else {
            console.warn("Haftalık grafik canvas'ı bulunamadı.");
        }
        
        if (tedarikciCanvas) {
            charts.tedarikciGrafigiOlustur();
        } else {
            console.warn("Tedarikçi dağılım grafik canvas'ı bulunamadı.");
        }
    } else {
        console.error("charts.js veya Chart.js kütüphanesi yüklenemedi! Grafikler oluşturulamıyor.");
    }

    // 4. Radyo Buton Dinleyici
    const filters = document.querySelectorAll('input[name="tedarikci-periyot"]');
    filters.forEach(radio => {
        radio.addEventListener('change', (e) => {
            // Stil güncelleme
            filters.forEach(r => {
                const label = r.parentElement;
                if(r.checked) {
                    label.classList.remove('text-gray-500', 'hover:bg-white');
                    label.classList.add('bg-white', 'text-brand-600', 'shadow-sm');
                } else {
                    label.classList.add('text-gray-500', 'hover:bg-white');
                    label.classList.remove('bg-white', 'text-brand-600', 'shadow-sm');
                }
            });
            
            // Grafiği güncelle
            if (typeof charts !== 'undefined') {
                charts.tedarikciGrafigiOlustur(e.target.value);
            }
        });
    });

    // 5. İlk Raporu Oluştur (Detaylı Rapor ve Karlılık)
    // API ve diğer scriptlerin tam yüklenmesi için hafif bir gecikme yine de faydalı olabilir
    setTimeout(() => { raporOlustur(); }, 300);
});

// --- YARDIMCI FONKSİYONLAR ---

function ozetVerileriniDoldur(summaryData) {
    const container = document.getElementById('ozet-kartlari');
    if (container) container.classList.remove('hidden');
    
    if(document.getElementById('ozet-toplam-litre'))
        document.getElementById('ozet-toplam-litre').textContent = `${parseFloat(summaryData.totalLitre || 0).toFixed(2)} L`;
    
    if(document.getElementById('ozet-gunluk-ortalama'))
        document.getElementById('ozet-gunluk-ortalama').textContent = `${parseFloat(summaryData.averageDailyLitre || 0).toFixed(2)} L`;
    
    if(document.getElementById('ozet-girdi-sayisi'))
        document.getElementById('ozet-girdi-sayisi').textContent = summaryData.entryCount || 0;
    
    if(document.getElementById('ozet-gun-sayisi'))
        document.getElementById('ozet-gun-sayisi').textContent = summaryData.dayCount || 0;
}

function tedarikciTablosunuDoldur(breakdownData) {
    const body = document.getElementById('tedarikci-dokum-tablosu');
    if (!body) return;
    
    body.innerHTML = '';
    if (!breakdownData || breakdownData.length === 0) {
        body.innerHTML = '<tr><td colspan="3" class="px-4 py-6 text-center text-gray-400 text-sm">Bu aralıkta veri bulunamadı.</td></tr>';
        return;
    }
    
    breakdownData.forEach(item => {
        body.innerHTML += `
        <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
            <td class="px-4 py-3 text-gray-900 font-medium text-sm">${utils.sanitizeHTML(item.name)}</td>
            <td class="px-4 py-3 text-right text-gray-600 font-mono text-sm">${parseFloat(item.litre).toFixed(2)}</td>
            <td class="px-4 py-3 text-right text-gray-500 text-xs">${item.entryCount}</td>
        </tr>`;
    });
}

function karlilikKartlariniDoldur(data) {
    const fmt = (val) => `${parseFloat(val || 0).toFixed(2)} TL`;
    
    if(document.getElementById('karlilik-toplam-gelir'))
        document.getElementById('karlilik-toplam-gelir').textContent = fmt(data.toplam_gelir);
        
    if(document.getElementById('karlilik-toplam-gider'))
        document.getElementById('karlilik-toplam-gider').textContent = fmt(data.toplam_gider);
    
    const net = document.getElementById('karlilik-net-kar');
    if(net) {
        const netVal = parseFloat(data.net_kar || 0);
        net.textContent = fmt(netVal);
        net.className = 'text-2xl font-bold tracking-tight ' + (netVal > 0 ? 'text-green-700' : (netVal < 0 ? 'text-red-700' : 'text-blue-700'));
    }

    if(document.getElementById('karlilik-sut-geliri')) document.getElementById('karlilik-sut-geliri').textContent = fmt(data.sut_geliri); 
    if(document.getElementById('karlilik-tahsilat-geliri')) document.getElementById('karlilik-tahsilat-geliri').textContent = fmt(data.diger_gelirler);
    if(document.getElementById('karlilik-yem-gideri')) document.getElementById('karlilik-yem-gideri').textContent = fmt(data.yem_maliyeti);
    if(document.getElementById('karlilik-finans-gideri')) document.getElementById('karlilik-finans-gideri').textContent = fmt(data.sut_maliyeti);
    if(document.getElementById('karlilik-genel-masraf')) document.getElementById('karlilik-genel-masraf').textContent = fmt(data.diger_giderler);
}

// --- RAPORLAMA MANTIĞI ---

async function karlilikRaporuOlustur(baslangic, bitis) {
    const role = document.body.dataset.userRole;
    // Sadece yetkililer görebilir
    if (role !== 'admin' && role !== 'firma_yetkilisi') return;

    const container = document.getElementById('karlilik-raporu-container');
    const msg = document.getElementById('karlilik-sonuc-mesaji');
    const cards = document.getElementById('karlilik-kartlari');
    const dateSpan = document.getElementById('karlilik-tarih-araligi');

    if(!container) return;
    
    container.classList.remove('hidden');
    if(cards) cards.classList.add('hidden');
    if(msg) {
        msg.classList.remove('hidden');
        msg.innerHTML = '<div class="flex justify-center items-center gap-2"><i class="fa-solid fa-circle-notch fa-spin text-brand-500"></i><span>Hesaplanıyor...</span></div>';
    }

    if (baslangicTarihiSecici && baslangicTarihiSecici.selectedDates[0]) {
        const basStr = baslangicTarihiSecici.selectedDates[0].toLocaleDateString('tr-TR');
        const bitStr = bitisTarihiSecici.selectedDates[0].toLocaleDateString('tr-TR');
        if(dateSpan) dateSpan.textContent = `(${basStr} - ${bitStr})`;
    }
    
    try {
        const data = await api.fetchKarlilikRaporu(baslangic, bitis);
        if (!data) throw new Error("Veri alınamadı");
        
        karlilikKartlariniDoldur(data);
        
        if(msg) msg.classList.add('hidden');
        if(cards) cards.classList.remove('hidden');
    } catch (e) {
        if(msg) msg.innerHTML = `<span class="text-red-500">Hata: ${e.message}</span>`;
    }
}

async function sutRaporuOlustur(baslangic, bitis) {
    const msg = document.getElementById('rapor-sonuc-mesaji');
    const title = document.getElementById('grafik-baslik');
    const canvas = document.getElementById('detayliRaporGrafigi');
    
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const ozetKartlari = document.getElementById('ozet-kartlari');
    if(ozetKartlari) ozetKartlari.classList.add('hidden');
    
    const tedarikciTablosu = document.getElementById('tedarikci-dokum-tablosu');
    if(tedarikciTablosu) tedarikciTablosu.innerHTML = '';
    
    if(msg) {
        msg.classList.remove('hidden');
        msg.innerHTML = '<div class="flex justify-center items-center gap-2"><i class="fa-solid fa-circle-notch fa-spin text-brand-500"></i><span>Yükleniyor...</span></div>';
    }
    
    // Eski grafiği temizle (Chart.js memory leak önlemi)
    if (detayliChart) {
        if(typeof unregisterChart === 'function') unregisterChart(detayliChart);
        detayliChart.destroy();
        detayliChart = null;
    }

    try {
        const veri = await api.fetchDetayliRapor(baslangic, bitis);

        if (!veri || !veri.chartData || !veri.chartData.labels || veri.chartData.labels.length === 0) {
            if(msg) msg.textContent = "Seçilen aralıkta veri bulunamadı.";
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if(title) title.textContent = "Rapor";
            tedarikciTablosunuDoldur([]);
            return;
        }

        if(msg) msg.classList.add('hidden');
        
        if (baslangicTarihiSecici && baslangicTarihiSecici.selectedDates[0]) {
            const basStr = baslangicTarihiSecici.selectedDates[0].toLocaleDateString('tr-TR');
            const bitStr = bitisTarihiSecici.selectedDates[0].toLocaleDateString('tr-TR');
            if(title) title.textContent = `${basStr} - ${bitStr} Süt Raporu`;
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
                    borderColor: '#0284c7', // brand-600
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#0284c7',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.9)', 
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => ` ${ctx.parsed.y} Litre`
                        }
                    }
                },
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#f3f4f6', borderDash: [4, 4] }, 
                        ticks: { font: { size: 11, family: "'Inter', sans-serif" } }
                    }, 
                    x: { 
                        grid: { display: false },
                        ticks: { font: { size: 11, family: "'Inter', sans-serif" } }
                    } 
                }
            }
        });
        
        if(typeof registerChart === 'function') registerChart(detayliChart);

    } catch (error) {
        console.error("Rapor oluşturma hatası:", error);
        if(msg) msg.textContent = "Rapor oluşturulurken bir hata oluştu.";
    }
}

async function raporOlustur() {
    if (!baslangicTarihiSecici || !bitisTarihiSecici) return;

    const d1 = baslangicTarihiSecici.selectedDates[0];
    const d2 = bitisTarihiSecici.selectedDates[0];
    const bas = d1 ? formatDateToYYYYMMDD(d1) : null;
    const bit = d2 ? formatDateToYYYYMMDD(d2) : null;

    if (!bas || !bit) {
        if(typeof gosterMesaj === 'function') gosterMesaj("Lütfen tarih aralığı seçin.", "warning");
        return;
    }
    if (!navigator.onLine) {
        if(typeof gosterMesaj === 'function') gosterMesaj("İnternet bağlantısı gereklidir.", "warning");
        return;
    }

    await Promise.allSettled([
        sutRaporuOlustur(bas, bit),
        karlilikRaporuOlustur(bas, bit)
    ]);
}