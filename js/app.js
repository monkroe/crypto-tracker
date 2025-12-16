// js/app.js - Versija 1.9.1 (Accordion istorija: Year -> Month -> Transactions)

const APP_VERSION = '1.9.1';

let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;
let allocationChart = null;
const PRIORITY_COINS = ['BTC', 'ETH', 'KAS', 'SOL', 'BNB'];

const CHART_COLORS = {
    KAS: '#2dd4bf', MON: '#a855f7', BTC: '#f97316', ETH: '#3b82f6',
    SOL: '#8b5cf6', BNB: '#eab308', JUP: '#4ade80', default: '#6b7280'
};

const MONTH_NAMES_LT = [
    'Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis',
    'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'
];

document.addEventListener('DOMContentLoaded', async () => {
    console.log(`✅ App started v${APP_VERSION}`);
    const versionEl = document.getElementById('app-version');
    if (versionEl) versionEl.innerText = APP_VERSION;
    
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) { showAppScreen(); loadAllData(); } 
    else { showAuthScreen(); }

    _supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            showAppScreen(); loadAllData();
        } else if (event === 'SIGNED_OUT') {
            showAuthScreen(); clearData();
        }
    });

    setupAuthHandlers();
    setupAppListeners();
});

function showAppScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
}
function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-content').classList.add('hidden');
}

function setupAuthHandlers() {
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-pass');
    const errText = document.getElementById('auth-error');

    function validateInputs() {
        const email = emailInput.value.trim();
        const pass = passInput.value.trim();
        if (!email || !pass) {
            errText.textContent = "⚠️ Įveskite el. paštą ir slaptažodį.";
            errText.classList.remove('hidden');
            return false;
        }
        errText.classList.add('hidden');
        return true;
    }

    document.getElementById('btn-login').addEventListener('click', async () => {
        if (!validateInputs()) return;
        const btn = document.getElementById('btn-login');
        const originalText = btn.innerText; btn.innerText = "Jungiama..."; btn.disabled = true;
        try {
            const { error } = await userLogin(emailInput.value, passInput.value);
            if (error) throw error;
        } catch (e) {
            errText.textContent = "Klaida: " + (e.message || 'Prisijungti nepavyko.');
            errText.classList.remove('hidden');
            btn.innerText = originalText; btn.disabled = false;
        }
    });

    document.getElementById('btn-signup').addEventListener('click', async () => {
        if (!validateInputs()) return;
        const btn = document.getElementById('btn-signup');
        const originalText = btn.innerText; btn.innerText = "Registruojama..."; btn.disabled = true;
        try {
            const { error } = await userSignUp(emailInput.value, passInput.value);
            if (error) throw error;
            alert("✅ Registracija sėkminga!"); btn.innerText = originalText; btn.disabled = false;
        } catch (e) {
            errText.textContent = "Klaida: " + (e.message || 'Registracija nepavyko.');
            errText.classList.remove('hidden'); btn.innerText = originalText; btn.disabled = false;
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        if (confirm('Ar tikrai norite atsijungti?')) await userSignOut();
    });
}

function clearData() {
    const container = document.getElementById('journal-accordion');
    if (container) container.innerHTML = '<div class="px-4 py-8 text-center text-xs text-gray-600">No transactions yet.</div>';
    document.getElementById('header-total-value').innerText = '$0.00';
    document.getElementById('total-pnl').innerText = '$0.00';
    document.getElementById('total-pnl-percent').innerText = '0.00%';
    coinsList = []; transactions = []; goals = []; prices = {};
    if (myChart) { myChart.destroy(); myChart = null; }
    if (allocationChart) { allocationChart.destroy(); allocationChart = null; }
}

function setupAppListeners() {
    const form = document.getElementById('add-tx-form');
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', handleTxSubmit);
        setupCalculator();
    }
    
    const btnSaveCoin = document.getElementById('btn-save-coin');
    if (btnSaveCoin) {
        btnSaveCoin.replaceWith(btnSaveCoin.cloneNode(true));
        document.getElementById('btn-save-coin').addEventListener('click', handleNewCoinSubmit);
    }
    const btnDeleteCoin = document.getElementById('btn-delete-coin');
    if (btnDeleteCoin) {
        btnDeleteCoin.replaceWith(btnDeleteCoin.cloneNode(true));
        document.getElementById('btn-delete-coin').addEventListener('click', handleDeleteCoinSubmit);
    }
    const btnFetch = document.getElementById('btn-fetch-price');
    if (btnFetch) {
        btnFetch.replaceWith(btnFetch.cloneNode(true));
        document.getElementById('btn-fetch-price').addEventListener('click', fetchPriceForForm);
    }
}

