// js/app.js - v3.2.0 (Fixes: Import, Edit, Coins)
import { showToast, parseCSV, debugLog, sanitizeText } from './utils.js';
import { loadInitialData, calculateHoldings, state } from './logic.js';
import { updateDashboardUI, renderCoinCards, renderTransactionJournal, renderGoals, setupCalculator, setupThemeHandlers } from './ui.js';

const APP_VERSION = '3.2.0';

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('app-version').textContent = APP_VERSION;
    setupThemeHandlers();
    
    const { data: { session } } = await window._supabase.auth.getSession();
    if (session) { showAppScreen(); await initData(); } 
    else { showAuthScreen(); }
    
    setupEventListeners();
});

async function initData() {
    try {
        await loadInitialData();
        refreshUI();
    } catch (e) { console.error(e); showToast("Error loading data", "error"); }
}

function refreshUI() {
    const totals = calculateHoldings();
    updateDashboardUI(totals);
    renderCoinCards();
    renderTransactionJournal();
    renderGoals(); // Būtina iškviesti!
    
    // Update Selects
    const coinSelects = [document.getElementById('tx-coin'), document.getElementById('delete-coin-select')];
    coinSelects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '';
        state.coins.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.symbol; opt.textContent = c.symbol; sel.appendChild(opt);
        });
    });
}

function setupEventListeners() {
    // 1. ADD TRANSACTION
    const form = document.getElementById('add-tx-form');
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    setupCalculator(); // Re-bind calculator

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save');
        btn.textContent = "Saving...";
        
        const dVal = document.getElementById('tx-date-input').value;
        const tVal = document.getElementById('tx-time-input').value || '00:00';
        const id = document.getElementById('tx-id').value;

        const txData = {
            date: new Date(`${dVal}T${tVal}:00`).toISOString(),
            type: document.getElementById('tx-type').value,
            coin_symbol: document.getElementById('tx-coin').value,
            amount: document.getElementById('tx-amount').value,
            total_cost_usd: document.getElementById('tx-total').value,
            price_per_coin: document.getElementById('tx-price').value,
            exchange: document.getElementById('tx-exchange').value,
            method: document.getElementById('tx-method').value,
            notes: sanitizeText(document.getElementById('tx-notes').value)
        };

        let success = false;
        if (id) {
            await window.deleteTransaction(id); // Supabase neturi update paprasto, darom delete+insert
            success = await window.saveTransaction(txData);
        } else {
            success = await window.saveTransaction(txData);
        }

        if (success) {
            showToast("Saved!", "success");
            document.getElementById('add-modal').classList.add('hidden');
            newForm.reset();
            document.getElementById('tx-id').value = '';
            await initData();
        }
        btn.textContent = "Save Transaction";
    });

    // 2. COIN MANAGEMENT (ADD/DELETE) - FIXED!
    document.getElementById('btn-save-coin').onclick = async () => {
        const symbol = document.getElementById('new-coin-symbol').value.toUpperCase();
        const id = document.getElementById('new-coin-id').value.toLowerCase();
        if(!symbol || !id) return showToast('Fill all fields', 'error');
        
        if (await window.saveNewCoin({ symbol, coingecko_id: id })) {
            showToast('Coin Added', 'success');
            document.getElementById('new-coin-modal').classList.add('hidden');
            await initData();
        }
    };

    document.getElementById('btn-delete-coin').onclick = async () => {
        const symbol = document.getElementById('delete-coin-select').value;
        if (await window.deleteSupportedCoin(symbol)) {
            showToast('Coin Deleted', 'success');
            document.getElementById('delete-coin-modal').classList.add('hidden');
            await initData();
        }
    };

    // 3. CSV IMPORT - FIXED!
    const csvInput = document.getElementById('csv-file-input');
    const newCsv = csvInput.cloneNode(true);
    csvInput.parentNode.replaceChild(newCsv, csvInput);
    
    newCsv.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const parsed = parseCSV(text);
        
        if (parsed.length === 0) return showToast('Invalid CSV', 'error');
        if (!confirm(`Import ${parsed.length} transactions?`)) return;

        let count = 0;
        for (const tx of parsed) {
            if (await window.saveTransaction(tx)) count++;
        }
        showToast(`Imported ${count} transactions`, 'success');
        await initData();
    });

    // 4. GLOBAL FUNCTIONS
    window.onDeleteTx = async (id) => {
        if(confirm("Delete?")) {
            await window.deleteTransaction(id);
            await initData();
            showToast("Deleted", "success");
        }
    };

    window.onEditTx = (id) => {
        const tx = state.transactions.find(t => t.id === id);
        if (!tx) return;
        document.getElementById('tx-id').value = tx.id;
        document.getElementById('tx-type').value = tx.type;
        document.getElementById('tx-coin').value = tx.coin_symbol;
        document.getElementById('tx-amount').value = tx.amount;
        document.getElementById('tx-price').value = tx.price_per_coin;
        document.getElementById('tx-total').value = tx.total_cost_usd;
        document.getElementById('tx-exchange').value = tx.exchange || '';
        document.getElementById('tx-method').value = tx.method || 'Market Buy';
        document.getElementById('tx-notes').value = tx.notes || '';
        
        const d = new Date(tx.date);
        document.getElementById('tx-date-input').value = d.toISOString().split('T')[0];
        document.getElementById('tx-time-input').value = d.toTimeString().slice(0, 5);
        
        document.getElementById('add-modal').classList.remove('hidden');
        setupCalculator(); // Re-trigger calc binding
    };
    
    // Auth & Settings listeners (keep existing...)
}

function showAppScreen() { document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('app-content').classList.remove('hidden'); }
function showAuthScreen() { document.getElementById('auth-screen').classList.remove('hidden'); document.getElementById('app-content').classList.add('hidden'); }
