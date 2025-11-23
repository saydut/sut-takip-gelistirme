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