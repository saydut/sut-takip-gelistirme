// ====================================================================================
// YARDIMCI FONKSİYONLAR (utils.js)
// ====================================================================================

const utils = {
    /**
     * YENİ: Sayıyı formatlar (Binlik ayracı ve ondalık hane).
     * Örnek: 1234.5 -> "1.234,50"
     */
    formatNumber(number, decimals = 2) {
        if (number === null || number === undefined || isNaN(number)) {
            return '0';
        }
        const val = parseFloat(number);
        return new Intl.NumberFormat('tr-TR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(val);
    },

    /**
     * YENİ: Para birimi formatlar (TL).
     * Örnek: 1500 -> "₺1.500,00"
     */
    formatCurrency(amount) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(0);
        }
        const val = parseFloat(amount);
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY'
        }).format(val);
    },

    /**
     * JavaScript Date nesnesini 'YYYY-MM-DD' formatında bir string'e çevirir.
     */
    getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * innerHTML'e eklenecek metinleri güvenli hale getirir.
     */
    sanitizeHTML(str) {
        if (str === null || str === undefined) {
            return '';
        }
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }
};

/**
 * Hem yerel kullanıcı verisini siler hem de sunucudan çıkış yapar.
 */
function guvenliCikis() {
    console.log("Güvenli Çıkış yapılıyor...");
    localStorage.removeItem('offlineUser');
    
    if (typeof kullaniciRolu !== 'undefined') {
        kullaniciRolu = null;
    }
     window.anaPanelMevcutGorunum = 'liste';
     window.anaPanelMevcutSayfa = 1;

    window.location.href = '/logout';
}

document.addEventListener('DOMContentLoaded', () => {
    yeniOzellikBildirimiKontrolEt();
});

function yeniOzellikBildirimiKontrolEt() {
    const mevcutVersiyon = document.body.dataset.appVersion;
    if (!mevcutVersiyon) return;
    const kullanicininGorduguVersiyon = localStorage.getItem('sutaski_app_version');
    if (mevcutVersiyon !== kullanicininGorduguVersiyon) {
        // gosterMesaj fonksiyonu ui.js yüklendiyse çalışır
        if(typeof gosterMesaj === 'function') {
             const mesaj = `
                <strong>Uygulama güncellendi!</strong> Sürüm ${mevcutVersiyon}'a hoş geldiniz.
                <a href="#" class="alert-link" data-bs-toggle="modal" data-bs-target="#hakkindaModal">Yenilikleri görmek için tıklayın.</a>
            `;
            gosterMesaj(mesaj, 'info', 10000, true);
        }
        localStorage.setItem('sutaski_app_version', mevcutVersiyon);
    }
}

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

    aylar.forEach((ay, index) => { aySecici.add(new Option(ay, index + 1)); });
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
    button.innerHTML = `<span class="spinner-border spinner-border-sm"></span> İşleniyor...`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(messages.error);
        }
        
        const disposition = response.headers.get('Content-Disposition');
        let filename = `rapor.pdf`;
        if (disposition && disposition.includes('attachment')) {
            const filenameMatch = /filename[^;=\n]*=(['"]?)([^'";\n]+)\1?/;
            const matches = filenameMatch.exec(disposition);
            if (matches && matches[2]) filename = matches[2].replace(/['"]/g, '');
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        
        // Yeni sekme veya indirme
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            a.remove();
            window.URL.revokeObjectURL(objectUrl);
        }, 100);
        
        if(typeof gosterMesaj === 'function') gosterMesaj(messages.success, "success");

    } catch (error) {
        if(typeof gosterMesaj === 'function') gosterMesaj(error.message, "danger");
    } finally {
        button.disabled = false;
        button.innerHTML = originalContent;
    }
}