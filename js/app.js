// js/app.js - Pagrindinė logika

// --- KINTAMIEJI ---
let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;

// --- INIT (STARTAS) ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("App started...");
    
    // 1. Užkraunami visi duomenys
    await loadAllData();
    
    // 2. Įjungiame skaičiuoklę formoje
    setupCalculator();
    
    // 3. Klausomės mygtukų paspaudimų
    document.getElementById('add-tx-form').addEventListener('submit', handleTxSubmit);
    document.getElementById('btn-save-coin').addEventListener('click', handleNewCoinSubmit);
    document.getElementById('btn-fetch-price').addEventListener('click', fetchLivePriceForForm);
});

// --- DUOMENŲ UŽKROVIMAS ---
async function loadAllData() {
    // Rodyti "Loading..."
    document.getElementById('journal-body').innerHTML = '<tr><td colspan="3" class="text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';

    try {
        // Siunčiame užklausas į Supabase (naudojame funkcijas iš supabase.js)
        coinsList = await getSupportedCoins();
        transactions = await getTransactions();
        
        // Gauname tikslus (Goals) - tiesioginė užklausa čia, nes paprasta
        const { data: goalsData } = await _supabase.from('crypto_goals').select('*');
        goals = goalsData || [];

        // Užpildome formos pasirinkimus (Dropdown)
        populateCoinSelect();

        // Gauname naujausias kainas
        await fetchPrices();

        // Atvaizduojame viską
        renderJournal();
        updateDashboard();

    } catch (e) {
        console.error("Klaida užkraunant duomenis:", e);
    }
}

// --- KAINŲ GAVIMAS (CoinGecko) ---
async function fetchPrices() {
    if (coinsList.length === 0) return;
    
    const ids = coinsList.map(c => c.coingecko_id).join(',');
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        prices = await res.json();
        console.log("Kainos atnaujintos:", prices);
    } catch (e) {
        console.error("CoinGecko Error:", e);
        // Jei nepavyksta, kainos lieka tuščios (nerodys vertės)
    }
}

async function fetchLivePriceForForm() {
    const symbol = document.getElementById('tx-coin').value;
    const coin = coinsList.find(c => c.symbol === symbol);
    if (!coin) return;

    const btn = document.getElementById('btn-fetch-price');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingecko_id}&vs_currencies=usd`);
        const data = await res.json();
        const price = data[coin.coingecko_id].usd;
        
        document.getElementById('tx-price').value = price;
        // Trigger calculator
        document.getElementById('tx-price').dispatchEvent(new Event('input'));
    } catch (e) {
        alert("Nepavyko gauti kainos.");
    }
    btn.innerText = "GET LIVE";
}

// --- VARTOTOJO SĄSAJA (UI) ---

function populateCoinSelect() {
    const select = document.getElementById('tx-coin');
    select.innerHTML = '';
    coinsList.forEach(coin => {
        const option = document.createElement('option');
        option.value = coin.symbol;
        option.textContent = coin.symbol; // Tik simbolis, kad tilptų mobile
        select.appendChild(option);
    });
}

function renderJournal() {
    const tbody = document.getElementById('journal-body');
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-xs text-gray-600">No transactions yet.</td></tr>';
        return;
    }

    transactions.forEach(tx => {
        const row = document.createElement('tr');
        const isBuy = tx.type === 'Buy';
        
        row.innerHTML = `
            <td class="px-4 py-3 align-top">
                <div class="font-bold text-gray-200 text-sm">${tx.coin_symbol}</div>
                <div class="text-[10px] text-gray-500">${tx.date}</div>
            </td>
            <td class="px-4 py-3 text-right align-top">
                <div class="text-xs text-gray-300">${isBuy ? '+' : '-'}${Number(tx.amount).toFixed(4)}</div>
                <div class="text-[10px] text-gray-500">@ $${Number(tx.price_per_coin).toFixed(4)}</div>
            </td>
            <td class="px-4 py-3 text-right align-top">
                <div class="font-bold text-sm ${isBuy ? 'text-gray-300' : 'text-gray-500'}">$${Number(tx.total_cost_usd).toFixed(2)}</div>
                <div class="text-[10px] ${isBuy ? 'text-primary-500' : 'text-red-400'} uppercase font-bold tracking-wider">${tx.type}</div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateDashboard() {
    // 1. Skaičiuojame Holdings (Kiek ko turime) ir Investuotą sumą
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
            // Paprastas PnL skaičiavimas: pardavus, mažiname investuotą sumą proporcingai, arba tiesiog atimame gautus pinigus (Cash out).
            // Čia naudosime "Cash Flow" metodą: Invested mažėja per pardavimo sumą.
            totalInvested -= cost; 
        }
    });

    // 2. Skaičiuojame Dabartinę Vertę (Current Value)
    let currentPortfolioValue = 0;
    
    for (const [symbol, amount] of Object.entries(holdings)) {
        if (amount <= 0.000001) continue; // Ignoruojame nulinius likučius

        const coin = coinsList.find(c => c.symbol === symbol);
        if (coin && prices[coin.coingecko_id]) {
            const price = prices[coin.coingecko_id].usd;
            currentPortfolioValue += amount * price;
        }
    }

    // 3. Atnaujiname Header
    document.getElementById('header-total-value').innerText = `$${currentPortfolioValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    // 4. Atnaujiname PnL kortelę
    const pnl = currentPortfolioValue - totalInvested;
    // Apsauga nuo dalybos iš nulio
    let pnlPercent = 0;
    if (totalInvested !== 0) {
        pnlPercent = (pnl / Math.abs(totalInvested)) * 100;
    }

    const pnlEl = document.getElementById('total-pnl');
    const pnlPercEl = document.getElementById('total-pnl-percent');

    pnlEl.innerText = `${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    pnlEl.className = `text-2xl font-bold ${pnl >= 0 ? 'text-primary-400' : 'text-red-400'}`;
    
    pnlPercEl.innerText = `${pnlPercent.toFixed(2)}%`;
    pnlPercEl.className = `text-xs font-bold px-2 py-0.5 rounded bg-gray-800 ${pnl >= 0 ? 'text-primary-400' : 'text-red-400'}`;

    // 5. Atnaujiname Grafiką
    renderChart(totalInvested, currentPortfolioValue);

    // 6. Atnaujiname Tikslus (Goals)
    renderGoals(holdings);

    // 7. Išsaugome istoriją į DB (Snapshots)
    if (typeof savePortfolioSnapshot === 'function') {
        savePortfolioSnapshot(currentPortfolioValue, totalInvested);
    }
}

