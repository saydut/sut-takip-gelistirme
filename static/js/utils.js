// ====================================================================================
// YARDIMCI FONKSİYONLAR (utils.js)
// Projenin farklı yerlerinde kullanılabilen genel amaçlı, arayüzden bağımsız fonksiyonları içerir.
// ====================================================================================

const utils = {
    /**
     * Sayıyı formatlar (Binlik ayracı ve ondalık hane).
     * Örnek: 1234.5 -> "1.234,50"
     * @param {number} number - Formatlanacak sayı.
     * @param {number} decimals - Ondalık basamak sayısı (Varsayılan: 2).
     * @returns {string}
     */
    formatNumber(number, decimals = 2) {
        if (number === null || number === undefined || isNaN(number)) {
            return '0';
        }
        // Sayıya çevir (string gelme ihtimaline karşı)
        const val = parseFloat(number);
        return new Intl.NumberFormat('tr-TR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(val);
    },

    /**
     * Para birimi formatlar (TL).
     * Örnek: 1500 -> "₺1.500,00"
     * @param {number} amount - Tutar.
     * @returns {string}
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
     * @param {Date} date - Formatlanacak tarih nesnesi. Varsayılan: şimdi.
     * @returns {string}
     */
    getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * innerHTML'e eklenecek metinleri güvenli hale getirir (XSS Koruması).
     * @param {string} str - Temizlenecek metin.
     * @returns {string} - HTML etiketlerinden arındırılmış güvenli metin.
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

// --- GLOBAL FONKSİYONLAR ---

/**
 * Hem yerel kullanıcı verisini siler hem de sunucudan çıkış yapar.
 */
function guvenliCikis() {
    console.log("Güvenli Çıkış yapılıyor...");
    // 1. Yerel depolamayı temizle
    localStorage.removeItem('offlineUser');
    
    // 2. Global değişkenleri sıfırla (varsa)
    if (typeof kullaniciRolu !== 'undefined') {
        kullaniciRolu = null;
    }
    // window altındaki değişkenleri de sıfırlayalım (ihtiyaç olursa)
    if (window.anaPanelMevcutGorunum) window.anaPanelMevcutGorunum = 'liste';
    if (window.anaPanelMevcutSayfa) window.anaPanelMevcutSayfa = 1;

    // 3. Backend logout endpoint'ine yönlendir
    window.location.href = '/logout';
}

document.addEventListener('DOMContentLoaded', () => {
    yeniOzellikBildirimiKontrolEt();
});

/**
 * Uygulama sürümünü kontrol eder ve yeni bir sürüm varsa kullanıcıya bir defalık bildirim gösterir.
 */
function yeniOzellikBildirimiKontrolEt() {
    const appBody = document.querySelector('body[data-app-version]');
    if (!appBody) return;

    const mevcutVersiyon = appBody.dataset.appVersion;
    const kullanicininGorduguVersiyon = localStorage.getItem('sutaski_app_version');

    if (mevcutVersiyon && mevcutVersiyon !== kullanicininGorduguVersiyon) {
        // Eğer gosterMesaj fonksiyonu globalde tanımlıysa (ui.js yüklendiyse) kullan
        if (typeof gosterMesaj === 'function') {
            const mesaj = `
                <strong>Uygulama güncellendi!</strong> Sürüm ${mevcutVersiyon}'a hoş geldiniz.
                <a href="#" class="alert-link underline" onclick="toggleModal('hakkindaModal', true)">Yenilikleri görmek için tıklayın.</a>
            `;
            // 3. parametre süre, 4. parametre allowHTML (ui.js desteğine bağlı)
            gosterMesaj(mesaj, 'info', 10000, true); 
        }
        localStorage.setItem('sutaski_app_version', mevcutVersiyon);
    }
}

/**
 * Verilen select elementlerini mevcut ay ve yıl seçenekleriyle doldurur.
 * @param {string} aySeciciId - Ay <select> elementinin ID'si.
 * @param {string} yilSeciciId - Yıl <select> elementinin ID'si.
 */
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

/**
 * Bir API endpoint'inden PDF dosyasını indirir ve yeni sekmede açar.
 * @param {string} url - PDF'i getirecek API adresi.
 * @param {string} buttonId - İşlemi tetikleyen butonun ID'si.
 * @param {object} messages - {success: string, error: string} formatında mesajlar.
 */
async function indirVeAc(url, buttonId, messages) {
    const button = document.getElementById(buttonId);
    let originalContent = '';
    
    if (button) {
        originalContent = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...`;
    }

    try {
        // Eğer token varsa header'a ekleyelim (api.js'deki yapıya benzer)
        const headers = {};
        /* Not: Normalde api.request kullanılır ama blob dönüşü gerektiği için
           manuel fetch yapıyoruz. Auth token gerekirse buraya eklenmeli.
        */

        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: messages.error }));
            throw new Error(errorData.error || messages.error);
        }
        
        const disposition = response.headers.get('Content-Disposition');
        let filename = `rapor.pdf`;
        if (disposition && disposition.includes('attachment')) {
            const filenameMatch = /filename[^;=\n]*=(['"]?)([^'";\n]+)\1?/;
            const matches = filenameMatch.exec(disposition);
            if (matches && matches[2]) {
                filename = matches[2].replace(/['"]/g, '');
            }
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        
        // Yeni sekmede açmayı dene
        const newWindow = window.open(objectUrl, '_blank');
        
        // Eğer popup engelleyici varsa veya kullanıcı indirmek istiyorsa
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
             const a = document.createElement('a');
             a.style.display = 'none';
             a.href = objectUrl;
             a.download = filename;
             document.body.appendChild(a);
             a.click();
             a.remove();
        }
        
        setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10000); // 10sn sonra temizle
        
        if (typeof gosterMesaj === 'function') {
            gosterMesaj(messages.success, "success");
        }

    } catch (error) {
        console.error("PDF İndirme Hatası:", error);
        if (typeof gosterMesaj === 'function') {
            gosterMesaj(error.message, "danger");
        } else {
            alert(error.message);
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalContent;
        }
    }
}