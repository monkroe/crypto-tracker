// js/app.js - Versija 1.6.7 (Clean Inputs & Fixed Triangle Calc)

const APP_VERSION = '1.6.7';

let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;
const PRIORITY_COINS = ['BTC', 'ETH', 'KAS', 'SOL', 'BNB'];

document.addEventListener('DOMContentLoaded', async () => {
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
        } return true;
    }
    document.getElementById('btn-login').addEventListener('click', async () => {
        if (!validate()) return;
        try { const { error } = await userLogin(emailInput.value, passInput.value); if (error) throw error; } 
        catch (e) { errText.textContent = e.message; errText.classList.remove('hidden'); }
    });
    document.getElementById('btn-signup').addEventListener('click', async () => {
        if (!validate()) return;
        try { const { error } = await userSignUp(emailInput.value, passInput.value); if (error) throw error; alert("Registracija sėkminga!"); } 
        catch (e) { errText.textContent = e.message; errText.classList.remove('hidden'); }
    });
    document.getElementById('btn-logout').addEventListener('click', async () => await userSignOut());
}

function clearData() {
    document.getElementById('journal-body').innerHTML = '';
    document.getElementById('header-total-value').innerText = '$0.00';
    coinsList = []; transactions = [];
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

// --- FIXED CALCULATOR ---
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

        // Jei turime Sumą (Total) ir įvedame Kiekį -> Skaičiuojame Kainą (Recurring Buy atvejis)
        if (t > 0 && a > 0) {
            priceIn.value = (t / a).toFixed(8);
        }
        // Kitu atveju, jei turime Kainą -> Skaičiuojame Sumą
        else if (p > 0) {
            totalIn.value = (a * p).toFixed(2);
        }
    });

    // 2. Keičiant KAINĄ (Price)
    priceIn.addEventListener('input', () => {
        const p = val(priceIn);
        const a = val(amountIn);
        const t = val(totalIn);
        
        // Jei turime Sumą -> Perskaičiuojame Kiekį
        if (t > 0 && p > 0) {
            amountIn.value = (t / p).toFixed(6);
        }
        // Jei neturime Sumos, bet turime Kiekį -> Skaičiuojame Sumą
        else if (a > 0) {
             totalIn.value = (a * p).toFixed(2);
        }
    });

    // 3. Keičiant SUMĄ (Total Cost)
    totalIn.addEventListener('input', () => {
        const t = val(totalIn);
        const p = val(priceIn);
        const a = val(amountIn);
        
        // Jei turime Kiekį -> Skaičiuojame Kainą (Recurring Buy atvejis)
        if (a > 0 && t > 0) {
            priceIn.value = (t / a).toFixed(8);
        }
        // Jei turime Kainą -> Skaičiuojame Kiekį (Standartinis pirkimas)
        else if (p > 0) {
            amountIn.value = (t / p).toFixed(6);
        }
    });
}

// --- DATA & CHARTS ---
async function loadAllData() {
    try {
        const [coinsData, txData, goalsData] = await Promise.all([
            getSupportedCoins(), getTransactions(), _supabase.from('crypto_goals').select('*')
        ]);
        coinsList = coinsData || []; transactions = txData || []; goals = goalsData.data || [];
        await fetchCurrentPrices();
        const holdings = updateDashboard(); 
        generateHistoryChart();
        populateCoinSelect(holdings); populateDeleteSelect(); renderJournal();
    } catch (e) { console.error(e); }
}

async function fetchCurrentPrices() {
    if (coinsList.length === 0) return;
    const ids = coinsList.map(c => c.coingecko_id).join(',');
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        if (res.ok) { const newPrices = await res.json(); prices = { ...prices, ...newPrices }; }
    } catch (e) { console.warn("Price error"); }
}