function setupCalculator() {
    const amountIn = document.getElementById('tx-amount');
    const priceIn = document.getElementById('tx-price');
    const totalIn = document.getElementById('tx-total');
    if (!amountIn || !priceIn || !totalIn) return;
    const val = (el) => { const v = parseFloat(el.value); return isNaN(v) ? 0 : v; };
    amountIn.addEventListener('input', () => {
        const a = val(amountIn), p = val(priceIn), t = val(totalIn);
        if (t > 0 && a > 0) { priceIn.value = (t / a).toFixed(8); } 
        else if (p > 0) { totalIn.value = (a * p).toFixed(2); }
    });
    priceIn.addEventListener('input', () => {
        const p = val(priceIn), a = val(amountIn), t = val(totalIn);
        if (t > 0 && p > 0) { amountIn.value = (t / p).toFixed(6); } 
        else if (a > 0) { totalIn.value = (a * p).toFixed(2); }
    });
    totalIn.addEventListener('input', () => {
        const t = val(totalIn), p = val(priceIn), a = val(amountIn);
        if (a > 0 && t > 0) { priceIn.value = (t / a).toFixed(8); } 
        else if (p > 0) { amountIn.value = (t / p).toFixed(6); }
    });
}

function formatMoney(value) {
    const num = Number(value);
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}
const padTo2Digits = (num) => String(num).padStart(2, '0');

async function loadAllData() {
    console.log('📊 Loading all data...');
    const container = document.getElementById('journal-accordion');
    if (container) container.innerHTML = '<div class="px-4 py-8 text-center text-xs text-gray-600"><div class="spinner mx-auto mb-2"></div>Loading...</div>';
    
    try {
        const [coinsData, txData, goalsData] = await Promise.all([getSupportedCoins(), getTransactions(), getCryptoGoals()]);
        coinsList = Array.isArray(coinsData) ? coinsData : [];
        transactions = Array.isArray(txData) ? txData : [];
        goals = Array.isArray(goalsData) ? goalsData : [];
        console.log(`✅ Loaded: ${coinsList.length} coins, ${transactions.length} transactions`);
        
        if (coinsList.length > 0) await fetchCurrentPrices();
        const holdings = updateDashboard();
        populateCoinSelect(holdings);
        renderAccordionJournal(); // NEW: Accordion rendering
        renderGoals(holdings);
        await generateHistoryChart();
        renderAllocationChart(holdings);
        renderCoinCards(holdings);
    } catch (e) {
        console.error('❌ Error loading data:', e);
        if (container) container.innerHTML = '<div class="px-4 py-8 text-center text-xs text-red-400">Error loading data.</div>';
    }
}

async function fetchCurrentPrices() {
    if (coinsList.length === 0) return;
    const ids = coinsList.map(c => c.coingecko_id).join(',');
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        if (res.ok) { const newPrices = await res.json(); prices = { ...prices, ...newPrices }; console.log('💰 Prices updated'); }
    } catch (e) { console.warn("⚠️ Price fetch error:", e); }
}

