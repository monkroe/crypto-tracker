// js/app.js - Versija 2.0.3 (Advanced Charting + Timeframes + Visual Polish)

const APP_VERSION = '2.0.3';

// Debug Mode
const DEBUG_MODE = localStorage.getItem('debug') === 'true';
function debugLog(...args) {
    if (DEBUG_MODE) console.log(...args);
}

// Global State
let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;
let allocationChart = null;
let celebratedGoals = new Set();
let currentFactorId = null;
let currentTimeframe = 'ALL'; // Default Timeframe

// Constants
const PRIORITY_COINS = ['BTC', 'ETH', 'KAS', 'SOL', 'BNB'];
const CHART_COLORS = { 
    KAS: '#2dd4bf', BTC: '#f97316', ETH: '#3b82f6', SOL: '#8b5cf6', BNB: '#eab308',
    PEPE: '#22c55e', MON: '#a855f7', ASTER: '#facc15', JUP: '#84cc16', HUMA: '#d946ef',
    default: '#6b7280'
};
const MONTH_NAMES_LT = ['Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis', 
                        'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'];

// Price cache
let priceCache = {};
let lastFetchTime = 0;
const CACHE_DURATION = 60000; 

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    debugLog(`✅ App started v${APP_VERSION}`);
    const versionEl = document.getElementById('app-version');
    if (versionEl) versionEl.textContent = APP_VERSION;
    
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        showAppScreen();
        await loadAllData();
    } else {
        showAuthScreen();
    }

    _supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            showAppScreen();
            loadAllData();
        } else if (event === 'SIGNED_OUT') {
            showAuthScreen();
            clearData();
        }
    });

    setupAuthHandlers();
    setupAppListeners();
    setupGlobalErrorHandler();
});

// ============================================
// SCREEN MANAGEMENT
// ============================================
function showAppScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
}

function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-content').classList.add('hidden');
}

// ============================================
// TIMEFRAME HANDLING (NEW v2.0.3)
// ============================================
window.changeTimeframe = function(tf) {
    if (currentTimeframe === tf) return; // No change
    currentTimeframe = tf;
    
    // Update UI Buttons
    document.querySelectorAll('.tf-btn').forEach(btn => {
        if (btn.dataset.tf === tf) {
            // Active State
            btn.classList.remove('text-gray-400', 'hover:text-gray-900', 'dark:hover:text-white');
            btn.classList.add('text-white', 'bg-gray-800', 'dark:bg-gray-600', 'shadow-sm');
        } else {
            // Inactive State
            btn.classList.add('text-gray-400', 'hover:text-gray-900', 'dark:hover:text-white');
            btn.classList.remove('text-white', 'bg-gray-800', 'dark:bg-gray-600', 'shadow-sm');
        }
    });

    // Update Indicator Text
    const indicator = document.getElementById('tf-indicator');
    if (indicator) indicator.textContent = tf;

    // Regenerate Chart
    generateHistoryChart();
};

