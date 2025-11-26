// static/theme.js

document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const htmlElement = document.documentElement;

    // 1. Kayıtlı temayı kontrol et, yoksa VARSAYILAN olarak 'light' (aydınlık) kullan
    // Eskiden sistem tercihine bakıyorduk, şimdi direkt 'light' atıyoruz.
    const currentTheme = localStorage.getItem('theme') || 'light';

    // 2. Temayı uygula
    if (currentTheme === 'dark') {
        htmlElement.setAttribute('data-theme', 'dark');
        if(sunIcon) sunIcon.classList.remove('hidden');
        if(moonIcon) moonIcon.classList.add('hidden');
    } else {
        htmlElement.setAttribute('data-theme', 'light');
        if(sunIcon) sunIcon.classList.add('hidden');
        if(moonIcon) moonIcon.classList.remove('hidden');
    }

    // 3. Butona tıklama olayı (Aynı kalıyor)
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = htmlElement.getAttribute('data-theme') === 'dark';
            
            if (isDark) {
                // Light moda geç
                htmlElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                if(sunIcon) sunIcon.classList.add('hidden');
                if(moonIcon) moonIcon.classList.remove('hidden');
            } else {
                // Dark moda geç
                htmlElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                if(sunIcon) sunIcon.classList.remove('hidden');
                if(moonIcon) moonIcon.classList.add('hidden');
            }
            
            // Grafik güncelleme tetikleyicisi (varsa)
            if (typeof updateAllChartThemes === 'function') {
                updateAllChartThemes();
            }
        });
    }
});