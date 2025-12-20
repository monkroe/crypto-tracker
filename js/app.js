// js/app.js - Versija 2.0.1 (UI Polish + Performance + Auto Theme)

const APP_VERSION = '2.0.1';

// Global State
let coinsList = [];
let transactions = [];
let goals = [];
let prices = {};
let myChart = null;
let allocationChart = null;
let celebratedGoals = new Set();
let currentFactorId = null; 

// Constants
const PRIORITY_COINS = ['BTC', 'ETH', 'KAS', 'SOL', 'BNB'];
const CHART_COLORS = { 
    KAS: '#2dd4bf', BTC: '#f97316', ETH: '#3b82f6', SOL: '#8b5cf6', BNB: '#eab308',
    PEPE: '#22c55e', MON: '#a855f7', ASTER: '#facc15', JUP: '#84cc16', HUMA: '#d946ef',
    default: '#6b7280'
};
const MONTH_NAMES_LT = ['Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis', 
                        'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'];

// Price cache for rate limiting
let priceCache = {};
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log(`✅ App started v${APP_VERSION}`);
    const versionEl = document.getElementById('app-version');
    if (versionEl) versionEl.textContent = APP_VERSION;
    
    // Check session
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        showAppScreen();
        await loadAllData();
    } else {
        showAuthScreen();
    }

    // Auth state listener
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
// AUTH HANDLERS
// ============================================
function setupAuthHandlers() {
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-pass');
    const errText = document.getElementById('auth-error');
    
    function validateInputs() {
        const email = emailInput.value.trim();
        const pass = passInput.value.trim();
        if (!email || !pass) {
            errText.textContent = "⚠️ Įveskite el. paštą ir slaptažodį.";
            errText.classList.remove('hidden');
            return false;
        }
        errText.classList.add('hidden');
        return true;
    }
    
    // Login button
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
    
    // Signup button
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
    
    // Logout button
    document.getElementById('btn-logout').addEventListener('click', async () => {
        if (confirm('Ar tikrai norite atsijungti?')) {
            await userSignOut();
        }
    });
    
    // Passkey support check
    if (isWebAuthnSupported()) {
        const passkeySection = document.getElementById('passkey-section');
        if (passkeySection) {
            passkeySection.classList.remove('hidden');
        }
        
        // Passkey login button
        const btnPasskeyLogin = document.getElementById('btn-passkey-login');
        if (btnPasskeyLogin) {
            btnPasskeyLogin.addEventListener('click', async () => {
                const btn = btnPasskeyLogin;
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<div class="spinner mx-auto"></div>';
                btn.disabled = true;
                
                try {
                    const { data, error } = await loginWithPasskey();
                    if (error) throw error;
                } catch (e) {
                    console.error('Passkey login error:', e);
                    errText.textContent = "Passkey prisijungimas nepavyko.";
                    errText.classList.remove('hidden');
                } finally {
                    btn.innerHTML = originalHTML;
                    btn.disabled = false;
                }
            });
        }
    }
}

// ============================================
// APP LISTENERS
// ============================================
function setupAppListeners() {
    // Transaction form
    const form = document.getElementById('add-tx-form');
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', handleTxSubmit);
        setupCalculator();
    }
    
    // Coin management
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
    
    // Price fetch
    const btnFetch = document.getElementById('btn-fetch-price');
    if (btnFetch) {
        btnFetch.replaceWith(btnFetch.cloneNode(true));
        document.getElementById('btn-fetch-price').addEventListener('click', fetchPriceForForm);
    }
    
    // CSV import
    const csvInput = document.getElementById('csv-file-input');
    if (csvInput) {
        csvInput.addEventListener('change', handleImportCSV);
    }
    
    // Settings button
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        btnSettings.addEventListener('click', openSettingsModal);
    }
    
    // Select all checkbox - Event Delegation
    const journalAccordion = document.getElementById('journal-accordion');
    if (journalAccordion) {
        journalAccordion.addEventListener('change', (e) => {
            if (e.target.classList.contains('tx-checkbox')) {
                updateSelectionUI();
            }
        });
    }
    
    const selectAllCheckbox = document.getElementById('select-all-tx');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.tx-checkbox');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateSelectionUI();
        });
    }
}