async function fetchPriceForForm() {
    const symbol = document.getElementById('tx-coin').value;
    const coin = coinsList.find(c => c.symbol === symbol);
    if (!coin || !coin.coingecko_id) { alert("CoinGecko ID nerastas!"); return; }
    const btn = document.getElementById('btn-fetch-price'); const oldText = btn.innerText; btn.innerText = '⏳'; btn.disabled = true;
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingecko_id}&vs_currencies=usd`);
        if (!res.ok) throw new Error('API error');
        const data = await res.json(); const price = data[coin.coingecko_id]?.usd;
        if (price) {
            const priceInput = document.getElementById('tx-price');
            priceInput.value = price; priceInput.dispatchEvent(new Event('input'));
            console.log(`✅ Price: ${symbol} = $${price}`);
        } else throw new Error('Price not found');
    } catch (e) { console.error('❌ Price error:', e); alert("Nepavyko gauti kainos."); }
    btn.innerText = oldText; btn.disabled = false;
}

function updateDashboard() {
    const holdings = {};
    let totalInvested = 0;
    transactions.forEach(tx => {
        if (!holdings[tx.coin_symbol]) holdings[tx.coin_symbol] = { qty: 0, invested: 0, totalCost: 0, totalAmount: 0 };
        const amount = Number(tx.amount), cost = Number(tx.total_cost_usd);
        if (tx.type === 'Buy') {
            holdings[tx.coin_symbol].qty += amount; holdings[tx.coin_symbol].invested += cost;
            holdings[tx.coin_symbol].totalCost += cost; holdings[tx.coin_symbol].totalAmount += amount;
            totalInvested += cost;
        } else {
            holdings[tx.coin_symbol].qty -= amount; holdings[tx.coin_symbol].invested -= cost; totalInvested -= cost;
        }
    });
    
    let totalValue = 0;
    Object.entries(holdings).forEach(([sym, data]) => {
        if (data.qty > 0) {
            const coin = coinsList.find(c => c.symbol === sym);
            if (coin && prices[coin.coingecko_id]) {
                const currentValue = data.qty * prices[coin.coingecko_id].usd;
                totalValue += currentValue;
                data.averageBuyPrice = data.totalAmount > 0 ? data.totalCost / data.totalAmount : 0;
                data.currentPrice = prices[coin.coingecko_id].usd;
                data.currentValue = currentValue;
            }
        }
    });
    
    const pnl = totalValue - totalInvested;
    const pnlPercent = totalInvested > 0 ? (pnl / totalInvested * 100) : 0;
    document.getElementById('header-total-value').innerText = formatMoney(totalValue);
    const pnlEl = document.getElementById('total-pnl');
    pnlEl.innerText = formatMoney(pnl); pnlEl.style.color = pnl >= 0 ? '#2dd4bf' : '#f87171';
    const pnlPercentEl = document.getElementById('total-pnl-percent');
    pnlPercentEl.innerText = (pnl >= 0 ? '+' : '') + pnlPercent.toFixed(2) + '%';
    pnlPercentEl.style.backgroundColor = pnl >= 0 ? '#14532d' : '#7f1d1d';
    pnlPercentEl.style.color = pnl >= 0 ? '#34d399' : '#fca5a5';
    console.log(`💵 Portfolio: ${formatMoney(totalValue)} | P&L: ${formatMoney(pnl)}`);
    return holdings;
}

function renderAllocationChart(holdings) {
    const canvas = document.getElementById('allocationChart');
    if (!canvas) { console.warn('⚠️ Allocation chart canvas not found'); return; }
    if (allocationChart) allocationChart.destroy();
    const chartData = [], labels = [], colors = [];
    Object.entries(holdings).forEach(([sym, data]) => {
        if (data.qty > 0 && data.currentValue) {
            chartData.push(data.currentValue); labels.push(sym);
            colors.push(CHART_COLORS[sym] || CHART_COLORS.default);
        }
    });
    if (chartData.length === 0) { console.log('⚠️ No data for allocation chart'); return; }
    const ctx = canvas.getContext('2d');
    allocationChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: chartData, backgroundColor: colors, borderColor: '#111827', borderWidth: 2 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 11 }, padding: 10, usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '', value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${formatMoney(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    console.log('✅ Allocation chart rendered');
}

function renderCoinCards(holdings) {
    const container = document.getElementById('coin-cards-container');
    if (!container) { console.warn('⚠️ Coin cards container not found'); return; }
    container.innerHTML = '';
    const activeHoldings = Object.entries(holdings).filter(([_, data]) => data.qty > 0);
    if (activeHoldings.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-sm py-4">No active holdings</p>';
        return;
    }
    activeHoldings.forEach(([sym, data]) => {
        const coin = coinsList.find(c => c.symbol === sym);
        if (!coin) return;
        let pnlPercent = 0, pnlClass = 'text-gray-400', pnlSign = '';
        if (data.averageBuyPrice && data.currentPrice) {
            pnlPercent = ((data.currentPrice - data.averageBuyPrice) / data.averageBuyPrice) * 100;
            if (pnlPercent > 0) { pnlClass = 'text-green-500'; pnlSign = '+'; } 
            else if (pnlPercent < 0) { pnlClass = 'text-red-500'; pnlSign = ''; }
        }
        const card = document.createElement('div');
        card.className = 'bg-gray-900 border border-gray-800 rounded-xl p-4';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div><h4 class="font-bold text-white text-lg">${sym}</h4><p class="text-xs text-gray-500">${data.qty.toFixed(4)} ${sym}</p></div>
                <div class="text-right"><p class="text-sm font-bold text-white">${formatMoney(data.currentValue || 0)}</p><p class="${pnlClass} text-xs font-bold">${pnlSign}${pnlPercent.toFixed(2)}%</p></div>
            </div>
            <div class="text-xs text-gray-600 space-y-1">
                <div class="flex justify-between"><span>Avg Buy:</span><span>${formatMoney(data.averageBuyPrice || 0)}</span></div>
                <div class="flex justify-between"><span>Current:</span><span>${formatMoney(data.currentPrice || 0)}</span></div>
            </div>
        `;
        container.appendChild(card);
    });
    console.log(`✅ Rendered ${activeHoldings.length} coin cards`);
}

