// js/app.js - Versija 1.7.2 (Data Access Consistency Fix)

const APP_VERSION = '1.7.2';

let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;
const PRIORITY_COINS = ['BTC', 'ETH', 'KAS', 'SOL', 'BNB'];

document.addEventListener('DOMContentLoaded', async () => {
    // ... (AUTH ir UI HELPERS dalis nepasikeitė)
    console.log(`App started v${APP_VERSION}`);
    const versionEl = document.getElementById('app-version');
    if (versionEl) versionEl.innerText = APP_VERSION;
    
    // Check Session
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        showAppScreen();
        loadAllData();
    } else {
        showAuthScreen();
    }

    _supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            showAppScreen();
            if (transactions.length === 0) loadAllData();
        } else if (event === 'SIGNED_OUT') {
            showAuthScreen();
            clearData();
        }
    });

    setupAuthHandlers();
    setupAppListeners();
});

// --- UI HELPERS ---
function showAppScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
}

function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-content').classList.add('hidden');
}

// --- AUTH ---
function setupAuthHandlers() {
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-pass');
    const errText = document.getElementById('auth-error');
    
    function validate() {
        if (!emailInput.value.trim() || !passInput.value.trim()) {
            errText.textContent = "Įveskite el. paštą ir slaptažodį.";
            errText.classList.remove('hidden');
            return false;
        }
        return true;
    }
    
    document.getElementById('btn-login').addEventListener('click', async () => {
        if (!validate()) return;
        try {
            const { error } = await userLogin(emailInput.value, passInput.value);
            if (error) throw error;
        } catch (e) {
            errText.textContent = e.message;
            errText.classList.remove('hidden');
        }
    });
    
    document.getElementById('btn-signup').addEventListener('click', async () => {
        if (!validate()) return;
        try {
            const { error } = await userSignUp(emailInput.value, passInput.value);
            if (error) throw error;
            alert("Registracija sėkminga! Patikrinkite el. paštą.");
        } catch (e) {
            errText.textContent = e.message;
            errText.classList.remove('hidden');
        }
    });
    
    document.getElementById('btn-logout').addEventListener('click', async () => {
        if (confirm('Ar tikrai norite atsijungti?')) {
            await userSignOut();
        }
    });
}

function clearData() {
    document.getElementById('journal-body').innerHTML = '';
    document.getElementById('header-total-value').innerText = '$0.00';
    document.getElementById('total-pnl').innerText = '$0.00';
    document.getElementById('total-pnl-percent').innerText = '0.00%';
    coinsList = [];
    transactions = [];
    goals = [];
    prices = {};
}

function setupAppListeners() {
    const form = document.getElementById('add-tx-form');
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', handleTxSubmit);
        setupCalculator();
    }
    
    document.getElementById('btn-save-coin').addEventListener('click', handleNewCoinSubmit);
    document.getElementById('btn-delete-coin').addEventListener('click', handleDeleteCoinSubmit);
    
    const btnFetch = document.getElementById('btn-fetch-price');
    btnFetch.replaceWith(btnFetch.cloneNode(true));
    document.getElementById('btn-fetch-price').addEventListener('click', fetchPriceForForm);
}

// --- CALCULATOR ---
function setupCalculator() {
    const amountIn = document.getElementById('tx-amount');
    const priceIn = document.getElementById('tx-price');
    const totalIn = document.getElementById('tx-total');
    
    if (!amountIn || !priceIn || !totalIn) return;

    const val = (el) => {
        const v = parseFloat(el.value);
        return isNaN(v) ? 0 : v;
    };

    // 1. Keičiant KIEKĮ (Amount)
    amountIn.addEventListener('input', () => {
        const a = val(amountIn);
        const p = val(priceIn);
        const t = val(totalIn);

        if (t > 0 && a > 0) {
            priceIn.value = (t / a).toFixed(8);
        } else if (p > 0) {
            totalIn.value = (a * p).toFixed(2);
        }
    });

    // 2. Keičiant KAINĄ (Price)
    priceIn.addEventListener('input', () => {
        const p = val(priceIn);
        const a = val(amountIn);
        const t = val(totalIn);
        
        if (t > 0 && p > 0) {
            amountIn.value = (t / p).toFixed(6);
        } else if (a > 0) {
            totalIn.value = (a * p).toFixed(2);
        }
    });

    // 3. Keičiant SUMĄ (Total Cost)
    totalIn.addEventListener('input', () => {
        const t = val(totalIn);
        const p = val(priceIn);
        const a = val(amountIn);
        
        if (a > 0 && t > 0) {
            priceIn.value = (t / a).toFixed(8);
        } else if (p > 0) {
            amountIn.value = (t / p).toFixed(6);
        }
    });
}

