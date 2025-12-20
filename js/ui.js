// js/ui.js - v3.1.0 (Performance & Logic Fix)
import { formatMoney, formatPrice, debugLog } from './utils.js';
import { state } from './logic.js';

let allocationChart = null;
const CHART_COLORS = { 
    KAS: '#2dd4bf', BTC: '#f97316', ETH: '#3b82f6', SOL: '#8b5cf6', BNB: '#eab308',
    PEPE: '#22c55e', USDT: '#26a17b', USDC: '#2775ca', default: '#6b7280'
};

// ===========================================
// 1. CALCULATOR LOGIC (Improved)
// ===========================================
export function setupCalculator() {
    const amountIn = document.getElementById('tx-amount');
    const priceIn = document.getElementById('tx-price');
    const totalIn = document.getElementById('tx-total');
    
    if (!amountIn || !priceIn || !totalIn) return;

    const val = (el) => parseFloat(el.value) || 0;
    const debounce = (func, wait) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => func(...args), wait); }; };

    // 1. Edge Case Fix: Jei Total ištrinamas, nereikia jo atstatyti jei kiti laukai užpildyti
    amountIn.addEventListener('input', debounce(() => { 
        const a = val(amountIn), p = val(priceIn), t = val(totalIn);
        if (t > 0 && a > 0) priceIn.value = (t / a).toFixed(8);
        else if (p > 0) totalIn.value = (a * p).toFixed(2);
    }, 300));

    priceIn.addEventListener('input', debounce(() => { 
        const p = val(priceIn), a = val(amountIn), t = val(totalIn);
        if (t > 0 && p > 0) amountIn.value = (t / p).toFixed(6);
        else if (a > 0) totalIn.value = (a * p).toFixed(2);
    }, 300));

    totalIn.addEventListener('input', debounce(() => { 
        const t = val(totalIn), p = val(priceIn), a = val(amountIn);
        if (a > 0 && t > 0) priceIn.value = (t / a).toFixed(8);
        else if (p > 0 && a === 0) amountIn.value = (t / p).toFixed(6); // Fix logic
    }, 300));
    
    debugLog('🧮 Calculator ready');
}

export function setupThemeHandlers() {
    const btnToggle = document.getElementById('btn-toggle-theme');
    if (btnToggle) {
        // Safe listener replacement
        const newBtn = btnToggle.cloneNode(true);
        btnToggle.parentNode.replaceChild(newBtn, btnToggle);
        newBtn.addEventListener('click', () => {
            if (document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.remove('dark'); localStorage.theme = 'light';
            } else {
                document.documentElement.classList.add('dark'); localStorage.theme = 'dark';
            }
        });
    }
}

// ===========================================
// 2. RENDERERS (Optimized with DocumentFragment)
// ===========================================

export function updateDashboardUI(totals) {
    document.getElementById('header-total-value').textContent = formatMoney(totals.totalValue);
    document.getElementById('total-invested').textContent = formatMoney(totals.totalInvested);
    const pnlEl = document.getElementById('total-pnl');
    pnlEl.textContent = formatMoney(totals.totalPnL);
    pnlEl.style.color = totals.totalPnL >= 0 ? '#2dd4bf' : '#f87171';
    const pnlPercentEl = document.getElementById('total-pnl-percent');
    pnlPercentEl.textContent = (totals.totalPnL >= 0 ? '+' : '') + totals.totalPnLPercent.toFixed(2) + '%';
    pnlPercentEl.className = `text-xs font-bold px-2 py-0.5 rounded ${totals.totalPnL >= 0 ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'}`;
}