// ==========================================
// NEW: ACCORDION JOURNAL (Year -> Month -> Transactions)
// ==========================================
function renderAccordionJournal() {
    const container = document.getElementById('journal-accordion');
    if (!container) { console.warn('⚠️ Journal accordion container not found'); return; }
    container.innerHTML = '';
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="px-4 py-8 text-center text-xs text-gray-600">No transactions yet.</div>';
        return;
    }
    
    // Group by year and month
    const grouped = {};
    transactions.forEach(tx => {
        const date = new Date(tx.date);
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11
        
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = [];
        grouped[year][month].push(tx);
    });
    
    // Sort years descending
    const years = Object.keys(grouped).sort((a, b) => b - a);
    
    years.forEach((year, yearIndex) => {
        const yearDiv = document.createElement('div');
        yearDiv.className = 'border border-gray-800 rounded-xl overflow-hidden mb-3';
        
        // Year header
        const yearHeader = document.createElement('div');
        yearHeader.className = 'bg-gray-900 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-850 transition-colors';
        yearHeader.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-calendar text-primary-400"></i>
                <span class="font-bold text-white">${year}</span>
                <span class="text-xs text-gray-500">(${Object.values(grouped[year]).flat().length} transactions)</span>
            </div>
            <i class="fa-solid fa-chevron-down text-gray-500 transition-transform year-chevron-${year}"></i>
        `;
        
        // Month container
        const monthContainer = document.createElement('div');
        monthContainer.id = `year-${year}`;
        monthContainer.className = yearIndex === 0 ? 'block' : 'hidden'; // First year open
        
        // Sort months descending
        const months = Object.keys(grouped[year]).sort((a, b) => b - a);
        
        months.forEach((month, monthIndex) => {
            const txs = grouped[year][month].sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const monthDiv = document.createElement('div');
            monthDiv.className = 'border-t border-gray-800/50';
            
            // Month header
            const monthHeader = document.createElement('div');
            monthHeader.className = 'bg-gray-900/50 px-6 py-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors';
            monthHeader.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-gray-300">${MONTH_NAMES_LT[month]}</span>
                    <span class="text-xs text-gray-600">(${txs.length})</span>
                </div>
                <i class="fa-solid fa-chevron-down text-gray-600 text-xs transition-transform month-chevron-${year}-${month}"></i>
            `;
            
            // Transactions container
            const txContainer = document.createElement('div');
            txContainer.id = `month-${year}-${month}`;
            txContainer.className = (yearIndex === 0 && monthIndex === 0) ? 'block' : 'hidden'; // First month of first year open
            
            txs.forEach(tx => {
                const txDiv = document.createElement('div');
                txDiv.className = 'px-6 py-3 border-t border-gray-800/30 hover:bg-gray-900/30 transition-colors';
                
                const dateObj = new Date(tx.date);
                const dateStr = dateObj.toLocaleDateString('lt-LT', { day: '2-digit', month: '2-digit' }) + ' ' + 
                               dateObj.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit', hour12: false });
                
                const isBuy = tx.type === 'Buy';
                const method = tx.method ? `<span class="text-[9px] text-gray-500 border border-gray-700 rounded px-1 ml-1">${tx.method}</span>` : '';
                const exchangeName = tx.exchange ? `<span class="text-[10px] text-gray-500 ml-2">${tx.exchange}</span>` : '';
                const notesDisplay = tx.notes ? `<div class="text-[10px] text-primary-400/80 italic mt-1"><i class="fa-regular fa-note-sticky mr-1"></i>${tx.notes}</div>` : '';
                
                txDiv.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center flex-wrap gap-1">
                                <span class="font-bold text-sm ${isBuy ? 'text-green-500' : 'text-red-500'}">${tx.coin_symbol}</span>
                                <span class="text-xs text-gray-600">${isBuy ? 'Buy' : 'Sell'}</span>
                                ${method}${exchangeName}
                            </div>
                            <div class="text-[10px] text-gray-600 mt-0.5">${dateStr}</div>
                            ${notesDisplay}
                        </div>
                        <div class="text-right ml-4">
                            <div class="text-xs text-gray-300 font-mono">${isBuy ? '+' : '-'}${Number(tx.amount).toFixed(4)}</div>
                            <div class="text-[10px] text-gray-500">@ $${Number(tx.price_per_coin).toFixed(4)}</div>
                            <div class="font-bold text-sm text-white mt-1">${formatMoney(tx.total_cost_usd)}</div>
                        </div>
                        <div class="flex flex-col gap-2 ml-3">
                            <button onclick="onEditTx(${tx.id})" class="text-gray-500 hover:text-yellow-500 transition-colors text-xs p-1"><i class="fa-solid fa-pen"></i></button>
                            <button onclick="onDeleteTx(${tx.id})" class="text-gray-500 hover:text-red-500 transition-colors text-xs p-1"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
                
                txContainer.appendChild(txDiv);
            });
            
            // Month click handler
            monthHeader.addEventListener('click', () => {
                const isHidden = txContainer.classList.contains('hidden');
                txContainer.classList.toggle('hidden');
                const chevron = monthHeader.querySelector(`.month-chevron-${year}-${month}`);
                if (chevron) {
                    if (isHidden) chevron.style.transform = 'rotate(180deg)';
                    else chevron.style.transform = 'rotate(0deg)';
                }
            });
            
            monthDiv.appendChild(monthHeader);
            monthDiv.appendChild(txContainer);
            monthContainer.appendChild(monthDiv);
        });
        
        // Year click handler
        yearHeader.addEventListener('click', () => {
            const isHidden = monthContainer.classList.contains('hidden');
            monthContainer.classList.toggle('hidden');
            const chevron = yearHeader.querySelector(`.year-chevron-${year}`);
            if (chevron) {
                if (isHidden) chevron.style.transform = 'rotate(180deg)';
                else chevron.style.transform = 'rotate(0deg)';
            }
        });
        
        yearDiv.appendChild(yearHeader);
        yearDiv.appendChild(monthContainer);
        container.appendChild(yearDiv);
    });
    
    console.log(`✅ Accordion rendered: ${years.length} years`);
}

