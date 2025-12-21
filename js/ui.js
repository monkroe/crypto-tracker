// js/ui.js - v3.0.0
// Features: PnL Chart, Goals Edit, Theme Handlers, UI Rendering

import { formatMoney, formatPrice } from './utils.js';
import { state } from './logic.js';

let allocationChart = null;
let pnlChart = null; // ✅ NEW: PnL Chart Instance

const CHART_COLORS = { 
    KAS: '#2dd4bf', BTC: '#f97316', ETH: '#3b82f6', SOL: '#8b5cf6', BNB: '#eab308', 
    PEPE: '#22c55e', USDT: '#26a17b', USDC: '#2775ca', default: '#6b7280'
};

export function setupThemeHandlers() {
    const btn = document.getElementById('btn-toggle-theme');
    if (btn) {
        btn.onclick = () => {
            const html = document.documentElement;
            html.classList.toggle('dark');
            localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
            
            // Re-render charts to update colors
            if(allocationChart) renderAllocationChart();
            if(pnlChart) renderPnLChart();
        };
    }
}

export function updateDashboardUI(totals) {
    document.getElementById('header-total-value').textContent = formatMoney(totals.totalValue);
    document.getElementById('total-invested').textContent = formatMoney(totals.totalInvested);
    
    const pnlEl = document.getElementById('total-pnl');
    pnlEl.textContent = formatMoney(totals.totalPnL);
    pnlEl.className = `text-2xl font-bold ${totals.totalPnL >= 0 ? 'text-primary-500' : 'text-red-500'}`;
    
    const pctEl = document.getElementById('total-pnl-percent');
    pctEl.textContent = (totals.totalPnL >= 0 ? '+' : '') + totals.totalPnLPercent.toFixed(2) + '%';
    pctEl.className = `text-xs font-bold px-2 py-0.5 rounded ${totals.totalPnL >= 0 ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`;
}

// ✅ FIX #13: Goals Rendering with Validation & Edit Button
export function renderGoals() {
    const container = document.getElementById('goals-container');
    if (!container) return;
    container.innerHTML = '';
    
    // Filter out goals for coins that no longer exist in supported coins
    const validGoals = state.goals.filter(goal => 
        state.coins.some(c => c.symbol === goal.coin_symbol)
    );
    
    if (validGoals.length === 0) { 
        document.getElementById('goals-section').classList.add('hidden'); 
        return; 
    }
    document.getElementById('goals-section').classList.remove('hidden');

    const fragment = document.createDocumentFragment();
    validGoals.forEach(goal => {
        const cur = state.holdings[goal.coin_symbol]?.qty || 0;
        const tgt = Number(goal.target_amount);
        const pct = tgt > 0 ? Math.min(100, (cur/tgt)*100) : 0;
        
        const div = document.createElement('div');
        div.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl shadow-sm mb-2';
        div.innerHTML = `
            <div class="flex justify-between items-center text-xs mb-1">
                <span class="font-bold text-gray-800 dark:text-gray-300">${goal.coin_symbol}</span>
                <div class="flex items-center gap-2">
                    <span class="text-primary-600 dark:text-primary-400 font-bold">${pct.toFixed(1)}%</span>
                    <button onclick="window.editGoal('${goal.id}')" class="text-gray-400 hover:text-yellow-500 transition-colors p-1">
                        <i class="fa-solid fa-pen text-[10px]"></i>
                    </button>
                </div>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div class="bg-primary-500 h-1.5 rounded-full transition-all duration-1000 ease-out" style="width:${pct}%"></div>
            </div>
            <div class="text-[9px] text-gray-500 mt-1 text-right font-mono">
                ${cur.toLocaleString(undefined, {maximumFractionDigits: 4})} / ${tgt.toLocaleString()}
            </div>`;
        fragment.appendChild(div);
    });
    container.appendChild(fragment);
}

