// js/app.js - Versija 1.1.2 (Auto-Calc & Sorting Fix)

// --- KINTAMIEJI ---
let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;

// Monetos, kurios rodomos aukščiau, jei neturi jokių likučių
const PRIORITY_COINS = ['BTC', 'ETH', 'KAS', 'SOL', 'BNB'];

// --- STARTAS ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("App started v1.1.2");
    
    // 1. Užkraunami duomenys
    await loadAllData();
    
    // 2. Įjungiame skaičiuoklę
    setupCalculator();
    
    // 3. Mygtukų klausymasis
    const form = document.getElementById('add-tx-form');
    if (form) form.addEventListener('submit', handleTxSubmit);

    const saveCoinBtn = document.getElementById('btn-save-coin');
    if (saveCoinBtn) saveCoinBtn.addEventListener('click', handleNewCoinSubmit);
    
    const fetchPriceBtn = document.getElementById('btn-fetch-price');
    if (fetchPriceBtn) fetchPriceBtn.addEventListener('click', fetchLivePriceForForm);
});

// --- DUOMENŲ UŽKROVIMAS ---
async function loadAllData() {
    const journalBody = document.getElementById('journal-body');
    // Rodome loading tik jei sąrašas tuščias
    if (journalBody && transactions.length === 0) {
        journalBody.innerHTML = '<tr><td colspan="3" class="text-center py-6"><i class="fa-solid fa-spinner fa-spin text-primary-500"></i> Loading...</td></tr>';
    }

    try {
        // Lygiagrečios užklausos (greičiau)
        const [coinsData, txData, goalsData] = await Promise.all([
            getSupportedCoins(),
            getTransactions(),
            _supabase.from('crypto_goals').select('*')
        ]);

        coinsList = coinsData || [];
        transactions = txData || [];
        goals = goalsData.data || [];

        // 1. Gauname kainas
        await fetchPrices();

        // 2. Atnaujiname Dashboard ir gauname Holdings (ką turime)
        const holdings = updateDashboard();

        // 3. Užpildome Dropdown (Rūšiavimas: Turimi -> Populiarūs -> Abėcėlė)
        populateCoinSelect(holdings);

        // 4. Piešiame žurnalą
        renderJournal();

    } catch (e) {
        console.error("Load Error:", e);
        if (journalBody) journalBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-red-400">Error loading data. Check console.</td></tr>';
    }
}

// --- KAINŲ GAVIMAS ---
async function fetchPrices() {
    if (coinsList.length === 0) return;
    
    const ids = coinsList.map(c => c.coingecko_id).join(',');
    try {
        // CoinGecko API
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        if (!res.ok) throw new Error("API Limit");
        
        const newPrices = await res.json();
        prices = { ...prices, ...newPrices }; // Sujungiame su senomis
        console.log("Prices updated.");
    } catch (e) {
        console.warn("CoinGecko error/limit. Using cached prices.");
    }
}

