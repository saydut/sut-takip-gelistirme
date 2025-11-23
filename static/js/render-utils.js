// static/js/render-utils.js

// Tekrar yükleme koruması
if (typeof window.renderUtils === 'undefined') {
    
    if (typeof utils === 'undefined') {
        console.error("render-utils.js HATASI: 'utils' kütüphanesi bulunamadı.");
    }

    window.renderUtils = {
        renderSutGirdileriAsList(girdiler) {
            let listHTML = '';
            if (!girdiler || girdiler.length === 0) return '';

            girdiler.forEach(girdi => {
                let formatliSaat = '??:??';
                try {
                    const tarihObj = new Date(girdi.taplanma_tarihi);
                    if (!isNaN(tarihObj.getTime())) {
                        formatliSaat = tarihObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                    }
                } catch(e) {}

                let etiketlerHTML = '';
                if (girdi.duzenlendi_mi) {
                    etiketlerHTML += `<span class="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20 ms-2">Düzenlendi</span>`;
                }
                if (girdi.isOffline) {
                    etiketlerHTML += `<span class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 ms-2"><i class="fa-solid fa-cloud-arrow-up mr-1"></i> Bekliyor</span>`;
                }

                // Yetki Kontrolü
                let currentUserId = null;
                const currentUserRole = document.body.dataset.userRole;
                try { 
                    const offlineUser = JSON.parse(localStorage.getItem('offlineUser'));
                    if (offlineUser) currentUserId = offlineUser.id;
                } catch(e) {}

                const girdiSahibiId = girdi.kullanici_id;
                const yetkiVar = !girdi.isOffline && (
                    currentUserRole === 'admin' || 
                    currentUserRole === 'firma_yetkilisi' || 
                    (currentUserRole === 'toplayici' && girdiSahibiId === currentUserId)
                );

                let actionButtons = '';
                if (yetkiVar) {
                    actionButtons = `
                        <div class="flex items-center gap-1">
                            <button onclick="modalHandler.acDuzenleModal(${girdi.id}, '${girdi.litre}', '${girdi.fiyat}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><i class="fa-solid fa-pen"></i></button>
                            <button onclick="modalHandler.acSilmeModal(${girdi.id})" class="p-2 text-red-600 hover:bg-red-50 rounded-lg"><i class="fa-solid fa-trash"></i></button>
                        </div>`;
                }

                let gecmisButonu = '';
                if (!girdi.isOffline && girdi.id && !String(girdi.id).startsWith('offline-')) {
                    gecmisButonu = `<button onclick="modalHandler.acGecmisModal(${girdi.id})" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><i class="fa-solid fa-clock-rotate-left"></i></button>`;
                }

                const litre = parseFloat(girdi.litre).toFixed(1);
                const fiyat = parseFloat(girdi.fiyat || 0);
                const fiyatHTML = fiyat > 0 ? `<span class="text-green-600 font-medium text-xs ml-1 bg-green-50 px-1.5 py-0.5 rounded">@${fiyat.toFixed(2)} TL</span>` : '';
                const kullaniciAdi = girdi.kullanicilar?.kullanici_adi ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : (girdi.isOffline ? 'Siz' : '-');
                const tedarikciAdi = girdi.tedarikciler ? utils.sanitizeHTML(girdi.tedarikciler.isim) : 'Bilinmeyen';

                listHTML += `
                    <div class="group flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0" id="girdi-liste-${girdi.id}">
                        <div class="flex-1 min-w-0 pr-4">
                            <div class="flex items-center flex-wrap gap-2 mb-1">
                                <h5 class="text-sm font-bold text-gray-900 truncate">${tedarikciAdi}</h5>
                                ${etiketlerHTML}
                            </div>
                            <div class="flex items-center text-xs text-gray-500 flex-wrap gap-y-1">
                                <span class="font-bold text-gray-800 text-sm mr-1">${litre} L</span>
                                ${fiyatHTML}
                                <span class="mx-2 text-gray-300 hidden sm:inline">|</span>
                                <span class="flex items-center mr-3 sm:mr-0"><i class="fa-regular fa-user mr-1 text-gray-400"></i>${kullaniciAdi}</span>
                                <span class="mx-2 text-gray-300">|</span>
                                <span class="flex items-center font-mono"><i class="fa-regular fa-clock mr-1 text-gray-400"></i>${formatliSaat}</span>
                            </div>
                        </div>
                        <div class="flex items-center opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                            ${actionButtons}
                            ${gecmisButonu}
                        </div>
                    </div>`;
            });
            return listHTML;
        },

        renderSutGirdileriAsCards(girdiler) {
            let cardsHTML = '';
            if (!girdiler || girdiler.length === 0) return '';

            girdiler.forEach(girdi => {
                let formatliSaat = '??:??';
                try {
                    const tarihObj = new Date(girdi.taplanma_tarihi);
                    if (!isNaN(tarihObj.getTime())) {
                        formatliSaat = tarihObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                    }
                } catch(e) {}

                let badgeler = '';
                if (girdi.duzenlendi_mi) badgeler += `<span class="h-2.5 w-2.5 rounded-full bg-yellow-400 ring-2 ring-white"></span>`;
                if (girdi.isOffline) badgeler += `<span class="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white ml-1"></span>`;
                const badgeContainer = badgeler ? `<div class="absolute top-3 right-3 flex">${badgeler}</div>` : '';

                let currentUserId = null;
                const currentUserRole = document.body.dataset.userRole;
                try { 
                    const offlineUser = JSON.parse(localStorage.getItem('offlineUser'));
                    if(offlineUser) currentUserId = offlineUser.id; 
                } catch(e) {}
                
                const girdiSahibiId = girdi.kullanici_id;
                const yetkiVar = !girdi.isOffline && (
                    currentUserRole === 'admin' || 
                    currentUserRole === 'firma_yetkilisi' || 
                    (currentUserRole === 'toplayici' && girdiSahibiId === currentUserId)
                );

                let actionButtons = '';
                if (yetkiVar) {
                    actionButtons = `
                    <button onclick="modalHandler.acDuzenleModal(${girdi.id}, '${girdi.litre}', '${girdi.fiyat}')" class="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors">Düzenle</button>
                    <button onclick="modalHandler.acSilmeModal(${girdi.id})" class="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-md transition-colors ml-2">Sil</button>`;
                }

                const litre = parseFloat(girdi.litre).toFixed(1);
                const fiyat = parseFloat(girdi.fiyat || 0);
                const toplamTutar = (parseFloat(girdi.litre) * fiyat).toFixed(2);
                const tedarikciAdi = girdi.tedarikciler ? utils.sanitizeHTML(girdi.tedarikciler.isim) : 'Bilinmeyen';
                const toplayan = girdi.kullanicilar?.kullanici_adi ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : '-';

                cardsHTML += `
                <div class="col-span-1 relative bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 group" id="girdi-kart-${girdi.id}">
                    ${badgeContainer}
                    <div class="mb-3 pr-6">
                        <h3 class="text-base font-bold text-gray-900 truncate">${tedarikciAdi}</h3>
                        <div class="flex items-center text-xs text-gray-400 mt-1">
                            <i class="fa-regular fa-clock mr-1"></i> ${formatliSaat} <span class="mx-1">•</span> <span>${toplayan}</span>
                        </div>
                    </div>
                    <div class="flex items-baseline gap-1 mb-4">
                        <span class="text-3xl font-extrabold text-brand-600 tracking-tight">${litre}</span>
                        <span class="text-sm font-medium text-gray-500">Litre</span>
                    </div>
                    <div class="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div class="flex flex-col">
                            <span class="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Tutar</span>
                            <span class="text-sm font-bold text-green-600">${fiyat > 0 ? toplamTutar + ' TL' : '-'}</span>
                        </div>
                        <div class="flex items-center">${actionButtons}</div>
                    </div>
                </div>`;
            });
            return cardsHTML;
        }
    };
}