// ============================================
// SETTINGS MODAL
// ============================================
async function openSettingsModal() {
    openModal('settings-modal');
    
    // Check passkey status
    if (isWebAuthnSupported()) {
        const passkeySettings = document.getElementById('passkey-settings');
        const passkeyStatus = document.getElementById('passkey-status');
        const btnSetup = document.getElementById('btn-setup-passkey');
        const btnRemove = document.getElementById('btn-remove-passkey');
        
        if (passkeySettings) passkeySettings.classList.remove('hidden');
        
        passkeyStatus.textContent = 'Checking...';
        passkeyStatus.classList.remove('text-green-500');
        
        const hasKey = await hasPasskey();
        
        if (hasKey) {
            passkeyStatus.textContent = '✅ Active';
            passkeyStatus.classList.add('text-green-500');
            btnSetup.classList.add('hidden');
            btnRemove.classList.remove('hidden');
            
            // Remove old listeners
            const newBtnRemove = btnRemove.cloneNode(true);
            btnRemove.parentNode.replaceChild(newBtnRemove, btnRemove);
            
            document.getElementById('btn-remove-passkey').addEventListener('click', async () => {
                if (confirm('Ar tikrai norite išjungti Passkey?')) {
                    const success = await removePasskey();
                    if (success) {
                        showToast('Passkey pašalintas.', 'success');
                        openSettingsModal(); // Refresh
                    }
                }
            });
        } else {
            passkeyStatus.textContent = 'Not set up';
            btnSetup.classList.remove('hidden');
            btnRemove.classList.add('hidden');
            
            // Remove old listeners
            const newBtnSetup = btnSetup.cloneNode(true);
            btnSetup.parentNode.replaceChild(newBtnSetup, btnSetup);
            
            document.getElementById('btn-setup-passkey').addEventListener('click', async () => {
                const success = await registerPasskey();
                if (success) {
                    showToast('Passkey sėkmingai įjungtas!', 'success');
                    openSettingsModal(); // Refresh
                }
            });
        }
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-2xl min-w-[250px]`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    const textColor = type === 'success' ? 'text-green-600 dark:text-green-400' : type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400';
    const msgColor = 'text-gray-800 dark:text-gray-200';

    toast.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-lg">${icon}</span>
            <span class="${msgColor} text-sm font-medium">${message}</span>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// DATA MANAGEMENT
// ============================================
function clearData() {
    const container = document.getElementById('journal-accordion');
    if (container) {
        container.innerHTML = '<div class="px-4 py-8 text-center text-xs text-gray-600">No transactions yet.</div>';
    }
    
    document.getElementById('header-total-value').textContent = '$0.00';
    document.getElementById('total-pnl').textContent = '$0.00';
    document.getElementById('total-pnl-percent').textContent = '0.00%';
    
    const investedEl = document.getElementById('total-invested');
    if (investedEl) investedEl.textContent = '$0.00';
    
    coinsList = [];
    transactions = [];
    goals = [];
    prices = {};
    celebratedGoals.clear();
    
    if (myChart) {
        myChart.destroy();
        myChart = null;
    }
    if (allocationChart) {
        allocationChart.destroy();
        allocationChart = null;
    }
}

async function loadAllData() {
    console.log('📊 Loading all data...');
    
    // Show spinner only on initial load if empty
    const container = document.getElementById('journal-accordion');
    if (container && transactions.length === 0) {
        container.innerHTML = '<div class="px-4 py-8 text-center text-xs text-gray-600"><div class="spinner mx-auto mb-2"></div>Loading...</div>';
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
        
        console.log(`✅ Loaded: ${coinsList.length} coins, ${transactions.length} transactions`);
        
        if (coinsList.length > 0) {
            await fetchCurrentPrices();
        }
        
        const holdings = updateDashboard();
        populateCoinSelect(holdings);
        renderAccordionJournal();
        renderGoals(holdings);
        await generateHistoryChart();
        renderAllocationChart(holdings);
        renderCoinCards(holdings);
        
        // Reset selection UI
        updateSelectionUI();
        
    } catch (e) {
        console.error('❌ Error loading data:', e);
        if (container) {
            container.innerHTML = '<div class="px-4 py-8 text-center text-xs text-red-400">Error loading data.</div>';
        }
    }
}

// ============================================
// PRICE FETCHING (with rate limiting)
// ============================================
async function fetchCurrentPrices() {
    if (coinsList.length === 0) return;
    
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION && Object.keys(priceCache).length > 0) {
        console.log('💰 Using cached prices');
        prices = { ...priceCache };
        return;
    }
    
    const ids = coinsList.map(c => c.coingecko_id).join(',');
    
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        if (res.ok) {
            const newPrices = await res.json();
            prices = { ...prices, ...newPrices };
            priceCache = { ...prices };
            lastFetchTime = now;
            console.log('💰 Prices updated');
        }
    } catch (e) {
        console.warn("⚠️ Price fetch error:", e);
    }
}

async function fetchPriceForForm() {
    const symbol = document.getElementById('tx-coin').value;
    const coin = coinsList.find(c => c.symbol === symbol);
    
    if (!coin || !coin.coingecko_id) {
        showToast("CoinGecko ID nerastas!", "error");
        return;
    }
    
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
            console.log(`✅ Price: ${symbol} = $${price}`);
            showToast(`Price updated: ${formatPrice(price)}`, 'success');
        } else {
            throw new Error('Price not found');
        }
    } catch (e) {
        console.error('❌ Price error:', e);
        showToast("Nepavyko gauti kainos.", "error");
    } finally {
        btn.textContent = oldText;
        btn.disabled = false;
    }
}

// ============================================
// CALCULATOR (with debounce)
// ============================================
function setupCalculator() {
    const amountIn = document.getElementById('tx-amount');
    const priceIn = document.getElementById('tx-price');
    const totalIn = document.getElementById('tx-total');
    
    if (!amountIn || !priceIn || !totalIn) return;
    
    const val = (el) => {
        const v = parseFloat(el.value);
        return isNaN(v) ? 0 : v;
    };
    
    const debounce = (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    };
    
    const calculateFromAmount = debounce(() => {
        const a = val(amountIn);
        const p = val(priceIn);
        const t = val(totalIn);
        
        if (t > 0 && a > 0) {
            priceIn.value = (t / a).toFixed(8);
        } else if (p > 0) {
            totalIn.value = (a * p).toFixed(2);
        }
    }, 300);
    
    const calculateFromPrice = debounce(() => {
        const p = val(priceIn);
        const a = val(amountIn);
        const t = val(totalIn);
        
        if (t > 0 && p > 0) {
            amountIn.value = (t / p).toFixed(6);
        } else if (a > 0) {
            totalIn.value = (a * p).toFixed(2);
        }
    }, 300);
    
    const calculateFromTotal = debounce(() => {
        const t = val(totalIn);
        const p = val(priceIn);
        const a = val(amountIn);
        
        if (a > 0 && t > 0) {
            priceIn.value = (t / a).toFixed(8);
        } else if (p > 0) {
            amountIn.value = (t / p).toFixed(6);
        }
    }, 300);
    
    amountIn.addEventListener('input', calculateFromAmount);
    priceIn.addEventListener('input', calculateFromPrice);
    totalIn.addEventListener('input', calculateFromTotal);
}

// ============================================
// FORMATTING (US Format: 1,234.56)
// ============================================
function formatMoney(value) {
    const num = Number(value);
    if (isNaN(num)) return '$0.00';
    // en-US uses comma for thousands, dot for decimals
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function formatPrice(value) {
    const num = Number(value);
    if (isNaN(num)) return '$0.0000';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2, // At least 2 decimals for prices like 87,000.00
        maximumFractionDigits: 8  // Up to 8 for small coins
    }).format(num);
}

function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const padTo2Digits = (num) => String(num).padStart(2, '0');

// ============================================
// DASHBOARD UPDATE
// ============================================
function updateDashboard() {
    const holdings = {};
    let totalInvested = 0;
    
    transactions.forEach(tx => {
        if (!holdings[tx.coin_symbol]) {
            holdings[tx.coin_symbol] = {
                qty: 0,
                invested: 0,
                totalCost: 0,
                totalAmount: 0
            };
        }
        
        const amount = Number(tx.amount);
        const cost = Number(tx.total_cost_usd);
        
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
                const currentValue = data.qty * prices[coin.coingecko_id].usd;
                totalValue += currentValue;
                data.averageBuyPrice = data.totalAmount > 0 ? data.totalCost / data.totalAmount : 0;
                data.currentPrice = prices[coin.coingecko_id].usd;
                data.currentValue = currentValue;
            }
        }
    });
    
    const pnl = totalValue - totalInvested;
    const pnlPercent = totalInvested > 0 ? (pnl / totalInvested * 100) : 0;
    
    document.getElementById('header-total-value').textContent = formatMoney(totalValue);
    
    const investedEl = document.getElementById('total-invested');
    if (investedEl) investedEl.textContent = formatMoney(totalInvested);
    
    const pnlEl = document.getElementById('total-pnl');
    pnlEl.textContent = formatMoney(pnl);
    pnlEl.style.color = pnl >= 0 ? '#2dd4bf' : '#f87171';
    
    const pnlPercentEl = document.getElementById('total-pnl-percent');
    pnlPercentEl.textContent = (pnl >= 0 ? '+' : '') + pnlPercent.toFixed(2) + '%';
    
    // Adjust colors for Light/Dark mode compatibility
    if (pnl >= 0) {
        pnlPercentEl.classList.remove('bg-red-100', 'text-red-600', 'dark:bg-red-900', 'dark:text-red-300');
        pnlPercentEl.classList.add('bg-green-100', 'text-green-600', 'dark:bg-green-900', 'dark:text-green-300');
    } else {
        pnlPercentEl.classList.remove('bg-green-100', 'text-green-600', 'dark:bg-green-900', 'dark:text-green-300');
        pnlPercentEl.classList.add('bg-red-100', 'text-red-600', 'dark:bg-red-900', 'dark:text-red-300');
    }
    
    return holdings;
}

// ============================================
// SELECTION UI (Bulk Delete)
// ============================================
function updateSelectionUI() {
    const selectedCount = document.querySelectorAll('.tx-checkbox:checked').length;
    const btnDelete = document.getElementById('btn-delete-selected');
    const countSpan = document.getElementById('selected-count');
    
    if (selectedCount > 0) {
        btnDelete.classList.remove('hidden');
        btnDelete.classList.add('flex');
        countSpan.textContent = selectedCount;
    } else {
        btnDelete.classList.add('hidden');
        btnDelete.classList.remove('flex');
    }
}

async function deleteSelectedTransactions() {
    const checkboxes = document.querySelectorAll('.tx-checkbox:checked');
    if (checkboxes.length === 0) return;
    
    if (!confirm(`Ar tikrai norite ištrinti ${checkboxes.length} transakcijas?`)) return;
    
    const btn = document.getElementById('btn-delete-selected');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div>';
    btn.disabled = true;
    
    const ids = Array.from(checkboxes).map(cb => cb.value);
    
    // Use bulk delete if available
    const success = await deleteMultipleTransactions(ids);
    
    if (success) {
        showToast(`Ištrinta: ${ids.length} transakcijos(-ų)`, 'success');
    } else {
        showToast(`Klaida trinant transakcijas`, 'error');
    }
    
    btn.disabled = false;
    btn.innerHTML = originalHTML;
    document.getElementById('select-all-tx').checked = false;
    
    await loadAllData();
}

// ============================================
// CHARTS
// ============================================
function renderAllocationChart(holdings) {
    const canvas = document.getElementById('allocationChart');
    if (!canvas) return;
    
    if (allocationChart) allocationChart.destroy();
    
    const chartData = [];
    const labels = [];
    const colors = [];
    
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
    const borderColor = isDark ? '#111827' : '#ffffff';
    
    allocationChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: chartData,
                backgroundColor: colors,
                borderColor: borderColor,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        font: { size: 11 },
                        padding: 10,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${formatMoney(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// OPTIMIZED CHART GENERATION (O(N) Complexity)
async function generateHistoryChart() {
    if (transactions.length === 0) {
        renderChart(['No data'], [0]);
        return;
    }
    
    // 1. Group transactions by date (O(N))
    const dailyChanges = {};
    const dates = transactions.map(t => new Date(t.date).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(); // Today
    
    transactions.forEach(tx => {
        const dateStr = new Date(tx.date).toISOString().split('T')[0];
        if (!dailyChanges[dateStr]) dailyChanges[dateStr] = [];
        dailyChanges[dateStr].push(tx);
    });
    
    const labels = [];
    const data = [];
    const balances = {}; // Running balances
    
    // 2. Iterate days once (O(D))
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        labels.push(dateStr);
        
        // Apply daily changes
        if (dailyChanges[dateStr]) {
            dailyChanges[dateStr].forEach(tx => {
                const amount = Number(tx.amount);
                if (['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy', 'Staking Reward', 'Bonus', 'Gift/Airdrop'].includes(tx.type)) {
                    balances[tx.coin_symbol] = (balances[tx.coin_symbol] || 0) + amount;
                } else if (['Sell', 'Withdraw'].includes(tx.type)) {
                    balances[tx.coin_symbol] = (balances[tx.coin_symbol] || 0) - amount;
                }
            });
        }
        
        // Calculate daily value using CURRENT prices (Approximation)
        let dailyValue = 0;
        for (const [sym, qty] of Object.entries(balances)) {
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
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0.3)');
    grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
    
    let borderColor = '#2dd4bf';
    if (data.length > 1 && data[data.length - 1] < data[0]) {
        borderColor = '#f87171'; // Red if down
    }
    
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                borderColor: borderColor,
                backgroundColor: grad,
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHitRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (ctx) => formatMoney(ctx.parsed.y)
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });
}

// ============================================
// COIN CARDS
// ============================================
function renderCoinCards(holdings) {
    const container = document.getElementById('coin-cards-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    const activeHoldings = Object.entries(holdings).filter(([_, data]) => data.qty > 0);
    
    if (activeHoldings.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-sm py-4">No active holdings</p>';
        return;
    }
    
    activeHoldings.forEach(([sym, data]) => {
        const coin = coinsList.find(c => c.symbol === sym);
        if (!coin) return;
        
        let pnlPercent = 0;
        let pnlAmount = 0;
        let pnlClass = 'text-gray-400';
        let pnlSign = '';
        
        if (data.averageBuyPrice && data.currentPrice) {
            pnlPercent = ((data.currentPrice - data.averageBuyPrice) / data.averageBuyPrice) * 100;
            pnlAmount = data.currentValue - data.invested;
            
            if (pnlPercent > 0) {
                pnlClass = 'text-green-600 dark:text-green-500';
                pnlSign = '+';
            } else if (pnlPercent < 0) {
                pnlClass = 'text-red-600 dark:text-red-500';
                pnlSign = '';
            }
        }
        
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-colors shadow-sm';
        
        card.innerHTML = `
            <div class="space-y-4">
                <div>
                    <p class="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Balance</p>
                    <h2 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">${formatMoney(data.currentValue || 0)}</h2>
                    <p class="text-sm text-gray-500 mt-1">${data.qty.toFixed(6)} ${sanitizeText(sym)}</p>
                </div>
                <div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-800">
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-gray-500">Unrealized Return</span>
                        <i class="fa-solid fa-arrow-up-right-from-square text-gray-400 text-xs"></i>
                    </div>
                    <div class="text-right">
                        <p class="${pnlClass} text-base font-bold">${pnlSign}${formatMoney(pnlAmount)} (${pnlSign}${pnlPercent.toFixed(2)}%)</p>
                    </div>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-500">Average buy price</span>
                    <span class="text-base font-semibold text-gray-700 dark:text-gray-200">${formatPrice(data.averageBuyPrice || 0)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-500">Cost basis</span>
                    <span class="text-base font-semibold text-gray-700 dark:text-gray-200">${formatMoney(data.invested || 0)}</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// ============================================
// TRANSACTION HISTORY (Auto Theme)
// ============================================
function renderAccordionJournal() {
    const container = document.getElementById('journal-accordion');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="px-4 py-8 text-center text-xs text-gray-600">No transactions yet.</div>';
        return;
    }
    
    const grouped = {};
    
    transactions.forEach(tx => {
        const date = new Date(tx.date);
        const year = date.getFullYear();
        const month = date.getMonth();
        
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = [];
        
        grouped[year][month].push(tx);
    });
    
    const years = Object.keys(grouped).sort((a, b) => b - a);
    
    years.forEach((year, yearIndex) => {
        const yearDiv = document.createElement('div');
        yearDiv.className = 'border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mb-3 bg-white dark:bg-gray-900 shadow-sm';
        
        const yearHeader = document.createElement('div');
        yearHeader.className = 'px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
        
        const totalTxs = Object.values(grouped[year]).flat().length;
        const yearTitle = document.createElement('div');
        yearTitle.className = 'flex items-center gap-2';
        yearTitle.innerHTML = `
            <i class="fa-solid fa-calendar text-primary-500"></i>
            <span class="font-bold text-gray-800 dark:text-white">${sanitizeText(year.toString())}</span>
            <span class="text-xs text-gray-500">(${totalTxs} transactions)</span>
        `;
        
        const chevron = document.createElement('i');
        chevron.className = `fa-solid fa-chevron-down text-gray-400 transition-transform year-chevron-${year}`;
        
        yearHeader.appendChild(yearTitle);
        yearHeader.appendChild(chevron);
        
        const monthContainer = document.createElement('div');
        monthContainer.id = `year-${year}`;
        monthContainer.className = yearIndex === 0 ? 'block' : 'hidden';
        
        const months = Object.keys(grouped[year]).sort((a, b) => b - a);
        
        months.forEach((month, monthIndex) => {
            const txs = grouped[year][month].sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const monthDiv = document.createElement('div');
            monthDiv.className = 'border-t border-gray-200 dark:border-gray-800';
            
            const monthHeader = document.createElement('div');
            monthHeader.className = 'bg-gray-50 dark:bg-gray-800/50 px-6 py-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors';
            
            const monthTitle = document.createElement('div');
            monthTitle.className = 'flex items-center gap-2';
            
            const monthName = document.createElement('span');
            monthName.className = 'text-sm font-semibold text-gray-700 dark:text-gray-300';
            monthName.textContent = MONTH_NAMES_LT[month];
            
            const monthCount = document.createElement('span');
            monthCount.className = 'text-xs text-gray-500';
            monthCount.textContent = `(${txs.length})`;
            
            monthTitle.appendChild(monthName);
            monthTitle.appendChild(monthCount);
            
            const monthChevron = document.createElement('i');
            monthChevron.className = `fa-solid fa-chevron-down text-gray-500 text-xs transition-transform month-chevron-${year}-${month}`;
            
            monthHeader.appendChild(monthTitle);
            monthHeader.appendChild(monthChevron);
            
            const txContainer = document.createElement('div');
            txContainer.id = `month-${year}-${month}`;
            txContainer.className = (yearIndex === 0 && monthIndex === 0) ? 'block' : 'hidden';
            
            txs.forEach(tx => {
                const txDiv = document.createElement('div');
                txDiv.className = 'px-6 py-3 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors';
                
                const dateObj = new Date(tx.date);
                const dateStr = dateObj.toLocaleDateString('lt-LT', { day: '2-digit', month: '2-digit' }) + 
                               ' ' + dateObj.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit', hour12: false });
                
                const isBuy = ['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy'].includes(tx.type);
                const isSell = ['Sell', 'Withdraw'].includes(tx.type);
                
                // Create elements safely
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'tx-checkbox form-checkbox h-4 w-4 text-primary-500 rounded border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 cursor-pointer transition';
                checkbox.value = tx.id;
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'flex-1';
                
                const topRow = document.createElement('div');
                topRow.className = 'flex justify-between items-start';
                
                const leftCol = document.createElement('div');
                leftCol.className = 'flex-1';
                
                const symbolSpan = document.createElement('span');
                symbolSpan.className = `font-bold text-sm ${isBuy ? 'text-green-600 dark:text-green-500' : isSell ? 'text-red-600 dark:text-red-500' : 'text-yellow-600 dark:text-yellow-500'}`;
                symbolSpan.textContent = tx.coin_symbol;
                
                const typeSpan = document.createElement('span');
                typeSpan.className = 'text-xs text-gray-500 ml-2';
                typeSpan.textContent = tx.type;
                
                const dateDiv = document.createElement('div');
                dateDiv.className = 'text-[10px] text-gray-500 mt-0.5';
                dateDiv.textContent = dateStr;
                
                leftCol.appendChild(symbolSpan);
                leftCol.appendChild(typeSpan);
                
                if (tx.method) {
                    const methodSpan = document.createElement('span');
                    methodSpan.className = 'text-[9px] text-gray-500 border border-gray-200 dark:border-gray-700 rounded px-1 ml-1';
                    methodSpan.textContent = tx.method;
                    leftCol.appendChild(methodSpan);
                }
                
                if (tx.exchange) {
                    const exchangeSpan = document.createElement('span');
                    exchangeSpan.className = 'text-[10px] text-gray-500 ml-2';
                    exchangeSpan.textContent = tx.exchange;
                    leftCol.appendChild(exchangeSpan);
                }
                
                leftCol.appendChild(dateDiv);
                
                // PnL calculation
                const currentPrice = prices[coinsList.find(c => c.symbol === tx.coin_symbol)?.coingecko_id]?.usd;
                if (currentPrice && tx.price_per_coin > 0 && isBuy) {
                    const pnlValue = (currentPrice - tx.price_per_coin) * tx.amount;
                    const pnlPercent = ((currentPrice - tx.price_per_coin) / tx.price_per_coin) * 100;
                    const pnlClass = pnlValue >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
                    const sign = pnlValue >= 0 ? '+' : '';
                    
                    const pnlDiv = document.createElement('div');
                    pnlDiv.className = `text-[9px] ${pnlClass} mt-0.5 font-bold`;
                    pnlDiv.textContent = `PnL: ${sign}${formatMoney(pnlValue)} (${sign}${pnlPercent.toFixed(2)}%)`;
                    leftCol.appendChild(pnlDiv);
                }
                
                if (tx.notes) {
                    const notesDiv = document.createElement('div');
                    notesDiv.className = 'text-[10px] text-primary-600 dark:text-primary-400 italic mt-1';
                    notesDiv.innerHTML = '<i class="fa-regular fa-note-sticky mr-1"></i>';
                    const notesText = document.createElement('span');
                    notesText.textContent = tx.notes;
                    notesDiv.appendChild(notesText);
                    leftCol.appendChild(notesDiv);
                }
                
                const rightCol = document.createElement('div');
                rightCol.className = 'text-right ml-4';
                
                const amountDiv = document.createElement('div');
                amountDiv.className = 'text-xs text-gray-600 dark:text-gray-300 font-mono';
                amountDiv.textContent = `${isBuy ? '+' : isSell ? '-' : '+'}${Number(tx.amount).toFixed(4)}`;
                
                const priceDiv = document.createElement('div');
                priceDiv.className = 'text-[10px] text-gray-500';
                priceDiv.textContent = `@ ${formatPrice(tx.price_per_coin)}`;
                
                const totalDiv = document.createElement('div');
                totalDiv.className = 'font-bold text-sm text-gray-800 dark:text-white mt-1';
                totalDiv.textContent = formatMoney(tx.total_cost_usd);
                
                rightCol.appendChild(amountDiv);
                rightCol.appendChild(priceDiv);
                rightCol.appendChild(totalDiv);
                
                const actionsCol = document.createElement('div');
                actionsCol.className = 'flex flex-col gap-2 ml-3';
                
                const editBtn = document.createElement('button');
                editBtn.className = 'text-gray-400 hover:text-yellow-500 transition-colors text-xs p-1';
                editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
                editBtn.onclick = () => onEditTx(tx.id);
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'text-gray-400 hover:text-red-500 transition-colors text-xs p-1';
                deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                deleteBtn.onclick = () => onDeleteTx(tx.id);
                
                actionsCol.appendChild(editBtn);
                actionsCol.appendChild(deleteBtn);
                
                topRow.appendChild(leftCol);
                topRow.appendChild(rightCol);
                topRow.appendChild(actionsCol);
                
                contentDiv.appendChild(topRow);
                
                const wrapper = document.createElement('div');
                wrapper.className = 'flex items-start gap-3';
                
                const checkboxWrapper = document.createElement('div');
                checkboxWrapper.className = 'pt-1.5';
                checkboxWrapper.appendChild(checkbox);
                
                wrapper.appendChild(checkboxWrapper);
                wrapper.appendChild(contentDiv);
                
                txDiv.appendChild(wrapper);
                txContainer.appendChild(txDiv);
            });
            
            // Month toggle
            monthHeader.addEventListener('click', () => {
                const isHidden = txContainer.classList.contains('hidden');
                txContainer.classList.toggle('hidden');
                if (isHidden) {
                    monthChevron.style.transform = 'rotate(180deg)';
                } else {
                    monthChevron.style.transform = 'rotate(0deg)';
                }
            });
            
            monthDiv.appendChild(monthHeader);
            monthDiv.appendChild(txContainer);
            monthContainer.appendChild(monthDiv);
        });
        
        // Year toggle
        yearHeader.addEventListener('click', () => {
            const isHidden = monthContainer.classList.contains('hidden');
            monthContainer.classList.toggle('hidden');
            if (isHidden) {
                chevron.style.transform = 'rotate(180deg)';
            } else {
                chevron.style.transform = 'rotate(0deg)';
            }
        });
        
        yearDiv.appendChild(yearHeader);
        yearDiv.appendChild(monthContainer);
        container.appendChild(yearDiv);
    });
}

// ============================================
// GOALS (Sorted by % Descending)
// ============================================
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
    
    // Sort goals: Highest percentage first
    const sortedGoals = [...goals].sort((a, b) => {
        const qtyA = holdings[a.coin_symbol]?.qty || 0;
        const targetA = Number(a.target_amount) || 1;
        const pctA = (qtyA / targetA);
        
        const qtyB = holdings[b.coin_symbol]?.qty || 0;
        const targetB = Number(b.target_amount) || 1;
        const pctB = (qtyB / targetB);
        
        return pctB - pctA;
    });
    
    sortedGoals.forEach(goal => {
        const current = holdings[goal.coin_symbol]?.qty || 0;
        const target = Number(goal.target_amount);
        
        if (target <= 0) return;
        
        const pct = Math.min(100, (current / target) * 100);
        
        if (pct >= 100 && !celebratedGoals.has(goal.coin_symbol)) {
            showCelebration(goal.coin_symbol);
            celebratedGoals.add(goal.coin_symbol);
        }
        
        const div = document.createElement('div');
        div.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl shadow-sm';
        
        const header = document.createElement('div');
        header.className = 'flex justify-between text-xs mb-1';
        
        const symbol = document.createElement('span');
        symbol.className = 'font-bold text-gray-800 dark:text-gray-300';
        symbol.textContent = goal.coin_symbol;
        
        const rightSide = document.createElement('div');
        rightSide.className = 'flex items-center gap-2';
        
        const percentage = document.createElement('span');
        percentage.className = 'text-primary-600 dark:text-primary-400 font-bold';
        percentage.textContent = `${pct.toFixed(1)}%`;
        
        const editBtn = document.createElement('button');
        editBtn.className = 'text-gray-400 hover:text-yellow-500 transition-colors';
        editBtn.innerHTML = '<i class="fa-solid fa-pen text-[10px]"></i>';
        editBtn.onclick = () => onEditGoal(goal.coin_symbol, target);
        
        rightSide.appendChild(percentage);
        rightSide.appendChild(editBtn);
        
        header.appendChild(symbol);
        header.appendChild(rightSide);
        
        const progressBar = document.createElement('div');
        progressBar.className = 'w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden';
        
        const progressFill = document.createElement('div');
        progressFill.className = 'bg-primary-500 h-1.5 rounded-full transition-all duration-500';
        progressFill.style.width = `${pct}%`;
        
        progressBar.appendChild(progressFill);
        
        const stats = document.createElement('div');
        stats.className = 'text-[9px] text-gray-500 mt-1 text-right font-mono';
        stats.textContent = `${current.toLocaleString(undefined, {maximumFractionDigits: 2})} / ${target.toLocaleString()}`;
        
        div.appendChild(header);
        div.appendChild(progressBar);
        div.appendChild(stats);
        
        container.appendChild(div);
    });
}

function showCelebration(symbol) {
    const duration = 3000;
    const end = Date.now() + duration;
    
    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });
        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
    
    const celebrationCoin = document.getElementById('celebration-coin');
    if (celebrationCoin) celebrationCoin.textContent = symbol;
    openModal('celebration-modal');
}

