// static/js/charts.js

// Eğer bu dosya daha önce yüklendiyse tekrar tanımlama yapma
if (typeof charts === 'undefined') {
    
    // Chart nesnesini global tanımla
    window.charts = {
        haftalikChart: null,
        tedarikciChart: null,

        /**
         * Son 7 günlük süt toplama grafiğini oluşturur.
         */
        async haftalikGrafigiOlustur() {
            try {
                const canvas = document.getElementById('haftalikRaporGrafigi');
                if (!canvas) return;
                
                // Eskisini temizle
                if (this.haftalikChart) {
                    this.haftalikChart.destroy();
                    this.haftalikChart = null;
                }

                // API'den veriyi çek
                const veri = await api.fetchHaftalikOzet();
                if (!veri) return;

                const ctx = canvas.getContext('2d');
                
                this.haftalikChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: veri.labels,
                        datasets: [{
                            label: 'Toplanan Süt (Litre)',
                            data: veri.data,
                            borderWidth: 1,
                            borderRadius: 5
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

                // Tema güncellemesi için kaydet
                if(typeof registerChart === 'function') registerChart(this.haftalikChart); 
                if (typeof updateAllChartThemes === 'function') updateAllChartThemes();

            } catch (error) {
                console.error("Haftalık grafik oluşturulurken hata:", error.message);
            }
        },


        /**
         * Tedarikçi dağılımı grafiğini (doughnut) oluşturur.
         */
        async tedarikciGrafigiOlustur(period = 'monthly') { 
            const canvas = document.getElementById('tedarikciDagilimGrafigi');
            const veriYokMesaji = document.getElementById('tedarikci-veri-yok');
            
            if (!canvas) return;

            // Eskisini temizle
            if (this.tedarikciChart) {
                this.tedarikciChart.destroy();
                this.tedarikciChart = null;
            }

            const ctx = canvas.getContext('2d');
            canvas.style.display = 'none';
            if (veriYokMesaji) {
                veriYokMesaji.style.display = 'block';
                veriYokMesaji.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';
            }

            try {
                const veri = await api.fetchTedarikciDagilimi(period);
                
                if (!veri || !veri.labels || veri.labels.length === 0) {
                    let mesaj = 'Veri bulunamadı.';
                    if (veriYokMesaji) veriYokMesaji.textContent = mesaj;
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
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: { font: { size: 12 } }
                            }
                        }
                    }
                });

                if(typeof registerChart === 'function') registerChart(this.tedarikciChart); 
                if (typeof updateAllChartThemes === 'function') updateAllChartThemes();

            } catch (error) {
                console.error("Tedarikçi grafiği oluşturulurken hata:", error.message);
                if (veriYokMesaji) veriYokMesaji.textContent = 'Grafik yüklenemedi.';
            }
        }
    };
}