// ============================================
// AUTH HANDLERS
// ============================================
function setupAuthHandlers() {
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-pass');
    const errText = document.getElementById('auth-error');
    
    function validateInputs() {
        if (!emailInput.value.trim() || !passInput.value.trim()) {
            errText.textContent = "⚠️ Įveskite el. paštą ir slaptažodį.";
            errText.classList.remove('hidden');
            return false;
        }
        errText.classList.add('hidden');
        return true;
    }
    
    document.getElementById('btn-login').addEventListener('click', async () => {
        if (!validateInputs()) return;
        const btn = document.getElementById('btn-login');
        const originalText = btn.textContent;
        btn.textContent = "Jungiama...";
        btn.disabled = true;
        try {
            const { error } = await userLogin(emailInput.value, passInput.value);
            if (error) throw error;
        } catch (e) {
            errText.textContent = "Klaida: " + (e.message || 'Prisijungti nepavyko.');
            errText.classList.remove('hidden');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
    
    document.getElementById('btn-signup').addEventListener('click', async () => {
        if (!validateInputs()) return;
        const btn = document.getElementById('btn-signup');
        const originalText = btn.textContent;
        btn.textContent = "Registruojama...";
        btn.disabled = true;
        try {
            const { error } = await userSignUp(emailInput.value, passInput.value);
            if (error) throw error;
            showToast("Registracija sėkminga!", "success");
        } catch (e) {
            errText.textContent = "Klaida: " + (e.message || 'Registracija nepavyko.');
            errText.classList.remove('hidden');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
    
    document.getElementById('btn-logout').addEventListener('click', async () => {
        if (confirm('Ar tikrai norite atsijungti?')) await userSignOut();
    });
    
    if (isWebAuthnSupported()) {
        document.getElementById('passkey-section').classList.remove('hidden');
        document.getElementById('btn-passkey-login').addEventListener('click', async () => {
            const btn = document.getElementById('btn-passkey-login');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<div class="spinner mx-auto"></div>';
            btn.disabled = true;
            try {
                const { error } = await loginWithPasskey();
                if (error) throw error;
            } catch (e) {
                debugLog('Passkey login error:', e);
                errText.textContent = "Passkey prisijungimas nepavyko.";
                errText.classList.remove('hidden');
            } finally {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }
        });
    }
}

// ============================================
// APP LISTENERS
// ============================================
function setupAppListeners() {
    const form = document.getElementById('add-tx-form');
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', handleTxSubmit);
        setupCalculator();
    }
    
    const btnSaveCoin = document.getElementById('btn-save-coin');
    if (btnSaveCoin) {
        btnSaveCoin.replaceWith(btnSaveCoin.cloneNode(true));
        document.getElementById('btn-save-coin').addEventListener('click', handleNewCoinSubmit);
    }
    
    const btnDeleteCoin = document.getElementById('btn-delete-coin');
    if (btnDeleteCoin) {
        btnDeleteCoin.replaceWith(btnDeleteCoin.cloneNode(true));
        document.getElementById('btn-delete-coin').addEventListener('click', handleDeleteCoinSubmit);
    }
    
    const btnFetch = document.getElementById('btn-fetch-price');
    if (btnFetch) {
        btnFetch.replaceWith(btnFetch.cloneNode(true));
        document.getElementById('btn-fetch-price').addEventListener('click', fetchPriceForForm);
    }
    
    const csvInput = document.getElementById('csv-file-input');
    if (csvInput) csvInput.addEventListener('change', handleImportCSV);
    
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) btnSettings.addEventListener('click', openSettingsModal);
    
    const journalAccordion = document.getElementById('journal-accordion');
    if (journalAccordion) {
        journalAccordion.addEventListener('change', (e) => {
            if (e.target.classList.contains('tx-checkbox')) updateSelectionUI();
        });
    }
    
    const selectAllCheckbox = document.getElementById('select-all-tx');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            document.querySelectorAll('.tx-checkbox').forEach(cb => cb.checked = e.target.checked);
            updateSelectionUI();
        });
    }
}

// ============================================
// MODALS & SETTINGS
// ============================================
async function openSettingsModal() {
    openModal('settings-modal');
    if (isWebAuthnSupported()) {
        document.getElementById('passkey-settings').classList.remove('hidden');
        const passkeyStatus = document.getElementById('passkey-status');
        passkeyStatus.textContent = 'Checking...';
        passkeyStatus.classList.remove('text-green-500');
        
        const hasKey = await hasPasskey();
        const btnSetup = document.getElementById('btn-setup-passkey');
        const btnRemove = document.getElementById('btn-remove-passkey');
        
        if (hasKey) {
            passkeyStatus.textContent = '✅ Active';
            passkeyStatus.classList.add('text-green-500');
            btnSetup.classList.add('hidden');
            btnRemove.classList.remove('hidden');
            
            const newBtnRemove = btnRemove.cloneNode(true);
            btnRemove.parentNode.replaceChild(newBtnRemove, btnRemove);
            document.getElementById('btn-remove-passkey').addEventListener('click', async () => {
                if (confirm('Ar tikrai norite išjungti Passkey?')) {
                    if (await removePasskey()) {
                        showToast('Passkey pašalintas.', 'success');
                        openSettingsModal();
                    }
                }
            });
        } else {
            passkeyStatus.textContent = 'Not set up';
            btnSetup.classList.remove('hidden');
            btnRemove.classList.add('hidden');
            
            const newBtnSetup = btnSetup.cloneNode(true);
            btnSetup.parentNode.replaceChild(newBtnSetup, btnSetup);
            document.getElementById('btn-setup-passkey').addEventListener('click', async () => {
                if (await registerPasskey()) {
                    showToast('Passkey sėkmingai įjungtas!', 'success');
                    openSettingsModal();
                }
            });
        }
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const cleanMsg = message.replace(/[✅❌ℹ️⚠️🎉🚀💰📊🔒⚡]/g, '').trim();
    const toast = document.createElement('div');
    toast.className = `toast bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-2xl min-w-[250px]`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    const msgColor = 'text-gray-800 dark:text-gray-200';
    toast.innerHTML = `<div class="flex items-center gap-2"><span class="text-lg">${icon}</span><span class="${msgColor} text-sm font-medium">${cleanMsg}</span></div>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ============================================
// DATA LOADING
// ============================================
function clearData() {
    document.getElementById('journal-accordion').innerHTML = '<div class="px-4 py-8 text-center text-xs text-gray-600">No transactions yet.</div>';
    document.getElementById('header-total-value').textContent = '$0.00';
    document.getElementById('total-pnl').textContent = '$0.00';
    document.getElementById('total-pnl-percent').textContent = '0.00%';
    document.getElementById('total-invested').textContent = '$0.00';
    coinsList = []; transactions = []; goals = []; prices = {}; celebratedGoals.clear();
    if (myChart) { myChart.destroy(); myChart = null; }
    if (allocationChart) { allocationChart.destroy(); allocationChart = null; }
}

async function loadAllData() {
    debugLog('📊 Loading all data...');
    const container = document.getElementById('journal-accordion');
    if (container && transactions.length === 0) {
        container.innerHTML = `<div class="animate-pulse space-y-3"><div class="h-20 bg-gray-200 dark:bg-gray-800 rounded-xl"></div><div class="h-20 bg-gray-200 dark:bg-gray-800 rounded-xl"></div></div>`;
    }
    
    try {
        const [coinsData, txData, goalsData] = await Promise.all([
            getSupportedCoins(),
            getTransactions(),
            getCryptoGoals()
        ]);
        coinsList = Array.isArray(coinsData) ? coinsData : [];
        transactions = Array.isArray(txData) ? txData : [];
        goals = Array.isArray(goalsData) ? goalsData : [];
        
        debugLog(`Loaded: ${coinsList.length} coins, ${transactions.length} transactions`);
        
        if (coinsList.length > 0) await fetchCurrentPrices();
        
        const holdings = updateDashboard();
        populateCoinSelect(holdings);
        renderAccordionJournal();
        renderGoals(holdings);
        await generateHistoryChart(); // Initial chart load
        renderAllocationChart(holdings);
        renderCoinCards(holdings);
        updateSelectionUI();
    } catch (e) {
        console.error('❌ Error loading data:', e);
        if (container) container.innerHTML = '<div class="px-4 py-8 text-center text-xs text-red-400">Error loading data.</div>';
    }
}

async function fetchCurrentPrices() {
    if (coinsList.length === 0) return;
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION && Object.keys(priceCache).length > 0) {
        debugLog('💰 Using cached prices');
        prices = { ...priceCache };
        return;
    }
    const ids = coinsList.map(c => c.coingecko_id).join(',');
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        if (res.ok) {
            prices = await res.json();
            priceCache = { ...prices };
            lastFetchTime = now;
            debugLog('💰 Prices updated');
        }
    } catch (e) { console.warn("⚠️ Price fetch error:", e); }
}

async function fetchPriceForForm() {
    const symbol = document.getElementById('tx-coin').value;
    const coin = coinsList.find(c => c.symbol === symbol);
    if (!coin || !coin.coingecko_id) return showToast("CoinGecko ID nerastas!", "error");
    
    const btn = document.getElementById('btn-fetch-price');
    const oldText = btn.textContent;
    btn.textContent = '⏳';
    btn.disabled = true;
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingecko_id}&vs_currencies=usd`);
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        const price = data[coin.coingecko_id]?.usd;
        if (price) {
            const priceInput = document.getElementById('tx-price');
            priceInput.value = price;
            priceInput.dispatchEvent(new Event('input'));
            showToast(`Price updated: ${formatPrice(price)}`, 'success');
        } else throw new Error('Price not found');
    } catch (e) { showToast("Nepavyko gauti kainos.", "error"); }
    finally { btn.textContent = oldText; btn.disabled = false; }
}

