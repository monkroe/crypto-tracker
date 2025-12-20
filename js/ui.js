// js/ui.js - v3.3.0
import { formatMoney, formatPrice } from './utils.js';
import { state } from './logic.js';

let allocationChart = null;
const CHART_COLORS = { 
    KAS: '#2dd4bf', BTC: '#f97316', ETH: '#3b82f6', SOL: '#8b5cf6', BNB: '#eab308', 
    PEPE: '#22c55e', USDT: '#26a17b', USDC: '#2775ca', default: '#6b7280'
};

export function setupThemeHandlers() {
    const btn = document.getElementById('btn-toggle-theme');
    // FIX: Tiesioginis priskyrimas be cloneNode
    if (btn) {
        btn.onclick = () => {
            const html = document.documentElement;
            html.classList.toggle('dark');
            localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
        };
    }
}

export function updateDashboardUI(totals) {
    document.getElementById('header-total-value').textContent = formatMoney(totals.totalValue);
    document.getElementById('total-invested').textContent = formatMoney(totals.totalInvested);
    const pnlEl = document.getElementById('total-pnl');
    pnlEl.textContent = formatMoney(totals.totalPnL);
    pnlEl.className = `text-2xl font-bold ${totals.totalPnL >= 0 ? 'text-primary-400' : 'text-red-500'}`;
    const pctEl = document.getElementById('total-pnl-percent');
    pctEl.textContent = (totals.totalPnL >= 0 ? '+' : '') + totals.totalPnLPercent.toFixed(2) + '%';
    pctEl.className = `text-xs font-bold px-2 py-0.5 rounded ${totals.totalPnL >= 0 ? 'bg-primary-900/30 text-primary-400' : 'bg-red-900/30 text-red-400'}`;
}

export function renderGoals() {
    const container = document.getElementById('goals-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (state.goals.length === 0) { 
        document.getElementById('goals-section').classList.add('hidden'); 
        return; 
    }
    document.getElementById('goals-section').classList.remove('hidden');

    const fragment = document.createDocumentFragment();
    state.goals.forEach(goal => {
        const cur = state.holdings[goal.coin_symbol]?.qty || 0;
        const tgt = Number(goal.target_amount);
        const pct = Math.min(100, (cur/tgt)*100);
        
        const div = document.createElement('div');
        div.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl shadow-sm mb-2';
        div.innerHTML = `
            <div class="flex justify-between text-xs mb-1"><span class="font-bold text-gray-800 dark:text-gray-300">${goal.coin_symbol}</span><span class="text-primary-600 dark:text-primary-400 font-bold">${pct.toFixed(1)}%</span></div>
            <div class="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5"><div class="bg-primary-500 h-1.5 rounded-full" style="width:${pct}%"></div></div>
            <div class="text-[9px] text-gray-500 mt-1 text-right font-mono">${cur.toLocaleString(undefined, {maximumFractionDigits: 0})} / ${tgt.toLocaleString()}</div>`;
        fragment.appendChild(div);
    });
    container.appendChild(fragment);
}

