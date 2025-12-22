// js/ui.js - v4.2.2
// Features: Clean Badges (No Fee in list), Transfer Icon ⇄, LIVE Chart with Timeframes

import { formatMoney } from './utils.js';
import { state } from './logic.js';

let allocationChart = null;
let pnlChart = null;
let coinPriceChart = null; // ✅ NEW: Chart instance
let currentChartTimeframe = '7D'; // ✅ NEW: Default timeframe
const celebratedGoals = new Set();
let currentExchangeFilter = null;

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
            
            // ✅ Perpiešti coin chart jei atidarytas
            const symbol = document.getElementById('coin-detail-symbol')?.textContent;
            if(symbol && !document.getElementById('coin-detail-modal').classList.contains('hidden')) {
                renderCoinPriceChart(symbol, currentChartTimeframe);
            }
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

// --- GRAFIKO LOGIKA (AREA CHART + TIMEFRAMES) ---

export async function renderCoinPriceChart(symbol, timeframe = '7D') {
    const container = document.getElementById('coin-chart-container');
    const loader = document.getElementById('chart-loader');
    const livePriceEl = document.getElementById('chart-live-price'); // Vieta kainai virš grafiko
    const liveChangeEl = document.getElementById('chart-live-change');
    
    if (!container) return;
    
    // Atnaujiname globalų kintamąjį ir mygtukų stilių
    currentChartTimeframe = timeframe;
    document.querySelectorAll('.chart-tf-btn').forEach(btn => {
        if(btn.dataset.tf === timeframe) {
            btn.classList.add('bg-white', 'dark:bg-gray-700', 'text-gray-900', 'dark:text-white', 'shadow-sm');
            btn.classList.remove('text-gray-500', 'hover:text-gray-900', 'dark:hover:text-gray-300');
        } else {
            btn.classList.remove('bg-white', 'dark:bg-gray-700', 'text-gray-900', 'dark:text-white', 'shadow-sm');
            btn.classList.add('text-gray-500', 'hover:text-gray-900', 'dark:hover:text-gray-300');
        }
    });

    // Išvalome seną grafiką
    if (coinPriceChart) {
        coinPriceChart.remove();
        coinPriceChart = null;
    }
    container.innerHTML = '';
    if (loader) loader.classList.remove('hidden');

    try {
        const coin = state.coins.find(c => c.symbol === symbol);
        if (!coin) throw new Error('Moneta nerasta');

        const LWCharts = window.LightweightCharts;
        if (!LWCharts) throw new Error('Grafiko biblioteka nerasta');

        // Nustatome API parametrus
        let days = '7';
        if (timeframe === '1H' || timeframe === '24H') days = '1';
        else if (timeframe === '7D') days = '7';
        else if (timeframe === '30D') days = '30';
        else if (timeframe === '1Y') days = '365';
        else if (timeframe === 'ALL') days = 'max';

        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.coingecko_id}/market_chart?vs_currency=usd&days=${days}`);
        
        if (res.status === 429) throw new Error('Viršytas limitas. Palaukite.');
        if (!res.ok) throw new Error('Klaida gaunant duomenis');
        
        const data = await res.json();
        let prices = data.prices;

        // Papildomas filtravimas 1H (paskutinė valanda iš 24h duomenų)
        if (timeframe === '1H') {
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            prices = prices.filter(p => p[0] >= oneHourAgo);
        }

        if (!prices || prices.length === 0) throw new Error('Nėra duomenų');

        // Paruošiame duomenis TradingView formatui
        const areaData = prices.map(p => ({
            time: p[0] / 1000,
            value: p[1]
        }));

        // Skaičiuojame pokytį pasirinktam laikotarpiui
        const startPrice = areaData[0].value;
        const endPrice = areaData[areaData.length - 1].value;
        const diff = endPrice - startPrice;
        const diffPct = (diff / startPrice) * 100;
        const isPositive = diff >= 0;

        // Atnaujiname Live kainą virš grafiko
        if (livePriceEl) livePriceEl.textContent = formatMoney(endPrice);
        if (liveChangeEl) {
            liveChangeEl.innerHTML = `${isPositive ? '▲' : '▼'} ${Math.abs(diff).toFixed(4)} (${Math.abs(diffPct).toFixed(2)}%)`;
            liveChangeEl.className = `text-xs font-bold px-2 py-0.5 rounded ${isPositive ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`;
        }

        // Tikslumas (Precision)
        let precision = 2;
        let minMove = 0.01;
        if (endPrice < 1) { precision = 6; minMove = 0.000001; }
        else if (endPrice < 10) { precision = 4; minMove = 0.0001; }

        const isDark = document.documentElement.classList.contains('dark');
        const color = isPositive ? '#10b981' : '#ef4444'; // Green or Red theme based on trend

        // Kuriame grafiką
        coinPriceChart = LWCharts.createChart(container, {
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: isDark ? '#9ca3af' : '#6b7280',
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { style: 3, color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
            },
            width: container.clientWidth,
            height: 220, // Šiek tiek mažesnis, kad tilptų headeris
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderVisible: false,
            },
            rightPriceScale: {
                borderVisible: false,
                scaleMargins: { top: 0.2, bottom: 0.1 }, // Daugiau vietos viršuje
            },
            crosshair: {
                vertLine: { labelVisible: false, style: 0, color: '#9ca3af' },
                horzLine: { labelVisible: true, style: 0, color: '#9ca3af' },
            },
        });

        const areaSeries = coinPriceChart.addAreaSeries({
            topColor: isPositive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
            bottomColor: isPositive ? 'rgba(16, 185, 129, 0.0)' : 'rgba(239, 68, 68, 0.0)',
            lineColor: color,
            lineWidth: 2,
            priceFormat: { type: 'price', precision: precision, minMove: minMove },
        });

        areaSeries.setData(areaData);
        coinPriceChart.timeScale().fitContent();

        // Responsive resize
        new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== container) return;
            const newRect = entries[0].contentRect;
            if (coinPriceChart) coinPriceChart.applyOptions({ height: newRect.height, width: newRect.width });
        }).observe(container);

    } catch (e) {
        console.error("Chart Error:", e);
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-center text-gray-400 text-xs"><i class="fa-solid fa-chart-line text-2xl mb-1"></i>${e.message}</div>`;
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

// Globalus handleris mygtukams
window.changeCoinChartTimeframe = (timeframe) => {
    const symbol = document.getElementById('coin-detail-symbol')?.textContent;
    if (symbol) renderCoinPriceChart(symbol, timeframe);
};

// --- MODALŲ LOGIKA ---

export async function openCoinDetail(symbol) {
    const modal = document.getElementById('coin-detail-modal');
    if (!modal) return;
    
    const coin = state.coins.find(c => c.symbol === symbol);
    const holding = state.holdings[symbol];
    if (!coin || !holding) return;
    
    document.getElementById('coin-detail-symbol').textContent = symbol;
    document.getElementById('coin-detail-qty').textContent = holding.qty.toLocaleString(undefined, {maximumFractionDigits: 6});
    document.getElementById('coin-detail-value').textContent = formatMoney(holding.currentValue);
    document.getElementById('coin-detail-invested').textContent = formatMoney(holding.invested);
    
    const pnlEl = document.getElementById('coin-detail-pnl');
    pnlEl.textContent = `${holding.pnl >= 0 ? '+' : ''}${formatMoney(holding.pnl)}`;
    pnlEl.className = `text-xl font-bold ${holding.pnl >= 0 ? 'text-primary-500' : 'text-red-500'}`;
    
    // ✅ Atidarome grafiką su default 7D
    renderCoinPriceChart(symbol, '7D');
    
    // Filtrai ir transakcijos
    const coinTxs = state.transactions.filter(tx => tx.coin_symbol === symbol);
    const exchanges = [...new Set(coinTxs.map(tx => tx.exchange).filter(Boolean))].sort();
    
    const exchangesContainer = document.getElementById('coin-detail-exchanges');
    if (exchangesContainer) {
        exchangesContainer.innerHTML = '';
        
        const setActiveBtn = (activeBtn) => {
            Array.from(exchangesContainer.children).forEach(child => {
                child.className = 'px-3 py-1 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700';
            });
            activeBtn.className = 'px-3 py-1 text-xs font-bold rounded-lg bg-primary-500 text-white shadow-md transition-transform active:scale-95';
        };

        const allBtn = document.createElement('button');
        allBtn.textContent = 'Visos';
        allBtn.onclick = () => { renderCoinTransactions(coinTxs); setActiveBtn(allBtn); };
        exchangesContainer.appendChild(allBtn);
        setActiveBtn(allBtn);

        exchanges.forEach(ex => {
            const btn = document.createElement('button');
            btn.textContent = ex;
            btn.onclick = () => {
                const filtered = coinTxs.filter(tx => tx.exchange === ex);
                renderCoinTransactions(filtered);
                setActiveBtn(btn);
            };
            exchangesContainer.appendChild(btn);
        });
    }
    
    renderCoinTransactions(coinTxs);
    modal.classList.remove('hidden');
}

window.openCoinDetail = openCoinDetail; 

function renderCoinTransactions(txs) {
    const container = document.getElementById('coin-detail-transactions');
    if (!container) return;
    container.innerHTML = '';
    
    if (txs.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-gray-500 text-xs">Nėra transakcijų</div>`;
        return;
    }

    const sorted = txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(tx => {
        const isBuy = ['Buy', 'Instant Buy', 'Market Buy', 'Limit Buy', 'Recurring Buy'].includes(tx.type);
        const typeColor = isBuy ? 'text-primary-500' : 'text-red-500';
        
        let methodDisplay = tx.method || '';
        methodDisplay = methodDisplay.replace('Transfer to ', '→ ').replace('Transfer from ', '← ').replace(' (Card)', '').replace(' (DCA)', '');
        if (methodDisplay === 'Staking Reward') methodDisplay = 'Reward';
        if (methodDisplay === 'Market Buy') methodDisplay = ''; 

        const row = document.createElement('div');
        row.className = 'flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800 mb-2 cursor-pointer hover:border-primary-500 transition-colors';
        row.onclick = () => window.onEditTx(tx.id);

        // ✅ SHOW FEES IN MODAL ONLY
        let feeHTML = '';
        if (Number(tx.fee_usd) > 0) {
            feeHTML = `<span class="block text-[9px] text-orange-500 mt-0.5">Fee: $${Number(tx.fee_usd).toFixed(2)}</span>`;
        }

        row.innerHTML = `
            <div>
                <div class="flex items-center gap-2">
                    <p class="font-bold text-sm ${typeColor}">${tx.type}</p>
                    ${methodDisplay ? `<span class="text-[9px] bg-gray-200 dark:bg-gray-700 px-1.5 rounded text-gray-600 dark:text-gray-300">${methodDisplay}</span>` : ''}
                </div>
                <p class="text-xs text-gray-500">${new Date(tx.date).toLocaleDateString()}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-sm text-gray-900 dark:text-white">${isBuy ? '+' : ''}${Number(tx.amount).toFixed(4)}</p>
                <p class="text-xs font-bold text-gray-700 dark:text-gray-300">$${Number(tx.total_cost_usd).toFixed(2)}</p>
                ${feeHTML} 
            </div>`;
        container.appendChild(row);
    });
}

// --- SĄRAŠAS IR FILTRAI ---

export function renderExchangeFilters() {
    const container = document.getElementById('exchange-filters-container');
    if (!container) return;
    
    const exchanges = [...new Set(state.transactions.map(tx => tx.exchange).filter(Boolean))].sort();
    if (exchanges.length === 0) { container.innerHTML = ''; return; }
    
    container.innerHTML = '';
    
    const allBtn = document.createElement('button');
    allBtn.className = 'exchange-filter-btn px-2 py-1 rounded text-[9px] font-bold transition-colors bg-primary-500 text-white';
    allBtn.textContent = 'All';
    allBtn.dataset.exchange = 'All';
    allBtn.onclick = () => window.filterByExchange('All');
    container.appendChild(allBtn);
    
    exchanges.forEach(exchange => {
        const btn = document.createElement('button');
        btn.className = 'exchange-filter-btn px-2 py-1 rounded text-[9px] font-bold transition-colors bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary-500 hover:text-white';
        btn.textContent = exchange;
        btn.dataset.exchange = exchange;
        btn.onclick = () => window.filterByExchange(exchange);
        container.appendChild(btn);
    });
}

window.filterByExchange = (exchange) => {
    currentExchangeFilter = exchange;
    renderTransactionJournal();
    document.querySelectorAll('.exchange-filter-btn').forEach(btn => {
        if (btn.dataset.exchange === exchange) {
            btn.classList.add('bg-primary-500', 'text-white');
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-600', 'dark:text-gray-300');
        } else {
            btn.classList.remove('bg-primary-500', 'text-white');
            btn.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-600', 'dark:text-gray-300');
        }
    });
};

export function renderTransactionJournal() {
    const container = document.getElementById('journal-accordion');
    if (!container) return;
    container.innerHTML = '';
    
    let filteredTxs = state.transactions.slice();
    if (currentExchangeFilter && currentExchangeFilter !== 'All') {
        filteredTxs = filteredTxs.filter(tx => tx.exchange === currentExchangeFilter);
    }
    
    const sortedTxs = filteredTxs.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sortedTxs.length === 0) { container.innerHTML = `<div class="text-center py-8 text-sm text-gray-500">Nėra transakcijų</div>`; return; }

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
        const allYearTxs = Object.values(yearData).flat();
        const yearStats = calculateGroupStats(allYearTxs);
        const yearStatsHTML = yearStats.totalVal > 0 ? `<span class="${yearStats.pnl >= 0 ? 'text-primary-500' : 'text-red-500'} font-bold text-xs ml-2">${yearStats.pnl >= 0 ? '+' : ''}${formatMoney(yearStats.pnl)} (${yearStats.pct.toFixed(1)}%)</span>` : '';

        const yearWrapper = document.createElement('div');
        yearWrapper.className = 'mb-4 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden';
        
        const yearHeader = document.createElement('div');
        yearHeader.className = 'bg-gray-100 dark:bg-gray-800 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors';
        yearHeader.innerHTML = `<div class="flex items-center gap-3"><i class="fa-solid fa-calendar-days text-primary-500"></i><div class="flex items-baseline"><span class="font-bold text-gray-800 dark:text-gray-200 text-sm">${year}</span>${yearStatsHTML}</div></div><i class="fa-solid fa-chevron-down transition-transform duration-300 text-gray-500 ${isYearOpen ? '' : '-rotate-90'}" id="icon-${yearId}"></i>`;
        
        const yearContent = document.createElement('div');
        yearContent.id = yearId; yearContent.className = `bg-white dark:bg-gray-900/50 p-2 space-y-2 ${isYearOpen ? '' : 'hidden'}`;
        yearHeader.onclick = () => { yearContent.classList.toggle('hidden'); const icon = document.getElementById(`icon-${yearId}`); icon.style.transform = yearContent.classList.contains('hidden') ? 'rotate(-90deg)' : 'rotate(0deg)'; };
        yearWrapper.appendChild(yearHeader);

        Object.keys(yearData).sort((a, b) => parseInt(b) - parseInt(a)).forEach((monthIndex, mIndex) => {
            const txs = yearData[monthIndex];
            const monthId = `month-${year}-${monthIndex}`;
            const isMonthOpen = mIndex === 0;
            const stats = calculateGroupStats(txs);
            const statsHTML = stats.totalVal > 0 ? `<span class="${stats.pnl >= 0 ? 'text-primary-500' : 'text-red-500'} font-mono ml-2">${stats.pnl >= 0 ? '+' : ''}${formatMoney(stats.pnl)} (${stats.pct.toFixed(1)}%)</span>` : '';

            const monthWrapper = document.createElement('div');
            const monthHeader = document.createElement('div');
            monthHeader.className = 'flex justify-between items-center px-2 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded mb-1 select-none group';
            monthHeader.innerHTML = `<div class="flex items-center gap-2 w-full"><div class="w-1 h-3 bg-primary-500 rounded-full"></div><span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-primary-500 transition-colors">${monthsLT[parseInt(monthIndex)]} (${txs.length})</span><div class="ml-auto text-[10px] font-bold flex items-center gap-2">${statsHTML}<i class="fa-solid fa-chevron-down text-gray-400 transition-transform duration-300 ${isMonthOpen ? '' : '-rotate-90'}" id="icon-${monthId}"></i></div></div>`;
            
            const monthContent = document.createElement('div');
            monthContent.id = monthId; monthContent.className = `space-y-2 pl-2 ${isMonthOpen ? '' : 'hidden'}`;
            monthHeader.onclick = () => { monthContent.classList.toggle('hidden'); const icon = document.getElementById(`icon-${monthId}`); icon.style.transform = monthContent.classList.contains('hidden') ? 'rotate(-90deg)' : 'rotate(0deg)'; };
            
            monthWrapper.appendChild(monthHeader);
            txs.forEach(tx => { monthContent.appendChild(createTransactionCard(tx)); });
            monthWrapper.appendChild(monthContent);
            yearContent.appendChild(monthWrapper);
        });
        yearWrapper.appendChild(yearContent);
        container.appendChild(yearWrapper);
    });
}