async function generateHistoryChart() {
    console.log('📈 Generating history chart...');
    if (transactions.length === 0) { renderChart(['No data'], [0]); return; }
    const dates = transactions.map(t => new Date(t.date).getTime());
    const minDate = new Date(Math.min(...dates)), maxDate = new Date();
    const dayLabels = [], dayValues = [];
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]; dayLabels.push(dateStr);
        let dailyValue = 0; const balances = {};
        transactions.forEach(tx => {
            const txDate = new Date(tx.date).toISOString().split('T')[0];
            if (txDate <= dateStr) {
                if (!balances[tx.coin_symbol]) balances[tx.coin_symbol] = 0;
                if (tx.type === 'Buy') balances[tx.coin_symbol] += Number(tx.amount);
                else balances[tx.coin_symbol] -= Number(tx.amount);
            }
        });
        for (const [sym, qty] of Object.entries(balances)) {
            if (qty > 0) {
                const coin = coinsList.find(c => c.symbol === sym);
                if (coin && prices[coin.coingecko_id]) dailyValue += qty * prices[coin.coingecko_id].usd;
            }
        }
        dayValues.push(dailyValue);
    }
    console.log(`✅ Chart generated with ${dayLabels.length} data points`);
    renderChart(dayLabels, dayValues);
}

