// js/utils.js - v3.9.7
// Features: Enhanced CSV Parser, Fees Support, Smart Formatting, Tailwind Toasts

export const DEBUG_MODE = localStorage.getItem('debug') === 'true';

export function debugLog(...args) {
    if (DEBUG_MODE) console.log(...args);
}

// 1. IŠMANUS FORMATAVIMAS (Pinigai)
export function formatMoney(value) {
    const num = Number(value);
    if (isNaN(num)) return '$0.00';
    
    // Jei suma labai maža (pvz. 0.004), rodome daugiau skaičių
    const decimals = Math.abs(num) < 0.01 && num !== 0 ? 6 : 2;
    
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}

// 2. IŠMANUS FORMATAVIMAS (Kaina)
export function formatPrice(value) {
    const num = Number(value);
    if (isNaN(num)) return '$0.00';
    
    // Kripto kainoms: jei < $1, rodome 8 skaičius, kitaip 2
    const decimals = Math.abs(num) < 1 && num !== 0 ? 8 : 2;
    
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: 8 
    }).format(num);
}

// 3. SAUGUMAS
export function sanitizeText(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 4. GRAŽŪS PRANEŠIMAI (TOASTS - Jūsų originalus stilius)
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    let bg, icon;
    
    // Spalvų ir ikonų logika
    if (type === 'success') {
        bg = 'bg-white border-l-4 border-primary-500';
        icon = '<i class="fa-solid fa-circle-check text-primary-500"></i>';
    } else if (type === 'info') {
        bg = 'bg-white border-l-4 border-blue-500';
        icon = '<i class="fa-solid fa-circle-info text-blue-500"></i>';
    } else {
        bg = 'bg-white border-l-4 border-red-500';
        icon = '<i class="fa-solid fa-triangle-exclamation text-red-500"></i>';
    }
    
    toast.className = `toast ${bg} dark:bg-gray-800 shadow-xl rounded-r-xl px-4 py-3 flex items-center gap-3 min-w-[300px] mb-3 transform transition-all duration-300 translate-x-full`;
    toast.innerHTML = `<span class="text-xl">${icon}</span><span class="text-sm font-bold text-gray-800 dark:text-white">${message}</span>`;
    
    container.appendChild(toast);
    
    // Animacija
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full');
    });
    
    setTimeout(() => { 
        toast.classList.add('translate-x-full', 'opacity-0'); 
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
}

// 5. GRIEŽTAS CSV SKAITYMAS (Su FEES palaikymu)
export function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    
    // Automatinis skirtuko nustatymas (; arba ,)
    const separator = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    
    return lines.slice(1).map(line => {
        // Išvalome kabutes
        const cols = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
        
        // Reikia bent pagrindinių duomenų
        if (cols.length < 3) return null;
        
        // Pagalbinė funkcija skaičių valymui (pvz. 1,000.50 -> 1000.50)
        const parseNum = (val) => parseFloat(val?.replace(/,/g, '.') || 0);

        return {
            date: cols[0], 
            type: cols[1] || 'Buy',
            coin_symbol: cols[2]?.toUpperCase(),
            amount: parseNum(cols[3]),
            price_per_coin: parseNum(cols[4]),
            total_cost_usd: parseNum(cols[5]),
            
            // ✅ NAUJA: Pridedame Fees (tikimės 6 stulpelio, jei nėra - 0)
            fees: parseNum(cols[6]), 
            
            exchange: cols[7] || '',
            method: cols[8] || '',
            notes: cols[9] || ''
        };
    }).filter(x => x && x.coin_symbol && (!isNaN(x.amount) || x.type === 'Gift'));
}
