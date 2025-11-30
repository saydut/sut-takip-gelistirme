// static/js/charts.js

window.charts = {
    haftalikChart: null,
    gunlukPasta: null,
    haftalikPasta: null,
    aylikPasta: null,

    // --- HAFTALIK SÜT GRAFİĞİ ---
    async haftalikGrafigiOlustur() {
        const loadingElement = document.getElementById('haftalik-grafik-loading');
        const toplamElement = document.getElementById('haftalik-toplam-litre');
        const canvas = document.getElementById('haftalikRaporGrafigi');

        if (!canvas) return;

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
            
            const ctx = canvas.getContext('2d');
            
            // GÜVENLİ TEMİZLİK: Mevcut grafiği bul ve yok et
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                existingChart.destroy();
            }
            this.haftalikChart = null;

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

    // --- YENİ: 3'LÜ PASTA GRAFİĞİ OLUŞTUR ---
    async ucPastaGrafigiOlustur() {
        const canvasIds = {
            daily: 'pastaGrafikGunluk',
            weekly: 'pastaGrafikHaftalik',
            monthly: 'pastaGrafikAylik'
        };

        try {
            const tumVeriler = await api.fetchTedarikciDagilimiCoklu();

            for (const [period, canvasId] of Object.entries(canvasIds)) {
                const canvas = document.getElementById(canvasId);
                if (!canvas) continue;
                
                const ctx = canvas.getContext('2d');
                const veri = tumVeriler[period];

                // Temizlik (Canvas Reset)
                const existing = Chart.getChart(canvas);
                if(existing) existing.destroy();

                // Veri yoksa boş bırak (veya mesaj göster)
                if (!veri || !veri.data || veri.data.length === 0) {
                    // İstersen buraya "Veri Yok" yazısı çizdirebilirsin
                    continue;
                }

                // Grafik Oluştur (Pasta - Basitleştirilmiş)
                const config = {
                    type: 'doughnut',
                    data: {
                        labels: veri.labels,
                        datasets: [{
                            data: veri.data,
                            backgroundColor: [
                                '#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#6366F1', 
                                '#8B5CF6', '#EC4899', '#F97316', '#06B6D4', '#64748B'
                            ],
                            borderWidth: 1,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }, // Yer kazanmak için legend kapalı
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        let label = context.label || '';
                                        if (label) label += ': ';
                                        let value = context.parsed;
                                        return label + value.toLocaleString('tr-TR') + ' Lt';
                                    }
                                }
                            }
                        },
                        layout: { padding: 5 }
                    }
                };

                // Chart referanslarını saklayalım (tema güncellemesi için gerekebilir)
                if (period === 'daily') this.gunlukPasta = new Chart(ctx, config);
                else if (period === 'weekly') this.haftalikPasta = new Chart(ctx, config);
                else if (period === 'monthly') this.aylikPasta = new Chart(ctx, config);
            }
            
            if(typeof updateAllChartThemes === 'function') updateAllChartThemes();

        } catch (error) {
            console.error("Pasta grafik hatası:", error);
        }
    }
};