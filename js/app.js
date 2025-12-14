// js/app.js - Versija 1.1.0 (Smart Sort & Fixes)

// --- KINTAMIEJI ---
let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;

// Populiarios monetos, kurias norime matyti viršuje, net jei jų neturime
const TOP_COINS = ['BTC', 'ETH', 'KAS', 'SOL', 'BNB'];

// --- INIT (STARTAS) ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("App started...");
    
    // 1. Užkraunami visi duomenys
    await loadAllData();
    
    // 2. Įjungiame skaičiuoklę formoje
    setupCalculator();
    
    // 3. Klausomės mygtukų
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
    // Tik pirmą kartą rodome loading, kad neerzintų atnaujinant
    if (journalBody && transactions.length === 0) {
        journalBody.innerHTML = '<tr><td colspan="3" class="text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i> Loading data...</td></tr>';
    }

    try {
        // Lygiagrečios užklausos greičiui
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

        // 2. Atvaizduojame Dashboard (ir suskaičiuojame Holdings rūšiavimui)
        const holdings = updateDashboard();

        // 3. Užpildome Dropdown (Dabar jau žinome, ką turime, todėl galime rūšiuoti)
        populateCoinSelect(holdings);

        // 4. Atvaizduojame žurnalą
        renderJournal();

    } catch (e) {
        console.error("Critical error loading data:", e);
    }
}

// --- KAINŲ GAVIMAS (CoinGecko) ---
async function fetchPrices() {
    if (coinsList.length === 0) return;
    
    const ids = coinsList.map(c => c.coingecko_id).join(',');
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        
        if (!res.ok) throw new Error("API Limit");
        
        const newPrices = await res.json();
        // Sujungiame su senomis kainomis (jei API nepavyktų dalinai)
        prices = { ...prices, ...newPrices };
        console.log("Kainos atnaujintos.");
    } catch (e) {
        console.warn("CoinGecko API limit reached or error. Using old prices.");
    }
}