export function renderCoinCards() {
    const container = document.getElementById('coin-cards-container');
    if (!container) return;
    container.innerHTML = '';
    
    const sorted = Object.entries(state.holdings)
        .filter(([_, d]) => d.qty > 0)
        .sort((a, b) => b[1].currentValue - a[1].currentValue);
    
    if (sorted.length === 0) { 
        container.innerHTML = `<div class="text-center py-8 text-gray-500">Nėra aktyvių pozicijų</div>`; 
        return; 
    }
    
    const fragment = document.createDocumentFragment();
    sorted.forEach(([sym, data]) => {
        const pnlClass = data.pnl >= 0 ? 'text-primary-500' : 'text-red-500';
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm mb-3';
        card.innerHTML = `
            <div class="flex justify-between mb-2">
                <span class="text-[10px] font-bold text-gray-400 uppercase">Balansas</span>
                <span class="text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">${sym}</span>
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-0.5">${formatMoney(data.currentValue)}</h2>
            <p class="text-xs text-gray-500 mb-4 font-mono">${data.qty.toLocaleString()} ${sym} @ ${formatMoney(data.currentPrice)}</p>
            <div class="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-3">
                <span class="text-xs text-gray-500">Pelnas/Nuostolis</span>
                <span class="${pnlClass} font-bold text-sm">${data.pnl >=0?'+':''}${formatMoney(data.pnl)} (${data.pnlPercent.toFixed(2)}%)</span>
            </div>`;
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

export function renderTransactionJournal() {
    const container = document.getElementById('journal-accordion');
    if (!container) return;
    container.innerHTML = '';
    
    const sortedTxs = state.transactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sortedTxs.length === 0) { 
        container.innerHTML = `<div class="text-center py-8 text-sm text-gray-500">Nėra transakcijų</div>`; 
        return; 
    }

    const grouped = {};
    sortedTxs.forEach(tx => { 
        const d = new Date(tx.date); 
        if(isNaN(d)) return; 
        const k = `${d.getFullYear()}-${d.getMonth()}`; 
        if(!grouped[k]) grouped[k]=[]; 
        grouped[k].push(tx); 
    });
    
    const monthsLT = ['Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis', 'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'];

    const fragment = document.createDocumentFragment();
    
    // Sort keys descending (newest month first)
    Object.keys(grouped).sort((a,b) => b.localeCompare(a)).forEach(key => {
        const [yr, mo] = key.split('-');
        const txs = grouped[key];
        
        const groupHeader = document.createElement('div');
        groupHeader.className = 'bg-gray-50 dark:bg-gray-800/50 px-4 py-2 text-[10px] font-bold text-gray-500 uppercase mt-4 mb-2 rounded-lg border border-gray-200 dark:border-gray-800 flex justify-between';
        groupHeader.innerHTML = `<span>${yr} ${monthsLT[parseInt(mo)]}</span> <span>${txs.length}</span>`;
        fragment.appendChild(groupHeader);

        txs.forEach(tx => {
            const isBuy = ['Buy', 'Instant Buy', 'Market Buy', 'Limit Buy', 'Recurring Buy'].includes(tx.type);
            const color = isBuy ? 'text-primary-500' : 'text-red-500';
            
            let pnlHTML = '';
            // Only calculate PnL for individual buys if we have current price
            /* Note: Individual Tx PnL is tricky without FIFO matching. 
               This simple version just compares buy price vs current price.
            */
            if (isBuy) {
                 const coin = state.coins.find(c => c.symbol === tx.coin_symbol);
                 if (coin && state.prices[coin.coingecko_id]) {
                     const currentVal = tx.amount * state.prices[coin.coingecko_id].usd;
                     const diff = currentVal - tx.total_cost_usd;
                     const pct = (diff / tx.total_cost_usd) * 100;
                     const cls = diff >= 0 ? 'text-primary-500' : 'text-red-500';
                     pnlHTML = `<div class="text-[9px] ${cls} font-mono mt-1">PnL: ${diff>=0?'+':''}$${diff.toFixed(2)} (${pct.toFixed(1)}%)</div>`;
                 }
            }

            let badges = '';
            if (tx.exchange) badges += `<span class="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">${tx.exchange}</span>`;

            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-2 shadow-sm flex justify-between items-start transition-colors hover:border-primary-500/30';
            
            card.innerHTML = `
                <div class="flex items-start gap-3">
                    <input type="checkbox" class="tx-checkbox form-checkbox h-4 w-4 mt-1 text-primary-500 rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:ring-0 cursor-pointer" 
                           data-tx-id="${tx.id}" 
                           onchange="window.updateDeleteSelectedButton()">
                    <div class="flex-1">
                        <div class="flex items-center flex-wrap">
                            <span class="font-bold text-sm ${color}">${tx.coin_symbol}</span>
                            <span class="text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded ml-2">${tx.type}</span>
                            ${badges}
                        </div>
                        <div class="text-[10px] text-gray-400 mt-1">${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        ${pnlHTML}
                    </div>
                </div>
                <div class="text-right flex flex-col items-end">
                    <div class="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">${isBuy?'+':'-'}${Number(tx.amount).toFixed(4)}</div>
                    <div class="font-bold text-sm text-gray-900 dark:text-white mt-0.5">${formatMoney(tx.total_cost_usd)}</div>
                    <div class="flex gap-2 mt-2 opacity-50 hover:opacity-100 transition-opacity">
                        <button onclick="window.onEditTx('${tx.id}')" class="text-gray-400 hover:text-yellow-500 transition-colors p-1"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button onclick="window.onDeleteTx('${tx.id}')" class="text-gray-400 hover:text-red-500 transition-colors p-1"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>
                </div>`;
            fragment.appendChild(card);
        });
    });
    container.appendChild(fragment);
}

export function renderAllocationChart() {
    const canvas = document.getElementById('allocationChart');
    if (!canvas) return;
    
    if (allocationChart) {
        allocationChart.destroy();
        allocationChart = null;
    }
    
    const chartData = [], labels = [], colors = [];
    Object.entries(state.holdings).forEach(([sym, data]) => { 
        if (data.qty > 0 && data.currentValue > 1) { 
            chartData.push(data.currentValue); 
            labels.push(sym); 
            colors.push(CHART_COLORS[sym] || CHART_COLORS.default); 
        } 
    });
    
    if (chartData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const isDark = document.documentElement.classList.contains('dark');
    
    allocationChart = new Chart(ctx, { 
        type: 'doughnut', 
        data: { 
            labels: labels, 
            datasets: [{ 
                data: chartData, 
                backgroundColor: colors, 
                borderColor: isDark ? '#111827' : '#ffffff', 
                borderWidth: 2,
                hoverOffset: 4
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        color: isDark ? '#9ca3af' : '#4b5563', 
                        font: { size: 10, family: 'sans-serif' }, 
                        usePointStyle: true,
                        padding: 15
                    } 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) { label += ': '; }
                            label += formatMoney(context.raw);
                            return label;
                        }
                    }
                }
            } 
        } 
    });
}