export function renderCoinCards() {
    const container = document.getElementById('coin-cards-container');
    if (!container) return;
    container.innerHTML = '';
    const sorted = Object.entries(state.holdings).filter(([_, d]) => d.qty > 0).sort((a, b) => b[1].currentValue - a[1].currentValue);
    
    if (sorted.length === 0) { container.innerHTML = `<div class="text-center py-8 text-gray-500">No active holdings</div>`; return; }
    
    const fragment = document.createDocumentFragment();
    sorted.forEach(([sym, data]) => {
        const pnlClass = data.pnl >= 0 ? 'text-green-500' : 'text-red-500';
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm mb-3';
        card.innerHTML = `
            <div class="flex justify-between mb-2"><span class="text-xs font-bold text-gray-500">BALANCE</span><span class="text-xs font-bold bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">${sym}</span></div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white">${formatMoney(data.currentValue)}</h2>
            <p class="text-sm text-gray-500 mb-4">${data.qty.toFixed(4)} ${sym}</p>
            <div class="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-3">
                <span class="text-sm text-gray-500">PnL</span><span class="${pnlClass} font-bold">${data.pnl >=0?'+':''}${formatMoney(data.pnl)} (${data.pnlPercent.toFixed(2)}%)</span>
            </div>`;
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

export function renderTransactionJournal() {
    const container = document.getElementById('journal-accordion');
    if (!container) return;
    container.innerHTML = '';
    
    const sortedTxs = state.transactions.slice().reverse();
    if (sortedTxs.length === 0) { container.innerHTML = `<div class="text-center py-8 text-sm text-gray-500">No transactions</div>`; return; }

    const grouped = {};
    sortedTxs.forEach(tx => { const d = new Date(tx.date); if(isNaN(d)) return; const k = `${d.getFullYear()}-${d.getMonth()}`; if(!grouped[k]) grouped[k]=[]; grouped[k].push(tx); });
    const monthsLT = ['Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis', 'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'];

    const fragment = document.createDocumentFragment();
    Object.keys(grouped).forEach(key => {
        const [yr, mo] = key.split('-');
        const txs = grouped[key];
        
        const groupHeader = document.createElement('div');
        groupHeader.className = 'bg-gray-50 dark:bg-gray-800/50 px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-4 mb-2 rounded-lg border border-gray-100 dark:border-gray-800';
        groupHeader.textContent = `${yr} ${monthsLT[parseInt(mo)]} (${txs.length})`;
        fragment.appendChild(groupHeader);

        txs.forEach(tx => {
            const isBuy = ['Buy', 'Instant Buy'].includes(tx.type);
            const color = isBuy ? 'text-green-500' : 'text-red-500';
            
            let pnlHTML = '';
            const coin = state.coins.find(c => c.symbol === tx.coin_symbol);
            if (isBuy && coin && state.prices[coin.coingecko_id]) {
                const curVal = tx.amount * state.prices[coin.coingecko_id].usd;
                const pnlVal = curVal - tx.total_cost_usd;
                const pnlPct = (pnlVal / tx.total_cost_usd) * 100;
                const pnlCls = pnlVal >= 0 ? 'text-green-500' : 'text-red-500';
                pnlHTML = `<div class="text-[10px] ${pnlCls} font-mono font-bold mt-1">PnL: ${pnlVal>=0?'+':''}$${pnlVal.toFixed(2)} (${pnlVal>=0?'+':''}${pnlPct.toFixed(2)}%)</div>`;
            }

            let badges = '';
            if (tx.exchange) badges += `<span class="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">${tx.exchange}</span>`;
            if (tx.method && tx.method !== 'Market Buy') badges += `<span class="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">${tx.method}</span>`;

            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-2 shadow-sm flex justify-between items-start';
            // FIX: Mygtukai šalia ir be teksto, su window.onEditTx
            card.innerHTML = `
                <div class="flex-1">
                    <div class="flex items-center flex-wrap">
                        <span class="font-bold text-sm ${color}">${tx.coin_symbol}</span>
                        <span class="text-xs text-gray-500 ml-2 font-bold">${tx.type}</span>
                        ${badges}
                    </div>
                    <div class="text-[10px] text-gray-400 mt-1">${new Date(tx.date).toLocaleString()}</div>
                    ${pnlHTML}
                </div>
                <div class="text-right flex flex-col items-end">
                    <div class="text-xs font-mono font-bold text-gray-300">${isBuy?'+':'-'}${Number(tx.amount).toFixed(4)}</div>
                    <div class="font-bold text-sm text-white mt-0.5">${formatMoney(tx.total_cost_usd)}</div>
                    <div class="flex gap-3 mt-3">
                        <button onclick="window.onEditTx('${tx.id}')" class="text-gray-500 hover:text-yellow-500 transition-colors p-1"><i class="fa-solid fa-pen text-sm"></i></button>
                        <button onclick="window.onDeleteTx('${tx.id}')" class="text-gray-500 hover:text-red-500 transition-colors p-1"><i class="fa-solid fa-trash text-sm"></i></button>
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
    
    // FIX: Saugus naikinimas
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
        data: { labels: labels, datasets: [{ data: chartData, backgroundColor: colors, borderColor: isDark ? '#111827' : '#ffffff', borderWidth: 2 }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#9ca3af' : '#4b5563', font: { size: 11 }, usePointStyle: true } } } } 
    });
}