// ============================================
// CALCULATOR & FORMATTING
// ============================================
function setupCalculator() {
    const amountIn = document.getElementById('tx-amount'), priceIn = document.getElementById('tx-price'), totalIn = document.getElementById('tx-total');
    if (!amountIn) return;
    const val = (el) => parseFloat(el.value) || 0;
    const debounce = (func, wait) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); }; };
    
    amountIn.addEventListener('input', debounce(() => { const a = val(amountIn), p = val(priceIn), t = val(totalIn); if(t>0 && a>0) priceIn.value=(t/a).toFixed(8); else if(p>0) totalIn.value=(a*p).toFixed(2); }, 300));
    priceIn.addEventListener('input', debounce(() => { const p = val(priceIn), a = val(amountIn), t = val(totalIn); if(t>0 && p>0) amountIn.value=(t/p).toFixed(6); else if(a>0) totalIn.value=(a*p).toFixed(2); }, 300));
    totalIn.addEventListener('input', debounce(() => { const t = val(totalIn), p = val(priceIn), a = val(amountIn); if(a>0 && t>0) priceIn.value=(t/a).toFixed(8); else if(p>0) amountIn.value=(t/p).toFixed(6); }, 300));
}

function formatMoney(value) {
    const num = Number(value);
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

function formatPrice(value) {
    const num = Number(value);
    if (isNaN(num)) return '$0.0000';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(num);
}

function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function parseCSVNumber(val) {
    if (typeof val !== 'string') return parseFloat(val);
    val = val.trim();
    const lastComma = val.lastIndexOf(','), lastDot = val.lastIndexOf('.');
    if (lastComma > lastDot) return parseFloat(val.replace(/\./g, '').replace(',', '.'));
    return parseFloat(val.replace(/,/g, ''));
}

const padTo2Digits = (num) => String(num).padStart(2, '0');

// ============================================
// DASHBOARD & CHARTS
// ============================================
function updateDashboard() {
    const holdings = {};
    let totalInvested = 0;
    
    transactions.forEach(tx => {
        if (!holdings[tx.coin_symbol]) holdings[tx.coin_symbol] = { qty: 0, invested: 0, totalCost: 0, totalAmount: 0 };
        const amount = Number(tx.amount), cost = Number(tx.total_cost_usd);
        
        if (['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy'].includes(tx.type)) {
            holdings[tx.coin_symbol].qty += amount;
            holdings[tx.coin_symbol].invested += cost;
            holdings[tx.coin_symbol].totalCost += cost;
            holdings[tx.coin_symbol].totalAmount += amount;
            totalInvested += cost;
        } else if (['Sell', 'Withdraw'].includes(tx.type)) {
            holdings[tx.coin_symbol].qty -= amount;
            holdings[tx.coin_symbol].invested -= cost;
            totalInvested -= cost;
        } else if (['Staking Reward', 'Gift/Airdrop', 'Bonus'].includes(tx.type)) {
            holdings[tx.coin_symbol].qty += amount;
        }
    });
    
    let totalValue = 0;
    Object.entries(holdings).forEach(([sym, data]) => {
        if (data.qty > 0) {
            const coin = coinsList.find(c => c.symbol === sym);
            if (coin && prices[coin.coingecko_id]) {
                const currentVal = data.qty * prices[coin.coingecko_id].usd;
                totalValue += currentVal;
                data.averageBuyPrice = data.totalAmount > 0 ? data.totalCost / data.totalAmount : 0;
                data.currentPrice = prices[coin.coingecko_id].usd;
                data.currentValue = currentVal;
            }
        }
    });
    
    const pnl = totalValue - totalInvested;
    const pnlPercent = totalInvested > 0 ? (pnl / totalInvested * 100) : 0;
    
    document.getElementById('header-total-value').textContent = formatMoney(totalValue);
    document.getElementById('total-invested').textContent = formatMoney(totalInvested);
    const pnlEl = document.getElementById('total-pnl');
    pnlEl.textContent = formatMoney(pnl);
    pnlEl.style.color = pnl >= 0 ? '#2dd4bf' : '#f87171';
    const pnlPercentEl = document.getElementById('total-pnl-percent');
    pnlPercentEl.textContent = (pnl >= 0 ? '+' : '') + pnlPercent.toFixed(2) + '%';
    pnlPercentEl.className = `text-xs font-bold px-2 py-0.5 rounded ${pnl >= 0 ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'}`;
    
    return holdings;
}

// ============================================
// ADVANCED CHART GENERATION (v2.0.3)
// ============================================
async function generateHistoryChart() {
    if (transactions.length === 0) { renderChart(['No data'], [0]); return; }
    
    const dailyChanges = {};
    const allDates = transactions.map(t => new Date(t.date).getTime());
    const firstTxDate = new Date(Math.min(...allDates));
    let startDate = new Date(firstTxDate);
    const now = new Date();
    
    // Timeframe Logic
    switch (currentTimeframe) {
        case '1W': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7); break;
        case '1M': startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
        case '3M': startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
        case '6M': startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break;
        case '1Y': startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
        case '5Y': startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()); break;
        case 'ALL': startDate = new Date(firstTxDate); break;
    }
    if (startDate < firstTxDate) startDate = firstTxDate;

    transactions.forEach(tx => {
        const dateStr = new Date(tx.date).toISOString().split('T')[0];
        if (!dailyChanges[dateStr]) dailyChanges[dateStr] = [];
        dailyChanges[dateStr].push(tx);
    });
    
    const labels = [];
    const data = [];
    let runningBalances = {};
    
    // Pre-calculate balances before startDate
    for (let d = new Date(firstTxDate); d < startDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (dailyChanges[dateStr]) {
            dailyChanges[dateStr].forEach(tx => {
                const amount = Number(tx.amount);
                if (['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy', 'Staking Reward', 'Bonus', 'Gift/Airdrop'].includes(tx.type)) {
                    runningBalances[tx.coin_symbol] = (runningBalances[tx.coin_symbol] || 0) + amount;
                } else if (['Sell', 'Withdraw'].includes(tx.type)) {
                    runningBalances[tx.coin_symbol] = (runningBalances[tx.coin_symbol] || 0) - amount;
                }
            });
        }
    }

    // Generate Chart Data
    let loopDate = new Date(startDate);
    loopDate.setDate(loopDate.getDate() - 1); // Buffer

    for (; loopDate <= now; loopDate.setDate(loopDate.getDate() + 1)) {
        const dateStr = loopDate.toISOString().split('T')[0];
        let label = (currentTimeframe === '1W' || currentTimeframe === '1M') 
            ? loopDate.toLocaleDateString('lt-LT', { day: '2-digit', month: 'short' })
            : loopDate.toLocaleDateString('lt-LT', { month: 'short', year: '2-digit' });
        
        labels.push(label);
        
        if (dailyChanges[dateStr]) {
            dailyChanges[dateStr].forEach(tx => {
                const amount = Number(tx.amount);
                if (['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy', 'Staking Reward', 'Bonus', 'Gift/Airdrop'].includes(tx.type)) {
                    runningBalances[tx.coin_symbol] = (runningBalances[tx.coin_symbol] || 0) + amount;
                } else if (['Sell', 'Withdraw'].includes(tx.type)) {
                    runningBalances[tx.coin_symbol] = (runningBalances[tx.coin_symbol] || 0) - amount;
                }
            });
        }
        
        let dailyValue = 0;
        for (const [sym, qty] of Object.entries(runningBalances)) {
            if (qty > 0) {
                const coin = coinsList.find(c => c.symbol === sym);
                if (coin && prices[coin.coingecko_id]) {
                    dailyValue += qty * prices[coin.coingecko_id].usd;
                }
            }
        }
        data.push(dailyValue);
    }
    
    renderChart(labels, data);
}