window.onEditGoal = function(coinSymbol, currentTarget) {
    const newTarget = prompt(`Edit goal for ${coinSymbol}\n\nCurrent target: ${currentTarget.toLocaleString()}`, currentTarget);
    if (newTarget === null) return;
    
    const target = parseFloat(newTarget);
    if (isNaN(target) || target <= 0) {
        showToast('Invalid target amount!', 'error');
        return;
    }
    
    saveOrUpdateGoal(coinSymbol, target).then(success => {
        if (success) {
            showToast('Goal updated!', 'success');
            loadAllData();
        }
    });
};

// ============================================
// COIN SELECTION
// ============================================
function populateCoinSelect(holdings) {
    const select = document.getElementById('tx-coin');
    const deleteSelect = document.getElementById('delete-coin-select');
    
    if (!select || !deleteSelect) return;
    
    select.innerHTML = '';
    deleteSelect.innerHTML = '<option value="">-- Pasirinkite --</option>';
    
    if (coinsList.length === 0) {
        select.innerHTML = '<option value="">-- Pridėkite monetą --</option>';
        return;
    }
    
    const sortedCoins = [...coinsList].sort((a, b) => {
        const hasA = (holdings[a.symbol]?.qty || 0) > 0;
        const hasB = (holdings[b.symbol]?.qty || 0) > 0;
        
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        
        return a.symbol.localeCompare(b.symbol);
    });
    
    sortedCoins.forEach(coin => {
        const hasBalance = (holdings[coin.symbol]?.qty || 0) > 0;
        
        const opt1 = document.createElement('option');
        opt1.value = coin.symbol;
        opt1.textContent = hasBalance ? `★ ${coin.symbol}` : coin.symbol;
        select.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = coin.symbol;
        opt2.textContent = coin.symbol;
        deleteSelect.appendChild(opt2);
    });
}

