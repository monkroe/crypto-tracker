// js/ui.js - v3.9.7 (Fix Badges + Fees Display)

import { formatMoney } from './utils.js';
import { state } from './logic.js';

let allocationChart = null;
let pnlChart = null;
const celebratedGoals = new Set();
const CHART_COLORS = { KAS: '#2dd4bf', ASTER: '#fbc527', BTC: '#f97316', ETH: '#3b82f6', SOL: '#8b5cf6', BNB: '#eab308', PEPE: '#097a22', USDT: '#26a17b', USDC: '#2775ca', default: '#6b7280' };

export function setupThemeHandlers() {
    const btn = document.getElementById('btn-toggle-theme');
    if (btn) {
        btn.onclick = () => {
            const html = document.documentElement;
            html.classList.toggle('dark');
            localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
            if(allocationChart) renderAllocationChart();
            if(pnlChart) renderPnLChart(document.getElementById('tf-indicator')?.textContent || 'ALL');
        };
    }
}

export function updateDashboardUI(totals) {
    document.getElementById('header-total-value').textContent = formatMoney(totals.totalValue);
    const setStat = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            const sign = val >= 0 ? '↗' : '↘';
            el.innerHTML = `${sign} ${formatMoney(Math.abs(val))}`;
            el.className = `text-xs sm:text-sm font-bold truncate ${val >= 0 ? 'text-primary-500' : 'text-red-500'}`;
        }
    };
    setStat('header-24h-change', totals.change24hUsd);
    setStat('header-30d-change', totals.change30dUsd);
    setStat('header-total-pnl', totals.totalPnL);
}

export function renderGoals() {
    const container = document.getElementById('goals-container');
    if (!container) return;
    container.innerHTML = '';
    const goalsWithProgress = state.goals.filter(goal => state.coins.some(c => c.symbol === goal.coin_symbol)).map(goal => {
        const cur = state.holdings[goal.coin_symbol]?.qty || 0;
        const tgt = Number(goal.target_amount);
        const pct = tgt > 0 ? (cur / tgt) * 100 : 0;
        return { ...goal, cur, tgt, pct };
    }).sort((a, b) => b.pct - a.pct);

    if (goalsWithProgress.length === 0) { document.getElementById('goals-section').classList.add('hidden'); return; }
    document.getElementById('goals-section').classList.remove('hidden');

    const fragment = document.createDocumentFragment();
    goalsWithProgress.forEach(goal => {
        const displayPct = Math.min(100, goal.pct);
        if (goal.pct >= 100 && !celebratedGoals.has(goal.coin_symbol)) { celebratedGoals.add(goal.coin_symbol); }
        const div = document.createElement('div');
        div.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl shadow-sm mb-2';
        div.innerHTML = `<div class="flex justify-between items-center text-xs mb-1"><span class="font-bold text-gray-800 dark:text-gray-300">${goal.coin_symbol}</span><div class="flex items-center gap-2"><span class="text-primary-600 dark:text-primary-400 font-bold">${goal.pct.toFixed(1)}%</span><button onclick="window.editGoal('${goal.id}')" class="text-gray-400 hover:text-yellow-500 p-1"><i class="fa-solid fa-pen text-[10px]"></i></button></div></div><div class="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden"><div class="bg-primary-500 h-1.5 rounded-full" style="width:${displayPct}%"></div></div><div class="text-[9px] text-gray-500 mt-1 text-right font-mono">${goal.cur.toLocaleString()} / ${goal.tgt.toLocaleString()}</div>`;
        fragment.appendChild(div);
    });
    container.appendChild(fragment);
}