function calculateGroupStats(txs) {
    let totalCost = 0; let totalVal = 0;
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

// ✅ UPDATED: Clean Badges + Transfer Icon + No Fee in List
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
    if (tx.exchange) { 
        badgesHTML += `<span onclick="window.filterByExchange('${tx.exchange}')" class="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-primary-500 hover:text-white transition-colors">${tx.exchange}</span>`; 
    }

    // ✅ 1. Transfer Icon Logic
    if (tx.type === 'Transfer') {
        let transferText = tx.method || 'Transfer';
        let icon = '→'; 
        if (transferText.includes('Transfer to')) { icon = '→'; transferText = transferText.replace('Transfer to ', ''); }
        else if (transferText.includes('Transfer from')) { icon = '←'; transferText = transferText.replace('Transfer from ', ''); }
        
        badgesHTML += `<span class="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">${icon} ${transferText}</span>`;
    } else {
        let methodDisplay = tx.method || '';
        methodDisplay = methodDisplay.replace(' (Card)', '').replace(' (DCA)', '');
        if (methodDisplay === 'Staking Reward') methodDisplay = 'Reward';
        if (methodDisplay === 'Market Buy') methodDisplay = '';
        if (methodDisplay) { 
            badgesHTML += `<span class="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">${methodDisplay}</span>`; 
        }
    }
    
    // ✅ 2. MOKESČIŲ (FEES) ČIA NERODOME. TIK MODALE.

    let notesHTML = '';
    if (tx.notes && tx.notes.trim() !== '') { 
        notesHTML = `<div class="text-[9px] text-gray-400 italic mt-1.5 pl-2 border-l-2 border-gray-200 dark:border-gray-700 line-clamp-2">${tx.notes}</div>`; 
    }

    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm flex justify-between items-start transition-all hover:border-primary-500/50 cursor-pointer';
    card.onclick = (e) => { 
        if (!e.target.closest('.tx-checkbox') && !e.target.closest('.action-btn') && !e.target.closest('[onclick*="filterByExchange"]')) { 
            window.openCoinDetail(tx.coin_symbol); 
        } 
    };

    // ✅ Pakeičiame "Transfer" tekstą į ikoną ⇄ pagrindiniame view
    const typeDisplay = tx.type === 'Transfer' ? '⇄' : tx.type;

    card.innerHTML = `
        <div class="flex items-start gap-3 w-full">
            <input type="checkbox" class="tx-checkbox form-checkbox h-4 w-4 mt-1 text-primary-500 rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:ring-0 cursor-pointer" data-tx-id="${tx.id}" onchange="window.updateDeleteSelectedButton()">
            <div class="flex-1 min-w-0">
                <div class="flex items-center flex-wrap">
                    <span class="font-bold text-sm ${color}">${tx.coin_symbol}</span>
                    <span class="text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded ml-2">${typeDisplay}</span>
                    ${badgesHTML}
                </div>
                <div class="text-[10px] text-gray-400 mt-1">${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                ${pnlHTML}${notesHTML}
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
    if (allocationChart) { allocationChart.destroy(); allocationChart = null; }
    const chartData = [], labels = [], colors = [];
    Object.entries(state.holdings).forEach(([sym, data]) => { 
        if (data.qty > 0 && data.currentValue > 1) { chartData.push(data.currentValue); labels.push(sym); colors.push(CHART_COLORS[sym] || CHART_COLORS.default); } 
    });
    if (chartData.length === 0) return;
    const ctx = canvas.getContext('2d'); const isDark = document.documentElement.classList.contains('dark');
    allocationChart = new Chart(ctx, { 
        type: 'doughnut', 
        data: { labels: labels, datasets: [{ data: chartData, backgroundColor: colors, borderColor: isDark ? '#111827' : '#ffffff', borderWidth: 2, hoverOffset: 4 }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#9ca3af' : '#4b5563', font: { size: 10, family: 'sans-serif' }, usePointStyle: true, padding: 15 } }, tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } label += formatMoney(context.raw); return label; } } } } } 
    });
}

export function renderPnLChart(timeframe = 'ALL') {
    const canvas = document.getElementById('pnlChart');
    if (!canvas) return;
    if (pnlChart) { pnlChart.destroy(); pnlChart = null; }
    const now = new Date(); const cutoff = new Date();
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
        if (isBuy) { cumulativeInvested += Number(tx.total_cost_usd) + Number(tx.fee_usd || 0); } 
        else if (isTransfer) { cumulativeInvested += Number(tx.fee_usd || 0); } 
        else { cumulativeInvested -= Number(tx.total_cost_usd); }
    };
    const pastTxs = allTxs.filter(tx => new Date(tx.date) < cutoff); pastTxs.forEach(updateInvested);
    const points = [{ date: cutoff, val: cumulativeInvested }];
    const relevantTxs = allTxs.filter(tx => new Date(tx.date) >= cutoff);
    relevantTxs.forEach(tx => { updateInvested(tx); points.push({ date: new Date(tx.date), val: cumulativeInvested }); });
    points.push({ date: now, val: cumulativeInvested });

    const labels = points.map(p => { if (timeframe === '24H') return p.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); if (timeframe === '1W') return p.date.toLocaleDateString('lt-LT', {weekday: 'short'}); return p.date.toLocaleDateString('lt-LT', {month: 'numeric', day: 'numeric'}); });
    const dataPoints = points.map(p => p.val);
    const ctx = canvas.getContext('2d'); const isDark = document.documentElement.classList.contains('dark'); const isPositive = dataPoints[dataPoints.length - 1] >= 0; const color = isPositive ? '#2dd4bf' : '#ef4444';

    pnlChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Investuota', data: dataPoints, borderColor: color, backgroundColor: isPositive ? 'rgba(45, 212, 191, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderWidth: 2, tension: 0.1, fill: true, pointRadius: (ctx) => points.length < 30 ? 3 : 0, pointHoverRadius: 5 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: isDark ? '#1f2937' : '#ffffff', titleColor: isDark ? '#f9fafb' : '#111827', bodyColor: isDark ? '#f9fafb' : '#111827', borderColor: isDark ? '#374151' : '#e5e7eb', borderWidth: 1, callbacks: { label: function(context) { return 'Investuota: ' + formatMoney(context.raw); } } } }, scales: { x: { display: true, grid: { display: false }, ticks: { color: isDark ? '#6b7280' : '#9ca3af', font: { size: 9 }, maxTicksLimit: timeframe === '24H' ? 6 : 7, maxRotation: 0, autoSkip: true } }, y: { display: true, position: 'right', grid: { color: isDark ? '#374151' : '#f3f4f6', drawBorder: false }, ticks: { color: isDark ? '#6b7280' : '#9ca3af', font: { size: 9 }, callback: function(value) { return '$' + value.toLocaleString(undefined, {notation: "compact"}); } } } }, interaction: { mode: 'nearest', axis: 'x', intersect: false } }
    });
}
