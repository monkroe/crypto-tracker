// js/app.js - Versija 1.7.8 (Ištaisyta validacija ir datos formatavimas)

const APP_VERSION = '1.7.8';

let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;
const PRIORITY_COINS = ['BTC', 'ETH', 'KAS', 'SOL', 'BNB'];

document.addEventListener('DOMContentLoaded', async () => {
    console.log(`App started v${APP_VERSION}`);
    const versionEl = document.querySelector('footer p:nth-child(3) span');
    if (versionEl) versionEl.innerText = APP_VERSION;
    
    // Pradinis sesijos tikrinimas
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');
        loadAllData();
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app-content').classList.add('hidden');
    }

    _supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app-content').classList.remove('hidden');
            loadAllData();
        } else if (event === 'SIGNED_OUT') {
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('app-content').classList.add('hidden');
            clearData();
        }
    });

    setupAuthHandlers();
    setupAppListeners();
});

// --- UI HELPERS / AUTH HANDLERS ---
function setupAuthHandlers() {
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-pass');
    const errText = document.getElementById('auth-error');

    function validateInputs() {
        const email = emailInput.value.trim();
        const pass = passInput.value.trim();
        if (!email || !pass) {
            errText.textContent = "⚠️ Prašome įvesti el. paštą ir slaptažodį.";
            errText.classList.remove('hidden');
            return false;
        }
        errText.classList.add('hidden');
        return true;
    }

    document.getElementById('btn-login').addEventListener('click', async () => {
        if (!validateInputs()) return;
        const btn = document.getElementById('btn-login');
        const originalText = btn.innerText;
        btn.innerText = "Jungiama...";
        btn.disabled = true;
        try {
            const { error } = await userLogin(emailInput.value, passInput.value);
            if (error) throw error;
        } catch (e) {
            errText.textContent = "Klaida: " + (e.message || 'Prisijungti nepavyko.');
            errText.classList.remove('hidden');
            btn.innerText = originalText;
        }
        btn.disabled = false;
    });

    document.getElementById('btn-signup').addEventListener('click', async () => {
        if (!validateInputs()) return;
        const btn = document.getElementById('btn-signup');
        const originalText = btn.innerText;
        btn.innerText = "Registruojama...";
        btn.disabled = true;
        try {
            const { error } = await userSignUp(emailInput.value, passInput.value);
            if (error) throw error;
            alert("Registracija sėkminga! Patikrinkite el. paštą (jei reikia) ir prisijunkite.");
            btn.innerText = originalText;
        } catch (e) {
            errText.textContent = "Registracijos klaida: " + (e.message || 'Nepavyko užregistruoti.');
            errText.classList.remove('hidden');
            btn.innerText = originalText;
        }
        btn.disabled = false;
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        if (confirm('Ar tikrai norite atsijungti?')) {
            await userSignOut();
        }
    });
}

function clearData() {
    document.getElementById('journal-body').innerHTML = '<tr><td colspan="3" class="px-4 py-8 text-center text-xs text-gray-600">No transactions yet.</td></tr>';
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
    
    document.getElementById('btn-save-coin').replaceWith(document.getElementById('btn-save-coin').cloneNode(true));
    document.getElementById('btn-save-coin').addEventListener('click', handleNewCoinSubmit);
    
    document.getElementById('btn-delete-coin').replaceWith(document.getElementById('btn-delete-coin').cloneNode(true));
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

    amountIn.addEventListener('input', () => {
        const a = val(amountIn);
        const p = val(priceIn);
        const t = val(totalIn);
        if (t > 0 && a > 0) { priceIn.value = (t / a).toFixed(8); } 
        else if (p > 0) { totalIn.value = (a * p).toFixed(2); }
    });

    priceIn.addEventListener('input', () => {
        const p = val(priceIn);
        const a = val(amountIn);
        const t = val(totalIn);
        if (t > 0 && p > 0) { amountIn.value = (t / p).toFixed(6); } 
        else if (a > 0) { totalIn.value = (a * p).toFixed(2); }
    });

    totalIn.addEventListener('input', () => {
        const t = val(totalIn);
        const p = val(priceIn);
        const a = val(amountIn);
        if (a > 0 && t > 0) { priceIn.value = (t / a).toFixed(8); } 
        else if (p > 0) { amountIn.value = (t / p).toFixed(6); }
    });
}

// ===============================================
// HELPER FUNKCIJOS
// ===============================================
function formatMoney(value) {
    const num = Number(value);
    const options = {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: num > -1 && num < 1 ? 8 : 2
    };
    return new Intl.NumberFormat('en-US', options).format(value);
}

// ===============================================
// DATA LOADING
// ===============================================