export function renderCoinCards() {
    const container = document.getElementById('coin-cards-container');
    if (!container) return;
    container.innerHTML = '';
    const sortedHoldings = Object.entries(state.holdings).filter(([_, data]) => data.qty > 0).sort((a, b) => b[1].currentValue - a[1].currentValue);
    
    if (sortedHoldings.length === 0) {
        container.innerHTML = `<div class="text-center py-8"><i class="fa-solid fa-coins text-6xl text-gray-300 dark:text-gray-700 mb-4"></i><p class="text-gray-500 text-sm">No active holdings</p></div>`;
        return;
    }
    
    // 2. Performance Fix: DocumentFragment
    const fragment = document.createDocumentFragment();
    sortedHoldings.forEach(([sym, data]) => {
        const pnlClass = data.pnl >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
        const pnlSign = data.pnl >= 0 ? '+' : '';
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm';
        card.innerHTML = `<div class="space-y-4"><div><div class="flex justify-between"><p class="text-xs text-gray-500 uppercase font-bold mb-1">Balance</p><span class="text-xs font-bold bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">${sym}</span></div><h2 class="text-3xl font-bold text-gray-900 dark:text-white">${formatMoney(data.currentValue)}</h2><p class="text-sm text-gray-500 mt-1">${data.qty.toFixed(6)} ${sym}</p></div><div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-800"><div class="flex items-center gap-2"><span class="text-sm text-gray-500">Pelnas/Nuostolis</span></div><div class="text-right"><p class="${pnlClass} text-base font-bold">${pnlSign}${formatMoney(data.pnl)} (${pnlSign}${data.pnlPercent.toFixed(2)}%)</p></div></div><div class="flex justify-between items-center"><span class="text-sm text-gray-500">Vid. kaina</span><span class="text-base font-semibold text-gray-700 dark:text-gray-200">${formatPrice(data.avgPrice)}</span></div><div class="flex justify-between items-center"><span class="text-sm text-gray-500">Savikaina</span><span class="text-base font-semibold text-gray-700 dark:text-gray-200">${formatMoney(data.invested)}</span></div></div>`;
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

export function renderTransactionJournal() {
    const container = document.getElementById('journal-accordion');
    if (!container) return;
    container.innerHTML = '';
    if (state.transactions.length === 0) { container.innerHTML = `<div class="text-center py-8 text-sm text-gray-500">No transactions.</div>`; return; }
    
    const grouped = {};
    // state.transactions jau surikiuotas logic.js faile
    state.transactions.slice().reverse().forEach(tx => { const d = new Date(tx.date); if (isNaN(d.getTime())) return; const y = d.getFullYear(), m = d.getMonth(); if(!grouped[y]) grouped[y] = {}; if(!grouped[y][m]) grouped[y][m] = []; grouped[y][m].push(tx); });
    const monthsLT = ['Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis', 'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'];

    const fragment = document.createDocumentFragment();
    Object.keys(grouped).sort((a,b)=>b-a).forEach((year, yIdx) => {
        const yDiv = document.createElement('div'); yDiv.className = 'border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mb-3 bg-white dark:bg-gray-900 shadow-sm';
        const yHead = document.createElement('div'); yHead.className = 'px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition';
        yHead.innerHTML = `<div class="flex items-center gap-2"><i class="fa-solid fa-calendar text-primary-500"></i><span class="font-bold text-gray-800 dark:text-white">${year}</span></div><i class="fa-solid fa-chevron-down text-gray-400 transition-transform ${yIdx===0?'rotate-180':''}"></i>`;
        const mCont = document.createElement('div'); mCont.className = yIdx===0 ? 'block' : 'hidden';
        yHead.onclick = () => { mCont.classList.toggle('hidden'); yHead.querySelector('.fa-chevron-down').classList.toggle('rotate-180'); };
        
        Object.keys(grouped[year]).sort((a,b)=>b-a).forEach((month, mIdx) => {
            const txs = grouped[year][month]; // Jau surikiuota
            const mDiv = document.createElement('div'); mDiv.className = 'border-t border-gray-200 dark:border-gray-800';
            const mHead = document.createElement('div'); mHead.className = 'bg-gray-50 dark:bg-gray-800/50 px-6 py-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition';
            mHead.innerHTML = `<div class="flex items-center gap-2"><span class="text-sm font-semibold text-gray-700 dark:text-gray-300">${monthsLT[month]}</span><span class="text-xs text-gray-500">(${txs.length})</span></div><i class="fa-solid fa-chevron-down text-gray-500 text-xs transition-transform ${yIdx===0 && mIdx===0 ?'rotate-180':''}"></i>`;
            const txCont = document.createElement('div'); txCont.className = (yIdx===0 && mIdx===0) ? 'block' : 'hidden';
            mHead.onclick = () => { txCont.classList.toggle('hidden'); mHead.querySelector('.fa-chevron-down').classList.toggle('rotate-180'); };
            txs.forEach(tx => {
                const isBuy = ['Buy', 'Instant Buy'].includes(tx.type); const isSell = ['Sell', 'Withdraw'].includes(tx.type);
                const color = isBuy ? 'text-green-600 dark:text-green-500' : (isSell ? 'text-red-600 dark:text-red-500' : 'text-yellow-600 dark:text-yellow-500');
                const div = document.createElement('div'); div.className = 'px-6 py-3 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition flex items-start gap-3';
                div.innerHTML = `<div class="flex-1"><div class="flex justify-between items-start"><div><span class="font-bold text-sm ${color}">${tx.coin_symbol}</span><span class="text-xs text-gray-500 ml-2">${tx.type}</span><div class="text-[10px] text-gray-500 mt-0.5">${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div></div><div class="text-right"><div class="text-xs text-gray-600 dark:text-gray-300 font-mono">${isBuy?'+':isSell?'-':''}${Number(tx.amount).toFixed(4)}</div><div class="font-bold text-sm text-gray-800 dark:text-white mt-1">${formatMoney(tx.total_cost_usd)}</div></div></div><button onclick="window.onDeleteTx('${tx.id}')" class="text-[10px] text-red-400 hover:text-red-600 uppercase font-bold mt-2">Delete</button></div>`;
                txCont.appendChild(div);
            });
            mDiv.appendChild(mHead); mDiv.appendChild(txCont); mCont.appendChild(mDiv);
        });
        yDiv.appendChild(yHead); yDiv.appendChild(mCont); fragment.appendChild(yDiv);
    });
    container.appendChild(fragment);
}

export function renderAllocationChart() {
    const canvas = document.getElementById('allocationChart');
    if (!canvas) return;
    // 3. Chart Race Condition Fix
    if (allocationChart) { try { allocationChart.destroy(); } catch(e) { console.warn(e); } }
    
    const chartData = [], labels = [], colors = [];
    Object.entries(state.holdings).forEach(([sym, data]) => { if (data.qty > 0 && data.currentValue > 1) { chartData.push(data.currentValue); labels.push(sym); colors.push(CHART_COLORS[sym] || CHART_COLORS.default); } });
    
    const ctx = canvas.getContext('2d');
    const isDark = document.documentElement.classList.contains('dark');
    allocationChart = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: chartData, backgroundColor: colors, borderColor: isDark ? '#111827' : '#ffffff', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#9ca3af' : '#4b5563', font: { size: 11 }, usePointStyle: true } } } } });
}
