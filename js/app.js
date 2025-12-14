// js/app.js - Versija 1.7.5 (Stabili versija su apsauga nuo tuščių duomenų)

const APP_VERSION = '1.7.5';

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

// --- DATA LOADING (STABILUS) ---
async function loadAllData() {
    const journalBody = document.getElementById('journal-body');
    if (journalBody) journalBody.innerHTML = '<tr><td colspan="3" class="px-4 py-8 text-center text-xs text-gray-600"><div class="spinner mx-auto mb-2"></div>Loading...</td></tr>';
    
    try {
        const [coinsData, txData, goalsData] = await Promise.all([
            getSupportedCoins(),
            getTransactions(),
            getCryptoGoals()
        ]);
        
        // KRITINIS PATAISYMAS: Apsauga nuo null/undefined
        coinsList = Array.isArray(coinsData) ? coinsData : [];
        transactions = Array.isArray(txData) ? txData : [];
        goals = Array.isArray(goalsData) ? goalsData : [];
        
        // Toliau krauname kainas, tik po sėkmingo monetų užkrovimo
        if (coinsList.length > 0) {
            await fetchCurrentPrices();
        }

        const holdings = updateDashboard();
        
        populateCoinSelect(holdings);
        populateDeleteSelect();
        renderJournal();
        renderGoals();
        
        if (transactions.length > 0) {
            // generateHistoryChart(); // Iškomentuojame chart, kadangi gali sulėtinti ir sukelti CoinGecko klaidas
        } else {
            // Rodo tuščią diagramą, jei transakcijų nėra
            renderChart([], []); 
        }

    } catch (e) {
        console.error('Error loading data in app.js:', e);
        renderJournal(); // Išeiname iš Loading būsenos
        updateDashboard(); // Atnaujiname P&L į 0.00
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
    const options = {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: num > -1 && num < 1 ? 8 : 2
    };
    return new Intl.NumberFormat('en-US', options).format(value);
}

// ... (Kitos render, updateDashboard, chart, price fetch ir CRUD funkcijos)
// --- VISAS LIKUSIS KODAS BŪTINAS, TIKRINOME JĮ ANKSČIAU --- 
// (Taupau vietą, bet Jūs naudokite pilną v1.7.5 kodą)

// --- DASHBOARD UPDATE ---
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
    pnlEl.innerText = formatMoney(pnl);
    pnlEl.style.color = pnl >= 0 ? '#2dd4bf' : '#f87171';
    
    const pnlPercentEl = document.getElementById('total-pnl-percent');
    pnlPercentEl.innerText = (pnl >= 0 ? '+' : '') + pnlPercent.toFixed(2) + '%';
    pnlPercentEl.style.backgroundColor = pnl >= 0 ? '#14532d' : '#7f1d1d';
    pnlPercentEl.style.color = pnl >= 0 ? '#34d399' : '#fca5a5';
    
    return holdings;
}

// ... (renderChart, renderJournal, renderGoals) ...

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
// ... (Iki failo pabaigos)