function renderChart(labels, data) {
    const ctxEl = document.getElementById('pnlChart');
    if (!ctxEl) return;
    if (myChart) myChart.destroy();
    
    const ctx = ctxEl.getContext('2d');
    const isDark = document.documentElement.classList.contains('dark');
    
    const grad = ctx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0.2)'); 
    grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
    
    let borderColor = '#2dd4bf'; // Teal
    if (data.length > 1 && data[data.length - 1] < data[0]) {
        borderColor = '#f87171'; // Red
        grad.addColorStop(0, 'rgba(248, 113, 113, 0.2)');
        grad.addColorStop(1, 'rgba(248, 113, 113, 0)');
    }
    
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                borderColor: isDark ? borderColor : '#0d9488',
                backgroundColor: grad,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: isDark ? '#111827' : '#ffffff',
                pointBorderColor: borderColor,
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                    titleColor: isDark ? '#fff' : '#111827',
                    bodyColor: isDark ? '#fff' : '#111827',
                    borderColor: borderColor,
                    borderWidth: 1,
                    padding: 10,
                    callbacks: { label: (ctx) => formatMoney(ctx.parsed.y) }
                }
            },
            scales: {
                x: { display: false, grid: { display: false } },
                y: { 
                    display: true, position: 'right', 
                    grid: { color: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)', drawBorder: false },
                    ticks: { callback: function(val) { return val.toLocaleString('en-US', {notation: "compact", compactDisplay: "short"}); }, color: '#6b7280', font: { size: 10 } } 
                }
            }
        }
    });
}

