// js/app.js - v3.0.0
import { showToast, debugLog } from './utils.js';
import { loadInitialData, calculateHoldings, state } from './logic.js';
import { updateDashboardUI, renderCoinCards, renderTransactionJournal, renderAllocationChart } from './ui.js';

const APP_VERSION = '3.0.0';

// ===================================
// INIT
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    debugLog(`✅ App v${APP_VERSION} starting...`);
    document.getElementById('app-version').textContent = APP_VERSION;
    
    // Auth Check
    const { data: { session } } = await window._supabase.auth.getSession();
    
    if (session) {
        showAppScreen();
        await initData();
    } else {
        showAuthScreen();
    }
    
    // Listeners
    setupEventListeners();
});

// ===================================
// DATA FLOW
// ===================================
async function initData() {
    try {
        await loadInitialData();
        refreshUI();
    } catch (e) {
        console.error("Init Error", e);
        showToast("Error loading data", "error");
    }
}

function refreshUI() {
    const totals = calculateHoldings();
    updateDashboardUI(totals);
    renderCoinCards();
    renderTransactionJournal();
    renderAllocationChart();
    
    // Atnaujiname select meniu modaliniuose languose
    const coinSelects = [document.getElementById('tx-coin'), document.getElementById('delete-coin-select')];
    coinSelects.forEach(sel => {
        if(sel) {
            sel.innerHTML = '';
            state.coins.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.symbol;
                opt.textContent = c.symbol;
                sel.appendChild(opt);
            });
        }
    });
}

// ===================================
// HANDLERS
// ===================================
function setupEventListeners() {
    // Auth
    document.getElementById('btn-login').addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        const { error } = await window.userLogin(email, pass);
        if (error) showToast(error.message, 'error');
        else { showAppScreen(); initData(); }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await window.userSignOut();
        showAuthScreen();
    });

    // Transaction Form
    document.getElementById('add-tx-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save');
        btn.textContent = "Saving...";
        
        const txData = {
            date: new Date().toISOString(), // Supaprastinta v3.0.0
            type: document.getElementById('tx-type').value,
            coin_symbol: document.getElementById('tx-coin').value,
            amount: parseFloat(document.getElementById('tx-amount').value),
            total_cost_usd: parseFloat(document.getElementById('tx-total').value),
            price_per_coin: parseFloat(document.getElementById('tx-price').value),
            exchange: document.getElementById('tx-exchange').value,
            method: document.getElementById('tx-method').value,
            notes: document.getElementById('tx-notes').value
        };

        const success = await window.saveTransaction(txData);
        if (success) {
            showToast("Saved!", "success");
            document.getElementById('add-modal').classList.add('hidden');
            document.getElementById('add-tx-form').reset();
            await initData();
        } else {
            showToast("Error saving", "error");
        }
        btn.textContent = "Save Transaction";
    });
    
    // Global functions for inline HTML access (window scope)
    window.onDeleteTx = async (id) => {
        if(confirm("Delete transaction?")) {
            await window.deleteTransaction(id);
            await initData();
            showToast("Deleted", "success");
        }
    };
}

function showAppScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
}

function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-content').classList.add('hidden');
}