function renderChart(labels, data) {
    const ctxEl = document.getElementById('pnlChart');
    if (!ctxEl) { console.error('❌ Chart canvas not found!'); return; }
    if (myChart) myChart.destroy();
    const ctx = ctxEl.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0.3)'); grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
    let borderColor = '#2dd4bf';
    if (data.length > 1 && data[data.length - 1] < data[0]) borderColor = '#f87171';
    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ data: data, borderColor: borderColor, backgroundColor: grad, borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0, pointHitRadius: 10 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, callbacks: { label: (ctx) => formatMoney(ctx.parsed.y) } } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
    console.log('✅ Chart rendered');
}

function populateCoinSelect(holdings) {
    const select = document.getElementById('tx-coin'), deleteSelect = document.getElementById('delete-coin-select');
    if (!select || !deleteSelect) return;
    select.innerHTML = ''; deleteSelect.innerHTML = '<option value="">-- Pasirinkite --</option>';
    if (coinsList.length === 0) { select.innerHTML = '<option value="">-- Pridėkite monetą --</option>'; return; }
    const sortedCoins = [...coinsList].sort((a, b) => {
        const hasA = (holdings[a.symbol]?.qty || 0) > 0, hasB = (holdings[b.symbol]?.qty || 0) > 0;
        if (hasA && !hasB) return -1; if (!hasA && hasB) return 1;
        const topA = PRIORITY_COINS.includes(a.symbol), topB = PRIORITY_COINS.includes(b.symbol);
        if (topA && !topB) return -1; if (!topA && topB) return 1;
        return a.symbol.localeCompare(b.symbol);
    });
    sortedCoins.forEach(coin => {
        const hasBalance = (holdings[coin.symbol]?.qty || 0) > 0;
        const opt1 = document.createElement('option'); opt1.value = coin.symbol;
        opt1.textContent = hasBalance ? `★ ${coin.symbol}` : coin.symbol; select.appendChild(opt1);
        const opt2 = document.createElement('option'); opt2.value = coin.symbol; opt2.textContent = coin.symbol; deleteSelect.appendChild(opt2);
    });
}