// ============================================
// RENDERERS (Allocation, Cards, Goals, Journal)
// ============================================
function renderAllocationChart(holdings) {
    const canvas = document.getElementById('allocationChart');
    if (!canvas) return;
    if (allocationChart) allocationChart.destroy();
    
    const chartData = [], labels = [], colors = [];
    Object.entries(holdings).forEach(([sym, data]) => {
        if (data.qty > 0 && data.currentValue) {
            chartData.push(data.currentValue);
            labels.push(sym);
            colors.push(CHART_COLORS[sym] || CHART_COLORS.default);
        }
    });
    
    if (chartData.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const isDark = document.documentElement.classList.contains('dark');
    
    allocationChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: chartData,
                backgroundColor: colors,
                borderColor: isDark ? '#111827' : '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: isDark ? '#9ca3af' : '#4b5563', font: { size: 11 }, usePointStyle: true } },
                tooltip: { callbacks: { label: function(context) { const total = context.dataset.data.reduce((a, b) => a + b, 0); const pct = ((context.parsed / total) * 100).toFixed(1); return `${context.label}: ${formatMoney(context.parsed)} (${pct}%)`; } } }
            }
        }
    });
}

function renderCoinCards(holdings) {
    const container = document.getElementById('coin-cards-container');
    if (!container) return;
    container.innerHTML = '';
    const activeHoldings = Object.entries(holdings).filter(([_, data]) => data.qty > 0);
    
    if (activeHoldings.length === 0) {
        container.innerHTML = `<div class="text-center py-8"><i class="fa-solid fa-coins text-6xl text-gray-300 dark:text-gray-700 mb-4"></i><p class="text-gray-500 text-sm mb-2">No active holdings</p><button onclick="openModal('add-modal')" class="text-primary-600 dark:text-primary-400 font-bold text-sm">Add transaction →</button></div>`;
        return;
    }
    
    activeHoldings.forEach(([sym, data]) => {
        let pnlPercent = 0, pnlAmount = 0, pnlClass = 'text-gray-400', pnlSign = '';
        if (data.averageBuyPrice && data.currentPrice) {
            pnlPercent = ((data.currentPrice - data.averageBuyPrice) / data.averageBuyPrice) * 100;
            pnlAmount = data.currentValue - data.invested;
            if (pnlPercent > 0) { pnlClass = 'text-green-600 dark:text-green-500'; pnlSign = '+'; }
            else if (pnlPercent < 0) { pnlClass = 'text-red-600 dark:text-red-500'; pnlSign = ''; }
        }
        
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm';
        card.innerHTML = `
            <div class="space-y-4">
                <div><p class="text-xs text-gray-500 uppercase font-bold mb-1">Balance</p><h2 class="text-3xl font-bold text-gray-900 dark:text-white">${formatMoney(data.currentValue)}</h2><p class="text-sm text-gray-500 mt-1">${data.qty.toFixed(6)} ${sanitizeText(sym)}</p></div>
                <div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-800"><div class="flex items-center gap-2"><span class="text-sm text-gray-500">Unrealized Return</span><i class="fa-solid fa-arrow-trend-up text-gray-400 text-xs"></i></div><div class="text-right"><p class="${pnlClass} text-base font-bold">${pnlSign}${formatMoney(pnlAmount)} (${pnlSign}${pnlPercent.toFixed(2)}%)</p></div></div>
                <div class="flex justify-between items-center"><span class="text-sm text-gray-500">Avg Buy Price</span><span class="text-base font-semibold text-gray-700 dark:text-gray-200">${formatPrice(data.averageBuyPrice)}</span></div>
                <div class="flex justify-between items-center"><span class="text-sm text-gray-500">Cost Basis</span><span class="text-base font-semibold text-gray-700 dark:text-gray-200">${formatMoney(data.invested)}</span></div>
            </div>`;
        container.appendChild(card);
    });
}