// ============================================
// TRANSACTION HANDLERS
// ============================================
async function handleTxSubmit(e) {
    e.preventDefault();
    
    const btn = document.getElementById('btn-save');
    const oldText = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;
    
    const txId = document.getElementById('tx-id').value;
    const coinSymbol = document.getElementById('tx-coin').value;
    const rawAmount = document.getElementById('tx-amount').value;
    const rawPrice = document.getElementById('tx-price').value;
    const rawTotal = document.getElementById('tx-total').value;
    const dStr = document.getElementById('tx-date-input').value;
    const tStr = document.getElementById('tx-time-input').value || '00:00';
    
    if (!coinSymbol) {
        showToast("Pasirinkite monetą!", "error");
        btn.textContent = oldText;
        btn.disabled = false;
        return;
    }
    
    const amount = parseFloat(rawAmount);
    const price = parseFloat(rawPrice);
    const total = parseFloat(rawTotal);
    
    if (isNaN(amount) || isNaN(price) || isNaN(total) || amount <= 0) {
        showToast("Įveskite teigiamus skaičius!", "error");
        btn.textContent = oldText;
        btn.disabled = false;
        return;
    }
    
    const localDate = new Date(`${dStr}T${tStr}:00`);
    const finalDate = localDate.toISOString();
    
    const txData = {
        date: finalDate,
        type: document.getElementById('tx-type').value,
        coin_symbol: coinSymbol,
        exchange: document.getElementById('tx-exchange').value || null,
        method: document.getElementById('tx-method').value,
        notes: document.getElementById('tx-notes').value || null,
        amount: amount,
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
        showToast(txId ? 'Transaction updated!' : 'Transaction saved!', 'success');
        await loadAllData();
    }
    
    btn.textContent = oldText;
    btn.disabled = false;
}