async function generateHistoryChart() {
    if (transactions.length === 0) { renderChart([], []); return; }
    const dates = transactions.map(t => new Date(t.date).getTime());
    const minDate = new Date(Math.min(...dates));
    const now = new Date();
    if (minDate > now) { renderChart(['Now'], [0]); return; }
    const startTimestamp = Math.floor(minDate.getTime() / 1000);
    const endTimestamp = Math.floor(Date.now() / 1000);
    const daysDiff = (endTimestamp - startTimestamp) / (60 * 60 * 24);
    
    const fetchChart = async (coinId) => {
        try {
            const days = Math.ceil(daysDiff) + 1; 
            const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`);
            if (!res.ok) throw new Error("Rate Limit");
            const data = await res.json(); return { id: coinId, prices: data.prices };
        } catch (e) { return { id: coinId, prices: [] }; }
    };
    const activeSymbols = [...new Set(transactions.map(t => t.coin_symbol))];
    const activeCoins = coinsList.filter(c => activeSymbols.includes(c.symbol));
    const chartsData = [];
    for (const coin of activeCoins) {
        if (chartsData.length > 0) await new Promise(r => setTimeout(r, 1000));
        const data = await fetchChart(coin.coingecko_id); chartsData.push(data);
    }
    const historyMap = {}; 
    chartsData.forEach(item => {
        const coinSym = coinsList.find(c => c.coingecko_id === item.id)?.symbol;
        if (!coinSym) return;
        historyMap[coinSym] = {};
        item.prices.forEach(([ts, price]) => {
            const dateStr = new Date(ts).toISOString().split('T')[0]; historyMap[coinSym][dateStr] = price;
        });
    });
    const chartLabels = []; const chartData = [];
    for (let d = new Date(minDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]; chartLabels.push(dateStr);
        let dailyValue = 0; const balances = {};
        transactions.forEach(tx => {
            const txDate = new Date(tx.date).toISOString().split('T')[0];
            if (txDate <= dateStr) {
                if (!balances[tx.coin_symbol]) balances[tx.coin_symbol] = 0;
                if (tx.type === 'Buy') balances[tx.coin_symbol] += Number(tx.amount); else balances[tx.coin_symbol] -= Number(tx.amount);
            }
        });
        for (const [sym, qty] of Object.entries(balances)) {
            if (qty > 0) {
                if (historyMap[sym] && historyMap[sym][dateStr]) dailyValue += qty * historyMap[sym][dateStr];
                else { const coin = coinsList.find(c => c.symbol === sym); if (coin && prices[coin.coingecko_id]) dailyValue += qty * prices[coin.coingecko_id].usd; }
            }
        } chartData.push(dailyValue);
    } renderChart(chartLabels, chartData);
}

function renderChart(labels, data) {
    const ctxEl = document.getElementById('pnlChart'); if (!ctxEl) return;
    if (myChart) myChart.destroy();
    const ctx = ctxEl.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0.3)'); grad.addColorStop(1, 'rgba(45, 212, 191, 0.0)');
    let borderColor = '#2dd4bf'; if (data.length > 1 && data[data.length - 1] < data[0]) borderColor = '#f87171';
    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ data: data, borderColor: borderColor, backgroundColor: grad, borderWidth: 2, fill: true, tension: 0.2, pointRadius: 0, pointHitRadius: 10 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { display: false }, y: { display: false } }, interaction: { mode: 'nearest', axis: 'x', intersect: false } }
    });
}

function renderJournal() {
    const tbody = document.getElementById('journal-body'); if (!tbody) return; tbody.innerHTML = '';
    if (transactions.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-xs text-gray-600">No transactions yet.</td></tr>'; return; }
    const sortedTx = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    sortedTx.forEach(tx => {
        const row = document.createElement('tr'); const isBuy = tx.type === 'Buy';
        const dateObj = new Date(tx.date);
        const dateStr = dateObj.toLocaleDateString('lt-LT') + ' ' + dateObj.toLocaleTimeString('lt-LT', {hour: '2-digit', minute:'2-digit', hour12: false});
        const method = tx.method ? `<span class="text-[9px] text-gray-500 border border-gray-700 rounded px-1 ml-1">${tx.method}</span>` : '';
        const exchangeName = tx.exchange ? `<div class="text-[10px] text-gray-400 font-semibold mt-0.5">${tx.exchange}</div>` : '';
        const notesDisplay = tx.notes ? `<div class="text-[10px] text-primary-400/80 italic mt-1 leading-tight"><i class="fa-regular fa-note-sticky mr-1"></i>${tx.notes}</div>` : '';
        row.innerHTML = `
            <td class="px-4 py-3 align-top border-b border-gray-800/30">
                <div class="font-bold text-gray-200 text-sm flex items-center flex-wrap">${tx.coin_symbol} ${method}</div>
                ${exchangeName}
                <div class="text-[10px] text-gray-600 mt-0.5 mb-1">${dateStr}</div> ${notesDisplay}
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
        `; tbody.appendChild(row);
    });
}

async function fetchPriceForForm() {
    const symbol = document.getElementById('tx-coin').value;
    const dStr = document.getElementById('tx-date-input').value;
    if (!dStr) return;
    const coin = coinsList.find(c => c.symbol === symbol);
    if (!coin) return;

    const btn = document.getElementById('btn-fetch-price'); const oldText = btn.innerText; btn.innerText = '...';
    try {
        let price = 0;
        const selectedDate = new Date(dStr);
        const today = new Date();
        
        if (selectedDate.toDateString() === today.toDateString()) {
            const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingecko_id}&vs_currencies=usd`);
            const data = await res.json(); price = data[coin.coingecko_id].usd;
        } else {
            const d = selectedDate.getDate().toString().padStart(2, '0');
            const m = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
            const y = selectedDate.getFullYear();
            const dateQuery = `${d}-${m}-${y}`;
            const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.coingecko_id}/history?date=${dateQuery}`);
            const data = await res.json();
            if (data.market_data && data.market_data.current_price) price = data.market_data.current_price.usd;
            else alert("Istorinė kaina nerasta šiai datai.");
        }
        if (price > 0) {
            const priceInput = document.getElementById('tx-price');
            priceInput.value = price;
            // TRIGGER INPUT TO RECALCULATE
            priceInput.dispatchEvent(new Event('input'));
        }
    } catch (e) { console.error(e); alert("Nepavyko gauti kainos."); }
    btn.innerText = oldText;
}

window.onEditTx = function(id) {
    const tx = transactions.find(t => t.id === id);
    if(!tx) return;
    openModal('add-modal');
    setTimeout(() => {
        document.getElementById('tx-id').value = tx.id;
        document.getElementById('tx-type').value = tx.type;
        const parts = tx.date.split('T');
        if (parts.length >= 1) document.getElementById('tx-date-input').value = parts[0];
        if (parts.length >= 2) document.getElementById('tx-time-input').value = parts[1].slice(0, 5);
        document.getElementById('tx-coin').value = tx.coin_symbol;
        document.getElementById('tx-exchange').value = tx.exchange;
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

async function handleTxSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save'); const oldText = btn.innerText; btn.innerText = "Saving..."; btn.disabled = true;
    const txId = document.getElementById('tx-id').value;
    const rawAmount = document.getElementById('tx-amount').value;
    const rawPrice = document.getElementById('tx-price').value;
    const rawTotal = document.getElementById('tx-total').value;
    const dStr = document.getElementById('tx-date-input').value;
    const tStr = document.getElementById('tx-time-input').value || '00:00';
    const finalDate = `${dStr}T${tStr}:00`;
    const txData = {
        date: finalDate,
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
    if (txId) success = await updateTransaction(txId, txData);
    else success = await saveTransaction(txData);
    if (success) { closeModal('add-modal'); await loadAllData(); }
    btn.innerText = oldText; btn.disabled = false;
}

async function handleDeleteCoinSubmit() {
    const select = document.getElementById('delete-coin-select');
    const sym = select.value;
    if (!sym) return;

    if (confirm(`Ar tikrai norite ištrinti ${sym}? Tai panaikins ir šios monetos tikslus.`)) {
        const { data: { user } } = await _supabase.auth.getUser();
        if (user) {
            await deleteSupportedCoin(sym);
            await _supabase.from('crypto_goals').delete().eq('user_id', user.id).eq('coin_symbol', sym);
        }
        closeModal('delete-coin-modal');
        await loadAllData();
    }
}