async function fetchLivePriceForForm() {
    const symbolEl = document.getElementById('tx-coin');
    if (!symbolEl) return;
    
    const symbol = symbolEl.value;
    const coin = coinsList.find(c => c.symbol === symbol);
    if (!coin) return;

    const btn = document.getElementById('btn-fetch-price');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingecko_id}&vs_currencies=usd`);
        const data = await res.json();
        const price = data[coin.coingecko_id].usd;
        
        const priceInput = document.getElementById('tx-price');
        priceInput.value = price;
        // Aktyvuojame skaičiuoklę
        priceInput.dispatchEvent(new Event('input'));
    } catch (e) {
        alert("CoinGecko API busy. Try again.");
    }
    btn.innerHTML = originalText;
}

// --- UI FUNKCIJOS ---

// Svarbu: Formatuoja kainas gražiai (BTC rodo centus, PEPE rodo 8 skaičius)
function formatMoney(amount, isPrice = false) {
    const num = Number(amount);
    if (num === 0) return '$0.00';
    
    // Jei kaina labai maža (pvz. 0.0004), rodyti daugiau
    if (num < 1 && num > -1) {
        return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
    }
    // Didelėms sumoms (BTC) visada 2 skaičiai po kablelio
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function populateCoinSelect(holdings = {}) {
    const select = document.getElementById('tx-coin');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '';

    // Rūšiavimo logika:
    const sortedCoins = [...coinsList].sort((a, b) => {
        const hasA = (holdings[a.symbol] || 0) > 0;
        const hasB = (holdings[b.symbol] || 0) > 0;
        
        // 1. Visų pirma - ką aš turiu
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;

        // 2. Tada - populiarios
        const topA = PRIORITY_COINS.includes(a.symbol);
        const topB = PRIORITY_COINS.includes(b.symbol);
        if (topA && !topB) return -1;
        if (!topA && topB) return 1;

        // 3. Galiausiai - abėcėlė
        return a.symbol.localeCompare(b.symbol);
    });

    sortedCoins.forEach(coin => {
        const option = document.createElement('option');
        option.value = coin.symbol;
        const hasBalance = (holdings[coin.symbol] || 0) > 0;
        option.textContent = hasBalance ? `★ ${coin.symbol}` : coin.symbol;
        select.appendChild(option);
    });

    if (currentVal) select.value = currentVal;
}

function renderJournal() {
    const tbody = document.getElementById('journal-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-xs text-gray-600">No transactions yet.</td></tr>';
        return;
    }

    transactions.forEach(tx => {
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
        const amount = Number(tx.amount);
        const cost = Number(tx.total_cost_usd);

        if (tx.type === 'Buy') {
            holdings[tx.coin_symbol] += amount;
            totalInvested += cost;
        } else {
            holdings[tx.coin_symbol] -= amount;
            totalInvested -= cost; 
        }
    });

    let currentVal = 0;
    for (const [symbol, amount] of Object.entries(holdings)) {
        if (amount <= 0.0000001) continue;
        const coin = coinsList.find(c => c.symbol === symbol);
        if (coin && prices[coin.coingecko_id]) {
            currentVal += amount * prices[coin.coingecko_id].usd;
        }
    }

    // Atnaujinam Header
    const headerEl = document.getElementById('header-total-value');
    if (headerEl) headerEl.innerText = formatMoney(currentVal);

    // PnL
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
    if (goals.length === 0) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');

    goals.forEach(goal => {
        const current = holdings[goal.coin_symbol] || 0;
        const target = Number(goal.target_amount);
        const pct = Math.min(100, (current / target) * 100);
        
        const div = document.createElement('div');
        div.className = 'bg-gray-900 border border-gray-800 p-3 rounded-xl';
        div.innerHTML = `
            <div class="flex justify-between text-xs mb-1">
                <span class="font-bold text-gray-300">${goal.coin_symbol}</span>
                <span class="text-primary-400 font-bold">${pct.toFixed(1)}%</span>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-1.5">
                <div class="bg-primary-500 h-1.5 rounded-full" style="width: ${pct}%"></div>
            </div>
            <div class="text-[9px] text-gray-500 mt-1 text-right">${current.toFixed(2)} / ${target.toLocaleString()}</div>
        `;
        container.appendChild(div);
    });
}

function renderChart(invested, current) {
    const ctxEl = document.getElementById('pnlChart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    
    // Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0.2)');
    grad.addColorStop(1, 'rgba(45, 212, 191, 0)');

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Invested', 'Current'],
            datasets: [{
                data: [invested, current],
                borderColor: '#2dd4bf',
                backgroundColor: grad,
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#1f2937',
                pointBorderColor: '#2dd4bf'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

// --- SKAIČIUOKLĖ ---
function setupCalculator() {
    const amountIn = document.getElementById('tx-amount');
    const priceIn = document.getElementById('tx-price');
    const totalIn = document.getElementById('tx-total');
    if (!amountIn) return;

    // 1. Keičiant Amount arba Price -> Skaičiuoja Total
    function updateTotal() {
        const a = parseFloat(amountIn.value);
        const p = parseFloat(priceIn.value);
        if (!isNaN(a) && !isNaN(p)) {
            totalIn.value = (a * p).toFixed(2);
        }
    }

    // 2. Keičiant Total -> Skaičiuoja Amount (Tavo prašymas!)
    function updateAmount() {
        const t = parseFloat(totalIn.value);
        const p = parseFloat(priceIn.value);
        if (!isNaN(t) && !isNaN(p) && p !== 0) {
            amountIn.value = (t / p).toFixed(6);
        }
    }

    amountIn.addEventListener('input', updateTotal);
    priceIn.addEventListener('input', updateTotal);
    totalIn.addEventListener('input', updateAmount); // 'input' veikia iškart rašant
}

async function handleTxSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    const txData = {
        date: document.getElementById('tx-date').value,
        type: document.getElementById('tx-type').value,
        coin_symbol: document.getElementById('tx-coin').value,
        exchange: document.getElementById('tx-exchange').value,
        amount: document.getElementById('tx-amount').value,
        price_per_coin: document.getElementById('tx-price').value,
        total_cost_usd: document.getElementById('tx-total').value
    };

    const success = await saveTransaction(txData);
    if (success) {
        closeModal();
        e.target.reset();
        document.getElementById('tx-date').valueAsDate = new Date();
        await loadAllData();
    } else {
        alert("Save failed. Check permissions.");
    }
    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function handleNewCoinSubmit() {
    // Paprasta funkcija pridėti naują
    const sym = document.getElementById('new-coin-symbol').value.toUpperCase();
    const id = document.getElementById('new-coin-id').value.toLowerCase();
    if (!sym || !id) return;
    
    await saveNewCoin({ symbol: sym, coingecko_id: id, name: sym });
    document.getElementById('new-coin-modal').classList.add('hidden');
    await loadAllData();
}
