// js/app.js - Versija 1.4.3 (Visible Notes Fix)

let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;
const PRIORITY_COINS = ['BTC', 'ETH', 'KAS', 'SOL', 'BNB'];

document.addEventListener('DOMContentLoaded', async () => {
    console.log("App started v1.4.3");
    
    // Auth Listener
    _supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app-content').classList.remove('hidden');
            loadAllData();
        } else {
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('app-content').classList.add('hidden');
            clearData();
        }
    });

    setupAuthHandlers();
    setupAppListeners();
});

// --- AUTH HANDLERS ---
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
        try { await userLogin(emailInput.value, passInput.value); } 
        catch (e) { errText.textContent = e.message; errText.classList.remove('hidden'); }
    });

    document.getElementById('btn-signup').addEventListener('click', async () => {
        if (!validate()) return;
        try { await userSignUp(emailInput.value, passInput.value); alert("Registracija sėkminga!"); } 
        catch (e) { errText.textContent = e.message; errText.classList.remove('hidden'); }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => await userSignOut());
}

function clearData() {
    document.getElementById('journal-body').innerHTML = '';
    document.getElementById('header-total-value').innerText = '$0.00';
}

function setupAppListeners() {
    // Transaction Form Handler
    const form = document.getElementById('add-tx-form');
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', handleTxSubmit);
        setupCalculator(); // Activate calculator logic
    }

    // Coin Management Handlers
    document.getElementById('btn-save-coin').addEventListener('click', handleNewCoinSubmit);
    document.getElementById('btn-delete-coin').addEventListener('click', handleDeleteCoinSubmit);
    
    // Price Fetch Handler
    const btnFetch = document.getElementById('btn-fetch-price');
    btnFetch.replaceWith(btnFetch.cloneNode(true));
    document.getElementById('btn-fetch-price').addEventListener('click', fetchPriceForForm);
}

// --- CALCULATOR (Three-way) ---
function setupCalculator() {
    const amountIn = document.getElementById('tx-amount');
    const priceIn = document.getElementById('tx-price');
    const totalIn = document.getElementById('tx-total');
    if (!amountIn) return;

    amountIn.addEventListener('input', () => {
        if(amountIn.value && priceIn.value) totalIn.value = (amountIn.value * priceIn.value).toFixed(2);
    });
    priceIn.addEventListener('input', () => {
        if(amountIn.value && priceIn.value) totalIn.value = (amountIn.value * priceIn.value).toFixed(2);
    });
    totalIn.addEventListener('input', () => {
        const t = parseFloat(totalIn.value);
        const a = parseFloat(amountIn.value);
        const p = parseFloat(priceIn.value);
        if (t && a) priceIn.value = (t / a).toFixed(8);
        else if (t && p) amountIn.value = (t / p).toFixed(6);
    });
}

// --- DATA LOADING ---
async function loadAllData() {
    try {
        const [coinsData, txData, goalsData] = await Promise.all([
            getSupportedCoins(),
            getTransactions(),
            _supabase.from('crypto_goals').select('*')
        ]);
        coinsList = coinsData || [];
        transactions = txData || [];
        goals = goalsData.data || [];

        await fetchCurrentPrices();
        const holdings = updateDashboard();
        populateCoinSelect(holdings);
        populateDeleteSelect();
        renderJournal();
    } catch (e) { console.error(e); }
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
    } catch (e) { console.warn("Price error"); }
}

// --- SMART PRICE FETCH (History aware) ---
async function fetchPriceForForm() {
    const symbol = document.getElementById('tx-coin').value;
    const dateVal = document.getElementById('tx-date').value;
    const coin = coinsList.find(c => c.symbol === symbol);
    if (!coin) return;

    const btn = document.getElementById('btn-fetch-price');
    const oldText = btn.innerText;
    btn.innerText = '...';

    try {
        let price = 0;
        const selectedDate = new Date(dateVal);
        const today = new Date();
        
        // If date is today/future -> Live Price
        if (selectedDate.toDateString() === today.toDateString()) {
            const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingecko_id}&vs_currencies=usd`);
            const data = await res.json();
            price = data[coin.coingecko_id].usd;
        } else {
            // If date is past -> History API
            const d = selectedDate.getDate().toString().padStart(2, '0');
            const m = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
            const y = selectedDate.getFullYear();
            const dateStr = `${d}-${m}-${y}`;
            
            const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.coingecko_id}/history?date=${dateStr}`);
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
            priceInput.dispatchEvent(new Event('input')); // Trigger calculator
        }
    } catch (e) { 
        console.error(e);
        alert("Nepavyko gauti kainos."); 
    }
    btn.innerText = oldText;
}