window.onEditTx = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    openModal('add-modal');
    
    setTimeout(() => {
        document.getElementById('tx-id').value = tx.id;
        document.getElementById('tx-type').value = tx.type;
        document.getElementById('tx-coin').value = tx.coin_symbol;
        document.getElementById('tx-exchange').value = tx.exchange || '';
        document.getElementById('tx-method').value = tx.method || 'Market Buy';
        
        const dateObj = new Date(tx.date);
        const year = dateObj.getFullYear();
        const month = padTo2Digits(dateObj.getMonth() + 1);
        const day = padTo2Digits(dateObj.getDate());
        const dStr = `${year}-${month}-${day}`;
        
        const hours = padTo2Digits(dateObj.getHours());
        const minutes = padTo2Digits(dateObj.getMinutes());
        const tStr = `${hours}:${minutes}`;
        
        document.getElementById('tx-date-input').value = dStr;
        document.getElementById('tx-time-input').value = tStr;
        document.getElementById('tx-amount').value = Number(tx.amount).toFixed(6);
        document.getElementById('tx-price').value = Number(tx.price_per_coin).toFixed(8);
        document.getElementById('tx-total').value = Number(tx.total_cost_usd).toFixed(2);
        document.getElementById('tx-notes').value = tx.notes || '';
        
        document.getElementById('modal-title').textContent = "Edit Transaction";
        
        const btn = document.getElementById('btn-save');
        btn.textContent = "Update Transaction";
        btn.classList.remove('bg-primary-600', 'hover:bg-primary-500');
        btn.classList.add('bg-yellow-600', 'hover:bg-yellow-500');
    }, 100);
};