async function loadAllData() {
    const journalBody = document.getElementById('journal-body');
    if (journalBody) journalBody.innerHTML = '<tr><td colspan="3" class="px-4 py-8 text-center text-xs text-gray-600"><div class="spinner mx-auto mb-2"></div>Loading...</td></tr>';
    
    try {
        const [coinsData, txData, goalsData] = await Promise.all([
            getSupportedCoins(),
            getTransactions(),
            getCryptoGoals()
        ]);
        
        coinsList = Array.isArray(coinsData) ? coinsData : [];
        transactions = Array.isArray(txData) ? txData : [];
        goals = Array.isArray(goalsData) ? goalsData : [];
        
        if (coinsList.length > 0) {
            await fetchCurrentPrices();
        }

        const holdings = updateDashboard();
        
        populateCoinSelect(holdings); 
        
        renderJournal();
        renderGoals();
        
        if (transactions.length > 0) {
            // generateHistoryChart(); 
        } else {
            renderChart([], []); 
        }

    } catch (e) {
        console.error('Error loading data in app.js:', e);
        renderJournal(); 
        updateDashboard(); 
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

async function fetchPriceForForm() {
    const symbol = document.getElementById('tx-coin').value;
    const coin = coinsList.find(c => c.symbol === symbol);
    if (!coin || !coin.coingecko_id) {
        alert("CoinGecko ID nerastas!");
        return;
    }

    const btn = document.getElementById('btn-fetch-price');
    const oldText = btn.innerText;
    btn.innerText = '...';

    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingecko_id}&vs_currencies=usd`);
        const data = await res.json();
        const price = data[coin.coingecko_id].usd;
        
        const priceInput = document.getElementById('tx-price');
        priceInput.value = price;
        
        priceInput.dispatchEvent(new Event('input'));
        
    } catch (e) { 
        alert("Kaina nerasta (CoinGecko API klaida)."); 
    }
    btn.innerText = oldText;
}


// ===============================================
// DASHBOARD LOGIC
// ===============================================
function updateDashboard() {
    const holdings = {};
    let totalInvested = 0;
    
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
    
    let totalValue = 0;
    Object.entries(holdings).forEach(([sym, data]) => {
        if (data.qty > 0) {
            const coin = coinsList.find(c => c.symbol === sym);
            if (coin && prices[coin.coingecko_id]) {
                totalValue += data.qty * prices[coin.coingecko_id].usd;
            }
        }
    });
    
    const pnl = totalValue - totalInvested;
    const pnlPercent = totalInvested > 0 ? (pnl / totalInvested * 100) : 0;
    
    document.getElementById('header-total-value').innerText = formatMoney(totalValue);
    
    const pnlEl = document.getElementById('total-pnl');
    pnlEl.innerText = `${pnl >= 0 ? '+' : ''}${formatMoney(pnl)}`;
    pnlEl.style.color = pnl >= 0 ? '#2dd4bf' : '#f87171';
    
    const pnlPercentEl = document.getElementById('total-pnl-percent');
    pnlPercentEl.innerText = (pnl >= 0 ? '+' : '') + pnlPercent.toFixed(2) + '%';
    pnlPercentEl.className = `text-xs font-bold px-2 py-0.5 rounded bg-gray-800 ${pnl >= 0 ? 'text-primary-400' : 'text-red-400'}`;
    
    return holdings;
}


// ===============================================
// UI RENDERING
// ===============================================
function populateCoinSelect(holdings) {
    const select = document.getElementById('tx-coin');
    const deleteSelect = document.getElementById('delete-coin-select');
    if (!select || !deleteSelect) return;
    
    select.innerHTML = '';
    deleteSelect.innerHTML = '<option value="">-- Pasirinkite --</option>';

    if (coinsList.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- Pridėkite monetą per Manage Coins --';
        select.appendChild(option);
        return; 
    }
    
    const sortedCoins = [...coinsList].sort((a, b) => {
        const hasA = (holdings[a.symbol]?.qty || 0) > 0;
        const hasB = (holdings[b.symbol]?.qty || 0) > 0;
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        const topA = PRIORITY_COINS.includes(a.symbol);
        const topB = PRIORITY_COINS.includes(b.symbol);
        if (topA && !topB) return -1;
        if (!topA && topB) return 1;
        return a.symbol.localeCompare(b.symbol);
    });

    sortedCoins.forEach(coin => {
        const option = document.createElement('option');
        option.value = coin.symbol;
        const hasBalance = (holdings[coin.symbol]?.qty || 0) > 0;
        option.textContent = hasBalance ? `★ ${coin.symbol}` : coin.symbol;
        select.appendChild(option.cloneNode(true));
        
        const deleteOption = option.cloneNode(true);
        deleteOption.value = coin.symbol;
        deleteOption.textContent = coin.symbol;
        deleteSelect.appendChild(deleteOption);
    });
}


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
        
        const dateStr = dateObj.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        }) + ' ' + dateObj.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute:'2-digit',
            hour12: false
        });
        
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

function renderGoals(holdings) {
    const container = document.getElementById('goals-container');
    const section = document.getElementById('goals-section');
    if (!container || !section) return;
    container.innerHTML = '';
    if (goals.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    
    goals.forEach(goal => {
        const current = holdings[goal.coin_symbol]?.qty || 0;
        const target = Number(goal.target_amount);
        if (target <= 0) return;
        const pct = Math.min(100, (current / target) * 100);
        
        const div = document.createElement('div');
        div.className = 'bg-gray-900 border border-gray-800 p-3 rounded-xl';
        div.innerHTML = `
            <div class="flex justify-between text-xs mb-1">
                <span class="font-bold text-gray-300">${goal.coin_symbol}</span>
                <span class="text-primary-400 font-bold">${pct.toFixed(1)}%</span>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div class="bg-primary-500 h-1.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
            <div class="text-[9px] text-gray-500 mt-1 text-right font-mono">
                ${current.toLocaleString(undefined, {maximumFractionDigits: 2})} / ${target.toLocaleString()}
            </div>
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
        data: { labels: ['Invested', 'Current'], datasets: [{ data: [invested, current], borderColor: '#2dd4bf', backgroundColor: grad, borderWidth: 2, fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#1f2937', pointBorderColor: '#2dd4bf' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    });
}


// --- TRANSACTION HANDLERS ---
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
    
    // **PATAISYTA VALIDACIJA**: Patikrina ne tik NaN, bet ir neleidžia 0 reikšmių kritiniuose laukuose
    const amount = parseFloat(rawAmount);
    const price = parseFloat(rawPrice);
    const total = parseFloat(rawTotal);

    if (isNaN(amount) || isNaN(price) || isNaN(total) || 
        amount <= 0 || price <= 0 || total <= 0) {
        
        alert("Įveskite galiojančius, teigiamus skaičius (Amount, Price, Total Cost turi būti didesni už 0).");
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
        amount: amount, // Naudojame jau konvertuotas reikšmes
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

window.onEditTx = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    document.getElementById('modal-title').innerText = "Edit Transaction";
    document.getElementById('btn-save').innerText = "Update Transaction";
    document.getElementById('btn-save').classList.remove('bg-primary-600', 'hover:bg-primary-500');
    document.getElementById('btn-save').classList.add('bg-yellow-600', 'hover:bg-yellow-500');

    document.getElementById('tx-id').value = tx.id;
    document.getElementById('tx-type').value = tx.type;
    document.getElementById('tx-coin').value = tx.coin_symbol;
    document.getElementById('tx-exchange').value = tx.exchange || '';
    document.getElementById('tx-method').value = tx.method || 'Market Buy';

    const dateObj = new Date(tx.date);
    const dStr = dateObj.toISOString().split('T')[0];
    const tStr = dateObj.toTimeString().split(' ')[0].slice(0,5);
    document.getElementById('tx-date-input').value = dStr;
    document.getElementById('tx-time-input').value = tStr;

    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-price').value = tx.price_per_coin;
    document.getElementById('tx-total').value = tx.total_cost_usd;
    document.getElementById('tx-notes').value = tx.notes || '';

    openModal('add-modal');
}

window.onDeleteTx = async function(id) {
    if (!confirm("Ar tikrai norite ištrinti šią transakciją?")) return;
    const success = await deleteTransaction(id);
    if (success) {
        await loadAllData();
    }
}


// --- COIN MANAGEMENT LOGIC ---
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
        console.error("Error saving coin/goal:", e);
        alert("Klaida įrašant monetą. Patikrinkite, ar ji jau pridėta (duplicate key).");
    }
    
    btn.innerText = oldText;
    btn.disabled = false;
}

async function handleDeleteCoinSubmit() {
    const sym = document.getElementById('delete-coin-select').value;
    if (!sym || sym === '') {
        alert("Pasirinkite monetą trynimui.");
        return;
    }
    if (!confirm(`Ar tikrai norite ištrinti ${sym} ir visus susijusius tikslus? Transakcijos liks!`)) return;

    const btn = document.getElementById('btn-delete-coin');
    const oldText = btn.innerText;
    btn.innerText = "Deleting...";
    btn.disabled = true;

    try {
        const success = await deleteSupportedCoin(sym);
        if (success) {
            const { data: { user } } = await _supabase.auth.getUser();
            if(user) await _supabase.from('crypto_goals').delete().eq('user_id', user.id).eq('coin_symbol', sym);
            
            closeModal('delete-coin-modal');
            await loadAllData();
        }
    } catch (e) {
        console.error("Delete error:", e);
        alert("Klaida trinant monetą.");
    }

    btn.innerText = oldText;
    btn.disabled = false;
}