function renderGoals(holdings) {
    const container = document.getElementById('goals-container'), section = document.getElementById('goals-section');
    if (!container || !section) return; container.innerHTML = '';
    if (goals.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    goals.forEach(goal => {
        const current = holdings[goal.coin_symbol]?.qty || 0, target = Number(goal.target_amount);
        if (target <= 0) return;
        const pct = Math.min(100, (current / target) * 100);
        const div = document.createElement('div'); div.className = 'bg-gray-900 border border-gray-800 p-3 rounded-xl';
        div.innerHTML = `
            <div class="flex justify-between text-xs mb-1"><span class="font-bold text-gray-300">${goal.coin_symbol}</span><span class="text-primary-400 font-bold">${pct.toFixed(1)}%</span></div>
            <div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden"><div class="bg-primary-500 h-1.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div></div>
            <div class="text-[9px] text-gray-500 mt-1 text-right font-mono">${current.toLocaleString(undefined, {maximumFractionDigits: 2})} / ${target.toLocaleString()}</div>
        `;
        container.appendChild(div);
    });
    console.log(`✅ Goals rendered: ${goals.length} goals`);
}

async function handleTxSubmit(e) {
    e.preventDefault(); console.log('💾 Saving transaction...');
    const btn = document.getElementById('btn-save'), oldText = btn.innerText; btn.innerText = "Saving..."; btn.disabled = true;
    const txId = document.getElementById('tx-id').value, coinSymbol = document.getElementById('tx-coin').value;
    const rawAmount = document.getElementById('tx-amount').value, rawPrice = document.getElementById('tx-price').value, rawTotal = document.getElementById('tx-total').value;
    const dStr = document.getElementById('tx-date-input').value, tStr = document.getElementById('tx-time-input').value || '00:00';
    if (!coinSymbol) { alert("Pasirinkite monetą!"); btn.innerText = oldText; btn.disabled = false; return; }
    const amount = parseFloat(rawAmount), price = parseFloat(rawPrice), total = parseFloat(rawTotal);
    if (isNaN(amount) || isNaN(price) || isNaN(total) || amount <= 0 || price <= 0 || total <= 0) {
        alert("Įveskite teigiamus skaičius!"); btn.innerText = oldText; btn.disabled = false; return;
    }
    const localDate = new Date(`${dStr}T${tStr}:00`), finalDate = localDate.toISOString();
    const txData = {
        date: finalDate, type: document.getElementById('tx-type').value, coin_symbol: coinSymbol,
        exchange: document.getElementById('tx-exchange').value || null, method: document.getElementById('tx-method').value,
        notes: document.getElementById('tx-notes').value || null, amount: amount, price_per_coin: price, total_cost_usd: total
    };
    let success = false;
    if (txId) { console.log('📝 Updating:', txId); success = await updateTransaction(txId, txData); } 
    else { console.log('➕ Creating new transaction'); success = await saveTransaction(txData); }
    if (success) { console.log('✅ Transaction saved!'); closeModal('add-modal'); await loadAllData(); } 
    else { console.error('❌ Failed to save transaction'); }
    btn.innerText = oldText; btn.disabled = false;
}

window.onEditTx = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) { console.error('❌ Transaction not found:', id); return; }
    console.log('✏️ Editing transaction:', tx);
    openModal('add-modal');
    setTimeout(() => {
        document.getElementById('tx-id').value = tx.id;
        document.getElementById('tx-type').value = tx.type;
        document.getElementById('tx-coin').value = tx.coin_symbol;
        document.getElementById('tx-exchange').value = tx.exchange || '';
        document.getElementById('tx-method').value = tx.method || 'Market Buy';
        const dateObj = new Date(tx.date);
        const year = dateObj.getFullYear(), month = padTo2Digits(dateObj.getMonth() + 1), day = padTo2Digits(dateObj.getDate());
        const dStr = `${year}-${month}-${day}`;
        const hours = padTo2Digits(dateObj.getHours()), minutes = padTo2Digits(dateObj.getMinutes());
        const tStr = `${hours}:${minutes}`;
        document.getElementById('tx-date-input').value = dStr;
        document.getElementById('tx-time-input').value = tStr;
        document.getElementById('tx-amount').value = Number(tx.amount).toFixed(6);
        document.getElementById('tx-price').value = Number(tx.price_per_coin).toFixed(8);
        document.getElementById('tx-total').value = Number(tx.total_cost_usd).toFixed(2);
        document.getElementById('tx-notes').value = tx.notes || '';
        document.getElementById('modal-title').innerText = "Edit Transaction";
        const btn = document.getElementById('btn-save');
        btn.innerText = "Update Transaction";
        btn.classList.remove('bg-primary-600', 'hover:bg-primary-500');
        btn.classList.add('bg-yellow-600', 'hover:bg-yellow-500');
        console.log('✅ Form populated');
    }, 100);
};