window.onDeleteTx = async function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    const confirmMsg = `Ar tikrai norite ištrinti?\n\n${tx.coin_symbol} ${tx.type}\n${Number(tx.amount).toFixed(4)} @ ${formatMoney(tx.price_per_coin)}\nTotal: ${formatMoney(tx.total_cost_usd)}`;
    
    if (!confirm(confirmMsg)) return;
    
    const success = await deleteTransaction(id);
    if (success) {
        showToast('Transaction deleted', 'success');
        await loadAllData();
    }
};

// ============================================
// COIN MANAGEMENT
// ============================================
async function handleNewCoinSubmit() {
    const symbol = document.getElementById('new-coin-symbol').value.trim().toUpperCase();
    const coingeckoId = document.getElementById('new-coin-id').value.trim().toLowerCase();
    const targetRaw = document.getElementById('new-coin-target').value;
    
    if (!symbol || !coingeckoId) {
        showToast('Užpildykite simbolį ir CoinGecko ID!', 'error');
        return;
    }
    
    const btn = document.getElementById('btn-save-coin');
    const oldText = btn.textContent;
    btn.textContent = 'Saving...';
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
            showToast('Coin added!', 'success');
            await loadAllData();
        }
    } catch (e) {
        showToast('Klaida pridedant monetą: ' + e.message, 'error');
    }
    
    btn.textContent = oldText;
    btn.disabled = false;
}