function renderAccordionJournal() {
    const container = document.getElementById('journal-accordion');
    if (!container) return;
    container.innerHTML = '';
    if (transactions.length === 0) { container.innerHTML = `<div class="text-center py-8 text-sm text-gray-500">No transactions</div>`; return; }
    
    const grouped = {};
    transactions.forEach(tx => { const d = new Date(tx.date); const y = d.getFullYear(), m = d.getMonth(); if(!grouped[y]) grouped[y] = {}; if(!grouped[y][m]) grouped[y][m] = []; grouped[y][m].push(tx); });
    
    Object.keys(grouped).sort((a,b)=>b-a).forEach((year, yIdx) => {
        const yDiv = document.createElement('div'); yDiv.className = 'border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mb-3 bg-white dark:bg-gray-900 shadow-sm';
        const yHead = document.createElement('div'); yHead.className = 'px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition';
        yHead.innerHTML = `<div class="flex items-center gap-2"><i class="fa-solid fa-calendar text-primary-500"></i><span class="font-bold text-gray-800 dark:text-white">${year}</span></div><i class="fa-solid fa-chevron-down text-gray-400 transition-transform ${yIdx===0?'rotate-180':''}"></i>`;
        
        const mCont = document.createElement('div'); mCont.className = yIdx===0 ? 'block' : 'hidden';
        
        yHead.onclick = () => { mCont.classList.toggle('hidden'); yHead.querySelector('.fa-chevron-down').classList.toggle('rotate-180'); };
        
        Object.keys(grouped[year]).sort((a,b)=>b-a).forEach((month, mIdx) => {
            const txs = grouped[year][month].sort((a,b)=>new Date(b.date)-new Date(a.date));
            const mDiv = document.createElement('div'); mDiv.className = 'border-t border-gray-200 dark:border-gray-800';
            const mHead = document.createElement('div'); mHead.className = 'bg-gray-50 dark:bg-gray-800/50 px-6 py-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition';
            mHead.innerHTML = `<div class="flex items-center gap-2"><span class="text-sm font-semibold text-gray-700 dark:text-gray-300">${MONTH_NAMES_LT[month]}</span><span class="text-xs text-gray-500">(${txs.length})</span></div><i class="fa-solid fa-chevron-down text-gray-500 text-xs transition-transform ${yIdx===0 && mIdx===0 ?'rotate-180':''}"></i>`;
            
            const txCont = document.createElement('div'); txCont.className = (yIdx===0 && mIdx===0) ? 'block' : 'hidden';
            mHead.onclick = () => { txCont.classList.toggle('hidden'); mHead.querySelector('.fa-chevron-down').classList.toggle('rotate-180'); };
            
            txs.forEach(tx => {
                const isBuy = ['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy'].includes(tx.type);
                const isSell = ['Sell', 'Withdraw'].includes(tx.type);
                const color = isBuy ? 'text-green-600 dark:text-green-500' : (isSell ? 'text-red-600 dark:text-red-500' : 'text-yellow-600 dark:text-yellow-500');
                const div = document.createElement('div'); div.className = 'px-6 py-3 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition flex items-start gap-3';
                div.innerHTML = `<input type="checkbox" class="tx-checkbox form-checkbox h-4 w-4 text-primary-500 rounded border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 mt-1" value="${tx.id}">
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="font-bold text-sm ${color}">${tx.coin_symbol}</span><span class="text-xs text-gray-500 ml-2">${tx.type}</span>
                            <div class="text-[10px] text-gray-500 mt-0.5">${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-600 dark:text-gray-300 font-mono">${isBuy?'+':isSell?'-':'+'}${Number(tx.amount).toFixed(4)}</div>
                            <div class="font-bold text-sm text-gray-800 dark:text-white mt-1">${formatMoney(tx.total_cost_usd)}</div>
                        </div>
                        <div class="flex flex-col gap-2 ml-3">
                            <button onclick="onEditTx('${tx.id}')" class="text-gray-400 hover:text-yellow-500"><i class="fa-solid fa-pen text-xs"></i></button>
                            <button onclick="onDeleteTx('${tx.id}')" class="text-gray-400 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
                        </div>
                    </div>
                </div>`;
                txCont.appendChild(div);
            });
            mDiv.appendChild(mHead); mDiv.appendChild(txCont); mCont.appendChild(mDiv);
        });
        yDiv.appendChild(yHead); yDiv.appendChild(mCont); container.appendChild(yDiv);
    });
}

