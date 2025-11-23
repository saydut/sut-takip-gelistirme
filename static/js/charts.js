// static/js/charts.js

// [ÇÖZÜM] window.charts kullanarak "already declared" hatasını engelliyoruz.
window.charts = {
    haftalikChart: null,
    tedarikciChart: null,

    // --- HAFTALIK SÜT GRAFİĞİ ---
    async haftalikGrafigiOlustur() {
        try {
            let veri = await api.fetchHaftalikOzet();
            
            // Backend liste dönerse objeye çevir
            if (Array.isArray(veri)) {
                veri = veri.length > 0 ? veri[0] : { labels: [], data: [] };
            }
            
            const canvas = document.getElementById('haftalikRaporGrafigi');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            // Eski grafiği temizle (Hata önleyici)
            if (this.haftalikChart) {
                // chart-manager.js yüklüyse ordan sil, değilse direkt destroy et
                if(typeof unregisterChart === 'function') unregisterChart(this.haftalikChart);
                this.haftalikChart.destroy();
                this.haftalikChart = null; 
            }

            this.haftalikChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: veri.labels || [],
                    datasets: [{
                        label: 'Toplanan Süt (Litre)',
                        data: veri.data || [],
                        borderWidth: 1,
                        borderRadius: 5,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)', // Mavi ton
                        borderColor: 'rgba(59, 130, 246, 1)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true },
                        x: { grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (c) => ` Toplam: ${c.parsed.y} Litre` } }
                    }
                }
            });

            // Tema yöneticisine kaydet
            if(typeof registerChart === 'function') registerChart(this.haftalikChart); 
            if(typeof updateAllChartThemes === 'function') updateAllChartThemes();

        } catch (error) {
            console.error("Haftalık grafik hatası:", error.message);
            // Hata olsa bile kullanıcıya boş grafik göstermemek için canvas'ı temizleyebiliriz veya hata mesajı basabiliriz
        }
    },

    // --- TEDARİKÇİ DAĞILIM GRAFİĞİ ---
    async tedarikciGrafigiOlustur(period = 'monthly') { 
        const veriYokMesaji = document.getElementById('tedarikci-veri-yok');
        const canvas = document.getElementById('tedarikciDagilimGrafigi');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Eski grafiği temizle
        if (this.tedarikciChart) {
            if(typeof unregisterChart === 'function') unregisterChart(this.tedarikciChart);
            this.tedarikciChart.destroy();
            this.tedarikciChart = null;
        }
        
        canvas.style.display = 'none';
        if (veriYokMesaji) {
            veriYokMesaji.style.display = 'block';
            veriYokMesaji.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
        }

        try {
            const veri = await api.fetchTedarikciDagilimi(period);
            
            // Veri kontrolü
            if (!veri || !veri.labels || veri.labels.length === 0) {
                let mesaj = 'Veri bulunamadı.';
                if(period === 'daily') mesaj = 'Son 24 saatte veri yok.';
                else if(period === 'weekly') mesaj = 'Son 7 günde veri yok.';
                else if(period === 'monthly') mesaj = 'Son 30 günde veri yok.';
                
                if (veriYokMesaji) {
                    veriYokMesaji.style.display = 'block';
                    veriYokMesaji.textContent = mesaj;
                    // Stil düzeltmeleri
                    veriYokMesaji.className = "absolute inset-0 flex items-center justify-center text-gray-400 text-sm";
                }
                return;
            }

            const GRAFIKTE_GOSTERILECEK_SAYI = 9;
            let islenmisVeri = { labels: veri.labels, data: veri.data };

            // Çok fazla veri varsa "Diğerleri" olarak birleştir
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
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { size: 11 }, boxWidth: 12 }
                        }
                    },
                    layout: {
                        padding: { left: 0, right: 0, top: 0, bottom: 0 }
                    }
                }
            });

            if(typeof registerChart === 'function') registerChart(this.tedarikciChart); 
            if(typeof updateAllChartThemes === 'function') updateAllChartThemes();

        } catch (error) {
            console.error("Tedarikçi grafiği hatası:", error.message);
            if (veriYokMesaji) {
                veriYokMesaji.style.display = 'block';
                veriYokMesaji.textContent = 'Grafik yüklenemedi.';
            }
        }
    }
};

// Olay dinleyicisi (Güvenli ekleme)
document.addEventListener('DOMContentLoaded', function() {
    const filtreGrubu = document.getElementById('tedarikci-filtre-grup');
    if (filtreGrubu) {
        // Eski listenerları temizlemek yerine yenisini ekliyoruz, çakışma olmaz
        filtreGrubu.onchange = (event) => {
            if (event.target.name === 'tedarikci-periyot' && window.charts) {
                window.charts.tedarikciGrafigiOlustur(event.target.value);
            }
        };
    }
});