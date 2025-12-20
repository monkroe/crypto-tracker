// js/utils.js - v3.2.0
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
    const bg = type === 'success' ? 'bg-white border-l-4 border-green-500' : 'bg-white border-l-4 border-red-500';
    toast.className = `toast ${bg} dark:bg-gray-800 shadow-xl rounded-r px-4 py-3 flex items-center gap-3 min-w-[300px]`;
    toast.innerHTML = `<span class="text-xl">${type === 'success' ? '✅' : '⚠️'}</span><span class="text-sm font-bold text-gray-800 dark:text-white">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// Paprastas CSV parseris
export function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    
    // Bandome atspėti skirtuką (; arba ,)
    const separator = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    
    return lines.slice(1).map(line => {
        const cols = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 4) return null; // Reikia bent datos, tipo, simbolio, kiekio
        
        // CSV formatas: Date, Type, Coin, Amount, Price, Total, Exchange, Method, Notes
        return {
            date: cols[0], // Reiks validuoti
            type: cols[1] || 'Buy',
            coin_symbol: cols[2]?.toUpperCase(),
            amount: parseFloat(cols[3].replace(',', '.')) || 0,
            price_per_coin: parseFloat(cols[4]?.replace(',', '.') || 0),
            total_cost_usd: parseFloat(cols[5]?.replace(',', '.') || 0),
            exchange: cols[6] || '',
            method: cols[7] || '',
            notes: cols[8] || ''
        };
    }).filter(x => x && x.coin_symbol && x.amount > 0);
}
