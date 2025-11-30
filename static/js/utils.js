// static/js/utils.js

const utils = {
    getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    sanitizeHTML(str) {
        if (str === null || str === undefined) {
            return '';
        }
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }
};

function guvenliCikis() {
    localStorage.removeItem('offlineUser');
    if (typeof kullaniciRolu !== 'undefined') kullaniciRolu = null;
    window.location.href = '/logout';
}

document.addEventListener('DOMContentLoaded', () => {
    yeniOzellikBildirimiKontrolEt();
    // YENİ: Sürüm kontrolünü başlat
    versiyonKontrol();
});

function yeniOzellikBildirimiKontrolEt() {
    const mevcutVersiyon = document.body.dataset.appVersion;
    if (!mevcutVersiyon) return;
    const kullanicininGorduguVersiyon = localStorage.getItem('sutaski_app_version');
    if (mevcutVersiyon !== kullanicininGorduguVersiyon) {
        const mesaj = `<strong>Güncelleme:</strong> Sürüm ${mevcutVersiyon}'a hoş geldiniz.`;
        if(typeof gosterMesaj === 'function') gosterMesaj(mesaj, 'info', 10000, true);
        localStorage.setItem('sutaski_app_version', mevcutVersiyon);
    }
}

// [DÜZELTME] Eksik olan fonksiyon buraya eklendi.
function ayYilSecicileriniDoldur(aySeciciId, yilSeciciId) {
    const aySecici = document.getElementById(aySeciciId);
    const yilSecici = document.getElementById(yilSeciciId);
    if (!aySecici || !yilSecici) return;

    const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const simdikiTarih = new Date();
    const simdikiYil = simdikiTarih.getFullYear();
    const simdikiAy = simdikiTarih.getMonth();

    aySecici.innerHTML = '';
    yilSecici.innerHTML = '';

    aylar.forEach((ay, index) => { 
        const option = new Option(ay, index + 1);
        aySecici.add(option); 
    });
    aySecici.value = simdikiAy + 1;

    for (let i = 0; i < 5; i++) {
        yilSecici.add(new Option(simdikiYil - i, simdikiYil - i));
    }
}

async function indirVeAc(url, buttonId, messages) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    const originalContent = button.innerHTML;

    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> İşleniyor...`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(messages.error);
        
        let filename = `rapor.pdf`;
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.includes('attachment')) {
            const filenameMatch = /filename[^;=\n]*=(['"]?)([^'";\n]+)\1?/;
            if (filenameMatch && filenameMatch[2]) filename = filenameMatch[2].replace(/['"]/g, '');
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        
        if(typeof gosterMesaj === 'function') gosterMesaj(messages.success, "success");

    } catch (error) {
        if(typeof gosterMesaj === 'function') gosterMesaj(error.message, "danger");
    } finally {
        button.disabled = false;
        button.innerHTML = originalContent;
    }
}

// --- YENİ: Zorunlu Sürüm Güncelleme Mekanizması ---
async function versiyonKontrol() {
    // Sadece online ise kontrol et
    if (!navigator.onLine) return;

    try {
        // DÜZELTME: Artık herkese açık (public) endpoint kullanılıyor.
        // Bu sayede login olmamış kullanıcılar da güncellemeyi alabilir ve 401/302 hatası oluşmaz.
        const response = await fetch('/api/public/cache_version', { cache: "no-store" });
        
        // Eğer sunucu HTML dönerse (örn: hata sayfası), JSON parse hatası almamak için kontrol
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType || !contentType.includes("application/json")) {
            // Sessizce çık, log basıp kullanıcıyı rahatsız etme
            return;
        }
        
        const data = await response.json();
        const serverVersion = parseInt(data.version);
        
        // Yerelde kayıtlı sürümü al (yoksa 0 varsay)
        const localVersion = parseInt(localStorage.getItem('app_cache_version') || '0');

        // Eğer sunucu sürümü daha büyükse, güncelleme var demektir
        if (serverVersion > localVersion) {
            console.log(`Yeni sürüm tespit edildi! (Sunucu: ${serverVersion}, Yerel: ${localVersion})`);
            
            // Service Worker önbelleklerini temizle
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
                console.log('Önbellekler temizlendi.');
            }

            // Yeni sürümü kaydet
            localStorage.setItem('app_cache_version', serverVersion);

            // Service Worker'ı güncelle ve sayfayı yenile
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.update();
                }
            }

            // Kullanıcıya bilgi verip sayfayı yenile
            if (typeof gosterMesaj === 'function') {
                gosterMesaj('Yeni güncelleme yüklendi. Sayfa yenileniyor...', 'success', 2000);
            }
            
            setTimeout(() => {
                window.location.reload(true); // Hard reload
            }, 1500);
        }
    } catch (error) {
        // Hata olsa bile sessiz kal, kullanıcı akışını bozma
        console.warn('Versiyon kontrolü atlandı:', error);
    }
}