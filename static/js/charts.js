// static/js/charts.js

// [ÇÖZÜM] window.charts kullanarak çakışmaları engelliyoruz.
window.charts = {
    haftalikChart: null,
    tedarikciChart: null,

    // --- HAFTALIK SÜT GRAFİĞİ ---
    async haftalikGrafigiOlustur() {
        const loadingElement = document.getElementById('haftalik-grafik-loading');
        const toplamElement = document.getElementById('haftalik-toplam-litre');
        const canvasId = 'haftalikRaporGrafigi';
        let canvas = document.getElementById(canvasId);

        // Canvas yoksa veya DOM'dan kaldırılmışsa işlemi durdur
        if (!canvas || !document.body.contains(canvas)) return;

        if (loadingElement) loadingElement.style.display = 'flex';

        try {
            let veri = await api.fetchHaftalikOzet();
            
            if (Array.isArray(veri)) {
                veri = veri.length > 0 ? veri[0] : { labels: [], data: [] };
            }
            
            let toplamLitre = 0;
            if (veri.data && Array.isArray(veri.data)) {
                toplamLitre = veri.data.reduce((a, b) => a + (parseFloat(b) || 0), 0);
            }

            if (toplamElement) {
                toplamElement.textContent = toplamLitre.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Lt';
            }
            
            // GÜVENLİ TEMİZLİK: Mevcut grafiği bul ve yok et
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                existingChart.destroy();
            }
            this.haftalikChart = null;

            const ctx = canvas.getContext('2d');
            this.haftalikChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: veri.labels || [],
                    datasets: [{
                        label: 'Toplanan Süt (Litre)',
                        data: veri.data || [],
                        borderWidth: 1,
                        borderRadius: 4,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        hoverBackgroundColor: 'rgba(59, 130, 246, 0.9)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { 
                            backgroundColor: 'rgba(17, 24, 39, 0.9)',
                            padding: 10,
                            cornerRadius: 8,
                            callbacks: { label: (c) => ` Miktar: ${parseFloat(c.parsed.y).toLocaleString('tr-TR')} Lt` } 
                        }
                    }
                }
            });

            if(typeof registerChart === 'function') registerChart(this.haftalikChart); 
            if(typeof updateAllChartThemes === 'function') updateAllChartThemes();

        } catch (error) {
            console.error("Haftalık grafik hatası:", error.message);
        } finally {
            if (loadingElement) loadingElement.style.display = 'none';
        }
    },

    // --- TEDARİKÇİ DAĞILIM GRAFİĞİ ---
    async tedarikciGrafigiOlustur(period = 'monthly') { 
        const veriYokMesaji = document.getElementById('tedarikci-veri-yok');
        const canvasId = 'tedarikciDagilimGrafigi';
        let canvas = document.getElementById(canvasId);
        
        // Canvas yoksa işlemi durdur
        if (!canvas || !document.body.contains(canvas)) return;

        // [KESİN ÇÖZÜM: HARD RESET]
        // Eğer Chart.js instance'ı bozulmuşsa, destroy() bile hata verebilir.
        // Bu durumda en temiz yol, canvas elementini silip yeniden oluşturmaktır.
        const parent = canvas.parentNode;
        const existingChart = Chart.getChart(canvas);

        if (existingChart) {
            try {
                existingChart.destroy();
            } catch (e) {
                console.warn("Grafik destroy edilemedi, Canvas yenileniyor...", e);
                // Hata durumunda Canvas'ı DOM'dan söküp yenisini takıyoruz
                const newCanvas = document.createElement('canvas');
                newCanvas.id = canvasId;
                // Mevcut stil ve sınıfları kopyala
                newCanvas.className = canvas.className;
                newCanvas.style.cssText = canvas.style.cssText;
                // Eski canvas'ı yenisiyle değiştir
                parent.replaceChild(newCanvas, canvas);
                canvas = newCanvas; // Referansı güncelle
            }
        }
        this.tedarikciChart = null; // Değişkeni de sıfırla

        const ctx = canvas.getContext('2d');
        
        canvas.style.display = 'none';
        if (veriYokMesaji) {
            veriYokMesaji.style.display = 'flex';
            veriYokMesaji.innerHTML = '<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>';
            veriYokMesaji.className = "absolute inset-0 flex items-center justify-center text-brand-600";
        }

        try {
            const veri = await api.fetchTedarikciDagilimi(period);
            
            // Veri geldikten sonra canvas hala yerinde mi kontrol et
            if (!document.body.contains(canvas)) return;

            if (!veri || !veri.labels || veri.labels.length === 0) {
                let mesaj = 'Veri bulunamadı.';
                if(period === 'daily') mesaj = 'Son 24 saatte veri yok.';
                else if(period === 'weekly') mesaj = 'Son 7 günde veri yok.';
                else if(period === 'monthly') mesaj = 'Son 30 günde veri yok.';
                
                if (veriYokMesaji) {
                    veriYokMesaji.style.display = 'flex';
                    veriYokMesaji.innerHTML = mesaj;
                    veriYokMesaji.className = "absolute inset-0 flex items-center justify-center text-gray-400 text-sm";
                }
                return;
            }

            const GRAFIKTE_GOSTERILECEK_SAYI = 9;
            let islenmisVeri = { labels: veri.labels, data: veri.data };

            if (veri.labels.length > GRAFIKTE_GOSTERILECEK_SAYI + 1) {
                const digerleriToplami = veri.data.slice(GRAFIKTE_GOSTERILECEK_SAYI).reduce((a, b) => a + b, 0);
                islenmisVeri.labels = veri.labels.slice(0, GRAFIKTE_GOSTERILECEK_SAYI);
                islenmisVeri.labels.push('Diğerleri');
                islenmisVeri.data = veri.data.slice(0, GRAFIKTE_GOSTERILECEK_SAYI);
                islenmisVeri.data.push(digerleriToplami);
            }
            
            if (veriYokMesaji) veriYokMesaji.style.display = 'none';
            canvas.style.display = 'block';

            this.tedarikciChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: islenmisVeri.labels,
                    datasets: [{
                        label: 'Litre',
                        data: islenmisVeri.data,
                        backgroundColor: [
                            '#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#6366F1', 
                            '#8B5CF6', '#EC4899', '#F97316', '#06B6D4', '#64748B'
                        ],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { size: 11 }, boxWidth: 12, usePointStyle: true }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label) label += ': ';
                                    let value = context.parsed;
                                    let total = context.chart._metasets[context.datasetIndex].total;
                                    let percentage = ((value / total) * 100).toFixed(1) + '%';
                                    return label + value.toLocaleString('tr-TR') + ' Lt (' + percentage + ')';
                                }
                            }
                        }
                    },
                    layout: { padding: { left: 0, right: 0, top: 0, bottom: 0 } }
                }
            });

            if(typeof registerChart === 'function') registerChart(this.tedarikciChart); 
            if(typeof updateAllChartThemes === 'function') updateAllChartThemes();

        } catch (error) {
            console.error("Tedarikçi grafiği hatası:", error.message);
            if (veriYokMesaji) {
                veriYokMesaji.style.display = 'flex';
                veriYokMesaji.textContent = 'Grafik yüklenemedi.';
            }
        }
    }
};

// Olay dinleyicisi
document.addEventListener('DOMContentLoaded', function() {
    const filtreler = document.querySelectorAll('input[name="tedarikci-periyot"]');
    filtreler.forEach(radio => {
        radio.addEventListener('change', (event) => {
            if (window.charts) {
                window.charts.tedarikciGrafigiOlustur(event.target.value);
            }
        });
    });
});