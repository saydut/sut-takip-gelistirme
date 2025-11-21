// static/js/profil.js

window.onload = async function() {
    // Eğer kullanıcı admin veya firma yetkilisi ise alt kullanıcı listesini çek
    const rol = document.body.dataset.userRole;
    if (['admin', 'firma_yetkilisi'].includes(rol)) {
        await kullanicilariYukle();
    }
};

/**
 * Profil bilgilerini (Ad, Email, Tel) günceller.
 */
async function profilGuncelle() {
    const data = {
        kullanici_adi: document.getElementById('profil-isim').value.trim(),
        email: document.getElementById('profil-email').value.trim(),
        telefon: document.getElementById('profil-telefon').value.trim()
    };

    if (!data.kullanici_adi) {
        gosterMesaj("İsim alanı boş bırakılamaz.", "warning");
        return;
    }

    try {
        const result = await api.request('/api/profil/guncelle', 'PUT', data);
        gosterMesaj(result.message || "Profil başarıyla güncellendi.", "success");
        // İsteğe bağlı: Sayfayı yenilemeye gerek yok ama UI'da isim değiştiyse yansıtabiliriz.
    } catch (error) {
        gosterMesaj(error.message || "Profil güncellenirken hata oluştu.", "danger");
    }
}

/**
 * Alt kullanıcıları listeler (API'den çeker).
 */
async function kullanicilariYukle() {
    const tbody = document.getElementById('kullanici-listesi-body');
    const loading = document.getElementById('kullanici-yukleniyor');
    const empty = document.getElementById('kullanici-yok-mesaji');

    if (!tbody) return;

    tbody.innerHTML = '';
    loading.classList.remove('hidden');
    empty.classList.add('hidden');

    try {
        const data = await api.request('/api/firma/kullanicilar'); // Endpoint doğruluğunu kontrol et (eski projede bu yol vardı)
        
        loading.classList.add('hidden');

        if (!data || data.length === 0) {
            empty.classList.remove('hidden');
            return;
        }

        data.forEach(user => {
            // Rolü Türkçeleştir
            let rolTr = user.rol;
            let rolClass = "bg-gray-100 text-gray-800";
            
            if (user.rol === 'toplayici') { rolTr = 'Toplayıcı'; rolClass = 'bg-blue-100 text-blue-800'; }
            else if (user.rol === 'muhasebeci') { rolTr = 'Muhasebeci'; rolClass = 'bg-purple-100 text-purple-800'; }
            else if (user.rol === 'ciftci') { rolTr = 'Çiftçi'; rolClass = 'bg-green-100 text-green-800'; }

            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0";
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${utils.sanitizeHTML(user.kullanici_adi)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10 ${rolClass}">
                        ${rolTr}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="inline-flex items-center gap-1.5">
                        <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span> Aktif
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="kullaniciSilOnayAc(${user.id}, '${utils.sanitizeHTML(user.kullanici_adi.replace(/'/g, "\\'"))}')" class="text-red-600 hover:text-red-900 transition-colors p-1 rounded hover:bg-red-50">
                        <i class="fa-solid fa-trash"></i> Sil
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        loading.classList.add('hidden');
        console.error("Kullanıcılar yüklenirken hata:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-500 text-sm">Veriler yüklenemedi.</td></tr>`;
    }
}

// --- Kullanıcı Ekleme İşlemleri ---

function yeniKullaniciEkleModalAc() {
    document.getElementById('yeni-kullanici-form').reset();
    toggleModal('yeniKullaniciModal', true);
}

async function yeniKullaniciKaydet() {
    const ad = document.getElementById('yeni-kullanici-adi').value.trim();
    const sifre = document.getElementById('yeni-kullanici-sifre').value.trim();
    const rol = document.getElementById('yeni-kullanici-rol').value;

    if (!ad || !sifre) {
        gosterMesaj("Kullanıcı adı ve şifre zorunludur.", "warning");
        return;
    }

    try {
        const data = { kullanici_adi: ad, sifre: sifre, rol: rol };
        await api.request('/api/firma/kullanici_ekle', 'POST', data);
        
        gosterMesaj("Yeni kullanıcı başarıyla eklendi.", "success");
        toggleModal('yeniKullaniciModal', false);
        kullanicilariYukle(); // Listeyi yenile

    } catch (error) {
        gosterMesaj(error.message || "Kullanıcı eklenirken hata oluştu.", "danger");
    }
}

// --- Kullanıcı Silme İşlemleri ---

function kullaniciSilOnayAc(id, ad) {
    document.getElementById('silinecek-kullanici-id').value = id;
    document.getElementById('silinecek-kullanici-adi').innerText = ad;
    toggleModal('kullaniciSilOnayModal', true);
}

async function kullaniciSil() {
    const id = document.getElementById('silinecek-kullanici-id').value;
    
    try {
        await api.request(`/api/firma/kullanici_sil/${id}`, 'DELETE');
        
        gosterMesaj("Kullanıcı silindi.", "success");
        toggleModal('kullaniciSilOnayModal', false);
        kullanicilariYukle(); // Listeyi yenile

    } catch (error) {
        gosterMesaj(error.message || "Silme işlemi başarısız.", "danger");
        toggleModal('kullaniciSilOnayModal', false);
    }
}

// --- Çıkış Yap ---
async function cikisYap() {
    try {
        await api.request('/logout'); // Backend logout
        // Local temizlik
        localStorage.removeItem('offlineUser');
        // Yönlendir
        window.location.href = '/login';
    } catch (e) {
        console.error("Çıkış hatası:", e);
        window.location.href = '/login'; // Hata olsa da git
    }
}