// --- RENDER JOURNAL (Visible Notes) ---
function renderJournal() {
    const tbody = document.getElementById('journal-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-xs text-gray-600">No transactions yet.</td></tr>';
        return;
    }
    
    const sortedTx = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedTx.forEach(tx => {
        const row = document.createElement('tr');
        const isBuy = tx.type === 'Buy';
        
        // Formatuojame datą
        const dateObj = new Date(tx.date);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Elementai
        const method = tx.method ? `<span class="text-[9px] text-gray-500 border border-gray-700 rounded px-1 ml-1">${tx.method}</span>` : '';
        const exchangeName = tx.exchange ? `<div class="text-[10px] text-gray-400 font-semibold mt-0.5">${tx.exchange}</div>` : '';

        // PASTABOS: Rodomos visada kaip tekstas
        const notesDisplay = tx.notes ? `<div class="text-[10px] text-primary-400/80 italic mt-1 leading-tight"><i class="fa-regular fa-note-sticky mr-1"></i>${tx.notes}</div>` : '';

        row.innerHTML = `
            <td class="px-4 py-3 align-top border-b border-gray-800/30">
                <div class="font-bold text-gray-200 text-sm flex items-center flex-wrap">
                    ${tx.coin_symbol} 
                    ${method}
                </div>
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

// --- ACTIONS: EDIT & DELETE ---
window.onEditTx = function(id) {
    const tx = transactions.find(t => t.id === id);
    if(!tx) return;

    // 1. OPEN MODAL (Resets form)
    openModal('add-modal');

    // 2. POPULATE DATA (Delayed to override reset)
    setTimeout(() => {
        document.getElementById('tx-id').value = tx.id;
        document.getElementById('tx-type').value = tx.type;
        
        // Date convert to ISO for input
        const d = new Date(tx.date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        document.getElementById('tx-date').value = d.toISOString().slice(0, 16);
        
        document.getElementById('tx-coin').value = tx.coin_symbol;
        document.getElementById('tx-exchange').value = tx.exchange;
        document.getElementById('tx-method').value = tx.method || 'Market Buy';
        document.getElementById('tx-amount').value = tx.amount;
        document.getElementById('tx-price').value = tx.price_per_coin;
        document.getElementById('tx-total').value = tx.total_cost_usd;
        document.getElementById('tx-notes').value = tx.notes || '';

        // Change UI to Edit Mode
        document.getElementById('modal-title').innerText = "Edit Transaction";
        const btn = document.getElementById('btn-save');
        btn.innerText = "Update Transaction";
        btn.classList.remove('bg-primary-600', 'hover:bg-primary-500');
        btn.classList.add('bg-yellow-600', 'hover:bg-yellow-500');
    }, 50);
};

window.onDeleteTx = async function(id) {
    if(confirm("Are you sure you want to delete this transaction?")) {
        await deleteTransaction(id);
        await loadAllData();
    }
};

// --- HANDLERS ---
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

    const txData = {
        date: document.getElementById('tx-date').value,
        type: document.getElementById('tx-type').value,
        coin_symbol: document.getElementById('tx-coin').value,
        exchange: document.getElementById('tx-exchange').value,
        method: document.getElementById('tx-method').value,
        notes: document.getElementById('tx-notes').value,
        amount: parseFloat(rawAmount),
        price_per_coin: parseFloat(rawPrice),
        total_cost_usd: parseFloat(rawTotal)
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

// --- DASHBOARD HELPERS ---
function updateDashboard() {
    let holdings = {};
    let totalInvested = 0;
    transactions.forEach(tx => {
        if (!holdings[tx.coin_symbol]) holdings[tx.coin_symbol] = 0;
        const amt = Number(tx.amount);
        const cost = Number(tx.total_cost_usd);
        if (tx.type === 'Buy') { holdings[tx.coin_symbol] += amt; totalInvested += cost; }
        else { holdings[tx.coin_symbol] -= amt; totalInvested -= cost; }
    });

    let currentVal = 0;
    for (const [symbol, amount] of Object.entries(holdings)) {
        if (amount <= 0.0000001) continue;
        const coin = coinsList.find(c => c.symbol === symbol);
        if (coin && prices[coin.coingecko_id]) currentVal += amount * prices[coin.coingecko_id].usd;
    }

    document.getElementById('header-total-value').innerText = formatMoney(currentVal);
    const pnl = currentVal - totalInvested;
    const pnlEl = document.getElementById('total-pnl');
    const pnlPercEl = document.getElementById('total-pnl-percent');
    if (pnlEl) {
        pnlEl.innerText = `${pnl >= 0 ? '+' : ''}${formatMoney(pnl)}`;
        pnlEl.className = `text-2xl font-bold ${pnl >= 0 ? 'text-primary-400' : 'text-red-400'}`;
    }
    if (pnlPercEl) {
        let percent = totalInvested > 0 ? (pnl / totalInvested * 100) : 0;
        pnlPercEl.innerText = `${percent.toFixed(2)}%`;
        pnlPercEl.className = `text-xs font-bold px-2 py-0.5 rounded bg-gray-800 ${pnl >= 0 ? 'text-primary-400' : 'text-red-400'}`;
    }
    renderChart(totalInvested, currentVal);
    renderGoals(holdings);
    return holdings;
}

function renderGoals(holdings) {
    const container = document.getElementById('goals-container');
    const section = document.getElementById('goals-section');
    if (!container || !section) return;
    container.innerHTML = '';
    if (goals.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    goals.forEach(goal => {
        const current = holdings[goal.coin_symbol] || 0;
        const target = Number(goal.target_amount);
        if (target <= 0) return;
        const pct = Math.min(100, (current / target) * 100);
        const div = document.createElement('div');
        div.className = 'bg-gray-900 border border-gray-800 p-3 rounded-xl';
        div.innerHTML = `
            <div class="flex justify-between text-xs mb-1">
                <span class="font-bold text-gray-300">${goal.coin_symbol}</span><span class="text-primary-400 font-bold">${pct.toFixed(1)}%</span>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden"><div class="bg-primary-500 h-1.5 rounded-full" style="width: ${pct}%"></div></div>
            <div class="text-[9px] text-gray-500 mt-1 text-right font-mono">${current.toLocaleString()} / ${target.toLocaleString()}</div>
        `;
        container.appendChild(div);
    });
}

function renderChart(invested, current) {
    const ctxEl = document.getElementById('pnlChart');
    if (!ctxEl) return;
    if (myChart) myChart.destroy();
    const ctx = ctxEl.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0.2)'); grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels: ['Invested', 'Current'], datasets: [{ data: [invested, current], borderColor: '#2dd4bf', backgroundColor: grad, borderWidth: 2, fill: true, tension: 0.3, pointRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    });
}

function formatMoney(amount) {
    const num = Number(amount);
    if (num === 0) return '$0.00';
    if (num < 1 && num > -1) return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function populateCoinSelect(holdings = {}) {
    const select = document.getElementById('tx-coin');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '';
    const sortedCoins = [...coinsList].sort((a, b) => a.symbol.localeCompare(b.symbol));
    sortedCoins.forEach(coin => {
        const option = document.createElement('option');
        option.value = coin.symbol;
        const hasBalance = (holdings[coin.symbol] || 0) > 0;
        option.textContent = hasBalance ? `★ ${coin.symbol}` : coin.symbol;
        select.appendChild(option);
    });
    if (currentVal) select.value = currentVal;
}

function populateDeleteSelect() {
    const select = document.getElementById('delete-coin-select');
    if (!select) return;
    select.innerHTML = '';
    coinsList.forEach(c => {
        const o = document.createElement('option');
        o.value = c.symbol;
        o.textContent = c.symbol;
        select.appendChild(o);
    });
}

async function handleNewCoinSubmit() {
    const sym = document.getElementById('new-coin-symbol').value.toUpperCase();
    const id = document.getElementById('new-coin-id').value.toLowerCase();
    const target = document.getElementById('new-coin-target').value;
    if (!sym || !id) return;
    await saveNewCoin({ symbol: sym, coingecko_id: id, name: sym });
    if (target) {
        const { data: { user } } = await _supabase.auth.getUser();
        await _supabase.from('crypto_goals').upsert({ user_id: user.id, coin_symbol: sym, target_amount: Number(target) }, { onConflict: 'user_id, coin_symbol' });
    }
    closeModal('new-coin-modal');
    await loadAllData();
}

async function handleDeleteCoinSubmit() {
    const sym = document.getElementById('delete-coin-select').value;
    if (confirm("Delete?")) {
        await deleteSupportedCoin(sym);
        closeModal('delete-coin-modal');
        await loadAllData();
    }
}
