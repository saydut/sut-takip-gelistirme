// static/js/profil.js

document.addEventListener('DOMContentLoaded', () => {
    profilBilgileriniYukle();
    // Personel listesi yükleme kaldırıldı çünkü o bölüm HTML'den silindi.
});

// --- Profil Bilgileri ---
async function profilBilgileriniYukle() {
    try {
        const data = await api.fetchProfil(); // api.js'de tanımlı
        if (data.kullanici) {
            const k = data.kullanici;
            if(document.getElementById('profil-isim')) document.getElementById('profil-isim').value = k.kullanici_adi || '';
            if(document.getElementById('profil-email')) document.getElementById('profil-email').value = k.eposta || '';
            if(document.getElementById('profil-telefon')) document.getElementById('profil-telefon').value = k.telefon_no || '';
        }
    } catch (error) {
        console.error('Profil yükleme hatası:', error);
    }
}

async function profilGuncelle() {
    try {
        const data = {
            kullanici: { // API beklentisine göre grupladık
                eposta: document.getElementById('profil-email').value,
                telefon_no: document.getElementById('profil-telefon').value
                // Kullanıcı adı değişimi genellikle kısıtlanır, ama API izin veriyorsa eklenebilir
            }
        };
        // Kullanıcı adı inputunu da alalım, backend izin veriyorsa güncellenir
        const kadi = document.getElementById('profil-isim').value;
        if (kadi) data.kullanici.kullanici_adi = kadi;
        
        await api.updateProfil(data);
        ui.showToast('Profil başarıyla güncellendi.', 'success');
    } catch (error) {
        ui.showToast(error.message || 'Güncelleme başarısız.', 'error');
    }
}

// --- Şifre Değiştirme (Kendi Şifresi) ---
async function sifreDegistir() {
    const eski = document.getElementById('mevcut-sifre-input').value;
    const yeni = document.getElementById('kullanici-yeni-sifre-input').value;
    const yeniT = document.getElementById('kullanici-yeni-sifre-tekrar-input').value;

    if (yeni !== yeniT) {
        ui.showToast('Yeni şifreler uyuşmuyor!', 'warning');
        return;
    }

    try {
        await api.postChangePassword({ mevcut_sifre: eski, yeni_sifre: yeni, yeni_sifre_tekrar: yeniT });
        ui.showToast('Şifreniz başarıyla değiştirildi.', 'success');
        
        // Modalı kapat (toggleModal base.html'den gelir)
        if(typeof toggleModal === 'function') toggleModal('sifreDegistirModal', false);
        
        document.getElementById('mevcut-sifre-input').value = '';
        document.getElementById('kullanici-yeni-sifre-input').value = '';
        document.getElementById('kullanici-yeni-sifre-tekrar-input').value = '';
    } catch (error) {
        ui.showToast(error.message || 'Şifre değiştirilemedi.', 'error');
    }
}