async function handleDeleteCoinSubmit() {
    const sym = document.getElementById('delete-coin-select').value;
    
    if (!sym) {
        showToast("Pasirinkite monetą!", "error");
        return;
    }
    
    const hasTx = transactions.some(tx => tx.coin_symbol === sym);
    let confirmMsg = `Ar tikrai norite ištrinti ${sym}?`;
    
    if (hasTx) {
        confirmMsg += `\n\n⚠️ DĖMESIO: Ši moneta turi transakcijų!`;
    }
    
    if (!confirm(confirmMsg)) return;
    
    const btn = document.getElementById('btn-delete-coin');
    const oldText = btn.textContent;
    btn.textContent = "Deleting...";
    btn.disabled = true;
    
    try {
        const success = await deleteSupportedCoin(sym);
        
        if (success) {
            const { data: { user } } = await _supabase.auth.getUser();
            if (user) {
                await _supabase.from('crypto_goals').delete().eq('user_id', user.id).eq('coin_symbol', sym);
            }
            
            closeModal('delete-coin-modal');
            showToast('Coin deleted', 'success');
            await loadAllData();
        }
    } catch (e) {
        showToast('Klaida trinant monetą: ' + e.message, 'error');
    }
    
    btn.textContent = oldText;
    btn.disabled = false;
}

