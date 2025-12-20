// js/utils.js - Pagalbinės funkcijos

export const DEBUG_MODE = localStorage.getItem('debug') === 'true';

export function debugLog(...args) {
    if (DEBUG_MODE) console.log(...args);
}

export function formatMoney(value) {
    const num = Number(value);
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    }).format(num);
}

export function formatPrice(value) {
    const num = Number(value);
    if (isNaN(num)) return '$0.0000';
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 8 
    }).format(num);
}

export function sanitizeText(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function parseCSVNumber(val) {
    if (typeof val !== 'string') return parseFloat(val);
    val = val.trim();
    // Europos formatas (1.234,56) vs US (1,234.56)
    const lastComma = val.lastIndexOf(',');
    const lastDot = val.lastIndexOf('.');
    
    if (lastComma > lastDot) {
        // Euro: taškai tūkstančiams, kablelis dešimtainėms
        return parseFloat(val.replace(/\./g, '').replace(',', '.'));
    }
    // US: kableliai tūkstančiams
    return parseFloat(val.replace(/,/g, ''));
}

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const cleanMsg = message.replace(/[✅❌ℹ️⚠️🎉🚀💰📊🔒⚡]/g, '').trim();
    const toast = document.createElement('div');
    toast.className = `toast bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-2xl min-w-[250px]`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    const msgColor = 'text-gray-800 dark:text-gray-200';
    
    toast.innerHTML = `<div class="flex items-center gap-2"><span class="text-lg">${icon}</span><span class="${msgColor} text-sm font-medium">${cleanMsg}</span></div>`;
    
    container.appendChild(toast);
    
    // Animation
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

