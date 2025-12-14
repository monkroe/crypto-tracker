// js/app.js - Versija 1.3.6 (Skaičiuotuvas veikia į abi puses)

let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;
const PRIORITY_COINS = ['BTC', 'ETH', 'KAS', 'SOL', 'BNB'];

document.addEventListener('DOMContentLoaded', async () => {
    console.log("App started v1.3.6");

    // AUTH LISTENER
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
    setupAppListeners(); // Čia dabar įjungiamas ir skaičiuotuvas
});

// --- AUTH HANDLERS ---
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
            emailInput.classList.add('border-red-500');
            passInput.classList.add('border-red-500');
            setTimeout(() => {
                emailInput.classList.remove('border-red-500');
                passInput.classList.remove('border-red-500');
            }, 2000);
            return false;
        }
        return true;
    }

    document.getElementById('btn-login').addEventListener('click', async () => {
        if (!validateInputs()) return;
        const btn = document.getElementById('btn-login');
        const originalText = btn.innerText;
        try {
            errText.classList.add('hidden');
            btn.innerText = "Jungiama...";
            btn.disabled = true;
            await userLogin(emailInput.value, passInput.value);
        } catch (e) {
            errText.textContent = "Klaida: " + e.message;
            errText.classList.remove('hidden');
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById('btn-signup').addEventListener('click', async () => {
        if (!validateInputs()) return;
        const btn = document.getElementById('btn-signup');
        const originalText = btn.innerText;
        try {
            errText.classList.add('hidden');
            btn.innerText = "Registruojama...";
            btn.disabled = true;
            await userSignUp(emailInput.value, passInput.value);
            alert("Registracija sėkminga! Sistema jus prijungia...");
        } catch (e) {
            errText.textContent = "Registracijos klaida: " + e.message;
            errText.classList.remove('hidden');
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await userSignOut();
    });
}

function clearData() {
    document.getElementById('journal-body').innerHTML = '';
    document.getElementById('header-total-value').innerText = '$0.00';
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-pass').value = '';
    document.getElementById('auth-error').classList.add('hidden');
}

function setupAppListeners() {
    const form = document.getElementById('add-tx-form');
    if (form) {
        // Klonuojame formą, kad išvalytume senus listenerius
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // Prijungiame Submit funkciją
        newForm.addEventListener('submit', handleTxSubmit);

        // SVARBU: Iš naujo prijungiame skaičiuotuvą prie naujos formos!
        setupCalculator();
    }

    // Kiti mygtukai
    const btnSaveCoin = document.getElementById('btn-save-coin');
    const btnDelCoin = document.getElementById('btn-delete-coin');
    const btnFetch = document.getElementById('btn-fetch-price');

    // Nuimame senus listenerius (jei būtų) ir dedame naujus, naudojant klonavimo triuką arba paprastai
    // Čia paprastai, nes šie mygtukai nesikeičia
    btnSaveCoin.replaceWith(btnSaveCoin.cloneNode(true));
    document.getElementById('btn-save-coin').addEventListener('click', handleNewCoinSubmit);

    btnDelCoin.replaceWith(btnDelCoin.cloneNode(true));
    document.getElementById('btn-delete-coin').addEventListener('click', handleDeleteCoinSubmit);

    btnFetch.replaceWith(btnFetch.cloneNode(true));
    document.getElementById('btn-fetch-price').addEventListener('click', fetchLivePriceForForm);
}

// --- SKAIČIUOTUVAS (The Brains) ---
function setupCalculator() {
    const amountIn = document.getElementById('tx-amount');
    const priceIn = document.getElementById('tx-price');
    const totalIn = document.getElementById('tx-total');
    
    if (!amountIn || !priceIn || !totalIn) return;
    
    // 1. Jei keičiamas Kiekis (Amount) arba Kaina (Price) -> Skaičiuojame Total
    function calculateTotal() {
        const amount = parseFloat(amountIn.value);
        const price = parseFloat(priceIn.value);
        
        if (!isNaN(amount) && !isNaN(price)) {
            const total = amount * price;
            // Rodo 2 skaičius po kablelio, bet nenaudojame toFixed, kad liktų skaičius inpute
            totalIn.value = Math.round(total * 100) / 100; 
        }
    }
    
    // 2. Jei keičiama Suma (Total Cost) -> Skaičiuojame Kiekį (Amount)
    function calculateAmount() {
        const total = parseFloat(totalIn.value);
        const price = parseFloat(priceIn.value);
        
        if (!isNaN(total) && !isNaN(price) && price !== 0) {
            const amount = total / price;
            // Kiekį rodome tiksliau (pvz. 6 skaičiai po kablelio)
            amountIn.value = parseFloat(amount.toFixed(6));
        }
    }

    // Prijungiame logiką
    amountIn.addEventListener('input', calculateTotal);
    priceIn.addEventListener('input', calculateTotal); // Keičiant kainą, keičiasi total (pagal amount)
    
    // Jei vartotojas pats įrašo Total Cost, mes perskaičiuojame Amount
    totalIn.addEventListener('input', calculateAmount);
}

// --- DATA LOADING ---
async function loadAllData() {
    const journalBody = document.getElementById('journal-body');
    if (journalBody && transactions.length === 0) journalBody.innerHTML = '<tr><td colspan="3" class="text-center py-6">Loading...</td></tr>';

    try {
        const [coinsData, txData, goalsData] = await Promise.all([
            getSupportedCoins(),
            getTransactions(),
            _supabase.from('crypto_goals').select('*')
        ]);

        coinsList = coinsData || [];
        transactions = txData || [];
        goals = goalsData.data || [];

        await fetchPrices();
        const holdings = updateDashboard();
        
        populateCoinSelect(holdings);
        populateDeleteSelect();
        renderJournal();

    } catch (e) {
        console.error("Load Error:", e);
    }
}

async function fetchPrices() {
    if (coinsList.length === 0) return;
    const ids = coinsList.map(c => c.coingecko_id).join(',');
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        if (res.ok) {
            const newPrices = await res.json();
            prices = { ...prices, ...newPrices };
        }
    } catch (e) { console.warn("Price fetch error"); }
}

async function fetchLivePriceForForm() {
    const symbol = document.getElementById('tx-coin').value;
    const coin = coinsList.find(c => c.symbol === symbol);
    if (!coin) return;

    const btn = document.getElementById('btn-fetch-price');
    const oldText = btn.innerText;
    btn.innerText = '...';

    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingecko_id}&vs_currencies=usd`);
        const data = await res.json();
        const price = data[coin.coingecko_id].usd;
        
        const priceInput = document.getElementById('tx-price');
        priceInput.value = price;
        
        // Iššaukiame įvykį, kad suveiktų skaičiuotuvas
        priceInput.dispatchEvent(new Event('input'));
        
    } catch (e) { alert("Busy. Try later."); }
    btn.innerText = oldText;
}

// UI & FORMATTING
function formatMoney(amount) {
    const num = Number(amount);
    if (num === 0) return '$0.00';
    if (num < 1 && num > -1) return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function populateCoinSelect(holdings = {}) {
    const select = document.getElementById('tx-coin');
    if (!select) return;
    select.innerHTML = '';

    const sortedCoins = [...coinsList].sort((a, b) => {
        const hasA = (holdings[a.symbol] || 0) > 0;
        const hasB = (holdings[b.symbol] || 0) > 0;
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
        const hasBalance = (holdings[coin.symbol] || 0) > 0;
        option.textContent = hasBalance ? `★ ${coin.symbol}` : coin.symbol;
        select.appendChild(option);
    });
}

function populateDeleteSelect() {
    const select = document.getElementById('delete-coin-select');
    if (!select) return;
    select.innerHTML = '';
    const sorted = [...coinsList].sort((a, b) => a.symbol.localeCompare(b.symbol));
    sorted.forEach(coin => {
        const option = document.createElement('option');
        option.value = coin.symbol;
        option.textContent = coin.symbol;
        select.appendChild(option);
    });
}

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
        row.innerHTML = `
            <td class="px-4 py-3 align-top border-b border-gray-800/30">
                <div class="font-bold text-gray-200 text-sm">${tx.coin_symbol}</div>
                <div class="text-[10px] text-gray-500">${tx.date}</div>
            </td>
            <td class="px-4 py-3 text-right align-top border-b border-gray-800/30">
                <div class="text-xs text-gray-300">${isBuy ? '+' : '-'}${Number(tx.amount).toFixed(4)}</div>
                <div class="text-[10px] text-gray-500">@ ${Number(tx.price_per_coin).toFixed(4)}</div>
            </td>
            <td class="px-4 py-3 text-right align-top border-b border-gray-800/30">
                <div class="font-bold text-sm text-gray-200">${formatMoney(tx.total_cost_usd)}</div>
                <span class="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${isBuy ? 'text-teal-400 bg-teal-900/20' : 'text-red-400 bg-red-900/20'}">${tx.type}</span>
            </td>
        `;
        tbody.appendChild(row);
    });
}

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

async function handleTxSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Saving...';
    btn.disabled = true;

    const rawAmount = document.getElementById('tx-amount').value;
    const rawPrice = document.getElementById('tx-price').value;
    const rawTotal = document.getElementById('tx-total').value;

    const txData = {
        date: document.getElementById('tx-date').value,
        type: document.getElementById('tx-type').value,
        coin_symbol: document.getElementById('tx-coin').value,
        exchange: document.getElementById('tx-exchange').value,
        amount: parseFloat(rawAmount),
        price_per_coin: parseFloat(rawPrice),
        total_cost_usd: parseFloat(rawTotal)
    };

    if (isNaN(txData.amount) || isNaN(txData.price_per_coin)) {
        alert("Please enter valid numbers.");
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    const success = await saveTransaction(txData);
    if (success) { 
        closeModal('add-modal'); 
        e.target.reset(); 
        document.getElementById('tx-date').valueAsDate = new Date(); 
        await loadAllData(); 
    } 
    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function handleNewCoinSubmit() {
    const sym = document.getElementById('new-coin-symbol').value.toUpperCase();
    const id = document.getElementById('new-coin-id').value.toLowerCase();
    const target = document.getElementById('new-coin-target').value;

    if (!sym || !id) { alert("Symbol and ID are required."); return; }

    const btn = document.getElementById('btn-save-coin');
    const oldText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

    try {
        await saveNewCoin({ symbol: sym, coingecko_id: id, name: sym });
        if (target && Number(target) > 0) {
            const { data: { user } } = await _supabase.auth.getUser();
            if (user) {
                await _supabase.from('crypto_goals').upsert({ user_id: user.id, coin_symbol: sym, target_amount: Number(target) }, { onConflict: 'user_id, coin_symbol' });
            }
        }
        closeModal('new-coin-modal');
        document.getElementById('new-coin-symbol').value = '';
        document.getElementById('new-coin-id').value = '';
        document.getElementById('new-coin-target').value = '';
        await loadAllData();
    } catch (err) {
        console.error("Error saving coin/goal:", err);
        alert("Failed to save.");
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

async function handleDeleteCoinSubmit() {
    const sym = document.getElementById('delete-coin-select').value;
    if (!sym) return;
    if (!confirm(`Delete ${sym}?`)) return;
    const success = await deleteSupportedCoin(sym);
    if (success) {
        const { data: { user } } = await _supabase.auth.getUser();
        if(user) await _supabase.from('crypto_goals').delete().eq('user_id', user.id).eq('coin_symbol', sym);
        closeModal('delete-coin-modal');
        await loadAllData();
    }
}