// --- DATA LOADING (PATAISYTA) ---
async function loadAllData() {
    try {
        // PAKEITIMAS: Naudojame saugią getCryptoGoals() funkciją iš js/supabase.js
        const [coinsData, txData, goalsData] = await Promise.all([
            getSupportedCoins(),
            getTransactions(),
            getCryptoGoals() // NAUJAS, SAUGUS KVIETIMAS
        ]);
        
        coinsList = coinsData || [];
        transactions = txData || [];
        // Saugus goals duomenų priskyrimas
        goals = goalsData || [];
        
        await fetchCurrentPrices();
        const holdings = updateDashboard();
        generateHistoryChart();
        populateCoinSelect(holdings);
        populateDeleteSelect();
        renderJournal();
        renderGoals();
    } catch (e) {
        console.error('Error loading data:', e);
    }
}

async function fetchCurrentPrices() {
    if (coinsList.length === 0) return;
    const ids = coinsList.map(c => c.coingecko_id).join(',');
    
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        if (res.ok) {
            const newPrices = await res.json();
            prices = { ...prices, ...newPrices };
        }
    } catch (e) {
        console.warn("Price fetch error:", e);
    }
}

// --- DASHBOARD UPDATE ---
function updateDashboard() {
    const holdings = {};
    let totalInvested = 0;
    
    // Calculate holdings
    transactions.forEach(tx => {
        if (!holdings[tx.coin_symbol]) {
            holdings[tx.coin_symbol] = { qty: 0, invested: 0 };
        }
        
        if (tx.type === 'Buy') {
            holdings[tx.coin_symbol].qty += Number(tx.amount);
            holdings[tx.coin_symbol].invested += Number(tx.total_cost_usd);
            totalInvested += Number(tx.total_cost_usd);
        } else {
            holdings[tx.coin_symbol].qty -= Number(tx.amount);
            holdings[tx.coin_symbol].invested -= Number(tx.total_cost_usd);
            totalInvested -= Number(tx.total_cost_usd);
        }
    });
    
    // Calculate current value
    let totalValue = 0;
    Object.entries(holdings).forEach(([sym, data]) => {
        if (data.qty > 0) {
            const coin = coinsList.find(c => c.symbol === sym);
            if (coin && prices[coin.coingecko_id]) {
                totalValue += data.qty * prices[coin.coingecko_id].usd;
            }
        }
    });
    
    // Calculate P&L
    const pnl = totalValue - totalInvested;
    const pnlPercent = totalInvested > 0 ? (pnl / totalInvested * 100) : 0;
    
    // Update UI
    document.getElementById('header-total-value').innerText = formatMoney(totalValue);
    
    const pnlEl = document.getElementById('total-pnl');
    pnlEl.innerText = formatMoney(pnl);
    pnlEl.style.color = pnl >= 0 ? '#2dd4bf' : '#f87171';
    
    const pnlPercentEl = document.getElementById('total-pnl-percent');
    pnlPercentEl.innerText = (pnl >= 0 ? '+' : '') + pnlPercent.toFixed(2) + '%';
    pnlPercentEl.style.backgroundColor = pnl >= 0 ? '#14532d' : '#7f1d1d';
    pnlPercentEl.style.color = pnl >= 0 ? '#34d399' : '#fca5a5';
    
    return holdings;
}

