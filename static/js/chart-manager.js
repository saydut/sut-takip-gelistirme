// static/js/chart-manager.js

// Tekrar yükleme koruması
if (typeof window.registeredCharts === 'undefined') {
    window.registeredCharts = [];
}

if (typeof window.registerChart === 'undefined') {
    window.registerChart = function(chartInstance) {
        if (chartInstance) {
            window.registeredCharts.push(chartInstance);
        }
    };
}

if (typeof window.unregisterChart === 'undefined') {
    window.unregisterChart = function(chartInstance) {
        if (!chartInstance) return;
        window.registeredCharts = window.registeredCharts.filter(chart => chart.id !== chartInstance.id);
    };
}

if (typeof window.updateAllChartThemes === 'undefined') {
    window.updateAllChartThemes = function() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#E2E8F0' : '#333333';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const legendColor = isDark ? '#E2E8F0' : '#333333';
        const borderColor = isDark ? '#1E293B' : '#FFFFFF';
        
        const barBgColor = isDark ? 'rgba(76, 125, 255, 0.8)' : 'rgba(74, 144, 226, 0.8)';
        const barBorderColor = isDark ? 'rgba(76, 125, 255, 1)' : 'rgba(74, 144, 226, 1)';
        const lineBgColor = isDark ? 'rgba(76, 125, 255, 0.3)' : 'rgba(74, 144, 226, 0.3)';
        const lineBorderColor = isDark ? 'rgba(76, 125, 255, 1)' : 'rgba(74, 144, 226, 1)';

        window.registeredCharts.forEach(chart => {
            if (!chart) return;
            if (chart.options.scales.y) chart.options.scales.y.ticks.color = textColor;
            if (chart.options.scales.x) chart.options.scales.x.ticks.color = textColor;
            if (chart.options.scales.y) chart.options.scales.y.grid.color = gridColor;
            if (chart.options.plugins.legend) chart.options.plugins.legend.labels.color = legendColor;

            const chartType = chart.config.type;
            const dataset = chart.data.datasets[0];

            if (chartType === 'bar') {
                dataset.backgroundColor = barBgColor;
                dataset.borderColor = barBorderColor;
            } else if (chartType === 'line') {
                dataset.backgroundColor = lineBgColor;
                dataset.borderColor = lineBorderColor;
            } else if (chartType === 'doughnut') {
                dataset.borderColor = borderColor;
            }
            
            chart.update();
        });
    };
}