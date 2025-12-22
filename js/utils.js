// js/utils.js - v4.0.0
// Features: Debug, Formatters, Toast, CSV Parser (Updated for Fees)

export const DEBUG_MODE = localStorage.getItem('debug') === 'true';

export function debugLog(...args) {
    if (DEBUG_MODE) console.log(...args);
}

export function formatMoney(value) {
    const num = Number(value);
    return isNaN(num) ? '$0.00' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

export function formatPrice(value) {
    const num = Number(value);
    return isNaN(num) ? '$0.0000' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(num);
}

export function sanitizeText(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    let bg, icon;
    if (type === 'success') {
        bg = 'bg-white border-l-4 border-green-500';
        icon = '✅';
    } else if (type === 'info') {
        bg = 'bg-white border-l-4 border-blue-500';
        icon = 'ℹ️';
    } else {
        bg = 'bg-white border-l-4 border-red-500';
        icon = '⚠️';
    }
    toast.className = `toast ${bg} dark:bg-gray-800 shadow-xl rounded-r px-4 py-3 flex items-center gap-3 min-w-[300px]`;
    toast.innerHTML = `<span class="text-xl">${icon}</span><span class="text-sm font-bold text-gray-800 dark:text-white">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ✅ ATNAUJINTA: Palaiko fee_usd ir naują stulpelių tvarką
export function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    
    // Auto-detect separator
    const separator = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    
    return lines.slice(1).map(line => {
        // Valome kabutes: "Reikšmė" -> Reikšmė
        const cols = line.split(separator).map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        
        if (cols.length < 3) return null;
        
        // Struktūra pagal app.js exportą:
        // 0: date, 1: type, 2: coin, 3: amount, 4: price, 5: total, 6: fee, 7: exchange, 8: method, 9: notes
        
        return {
            date: cols[0], 
            type: cols[1] || 'Buy',
            coin_symbol: cols[2]?.toUpperCase(),
            amount: parseFloat(cols[3]?.replace(',', '.') || 0),
            price_per_coin: parseFloat(cols[4]?.replace(',', '.') || 0),
            total_cost_usd: parseFloat(cols[5]?.replace(',', '.') || 0),
            
            // ✅ NAUJAS: Mokesčių nuskaitymas (7-as stulpelis, indeksas 6)
            fee_usd: parseFloat(cols[6]?.replace(',', '.') || 0), 
            
            // Pasislinkę stulpeliai
            exchange: cols[7] || '',
            method: cols[8] || '',
            notes: cols[9] || ''
        };
    }).filter(x => x && x.coin_symbol && (!isNaN(x.amount)));
}