// ✅ FIX #12: Added PnL Chart Function
export function renderPnLChart(timeframe = 'ALL') {
    const canvas = document.getElementById('pnlChart');
    if (!canvas) return;
    
    if (pnlChart) {
        pnlChart.destroy();
        pnlChart = null;
    }
    
    // Calculate cumulative PnL over time
    const sortedTxs = state.transactions.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sortedTxs.length === 0) return;

    const dataPoints = [];
    const labels = [];
    let cumulativeInvested = 0;
    
    /* NOTE: Accurate historical PnL requires historical price data which we don't have.
       This is a simplified approximation based on realized gains + current holdings value.
       Ideally, you'd fetch historical portfolio value snapshots.
    */

    // Simplified Visualization: Cumulative Invested vs Time (as a placeholder for real PnL history)
    // Or we can show just the Cost Basis evolution
    sortedTxs.forEach(tx => {
        const isBuy = ['Buy', 'Instant Buy'].includes(tx.type);
        if(isBuy) cumulativeInvested += Number(tx.total_cost_usd);
        else cumulativeInvested -= Number(tx.total_cost_usd); // Simplified sell logic
        
        dataPoints.push(cumulativeInvested);
        labels.push(new Date(tx.date).toLocaleDateString());
    });
    
    const ctx = canvas.getContext('2d');
    const isDark = document.documentElement.classList.contains('dark');
    const isPositive = dataPoints[dataPoints.length - 1] >= 0;
    const color = isPositive ? '#2dd4bf' : '#ef4444'; // Primary vs Red

    pnlChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Invested Capital',
                data: dataPoints,
                borderColor: color,
                backgroundColor: isPositive ? 'rgba(45, 212, 191, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                    titleColor: isDark ? '#f9fafb' : '#111827',
                    bodyColor: isDark ? '#f9fafb' : '#111827',
                    borderColor: isDark ? '#374151' : '#e5e7eb',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return 'Invested: ' + formatMoney(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}
