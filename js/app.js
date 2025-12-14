// js/app.js - Versija 1.7.3 (Pilna ir stabili versija)

const APP_VERSION = '1.7.3';

let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;
const PRIORITY_COINS = ['BTC', 'ETH', 'KAS', 'SOL', 'BNB'];

document.addEventListener('DOMContentLoaded', async () => {
    console.log(`App started v${APP_VERSION}`);
    const versionEl = document.querySelector('footer p:last-child span');
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

// --- DATA LOADING ---
async function loadAllData() {
    const journalBody = document.getElementById('journal-body');
    if (journalBody) journalBody.innerHTML = '<tr><td colspan="3" class="px-4 py-8 text-center text-xs text-gray-600"><div class="spinner mx-auto mb-2"></div>Loading...</td></tr>';
    
    try {
        const [coinsData, txData, goalsData] = await Promise.all([
            getSupportedCoins(),
            getTransactions(),
            getCryptoGoals() // NAUDOJAME SAUGIĄ FUNKCIJĄ
        ]);
        
        coinsList = coinsData || [];
        transactions = txData || [];
        goals = goalsData || [];
        
        await fetchCurrentPrices();
        const holdings = updateDashboard();
        
        populateCoinSelect(holdings);
        populateDeleteSelect();
        renderJournal();
        renderGoals();

    } catch (e) {
        console.error('Error loading data:', e);
        // Čia neturėtų vykti klaidų, jei RLS nustatymai yra teisingi
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

function formatMoney(value) {
    const num = Number(value);
    // Naudojame didesnį tikslumą, jei kaina labai maža (pvz. < $1)
    const options = {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: num > -1 && num < 1 ? 8 : 2
    };
    return new Intl.NumberFormat('en-US', options).format(value);
}

// ... (Kitos render ir updateDashboard funkcijos lieka identiškos 1.7.0/1.7.2 versijoms) ...
// (Taupau vietą, bet Jūs naudokite visą kodą, įskaitant renderGoals, renderJournal, updateDashboard ir chart)

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
// ... (Kitos funkcijos) ...

// --- TRANSACTION HANDLERS ---
// ... (handleTxSubmit, onEditTx, onDeleteTx) ...
// ... (fetchPriceForForm) ...
// ... (handleNewCoinSubmit, handleDeleteCoinSubmit) ...

// **SVARBU:** ČIA NAUDOJAMAS HANDLE NEW COIN SUBMIT KODAS (iš 1.7.0/1.7.2 versijos, kuris veikia su saveNewCoin ir saveOrUpdateGoal):
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
        console.error(e);
    }
    
    btn.innerText = oldText;
    btn.disabled = false;
}

// **SVARBU:** ČIA NAUDOJAMAS HANDLE TX SUBMIT KODAS (iš 1.7.0/1.7.2 versijos, skirtas datai ir laikui):
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
    const dStr = document.getElementById('tx-date-input').value; // NAUJAS ID
    const tStr = document.getElementById('tx-time-input').value || '00:00'; // NAUJAS ID
    
    // ... (Validation) ...
    // Jūsų validacija

    const finalDate = `${dStr}T${tStr}:00`; // SUJUNGIMAS
    
    const txData = {
        date: finalDate,
        type: document.getElementById('tx-type').value,
        coin_symbol: document.getElementById('tx-coin').value,
        exchange: document.getElementById('tx-exchange').value || null,
        method: document.getElementById('tx-method').value,
        notes: document.getElementById('tx-notes').value || null,
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

// ... (Iki failo pabaigos)