function renderGoals(holdings) {
    const container = document.getElementById('goals-container');
    if (!container) return;
    container.innerHTML = '';
    if (goals.length === 0) { document.getElementById('goals-section').classList.add('hidden'); return; }
    document.getElementById('goals-section').classList.remove('hidden');
    
    [...goals].sort((a,b) => (holdings[b.coin_symbol]?.qty/b.target_amount) - (holdings[a.coin_symbol]?.qty/a.target_amount)).forEach(goal => {
        const cur = holdings[goal.coin_symbol]?.qty || 0, tgt = Number(goal.target_amount), pct = Math.min(100, (cur/tgt)*100);
        if (pct >= 100 && !celebratedGoals.has(goal.coin_symbol)) { showCelebration(goal.coin_symbol); celebratedGoals.add(goal.coin_symbol); }
        
        const div = document.createElement('div'); div.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl shadow-sm';
        div.innerHTML = `<div class="flex justify-between text-xs mb-1"><span class="font-bold text-gray-800 dark:text-gray-300">${goal.coin_symbol}</span><div class="flex items-center gap-2"><span class="text-primary-600 dark:text-primary-400 font-bold">${pct.toFixed(1)}%</span><button onclick="onEditGoal('${goal.coin_symbol}', ${tgt})" class="text-gray-400 hover:text-yellow-500"><i class="fa-solid fa-pen text-[10px]"></i></button></div></div><div class="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden"><div class="bg-primary-500 h-1.5 rounded-full transition-all duration-500" style="width:${pct}%"></div></div><div class="text-[9px] text-gray-500 mt-1 text-right font-mono">${cur.toLocaleString(undefined, {maximumFractionDigits: 2})} / ${tgt.toLocaleString()}</div>`;
        container.appendChild(div);
    });
}

function showCelebration(symbol) {
    const end = Date.now() + 3000;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
    const el = document.getElementById('celebration-coin'); if(el) el.textContent = symbol;
    openModal('celebration-modal');
}

// ============================================
// HANDLERS (Tx, Coins, Import)
// ============================================
async function handleTxSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save'); const oldText = btn.textContent; btn.textContent = "Saving..."; btn.disabled = true;
    const txId = document.getElementById('tx-id').value, coinSymbol = document.getElementById('tx-coin').value, 
          amount = parseFloat(document.getElementById('tx-amount').value), 
          price = parseFloat(document.getElementById('tx-price').value), 
          total = parseFloat(document.getElementById('tx-total').value);
    
    if (!coinSymbol || isNaN(amount) || amount <= 0 || price < 0 || total < 0) { showToast("Check inputs!", "error"); btn.textContent = oldText; btn.disabled = false; return; }
    
    const txData = {
        date: new Date(`${document.getElementById('tx-date-input').value}T${document.getElementById('tx-time-input').value || '00:00'}:00`).toISOString(),
        type: document.getElementById('tx-type').value, coin_symbol: coinSymbol, exchange: document.getElementById('tx-exchange').value || null,
        method: document.getElementById('tx-method').value, notes: document.getElementById('tx-notes').value || null,
        amount: amount, price_per_coin: price, total_cost_usd: total
    };
    
    if (await (txId ? updateTransaction(txId, txData) : saveTransaction(txData))) {
        closeModal('add-modal'); showToast(txId ? 'Updated!' : 'Saved!', 'success'); await loadAllData();
    }
    btn.textContent = oldText; btn.disabled = false;
}