function renderGoals(holdings) {
    const container = document.getElementById('goals-container');
    const section = document.getElementById('goals-section');
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
        div.className = 'bg-gray-900 border border-gray-800 p-3 rounded-xl';
        div.innerHTML = `
            <div class="flex justify-between text-xs mb-1">
                <span class="font-bold text-gray-300">${goal.coin_symbol} Goal</span>
                <span class="text-primary-400 font-bold">${percent.toFixed(1)}%</span>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div class="bg-primary-500 h-2 rounded-full" style="width: ${percent}%"></div>
            </div>
            <div class="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>${currentAmount.toFixed(0)} / ${target.toLocaleString()}</span>
                <span>${(target - currentAmount).toFixed(0)} left</span>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- GRAFIKAS (Chart.js) ---
function renderChart(invested, current) {
    const ctx = document.getElementById('pnlChart').getContext('2d');
    
    // Gradientas
    const gradient = ctx.createLinearGradient(0, 0, 0, 160);
    gradient.addColorStop(0, 'rgba(45, 212, 191, 0.5)'); // Primary color
    gradient.addColorStop(1, 'rgba(45, 212, 191, 0.0)');

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line', // Keičiame į Line grafiką, gražiau atrodo
        data: {
            labels: ['Cost Basis', 'Current Value'],
            datasets: [{
                label: 'Portfolio Value',
                data: [invested, current],
                borderColor: '#2dd4bf',
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#1f2937',
                pointBorderColor: '#2dd4bf'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false }, // Paslepiame ašis švaresniam vaizdui
                x: { ticks: { color: '#6b7280', font: {size: 10} }, grid: {display: false} }
            }
        }
    });
}

// --- LOGIKA: ADD TRANSACTION FORM ---
function setupCalculator() {
    const amountIn = document.getElementById('tx-amount');
    const priceIn = document.getElementById('tx-price');
    const totalIn = document.getElementById('tx-total');

    function calcTotal() {
        const amt = parseFloat(amountIn.value);
        const prc = parseFloat(priceIn.value);
        if (!isNaN(amt) && !isNaN(prc)) {
            totalIn.value = (amt * prc).toFixed(2);
        }
    }
    
    // Atvirkštinė logika: jei įvedi Total ir Price -> suskaičiuoja Amount
    function calcAmount() {
        const tot = parseFloat(totalIn.value);
        const prc = parseFloat(priceIn.value);
        if (!isNaN(tot) && !isNaN(prc) && prc !== 0) {
            amountIn.value = (tot / prc).toFixed(6); // Daugiau tikslumo monetoms
        }
    }

    amountIn.addEventListener('input', calcTotal);
    priceIn.addEventListener('input', calcTotal);
    // Jei vartotojas keičia Total, galime perskaičiuoti Amount
    totalIn.addEventListener('change', calcAmount); 
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
        document.getElementById('tx-date').valueAsDate = new Date(); // Reset date
        await loadAllData(); // Perkrauti viską
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
}

// --- LOGIKA: ADD NEW COIN ---
async function handleNewCoinSubmit() {
    const symbol = document.getElementById('new-coin-symbol').value.toUpperCase();
    const id = document.getElementById('new-coin-id').value.toLowerCase();
    const btn = document.getElementById('btn-save-coin');

    if (!symbol || !id) return alert("Please fill both fields");

    btn.innerText = "Saving...";
    
    const success = await saveNewCoin({ symbol: symbol, coingecko_id: id, name: symbol });
    
    if (success) {
        document.getElementById('new-coin-modal').classList.add('hidden');
        document.getElementById('new-coin-symbol').value = '';
        document.getElementById('new-coin-id').value = '';
        await loadAllData();
    } else {
        alert("Error adding coin. Maybe symbol already exists?");
    }
    btn.innerText = "Add Coin";
}