export function renderCoinCards() {
    const container = document.getElementById('coin-cards-container');
    if (!container) return;
    container.innerHTML = '';
    const sorted = Object.entries(state.holdings).filter(([_, d]) => d.qty > 0).sort((a, b) => b[1].currentValue - a[1].currentValue);
    if (sorted.length === 0) { container.innerHTML = `<div class="text-center py-8 text-gray-500">Nėra aktyvių pozicijų</div>`; return; }
    const fragment = document.createDocumentFragment();
    sorted.forEach(([sym, data]) => {
        const pnlClass = data.pnl >= 0 ? 'text-primary-500' : 'text-red-500';
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm mb-3';
        card.innerHTML = `<div class="flex justify-between mb-2"><span class="text-[10px] font-bold text-gray-400 uppercase">Balansas</span><span class="text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">${sym}</span></div><h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-0.5">${formatMoney(data.currentValue)}</h2><p class="text-xs text-gray-500 mb-4 font-mono">${data.qty.toLocaleString()} ${sym} @ ${formatMoney(data.currentPrice)}</p><div class="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-3"><span class="text-xs text-gray-500">Pelnas/Nuostolis</span><span class="${pnlClass} font-bold text-sm">${data.pnl >=0?'+':''}${formatMoney(data.pnl)} (${data.pnlPercent.toFixed(2)}%)</span></div>`;
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

export function renderTransactionJournal() {
    const container = document.getElementById('journal-accordion');
    if (!container) return;
    container.innerHTML = '';
    const sortedTxs = state.transactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sortedTxs.length === 0) { container.innerHTML = `<div class="text-center py-8 text-sm text-gray-500">Nėra transakcijų</div>`; return; }
    
    // Grouping Logic
    const grouped = {};
    sortedTxs.forEach(tx => { 
        const d = new Date(tx.date); 
        if(isNaN(d)) return; 
        const year = d.getFullYear(); const month = d.getMonth(); 
        if (!grouped[year]) grouped[year] = {}; 
        if (!grouped[year][month]) grouped[year][month] = []; 
        grouped[year][month].push(tx); 
    });
    
    const monthsLT = ['Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis', 'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'];
    const fragment = document.createDocumentFragment();
    
    Object.keys(grouped).sort((a, b) => b - a).forEach((year, yIndex) => {
        const yearData = grouped[year]; 
        const yearId = `year-${year}`; 
        const isYearOpen = yIndex === 0;
        
        const yearHeader = document.createElement('div'); 
        yearHeader.className = 'bg-gray-100 dark:bg-gray-800 px-4 py-3 flex justify-between items-center cursor-pointer mb-1 rounded'; 
        yearHeader.innerHTML = `<span class="font-bold text-gray-800 dark:text-gray-200 text-sm">${year}</span><i class="fa-solid fa-chevron-down" id="icon-${yearId}"></i>`;
        
        const yearContent = document.createElement('div'); 
        yearContent.id = yearId; 
        yearContent.className = isYearOpen ? '' : 'hidden';
        
        yearHeader.onclick = () => { yearContent.classList.toggle('hidden'); };
        
        Object.keys(yearData).sort((a, b) => parseInt(b) - parseInt(a)).forEach((monthIndex) => {
            const txs = yearData[monthIndex];
            const monthHeader = document.createElement('div'); 
            monthHeader.className = 'px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-2'; 
            monthHeader.textContent = monthsLT[parseInt(monthIndex)];
            yearContent.appendChild(monthHeader);
            
            txs.forEach(tx => yearContent.appendChild(createTransactionCard(tx)));
        });
        
        fragment.appendChild(yearHeader); 
        fragment.appendChild(yearContent);
    });
    container.appendChild(fragment);
}

function createTransactionCard(tx) {
    const isBuy = ['Buy', 'Instant Buy', 'Market Buy', 'Limit Buy', 'Recurring Buy'].includes(tx.type);
    const color = isBuy ? 'text-primary-500' : 'text-red-500';
    
    // Badges
    let badgesHTML = '';
    // Exchange Badge
    if (tx.exchange) badgesHTML += `<span class="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">${tx.exchange}</span>`;
    // Fees Badge
    if (Number(tx.fees) > 0) badgesHTML += `<span class="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-red-50 dark:bg-red-900/20 text-red-500 border border-red-100 dark:border-red-900/30">Fee: $${Number(tx.fees).toFixed(2)}</span>`;
    // Method Badge (Jei ne Market Buy)
    if (tx.method && tx.method !== 'Market Buy') badgesHTML += `<span class="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">${tx.method}</span>`;

    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm flex justify-between items-start mb-2';
    
    card.innerHTML = `
        <div class="flex-1">
            <div class="flex items-center flex-wrap">
                <span class="font-bold text-sm ${color}">${tx.coin_symbol}</span>
                <span class="text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded ml-2">${tx.type}</span>
                ${badgesHTML}
            </div>
            <div class="text-[10px] text-gray-400 mt-1">${new Date(tx.date).toLocaleDateString()}</div>
        </div>
        <div class="text-right">
            <div class="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">${isBuy?'+':'-'}${Number(tx.amount).toFixed(4)}</div>
            <div class="font-bold text-sm text-gray-900 dark:text-white mt-0.5">${formatMoney(tx.total_cost_usd)}</div>
            <div class="flex gap-2 mt-2 justify-end opacity-50">
                <button onclick="window.onEditTx('${tx.id}')"><i class="fa-solid fa-pen text-xs text-gray-400"></i></button>
                <button onclick="window.onDeleteTx('${tx.id}')"><i class="fa-solid fa-trash text-xs text-gray-400"></i></button>
            </div>
        </div>`;
    return card;
}

export function renderAllocationChart() { const canvas = document.getElementById('allocationChart'); if (!canvas) return; if (allocationChart) { allocationChart.destroy(); allocationChart = null; } const chartData = [], labels = [], colors = []; Object.entries(state.holdings).forEach(([sym, data]) => { if (data.qty > 0 && data.currentValue > 1) { chartData.push(data.currentValue); labels.push(sym); colors.push(CHART_COLORS[sym] || CHART_COLORS.default); } }); if (chartData.length === 0) return; const ctx = canvas.getContext('2d'); const isDark = document.documentElement.classList.contains('dark'); allocationChart = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: chartData, backgroundColor: colors, borderColor: isDark ? '#111827' : '#ffffff', borderWidth: 2, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#9ca3af' : '#4b5563', font: { size: 10, family: 'sans-serif' }, usePointStyle: true, padding: 15 } }, tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } label += formatMoney(context.raw); return label; } } } } } }); }
export function renderPnLChart(timeframe = 'ALL') { const canvas = document.getElementById('pnlChart'); if (!canvas) return; if (pnlChart) { pnlChart.destroy(); pnlChart = null; } const now = new Date(); const cutoff = new Date(); if (timeframe === '24H') cutoff.setHours(now.getHours() - 24); else if (timeframe === '1W') cutoff.setDate(now.getDate() - 7); else if (timeframe === '1M') cutoff.setMonth(now.getMonth() - 1); else if (timeframe === '3M') cutoff.setMonth(now.getMonth() - 3); else if (timeframe === '6M') cutoff.setMonth(now.getMonth() - 6); else if (timeframe === '1Y') cutoff.setFullYear(now.getFullYear() - 1); else if (timeframe === '5Y') cutoff.setFullYear(now.getFullYear() - 5); else if (timeframe === 'ALL') cutoff.setFullYear(2000); let cumulativeInvested = 0; const allTxs = state.transactions.sort((a, b) => new Date(a.date) - new Date(b.date)); const pastTxs = allTxs.filter(tx => new Date(tx.date) < cutoff); pastTxs.forEach(tx => { const isBuy = ['Buy', 'Instant Buy', 'Market Buy', 'Limit Buy', 'Recurring Buy'].includes(tx.type); if(isBuy) cumulativeInvested += Number(tx.total_cost_usd); else cumulativeInvested -= Number(tx.total_cost_usd); }); const points = [{ date: cutoff, val: cumulativeInvested }]; const relevantTxs = allTxs.filter(tx => new Date(tx.date) >= cutoff); relevantTxs.forEach(tx => { const isBuy = ['Buy', 'Instant Buy'].includes(tx.type); if(isBuy) cumulativeInvested += Number(tx.total_cost_usd); else cumulativeInvested -= Number(tx.total_cost_usd); points.push({ date: new Date(tx.date), val: cumulativeInvested }); }); points.push({ date: now, val: cumulativeInvested }); const labels = points.map(p => { if (timeframe === '24H') return p.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); if (timeframe === '1W') return p.date.toLocaleDateString('lt-LT', {weekday: 'short'}); return p.date.toLocaleDateString('lt-LT', {month: 'numeric', day: 'numeric'}); }); const dataPoints = points.map(p => p.val); const ctx = canvas.getContext('2d'); const isDark = document.documentElement.classList.contains('dark'); const isPositive = dataPoints[dataPoints.length - 1] >= 0; const color = isPositive ? '#2dd4bf' : '#ef4444'; pnlChart = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Investuota', data: dataPoints, borderColor: color, backgroundColor: isPositive ? 'rgba(45, 212, 191, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderWidth: 2, tension: 0.1, fill: true, pointRadius: (ctx) => { return points.length < 30 ? 3 : 0; }, pointHoverRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: isDark ? '#1f2937' : '#ffffff', titleColor: isDark ? '#f9fafb' : '#111827', bodyColor: isDark ? '#f9fafb' : '#111827', borderColor: isDark ? '#374151' : '#e5e7eb', borderWidth: 1, callbacks: { label: function(context) { return 'Investuota: ' + formatMoney(context.raw); } } } }, scales: { x: { display: true, grid: { display: false }, ticks: { color: isDark ? '#6b7280' : '#9ca3af', font: { size: 9 }, maxTicksLimit: timeframe === '24H' ? 6 : 7, maxRotation: 0, autoSkip: true } }, y: { display: true, position: 'right', grid: { color: isDark ? '#374151' : '#f3f4f6', drawBorder: false }, ticks: { color: isDark ? '#6b7280' : '#9ca3af', font: { size: 9 }, callback: function(value) { return '$' + value.toLocaleString(undefined, {notation: "compact"}); } } } }, interaction: { mode: 'nearest', axis: 'x', intersect: false } } }); }