async function handleNewCoinSubmit() {
    const symbol = document.getElementById('new-coin-symbol').value.trim().toUpperCase(), id = document.getElementById('new-coin-id').value.trim().toLowerCase(), target = parseFloat(document.getElementById('new-coin-target').value);
    if (!symbol || !id) return showToast('Fill all fields!', 'error');
    if (await saveNewCoin({ symbol, coingecko_id: id })) {
        if (target > 0) await saveOrUpdateGoal(symbol, target);
        closeModal('new-coin-modal'); showToast('Coin added!', 'success'); await loadAllData();
    } else showToast('Error adding coin', 'error');
}

async function handleDeleteCoinSubmit() {
    const sym = document.getElementById('delete-coin-select').value;
    if (!sym || !confirm(`Delete ${sym}? Transactions will remain.`)) return;
    if (await deleteSupportedCoin(sym)) {
        closeModal('delete-coin-modal'); showToast('Coin deleted', 'success'); await loadAllData();
    }
}

async function handleImportCSV(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(evt) {
        const rows = evt.target.result.split('\n').map(r => r.trim()).filter(r => r);
        if (rows.length < 2) return showToast('Empty/Invalid CSV', 'error');
        const sep = (rows[0].match(/;/g)||[]).length > (rows[0].match(/,/g)||[]).length ? ';' : ',';
        const parsed = [];
        
        rows.slice(1).forEach(row => {
            const cols = row.split(sep); if(cols.length < 6) return;
            parsed.push({
                date: new Date(cols[0]).toISOString(), type: cols[1], coin_symbol: cols[2],
                amount: parseCSVNumber(cols[3]), price_per_coin: parseCSVNumber(cols[4]), total_cost_usd: parseCSVNumber(cols[5]),
                exchange: cols[6]||'', method: cols[7]||'', notes: cols[8]||''
            });
        });
        
        if (parsed.length > 0 && confirm(`Import ${parsed.length} txs?`)) {
            if (await saveMultipleTransactions(parsed)) { showToast('Import success!', 'success'); await loadAllData(); }
        }
    };
    reader.readAsText(file); e.target.value = '';
}

function exportToCSV() {
    if (transactions.length === 0) return showToast("No data", "error");
    const headers = ["Data","Tipas","Moneta","Kiekis","Kaina","Viso","Birza","Metodas","Pastabos"];
    const rows = transactions.map(t => [t.date, t.type, t.coin_symbol, t.amount, t.price_per_coin, t.total_cost_usd, t.exchange, t.method, t.notes].map(c => `"${c}"`).join(','));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' }));
    link.download = `crypto_history_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
}

// Helpers
function populateCoinSelect(holdings) {
    const s1 = document.getElementById('tx-coin'), s2 = document.getElementById('delete-coin-select');
    if(!s1) return; s1.innerHTML = ''; s2.innerHTML = '<option value="">-- Select --</option>';
    coinsList.sort((a,b) => ((holdings[b.symbol]?.qty||0) - (holdings[a.symbol]?.qty||0))).forEach(c => {
        const o1 = document.createElement('option'); o1.value = c.symbol; o1.textContent = (holdings[c.symbol]?.qty > 0 ? '★ ' : '') + c.symbol; s1.appendChild(o1);
        const o2 = document.createElement('option'); o2.value = c.symbol; o2.textContent = c.symbol; s2.appendChild(o2);
    });
}

function setupGlobalErrorHandler() {
    window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); showToast('Unexpected error', 'error'); });
}

window.onEditTx = (id) => { const tx = transactions.find(t=>t.id===id); if(tx){ openModal('add-modal'); document.getElementById('tx-id').value=tx.id; document.getElementById('tx-type').value=tx.type; document.getElementById('tx-coin').value=tx.coin_symbol; document.getElementById('tx-amount').value=tx.amount; document.getElementById('tx-price').value=tx.price_per_coin; document.getElementById('tx-total').value=tx.total_cost_usd; } };
window.onDeleteTx = async (id) => { if(confirm('Delete?')) { await deleteTransaction(id); showToast('Deleted', 'success'); loadAllData(); } };

debugLog('✅ App.js loaded successfully v' + APP_VERSION);