async function fetchLivePriceForForm() {
    const symbolEl = document.getElementById('tx-coin');
    if (!symbolEl) return;
    
    const symbol = symbolEl.value;
    const coin = coinsList.find(c => c.symbol === symbol);
    if (!coin) return;

    const btn = document.getElementById('btn-fetch-price');
    const originalText = btn.innerHTML; // Išsaugome ikoną/tekstą
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingecko_id}&vs_currencies=usd`);
        const data = await res.json();
        const price = data[coin.coingecko_id].usd;
        
        const priceInput = document.getElementById('tx-price');
        priceInput.value = price;
        // Iššaukiame įvykį skaičiuoklei
        priceInput.dispatchEvent(new Event('input'));
    } catch (e) {
        alert("CoinGecko API busy. Try again in 30s.");
    }
    btn.innerHTML = originalText;
}

// --- VARTOTOJO SĄSAJA (UI) ---

// IŠMANUS RŪŠIAVIMAS: Holdings -> Top Coins -> Alphabet
function populateCoinSelect(holdings = {}) {
    const select = document.getElementById('tx-coin');
    if (!select) return;
    
    // Išsaugome, ką vartotojas buvo pasirinkęs (jei perkraunam duomenis)
    const currentSelection = select.value;

    select.innerHTML = '';

    // Rūšiavimo logika
    const sortedCoins = [...coinsList].sort((a, b) => {
        const holdsA = (holdings[a.symbol] || 0) > 0;
        const holdsB = (holdings[b.symbol] || 0) > 0;

        // 1. Prioritetas: Ar aš turiu šią monetą?
        if (holdsA && !holdsB) return -1;
        if (!holdsA && holdsB) return 1;

        // 2. Prioritetas: Ar tai Top moneta (BTC, KAS...)?
        const isTopA = TOP_COINS.includes(a.symbol);
        const isTopB = TOP_COINS.includes(b.symbol);
        if (isTopA && !isTopB) return -1;
        if (!isTopA && isTopB) return 1;

        // 3. Prioritetas: Abėcėlė
        return a.symbol.localeCompare(b.symbol);
    });

    sortedCoins.forEach(coin => {
        const option = document.createElement('option');
        option.value = coin.symbol;
        
        // Pažymime vizualiai, kurias turi
        const hasBalance = (holdings[coin.symbol] || 0) > 0;
        option.textContent = hasBalance ? `★ ${coin.symbol}` : coin.symbol;
        
        select.appendChild(option);
    });

    // Atstatome pasirinkimą, jei įmanoma
    if (currentSelection) {
        select.value = currentSelection;
    }
}

// FORMATAVIMO PAGALBININKAS (Helper)
function formatMoney(amount) {
    // Jei kaina labai maža (pvz. 0.00004), rodome daugiau skaičių
    // Jei kaina didelė (BTC), rodome 2 skaičius
    return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: amount < 1 ? 4 : 2,
        maximumFractionDigits: amount < 1 ? 8 : 2
    });
}

function renderJournal() {
    const tbody = document.getElementById('journal-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-xs text-gray-600">No transactions yet. Start adding!</td></tr>';
        return;
    }

    transactions.forEach(tx => {
        const row = document.createElement('tr');
        const isBuy = tx.type === 'Buy';
        const dateObj = new Date(tx.date);
        const dateStr = dateObj.toLocaleDateString(); // Paprastesnė data
        
        row.innerHTML = `
            <td class="px-4 py-3 align-top border-b border-gray-800/50">
                <div class="font-bold text-gray-200 text-sm flex items-center gap-1">
                    ${tx.coin_symbol}
                    <span class="text-[9px] px-1.5 py-0.5 rounded ${isBuy ? 'bg-teal-900/50 text-teal-400' : 'bg-red-900/50 text-red-400'}">${tx.type}</span>
                </div>
                <div class="text-[10px] text-gray-500">${dateStr}</div>
            </td>
            <td class="px-4 py-3 text-right align-top border-b border-gray-800/50">
                <div class="text-xs text-gray-300 font-mono">${isBuy ? '+' : '-'}${Number(tx.amount).toLocaleString('en-US', {maximumFractionDigits: 6})}</div>
                <div class="text-[10px] text-gray-500">@ $${Number(tx.price_per_coin).toLocaleString('en-US', {maximumFractionDigits: 6})}</div>
            </td>
            <td class="px-4 py-3 text-right align-top border-b border-gray-800/50">
                <div class="font-bold text-sm text-gray-200">$${Number(tx.total_cost_usd).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
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

    let currentPortfolioValue = 0;
    
    for (const [symbol, amount] of Object.entries(holdings)) {
        if (amount <= 0.0000001) continue;

        const coin = coinsList.find(c => c.symbol === symbol);
        if (coin && prices[coin.coingecko_id]) {
            const price = prices[coin.coingecko_id].usd;
            currentPortfolioValue += amount * price;
        }
    }

    // Header Update
    const headerValue = document.getElementById('header-total-value');
    if (headerValue) headerValue.innerText = `$${formatMoney(currentPortfolioValue)}`;

    // PnL Update
    const pnl = currentPortfolioValue - totalInvested;
    let pnlPercent = 0;
    if (totalInvested > 0) {
        pnlPercent = (pnl / totalInvested) * 100;
    }

    const pnlEl = document.getElementById('total-pnl');
    const pnlPercEl = document.getElementById('total-pnl-percent');

    if (pnlEl) {
        pnlEl.innerText = `${pnl >= 0 ? '+' : ''}$${formatMoney(pnl)}`;
        pnlEl.className = `text-2xl font-bold ${pnl >= 0 ? 'text-primary-400' : 'text-red-400'}`;
    }
    
    if (pnlPercEl) {
        pnlPercEl.innerText = `${pnlPercent.toFixed(2)}%`;
        pnlPercEl.className = `text-xs font-bold px-2 py-0.5 rounded bg-gray-800 ${pnl >= 0 ? 'text-primary-400' : 'text-red-400'}`;
    }

    renderChart(totalInvested, currentPortfolioValue);
    renderGoals(holdings);

    // Save Snapshot
    if (typeof savePortfolioSnapshot === 'function') {
        savePortfolioSnapshot(currentPortfolioValue, totalInvested);
    }

    return holdings; // Grąžiname, kad žinotume ką rūšiuoti
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
        const currentAmount = holdings[goal.coin_symbol] || 0;
        const target = Number(goal.target_amount);
        const percent = Math.min(100, (currentAmount / target) * 100);
        
        const div = document.createElement('div');
        div.className = 'bg-gray-900 border border-gray-800 p-3 rounded-xl relative overflow-hidden';
        div.innerHTML = `
            <div class="flex justify-between text-xs mb-1 relative z-10">
                <span class="font-bold text-gray-300 flex items-center gap-2">
                    <i class="fa-solid fa-bullseye text-primary-500"></i> ${goal.coin_symbol}
                </span>
                <span class="text-primary-400 font-bold">${percent.toFixed(1)}%</span>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden mt-2">
                <div class="bg-primary-500 h-1.5 rounded-full shadow-[0_0_10px_rgba(45,212,191,0.5)]" style="width: ${percent}%"></div>
            </div>
            <div class="flex justify-between text-[9px] text-gray-500 mt-1.5">
                <span>${currentAmount.toLocaleString()} held</span>
                <span>Target: ${target.toLocaleString()}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderChart(invested, current) {
    const ctxEl = document.getElementById('pnlChart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    
    // Modernus gradientas
    const gradient = ctx.createLinearGradient(0, 0, 0, 160);
    gradient.addColorStop(0, 'rgba(45, 212, 191, 0.2)'); 
    gradient.addColorStop(1, 'rgba(45, 212, 191, 0.0)');

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Invested', 'Current Value'],
            datasets: [{
                label: 'USD',
                data: [invested, current],
                borderColor: '#2dd4bf',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 6,
                pointBackgroundColor: '#1f2937',
                pointBorderColor: '#2dd4bf',
                pointBorderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false },
                x: { 
                    ticks: { color: '#6b7280', font: {size: 11, family: 'sans-serif'} }, 
                    grid: {display: false} 
                }
            },
            animation: { duration: 1500, easing: 'easeOutQuart' }
        }
    });
}

// --- LOGIKA: SKAIČIUOKLĖ ---
function setupCalculator() {
    const amountIn = document.getElementById('tx-amount');
    const priceIn = document.getElementById('tx-price');
    const totalIn = document.getElementById('tx-total');

    if (!amountIn || !priceIn || !totalIn) return;

    // 1. Įvedus Kiekį ir Kainą -> Skaičiuoja Total
    function calcTotal() {
        const amt = parseFloat(amountIn.value);
        const prc = parseFloat(priceIn.value);
        if (!isNaN(amt) && !isNaN(prc)) {
            totalIn.value = (amt * prc).toFixed(2);
        }
    }
    
    // 2. Įvedus Total ir Kainą -> Skaičiuoja Kiekį
    // Svarbu: naudojame 'input' įvykį, kad veiktų iškart rašant
    function calcAmount() {
        const tot = parseFloat(totalIn.value);
        const prc = parseFloat(priceIn.value);
        if (!isNaN(tot) && !isNaN(prc) && prc !== 0) {
            // Skaičiuojame tiksliai
            const result = tot / prc;
            amountIn.value = result.toFixed(6); 
        }
    }

    amountIn.addEventListener('input', calcTotal);
    priceIn.addEventListener('input', () => {
        // Jei vartotojas keičia kainą, priklauso ką jis prieš tai redagavo.
        // Standartiškai atnaujiname Total
        if (amountIn.value) calcTotal();
    });
    
    // Šitas pataisymas leidžia rašant Total iškart gauti Amount
    totalIn.addEventListener('input', calcAmount); 
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
        const dateEl = document.getElementById('tx-date');
        if (dateEl) dateEl.valueAsDate = new Date();
        await loadAllData();
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function handleNewCoinSubmit() {
    const symbolEl = document.getElementById('new-coin-symbol');
    const idEl = document.getElementById('new-coin-id');
    const btn = document.getElementById('btn-save-coin');

    if (!symbolEl || !idEl) return;
    
    const symbol = symbolEl.value.toUpperCase();
    const id = idEl.value.toLowerCase();

    if (!symbol || !id) return alert("Please fill both fields");

    const originalText = btn.innerText;
    btn.innerText = "Saving...";
    
    const success = await saveNewCoin({ symbol: symbol, coingecko_id: id, name: symbol });
    
    if (success) {
        document.getElementById('new-coin-modal').classList.add('hidden');
        symbolEl.value = '';
        idEl.value = '';
        await loadAllData();
    } else {
        alert("Error adding coin. Maybe symbol already exists?");
    }
    btn.innerText = originalText;
}
