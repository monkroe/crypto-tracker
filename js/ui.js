// js/ui.js - v4.2.0
// Features: Clean Badges, Clickable Rows (Open Detail), Buttons Edit/Delete

import { formatMoney } from './utils.js';
import { state } from './logic.js';

let allocationChart = null;
let pnlChart = null;
const celebratedGoals = new Set();

const CHART_COLORS = { 
    KAS: '#2dd4bf', ASTER: '#eec25e', BTC: '#f89907', ETH: '#3b82f6', 
    SOL: '#8b5cf6', BNB: '#eab308', PEPE: '#097a22', USDT: '#26a17b', 
    USDC: '#2775ca', MON: '#6f32e4', default: '#6b7280'
};

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
    const headerValue = document.getElementById('header-total-value');
    if(headerValue) headerValue.textContent = formatMoney(totals.totalValue);
    
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
    
    const goalsWithProgress = state.goals
        .filter(goal => state.coins.some(c => c.symbol === goal.coin_symbol))
        .map(goal => {
            const cur = state.holdings[goal.coin_symbol]?.qty || 0;
            const tgt = Number(goal.target_amount);
            const pct = tgt > 0 ? (cur / tgt) * 100 : 0;
            return { ...goal, cur, tgt, pct };
        })
        .sort((a, b) => b.pct - a.pct);

    if (goalsWithProgress.length === 0) { 
        document.getElementById('goals-section').classList.add('hidden'); 
        return; 
    }
    document.getElementById('goals-section').classList.remove('hidden');

    const fragment = document.createDocumentFragment();
    goalsWithProgress.forEach(goal => {
        const displayPct = Math.min(100, goal.pct);
        
        if (goal.pct >= 100 && !celebratedGoals.has(goal.coin_symbol)) {
            triggerCelebration(goal.coin_symbol);
            celebratedGoals.add(goal.coin_symbol);
        }
        
        const div = document.createElement('div');
        div.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl shadow-sm mb-2';
        div.innerHTML = `
            <div class="flex justify-between items-center text-xs mb-1">
                <span class="font-bold text-gray-800 dark:text-gray-300">${goal.coin_symbol}</span>
                <div class="flex items-center gap-2">
                    <span class="text-primary-600 dark:text-primary-400 font-bold">${goal.pct.toFixed(1)}%</span>
                    <button onclick="window.editGoal('${goal.id}')" class="text-gray-400 hover:text-yellow-500 transition-colors p-1">
                        <i class="fa-solid fa-pen text-[10px]"></i>
                    </button>
                </div>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div class="bg-primary-500 h-1.5 rounded-full transition-all duration-1000 ease-out" style="width:${displayPct}%"></div>
            </div>
            <div class="text-[9px] text-gray-500 mt-1 text-right font-mono">
                ${goal.cur.toLocaleString(undefined, {maximumFractionDigits: 4})} / ${goal.tgt.toLocaleString()}
            </div>`;
        fragment.appendChild(div);
    });
    container.appendChild(fragment);
}