// ============================================
// CSV IMPORT/EXPORT
// ============================================
async function handleImportCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        const text = e.target.result;
        const rows = text.split('\n').map(r => r.trim()).filter(r => r);
        
        if (rows.length < 2) {
            showToast('CSV failas tuščias arba neteisingas!', 'error');
            return;
        }
        
        const header = rows[0].toLowerCase();
        let parsedTransactions = [];
        
        if (header.includes('txid') && header.includes('pair')) {
            showToast("Rekomenduojama naudoti 'Universal Format', nes Kraken duomenys yra sudėtingi.", "info");
            return;
        } else if (header.includes('timestamp') && header.includes('transaction type')) {
            // COINBASE FORMAT
            rows.slice(1).forEach(row => {
                const cols = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g).map(c => c.replace(/"/g, ''));
                if (cols.length < 5) return;
                
                const type = cols[1].toLowerCase();
                if (type !== 'buy' && type !== 'sell') return;
                
                parsedTransactions.push({
                    date: new Date(cols[0]).toISOString(),
                    type: type === 'buy' ? 'Buy' : 'Sell',
                    coin_symbol: cols[2],
                    amount: parseFloat(cols[3]),
                    price_per_coin: parseFloat(cols[4]),
                    total_cost_usd: parseFloat(cols[5]),
                    exchange: 'Coinbase',
                    method: '',
                    notes: cols[8] || ''
                });
            });
        } else {
            // UNIVERSAL FORMAT (Robust for comma and semicolon)
            rows.slice(1).forEach(row => {
                const separator = row.includes(';') ? ';' : ',';
                const cols = row.split(separator);
                
                if (cols.length < 6) return;
                
                let exchange = cols[6] || '';
                let method = cols[7] || '';
                let note = cols[8] || '';
                
                // Smart Fix: Recurring Buy
                if (note.includes('Recurring Buy')) {
                    method = 'Recurring Buy';
                    note = note.replace('Recurring Buy', '').trim();
                } else if (note.includes('Instant Buy')) {
                    method = 'Instant Buy';
                    note = note.replace('Instant Buy', '').trim();
                }

                // Helper to clean numbers (replace comma with dot if needed for EU format)
                const cleanNum = (val) => parseFloat(val.replace(',', '.'));
                
                parsedTransactions.push({
                    date: new Date(cols[0]).toISOString(),
                    type: cols[1],
                    coin_symbol: cols[2],
                    amount: cleanNum(cols[3]),
                    price_per_coin: cleanNum(cols[4]),
                    total_cost_usd: cleanNum(cols[5]),
                    exchange: exchange,
                    method: method,
                    notes: note
                });
            });
        }
        
        if (parsedTransactions.length === 0) {
            showToast('Nepavyko nuskaityti jokių transakcijų.', 'error');
            return;
        }
        
        if (confirm(`Rasta ${parsedTransactions.length} transakcijų. Importuoti?`)) {
            const success = await saveMultipleTransactions(parsedTransactions);
            
            if (success) {
                showToast('Importas sėkmingas!', 'success');
                await loadAllData();
            } else {
                showToast('Importas nepavyko', 'error');
            }
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

function exportToCSV() {
    if (transactions.length === 0) {
        showToast("Nėra duomenų eksportavimui!", "error");
        return;
    }
    
    const headers = ["Data", "Tipas", "Moneta", "Kiekis", "Kaina", "Viso USD", "Birža", "Metodas", "Pastabos"];
    
    const rows = transactions.map(tx => {
        const dateObj = new Date(tx.date);
        const dateStr = dateObj.toISOString().split('T')[0];
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const cleanText = (txt) => txt ? `"${txt.replace(/"/g, '""')}"` : "";
        
        return [
            `${dateStr} ${timeStr}`,
            tx.type,
            tx.coin_symbol,
            tx.amount,
            tx.price_per_coin,
            tx.total_cost_usd,
            cleanText(tx.exchange),
            cleanText(tx.method),
            cleanText(tx.notes)
        ];
    });
    
    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `crypto_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('CSV exported!', 'success');
}

// ============================================
// ERROR HANDLER
// ============================================
function setupGlobalErrorHandler() {
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        showToast('Unexpected error occurred. Please refresh.', 'error');
    });
    
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
    });
}

console.log('✅ App.js loaded successfully v' + APP_VERSION);