window.onDeleteTx = async function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    const confirmMsg = `Ar tikrai norite ištrinti?\n\n${tx.coin_symbol} ${tx.type}\n${Number(tx.amount).toFixed(4)} @ ${formatMoney(tx.price_per_coin)}\nTotal: ${formatMoney(tx.total_cost_usd)}`;
    if (!confirm(confirmMsg)) return;
    console.log('🗑️ Deleting transaction:', id);
    const success = await deleteTransaction(id);
    if (success) { console.log('✅ Transaction deleted'); await loadAllData(); } 
    else { console.error('❌ Failed to delete'); }
};

async function handleNewCoinSubmit() {
    const symbol = document.getElementById('new-coin-symbol').value.trim().toUpperCase();
    const coingeckoId = document.getElementById('new-coin-id').value.trim().toLowerCase();
    const targetRaw = document.getElementById('new-coin-target').value;
    if (!symbol || !coingeckoId) { alert('Užpildykite simbolį ir CoinGecko ID!'); return; }
    if (coinsList.find(c => c.symbol === symbol)) { alert(`Moneta ${symbol} jau egzistuoja!`); return; }
    const btn = document.getElementById('btn-save-coin'), oldText = btn.innerText; btn.innerText = 'Saving...'; btn.disabled = true;
    console.log('➕ Adding new coin:', symbol);
    try {
        const coinData = { symbol, coingecko_id: coingeckoId };
        const success = await saveNewCoin(coinData);
        if (success && targetRaw) {
            const target = parseFloat(targetRaw);
            if (target > 0) { console.log('🎯 Adding goal:', symbol, target); await saveOrUpdateGoal(symbol, target); }
        }
        if (success) {
            console.log('✅ Coin added');
            document.getElementById('new-coin-symbol').value = '';
            document.getElementById('new-coin-id').value = '';
            document.getElementById('new-coin-target').value = '';
            closeModal('new-coin-modal'); await loadAllData();
        }
    } catch (e) { console.error('❌ Error adding coin:', e); alert('Klaida pridedant monetą: ' + e.message); }
    btn.innerText = oldText; btn.disabled = false;
}

async function handleDeleteCoinSubmit() {
    const sym = document.getElementById('delete-coin-select').value;
    if (!sym || sym === '') { alert("Pasirinkite monetą!"); return; }
    const hasTx = transactions.some(tx => tx.coin_symbol === sym);
    let confirmMsg = `Ar tikrai norite ištrinti ${sym}?`;
    if (hasTx) {
        const txCount = transactions.filter(tx => tx.coin_symbol === sym).length;
        confirmMsg += `\n\n⚠️ DĖMESIO: Ši moneta turi ${txCount} transakcijų!\nTransakcijos liks, bet negalėsite pridėti naujų.`;
    }
    if (!confirm(confirmMsg)) return;
    const btn = document.getElementById('btn-delete-coin'), oldText = btn.innerText; btn.innerText = "Deleting..."; btn.disabled = true;
    console.log('🗑️ Deleting coin:', sym);
    try {
        const success = await deleteSupportedCoin(sym);
        if (success) {
            const { data: { user } } = await _supabase.auth.getUser();
            if (user) await _supabase.from('crypto_goals').delete().eq('user_id', user.id).eq('coin_symbol', sym);
            console.log('✅ Coin deleted'); closeModal('delete-coin-modal'); await loadAllData();
        }
    } catch (e) { console.error('❌ Error deleting coin:', e); alert('Klaida trinant monetą: ' + e.message); }
    btn.innerText = oldText; btn.disabled = false;
            }