function triggerCelebration(symbol) {
    const modal = document.getElementById('celebration-modal');
    const coinSpan = document.getElementById('celebration-coin');
    
    if (modal && coinSpan) {
        coinSpan.textContent = symbol;
        modal.classList.remove('hidden');
        if (typeof window.confetti === 'function') {
            const duration = 3000;
            const end = Date.now() + duration;
            (function frame() {
                window.confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#2dd4bf', '#fbbf24', '#f87171'] });
                window.confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#2dd4bf', '#fbbf24', '#f87171'] });
                if (Date.now() < end) requestAnimationFrame(frame);
            }());
        }
    }
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
        
        // CLICK LOGIKA: Paspaudus kortelę atidaromas modalas
        card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm mb-3 cursor-pointer hover:border-primary-500 hover:shadow-lg transition-all';
        card.onclick = () => window.openCoinDetail(sym);
        
        card.innerHTML = `
            <div class="flex justify-between mb-2">
                <span class="text-[10px] font-bold text-gray-400 uppercase">Balansas</span>
                <span class="text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded hover:bg-primary-500 hover:text-white transition-colors">${sym}</span>
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
        
        const year = d.getFullYear();
        const month = d.getMonth(); 
        
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

        const allYearTxs = Object.values(yearData).flat();
        const yearStats = calculateGroupStats(allYearTxs);
        const yearStatsHTML = yearStats.totalVal > 0 
            ? `<span class="${yearStats.pnl >= 0 ? 'text-primary-500' : 'text-red-500'} font-bold text-xs ml-2">
                ${yearStats.pnl >= 0 ? '+' : ''}${formatMoney(yearStats.pnl)} (${yearStats.pct.toFixed(1)}%)
               </span>` 
            : '';

        const yearWrapper = document.createElement('div');
        yearWrapper.className = 'mb-4 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden';

        const yearHeader = document.createElement('div');
        yearHeader.className = 'bg-gray-100 dark:bg-gray-800 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors';
        yearHeader.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-calendar-days text-primary-500"></i>
                <div class="flex items-baseline">
                    <span class="font-bold text-gray-800 dark:text-gray-200 text-sm">${year}</span>
                    ${yearStatsHTML}
                </div>
            </div>
            <i class="fa-solid fa-chevron-down transition-transform duration-300 text-gray-500 ${isYearOpen ? '' : '-rotate-90'}" id="icon-${yearId}"></i>
        `;

        const yearContent = document.createElement('div');
        yearContent.id = yearId;
        yearContent.className = `bg-white dark:bg-gray-900/50 p-2 space-y-2 ${isYearOpen ? '' : 'hidden'}`;

        yearHeader.onclick = () => {
            yearContent.classList.toggle('hidden');
            const icon = document.getElementById(`icon-${yearId}`);
            icon.style.transform = yearContent.classList.contains('hidden') ? 'rotate(-90deg)' : 'rotate(0deg)';
        };

        yearWrapper.appendChild(yearHeader);

        const sortedMonths = Object.keys(yearData).sort((a, b) => parseInt(b) - parseInt(a));
        
        sortedMonths.forEach((monthIndex, mIndex) => {
            const txs = yearData[monthIndex];
            const monthId = `month-${year}-${monthIndex}`;
            const isMonthOpen = mIndex === 0;

            const stats = calculateGroupStats(txs);
            const statsHTML = stats.totalVal > 0 
                ? `<span class="${stats.pnl >= 0 ? 'text-primary-500' : 'text-red-500'} font-mono ml-2">
                    ${stats.pnl >= 0 ? '+' : ''}${formatMoney(stats.pnl)} (${stats.pct.toFixed(1)}%)
                   </span>` 
                : '';

            const monthWrapper = document.createElement('div');
            
            const monthHeader = document.createElement('div');
            monthHeader.className = 'flex justify-between items-center px-2 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded mb-1 select-none group';
            monthHeader.innerHTML = `
                <div class="flex items-center gap-2 w-full">
                    <div class="w-1 h-3 bg-primary-500 rounded-full"></div>
                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-primary-500 transition-colors">
                        ${monthsLT[parseInt(monthIndex)]} (${txs.length})
                    </span>
                    <div class="ml-auto text-[10px] font-bold flex items-center gap-2">
                        ${statsHTML}
                        <i class="fa-solid fa-chevron-down text-gray-400 transition-transform duration-300 ${isMonthOpen ? '' : '-rotate-90'}" id="icon-${monthId}"></i>
                    </div>
                </div>
            `;

            const monthContent = document.createElement('div');
            monthContent.id = monthId;
            monthContent.className = `space-y-2 pl-2 ${isMonthOpen ? '' : 'hidden'}`;

            monthHeader.onclick = () => {
                monthContent.classList.toggle('hidden');
                const icon = document.getElementById(`icon-${monthId}`);
                icon.style.transform = monthContent.classList.contains('hidden') ? 'rotate(-90deg)' : 'rotate(0deg)';
            };

            monthWrapper.appendChild(monthHeader);

            txs.forEach(tx => {
                monthContent.appendChild(createTransactionCard(tx));
            });

            monthWrapper.appendChild(monthContent);
            yearContent.appendChild(monthWrapper);
        });

        yearWrapper.appendChild(yearContent);
        container.appendChild(yearWrapper);
    });
}