function formatMoney(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

// --- CHART GENERATION ---
async function generateHistoryChart() {
    if (transactions.length === 0) {
        renderChart([], []);
        return;
    }
    
    const dates = transactions.map(t => new Date(t.date).getTime());
    const minDate = new Date(Math.min(...dates));
    const now = new Date();
    
    if (minDate > now) {
        renderChart(['Now'], [0]);
        return;
    }
    
    const startTimestamp = Math.floor(minDate.getTime() / 1000);
    const endTimestamp = Math.floor(Date.now() / 1000);
    const daysDiff = (endTimestamp - startTimestamp) / (60 * 60 * 24);
    
    const fetchChart = async (coinId) => {
        try {
            const days = Math.ceil(daysDiff) + 1;
            const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`);
            if (!res.ok) throw new Error("Rate Limit");
            const data = await res.json();
            return { id: coinId, prices: data.prices };
        } catch (e) {
            console.warn(`Chart fetch error for ${coinId}:`, e);
            return { id: coinId, prices: [] };
        }
    };
    
    const activeSymbols = [...new Set(transactions.map(t => t.coin_symbol))];
    const activeCoins = coinsList.filter(c => activeSymbols.includes(c.symbol));
    const chartsData = [];
    
    for (const coin of activeCoins) {
        // CoinGecko API vėlavimas, kad neviršytų API limitų
        if (chartsData.length > 0) await new Promise(r => setTimeout(r, 1000));
        const data = await fetchChart(coin.coingecko_id);
        chartsData.push(data);
    }
    
    const historyMap = {};
    chartsData.forEach(item => {
        const coinSym = coinsList.find(c => c.coingecko_id === item.id)?.symbol;
        if (!coinSym) return;
        historyMap[coinSym] = {};
        item.prices.forEach(([ts, price]) => {
            const dateStr = new Date(ts).toISOString().split('T')[0];
            historyMap[coinSym][dateStr] = price;
        });
    });
    
    const chartLabels = [];
    const chartData = [];
    
    for (let d = new Date(minDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        chartLabels.push(dateStr);
        
        let dailyValue = 0;
        const balances = {};
        
        transactions.forEach(tx => {
            const txDate = new Date(tx.date).toISOString().split('T')[0];
            if (txDate <= dateStr) {
                if (!balances[tx.coin_symbol]) balances[tx.coin_symbol] = 0;
                if (tx.type === 'Buy') {
                    balances[tx.coin_symbol] += Number(tx.amount);
                } else {
                    balances[tx.coin_symbol] -= Number(tx.amount);
                }
            }
        });
        
        for (const [sym, qty] of Object.entries(balances)) {
            if (qty > 0) {
                if (historyMap[sym] && historyMap[sym][dateStr]) {
                    dailyValue += qty * historyMap[sym][dateStr];
                } else {
                    const coin = coinsList.find(c => c.symbol === sym);
                    if (coin && prices[coin.coingecko_id]) {
                        dailyValue += qty * prices[coin.coingecko_id].usd;
                    }
                }
            }
        }
        chartData.push(dailyValue);
    }
    
    renderChart(chartLabels, chartData);
}

function renderChart(labels, data) {
    const ctxEl = document.getElementById('pnlChart');
    if (!ctxEl) return;
    
    if (myChart) myChart.destroy();
    
    const ctx = ctxEl.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0.3)');
    grad.addColorStop(1, 'rgba(45, 212, 191, 0.0)');
    
    let borderColor = '#2dd4bf';
    if (data.length > 1 && data[data.length - 1] < data[0]) {
        borderColor = '#f87171';
    }
    
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                borderColor: borderColor,
                backgroundColor: grad,
                borderWidth: 2,
                fill: true,
                tension: 0.2,
                pointRadius: 0,
                pointHitRadius: 10
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
                    callbacks: {
                        label: function(context) {
                            return formatMoney(context.parsed.y);
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

// --- JOURNAL RENDERING ---
function renderJournal() {
    const tbody = document.getElementById('journal-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-8 text-center text-xs text-gray-600">No transactions yet.</td></tr>';
        return;
    }
    
    const sortedTx = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedTx.forEach(tx => {
        const row = document.createElement('tr');
        const isBuy = tx.type === 'Buy';
        
        const dateObj = new Date(tx.date);
        const dateStr = dateObj.toLocaleDateString('lt-LT') + ' ' + 
                       dateObj.toLocaleTimeString('lt-LT', {hour: '2-digit', minute:'2-digit', hour12: false});
        
        const method = tx.method ? `<span class="text-[9px] text-gray-500 border border-gray-700 rounded px-1 ml-1">${tx.method}</span>` : '';
        const exchangeName = tx.exchange ? `<div class="text-[10px] text-gray-400 font-semibold mt-0.5">${tx.exchange}</div>` : '';
        const notesDisplay = tx.notes ? `<div class="text-[10px] text-primary-400/80 italic mt-1 leading-tight"><i class="fa-regular fa-note-sticky mr-1"></i>${tx.notes}</div>` : '';
        
        row.innerHTML = `
            <td class="px-4 py-3 align-top border-b border-gray-800/30">
                <div class="font-bold text-gray-200 text-sm flex items-center flex-wrap">${tx.coin_symbol} ${method}</div>
                ${exchangeName}
                <div class="text-[10px] text-gray-600 mt-0.5 mb-1">${dateStr}</div>
                ${notesDisplay}
            </td>
            <td class="px-4 py-3 text-right align-top border-b border-gray-800/30">
                <div class="text-xs text-gray-300 font-mono">${isBuy ? '+' : '-'}${Number(tx.amount).toFixed(4)}</div>
                <div class="text-[10px] text-gray-500">@ ${Number(tx.price_per_coin).toFixed(4)}</div>
            </td>
            <td class="px-4 py-3 text-right align-top border-b border-gray-800/30">
                <div class="font-bold text-sm text-gray-200">${formatMoney(tx.total_cost_usd)}</div>
                <div class="flex justify-end gap-3 mt-2">
                    <button onclick="onEditTx(${tx.id})" class="text-gray-500 hover:text-yellow-500 transition-colors text-xs px-2 py-1"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="onDeleteTx(${tx.id})" class="text-gray-500 hover:text-red-500 transition-colors text-xs px-2 py-1"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// --- GOALS RENDERING ---
function renderGoals() {
    const goalsContainer = document.getElementById('goals-container');
    const goalsSection = document.getElementById('goals-section');
    
    if (!goalsContainer || !goalsSection) return;
    
    if (goals.length === 0) {
        goalsSection.classList.add('hidden');
        return;
    }
    
    goalsSection.classList.remove('hidden');
    goalsContainer.innerHTML = '';
    
    goals.forEach(goal => {
        const holdings = {};
        transactions.forEach(tx => {
            if (tx.coin_symbol === goal.coin_symbol) {
                if (!holdings[tx.coin_symbol]) holdings[tx.coin_symbol] = 0;
                if (tx.type === 'Buy') holdings[tx.coin_symbol] += Number(tx.amount);
                else holdings[tx.coin_symbol] -= Number(tx.amount);
            }
        });
        
        const current = holdings[goal.coin_symbol] || 0;
        const target = Number(goal.target_amount);
        const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
        
        const goalEl = document.createElement('div');
        goalEl.className = 'bg-gray-900 border border-gray-800 rounded-xl p-4';
        goalEl.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="font-bold text-gray-200">${goal.coin_symbol}</span>
                <span class="text-xs text-gray-500">${current.toFixed(2)} / ${target.toFixed(0)}</span>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-2">
                <div class="bg-primary-500 h-2 rounded-full transition-all duration-500" style="width: ${progress}%"></div>
            </div>
            <div class="text-[10px] text-gray-500 mt-1 text-right">${progress.toFixed(1)}%</div>
        `;
        goalsContainer.appendChild(goalEl);
    });
}

// --- COIN SELECT POPULATION ---
function populateCoinSelect(holdings) {
    const select = document.getElementById('tx-coin');
    if (!select) return;
    
    select.innerHTML = '';
    
    // Priority coins first
    const priorityCoins = coinsList.filter(c => PRIORITY_COINS.includes(c.symbol));
    const otherCoins = coinsList.filter(c => !PRIORITY_COINS.includes(c.symbol));
    
    [...priorityCoins, ...otherCoins].forEach(coin => {
        const option = document.createElement('option');
        option.value = coin.symbol;
        option.textContent = coin.symbol;
        select.appendChild(option);
    });
}

function populateDeleteSelect() {
    const select = document.getElementById('delete-coin-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Pasirinkite --</option>';
    
    coinsList.forEach(coin => {
        const option = document.createElement('option');
        option.value = coin.symbol;
        option.textContent = coin.symbol;
        select.appendChild(option);
    });
}

// --- PRICE FETCHING ---
async function fetchPriceForForm() {
    const symbol = document.getElementById('tx-coin').value;
    const dStr = document.getElementById('tx-date-input').value;
    
    if (!dStr) {
        alert('Pasirinkite datą!');
        return;
    }
    
    const coin = coinsList.find(c => c.symbol === symbol);
    if (!coin) return;

    const btn = document.getElementById('btn-fetch-price');
    const oldText = btn.innerText;
    btn.innerText = '...';
    btn.disabled = true;
    
    try {
        let price = 0;
        const selectedDate = new Date(dStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);
        
        if (selectedDate.getTime() === today.getTime()) {
            const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingecko_id}&vs_currencies=usd`);
            const data = await res.json();
            price = data[coin.coingecko_id].usd;
        } else {
            const d = selectedDate.getDate().toString().padStart(2, '0');
            const m = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
            const y = selectedDate.getFullYear();
            const dateQuery = `${d}-${m}-${y}`;
            
            const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.coingecko_id}/history?date=${dateQuery}`);
            const data = await res.json();
            
            if (data.market_data && data.market_data.current_price) {
                price = data.market_data.current_price.usd;
            } else {
                alert("Istorinė kaina nerasta šiai datai.");
            }
        }
        
        if (price > 0) {
            const priceInput = document.getElementById('tx-price');
            priceInput.value = price;
            priceInput.dispatchEvent(new Event('input'));
        }
    } catch (e) {
        console.error(e);
        alert("Nepavyko gauti kainos. Bandykite vėliau.");
    }
    
    btn.innerText = oldText;
    btn.disabled = false;
}

// --- TRANSACTION HANDLERS ---
window.onEditTx = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    openModal('add-modal');
    
    setTimeout(() => {
        document.getElementById('tx-id').value = tx.id;
        document.getElementById('tx-type').value = tx.type;
        
        const parts = tx.date.split('T');
        if (parts.length >= 1) document.getElementById('tx-date-input').value = parts[0];
        if (parts.length >= 2) document.getElementById('tx-time-input').value = parts[1].slice(0, 5);
        
        document.getElementById('tx-coin').value = tx.coin_symbol;
        document.getElementById('tx-exchange').value = tx.exchange || '';
        document.getElementById('tx-method').value = tx.method || 'Market Buy';
        document.getElementById('tx-amount').value = tx.amount;
        document.getElementById('tx-price').value = tx.price_per_coin;
        document.getElementById('tx-total').value = tx.total_cost_usd;
        document.getElementById('tx-notes').value = tx.notes || '';
        
        document.getElementById('modal-title').innerText = "Edit Transaction";
        const btn = document.getElementById('btn-save');
        btn.innerText = "Update Transaction";
        btn.classList.remove('bg-primary-600', 'hover:bg-primary-500');
        btn.classList.add('bg-yellow-600', 'hover:bg-yellow-500');
    }, 50);
};

window.onDeleteTx = async function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    const confirmMsg = `Ar tikrai norite ištrinti šią transakciją?\n\n${tx.coin_symbol} ${tx.type}\nKiekis: ${tx.amount}\nData: ${new Date(tx.date).toLocaleDateString('lt-LT')}`;
    
    if (confirm(confirmMsg)) {
        const success = await deleteTransaction(id);
        if (success) {
            await loadAllData();
        }
    }
};

async function handleTxSubmit(e) {
    e.preventDefault();
    
    const btn = document.getElementById('btn-save');
    const oldText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;
    
    const txId = document.getElementById('tx-id').value;
    const rawAmount = document.getElementById('tx-amount').value;
    const rawPrice = document.getElementById('tx-price').value;
    const rawTotal = document.getElementById('tx-total').value;
    const dStr = document.getElementById('tx-date-input').value;
    const tStr = document.getElementById('tx-time-input').value || '00:00';
    
    // Validation
    if (!rawAmount || !rawPrice || !rawTotal || !dStr) {
        alert('Užpildykite visus būtinus laukus!');
        btn.innerText = oldText;
        btn.disabled = false;
        return;
    }
    
    const amount = parseFloat(rawAmount);
    const price = parseFloat(rawPrice);
    const total = parseFloat(rawTotal);
    
    if (amount <= 0 || price <= 0 || total <= 0) {
        alert('Reikšmės turi būti didesnės už nulį!');
        btn.innerText = oldText;
        btn.disabled = false;
        return;
    }
    
    const finalDate = `${dStr}T${tStr}:00`;
    
    const txData = {
        date: finalDate,
        type: document.getElementById('tx-type').value,
        coin_symbol: document.getElementById('tx-coin').value,
        exchange: document.getElementById('tx-exchange').value || null,
        method: document.getElementById('tx-method').value,
        notes: document.getElementById('tx-notes').value || null,
        amount: amount,
        price_per_coin: price,
        total_cost_usd: total
    };
    
    let success = false;
    if (txId) {
        success = await updateTransaction(txId, txData);
    } else {
        success = await saveTransaction(txData);
    }
    
    if (success) {
        closeModal('add-modal');
        await loadAllData();
    }
    
    btn.innerText = oldText;
    btn.disabled = false;
}

// --- COIN MANAGEMENT ---
async function handleNewCoinSubmit() {
    const symbol = document.getElementById('new-coin-symbol').value.trim().toUpperCase();
    const coingeckoId = document.getElementById('new-coin-id').value.trim().toLowerCase();
    const targetRaw = document.getElementById('new-coin-target').value;
    
    if (!symbol || !coingeckoId) {
        alert('Užpildykite simbolį ir CoinGecko ID!');
        return;
    }
    
    const btn = document.getElementById('btn-save-coin');
    const oldText = btn.innerText;
    btn.innerText = 'Saving...';
    btn.disabled = true;
    
    try {
        const coinData = { symbol, coingecko_id: coingeckoId };
        const success = await saveNewCoin(coinData);
        
        if (success && targetRaw) {
            const target = parseFloat(targetRaw);
            if (target > 0) {
                // Naudojame naują funkciją iš supabase.js, kuri valdo upsertą
                await saveOrUpdateGoal(symbol, target); 
            }
        }
        
        if (success) {
            document.getElementById('new-coin-symbol').value = '';
            document.getElementById('new-coin-id').value = '';
            document.getElementById('new-coin-target').value = '';
            closeModal('new-coin-modal');
            await loadAllData();
        }
    } catch (e) {
        // Klaida iš supabase.js bus parodyta ten, čia tik loguojam
        console.error(e);
    }
    
    btn.innerText = oldText;
    btn.disabled = false;
}

async function handleDeleteCoinSubmit() {
    const select = document.getElementById('delete-coin-select');
    const sym = select.value;
    
    if (!sym) {
        alert('Pasirinkite monetą!');
        return;
    }
    
    // Check if there are transactions for this coin
    const hasTx = transactions.some(tx => tx.coin_symbol === sym);
    
    let confirmMsg = `Ar tikrai norite ištrinti ${sym}?`;
    if (hasTx) {
        confirmMsg += `\n\n⚠️ DĖMESIO: Šiai monetai yra ${transactions.filter(tx => tx.coin_symbol === sym).length} transakcijų!\nIštrinus monetą, VISOS jos transakcijos taip pat bus ištrintos!`;
    }
    
    if (confirm(confirmMsg)) {
        const btn = document.getElementById('btn-delete-coin');
        const oldText = btn.innerText;
        btn.innerText = 'Deleting...';
        btn.disabled = true;
        
        try {
            const { data: { user } } = await _supabase.auth.getUser();
            if (user) {
                // 1. Delete transactions first
                if (hasTx) {
                    await _supabase
                        .from('crypto_transactions')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('coin_symbol', sym);
                }
                
                // 2. Delete goals
                await _supabase
                    .from('crypto_goals')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('coin_symbol', sym);
                
                // 3. Delete coin
                await deleteSupportedCoin(sym);
            }
            
            closeModal('delete-coin-modal');
            await loadAllData();
        } catch (e) {
            // Klaida bus rodoma iš supabase.js
            console.error(e);
        }
        
        btn.innerText = oldText;
        btn.disabled = false;
    }
}