function calculateGroupStats(txs) {
    let totalCost = 0;
    let totalVal = 0;

    txs.forEach(tx => {
        const isBuy = ['Buy', 'Instant Buy', 'Market Buy', 'Limit Buy', 'Recurring Buy'].includes(tx.type);
        if (isBuy) {
            const coin = state.coins.find(c => c.symbol === tx.coin_symbol);
            if (coin && state.prices[coin.coingecko_id]) {
                const price = state.prices[coin.coingecko_id].usd;
                totalCost += Number(tx.total_cost_usd);
                totalVal += Number(tx.amount) * price;
            }
        }
    });

    const pnl = totalVal - totalCost;
    const pct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
    
    return { pnl, pct, totalVal };
}

// ✅ ATNAUJINTA: Išvalyti Badges, Eilutė atidaro Modalą
function createTransactionCard(tx) {
    const isBuy = ['Buy', 'Instant Buy', 'Market Buy', 'Limit Buy', 'Recurring Buy'].includes(tx.type);
    const color = isBuy ? 'text-primary-500' : 'text-red-500';
    
    let pnlHTML = '';
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

    let badgesHTML = '';
    
    // 1. Biržos ženklelis
    if (tx.exchange) {
        badgesHTML += `<span class="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">${tx.exchange}</span>`;
    }

    // 2. Metodo valymas (Trumpi tekstai)
    let methodDisplay = tx.method || '';
    
    methodDisplay = methodDisplay
        .replace('Transfer to ', '')        // "Transfer to Hot Wallet" -> "Hot Wallet"
        .replace('Transfer from ', 'From ') // "Transfer from Exchange" -> "From Exchange"
        .replace(' (Card)', '')             // Panaikinti (Card)
        .replace(' (DCA)', '');             // Panaikinti (DCA)
        
    if (methodDisplay === 'Staking Reward') methodDisplay = 'Reward';
    if (methodDisplay === 'Market Buy') methodDisplay = ''; // Default, nerodome

    if (methodDisplay) {
        badgesHTML += `<span class="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">${methodDisplay}</span>`;
    }
    
    // 3. Mokesčio ženklelis
    if (tx.fee_usd && Number(tx.fee_usd) > 0) {
        badgesHTML += `<span class="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/30">Fee: $${Number(tx.fee_usd).toFixed(2)}</span>`;
    }

    let notesHTML = '';
    if (tx.notes && tx.notes.trim() !== '') {
        notesHTML = `<div class="text-[9px] text-gray-400 italic mt-1.5 pl-2 border-l-2 border-gray-200 dark:border-gray-700 line-clamp-2">${tx.notes}</div>`;
    }

    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm flex justify-between items-start transition-all hover:border-primary-500/50 cursor-pointer';
    
    // ✅ CLICK LOGIKA: 
    // Jei paspaudžia ant checkbox arba mygtukų - veikia jie.
    // Jei paspaudžia bet kur kitur eilutėje - atidaro "Detali Peržiūra" (Modalą).
    card.onclick = (e) => {
        if (!e.target.closest('.tx-checkbox') && !e.target.closest('.action-btn')) {
            // Ši funkcija atidaro "Coin Detail" langą
            window.openCoinDetail(tx.coin_symbol);
        }
    };

    card.innerHTML = `
        <div class="flex items-start gap-3 w-full">
            <input type="checkbox" class="tx-checkbox form-checkbox h-4 w-4 mt-1 text-primary-500 rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:ring-0 cursor-pointer" 
                    data-tx-id="${tx.id}" 
                    onchange="window.updateDeleteSelectedButton()">
            <div class="flex-1 min-w-0">
                <div class="flex items-center flex-wrap">
                    <span class="font-bold text-sm ${color}">${tx.coin_symbol}</span>
                    <span class="text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded ml-2">${tx.type}</span>
                    ${badgesHTML}
                </div>
                <div class="text-[10px] text-gray-400 mt-1">${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                ${pnlHTML}
                ${notesHTML}
            </div>
            
            <div class="text-right flex flex-col items-end shrink-0 ml-2">
                <div class="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">${isBuy?'+':'-'}${Number(tx.amount).toFixed(4)}</div>
                <div class="font-bold text-sm text-gray-900 dark:text-white mt-0.5">${formatMoney(tx.total_cost_usd)}</div>
                <div class="flex gap-2 mt-2 opacity-50 hover:opacity-100 transition-opacity">
                    <button onclick="window.onEditTx('${tx.id}')" class="action-btn text-gray-400 hover:text-yellow-500 transition-colors p-1"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="window.onDeleteTx('${tx.id}')" class="action-btn text-gray-400 hover:text-red-500 transition-colors p-1"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>
        </div>`;
    return card;
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

// ✅ PATAISYTA: Apsauga grafikui
export function renderPnLChart(timeframe = 'ALL') {
    const canvas = document.getElementById('pnlChart');
    if (!canvas) return;
    
    if (pnlChart) {
        pnlChart.destroy();
        pnlChart = null;
    }
    
    const now = new Date();
    const cutoff = new Date();
    
    if (timeframe === '24H') cutoff.setHours(now.getHours() - 24);
    else if (timeframe === '1W') cutoff.setDate(now.getDate() - 7);
    else if (timeframe === '1M') cutoff.setMonth(now.getMonth() - 1);
    else if (timeframe === '3M') cutoff.setMonth(now.getMonth() - 3);
    else if (timeframe === '6M') cutoff.setMonth(now.getMonth() - 6);
    else if (timeframe === '1Y') cutoff.setFullYear(now.getFullYear() - 1);
    else if (timeframe === '5Y') cutoff.setFullYear(now.getFullYear() - 5);
    else if (timeframe === 'ALL') cutoff.setFullYear(2000);

    let cumulativeInvested = 0;
    const allTxs = state.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const updateInvested = (tx) => {
        const isBuy = ['Buy', 'Instant Buy', 'Market Buy', 'Limit Buy', 'Recurring Buy', 'Gift/Airdrop', 'Staking Reward'].includes(tx.type);
        const isTransfer = tx.type === 'Transfer';
        
        if (isBuy) {
            cumulativeInvested += Number(tx.total_cost_usd) + Number(tx.fee_usd || 0);
        } else if (isTransfer) {
            cumulativeInvested += Number(tx.fee_usd || 0);
        } else {
            cumulativeInvested -= Number(tx.total_cost_usd);
        }
    };

    const pastTxs = allTxs.filter(tx => new Date(tx.date) < cutoff);
    pastTxs.forEach(updateInvested);

    const points = [{ date: cutoff, val: cumulativeInvested }];

    const relevantTxs = allTxs.filter(tx => new Date(tx.date) >= cutoff);
    relevantTxs.forEach(tx => {
        updateInvested(tx);
        points.push({ date: new Date(tx.date), val: cumulativeInvested });
    });

    points.push({ date: now, val: cumulativeInvested });

    const labels = points.map(p => {
        if (timeframe === '24H') return p.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        if (timeframe === '1W') return p.date.toLocaleDateString('lt-LT', {weekday: 'short'}); 
        return p.date.toLocaleDateString('lt-LT', {month: 'numeric', day: 'numeric'});
    });
    
    const dataPoints = points.map(p => p.val);

    const ctx = canvas.getContext('2d');
    const isDark = document.documentElement.classList.contains('dark');
    const isPositive = dataPoints[dataPoints.length - 1] >= 0;
    const color = isPositive ? '#2dd4bf' : '#ef4444';

    pnlChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Investuota',
                data: dataPoints,
                borderColor: color,
                backgroundColor: isPositive ? 'rgba(45, 212, 191, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                borderWidth: 2,
                tension: 0.1,
                fill: true,
                pointRadius: (ctx) => points.length < 30 ? 3 : 0,
                pointHoverRadius: 5
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
                    callbacks: { label: function(context) { return 'Investuota: ' + formatMoney(context.raw); } }
                }
            },
            scales: {
                x: { display: true, grid: { display: false }, ticks: { color: isDark ? '#6b7280' : '#9ca3af', font: { size: 9 }, maxTicksLimit: timeframe === '24H' ? 6 : 7, maxRotation: 0, autoSkip: true } },
                y: { display: true, position: 'right', grid: { color: isDark ? '#374151' : '#f3f4f6', drawBorder: false }, ticks: { color: isDark ? '#6b7280' : '#9ca3af', font: { size: 9 }, callback: function(value) { return '$' + value.toLocaleString(undefined, {notation: "compact"}); } } }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
}
