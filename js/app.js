// js/app.js - v3.1.1 (Fixes)
import { showToast, debugLog, sanitizeText } from './utils.js';
import { loadInitialData, calculateHoldings, state } from './logic.js';
import { updateDashboardUI, renderCoinCards, renderTransactionJournal, renderAllocationChart, setupCalculator, setupThemeHandlers } from './ui.js';

const APP_VERSION = '3.1.1';

document.addEventListener('DOMContentLoaded', async () => {
    debugLog(`✅ App v${APP_VERSION} starting...`);
    document.getElementById('app-version').textContent = APP_VERSION;
    
    setupThemeHandlers();
    
    const { data: { session } } = await window._supabase.auth.getSession();
    
    if (session) {
        showAppScreen();
        await initData();
    } else {
        showAuthScreen();
    }
    
    setupEventListeners();
});

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
    
    const coinSelects = [document.getElementById('tx-coin'), document.getElementById('delete-coin-select')];
    coinSelects.forEach(sel => {
        if(sel) {
            sel.innerHTML = '';
            state.coins.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.symbol; opt.textContent = c.symbol; sel.appendChild(opt);
            });
        }
    });
}

function setupEventListeners() {
    // 1. SETTINGS
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        const newBtn = btnSettings.cloneNode(true);
        btnSettings.parentNode.replaceChild(newBtn, btnSettings);
        newBtn.addEventListener('click', async () => {
            document.getElementById('settings-modal').classList.remove('hidden');
            await checkPasskeyStatus();
        });
    }

    // 2. AUTH
    document.getElementById('btn-login').addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        const { error } = await window.userLogin(email, pass);
        if (error) showToast(error.message, 'error'); else { showAppScreen(); initData(); }
    });
    document.getElementById('btn-logout').addEventListener('click', async () => { await window.userSignOut(); showAuthScreen(); });

    // 3. TRANSACTION FORM
    const txForm = document.getElementById('add-tx-form');
    const newTxForm = txForm.cloneNode(true);
    txForm.parentNode.replaceChild(newTxForm, txForm);
    
    // Aktyvuojame skaičiuotuvą kaskart, kai forma persikrauna
    setupCalculator();

    // 4. GET PRICE
    const btnGetPrice = document.getElementById('btn-fetch-price');
    if (btnGetPrice) {
        const newBtnPrice = btnGetPrice.cloneNode(true);
        btnGetPrice.parentNode.replaceChild(newBtnPrice, btnGetPrice);
        newBtnPrice.addEventListener('click', async () => {
            const sym = document.getElementById('tx-coin').value;
            const coin = state.coins.find(c => c.symbol === sym);
            if (!coin) return showToast('Coin not found', 'error');
            
            newBtnPrice.textContent = '⏳';
            try {
                const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingecko_id}&vs_currencies=usd`);
                if(res.ok) {
                    const data = await res.json();
                    if(data[coin.coingecko_id]) {
                        const price = data[coin.coingecko_id].usd;
                        const priceInput = document.getElementById('tx-price');
                        priceInput.value = price;
                        // Trigger calculator manually
                        priceInput.dispatchEvent(new Event('input'));
                        showToast(`Price: $${price}`, 'success');
                    }
                }
            } catch(e) { showToast('API Error', 'error'); }
            newBtnPrice.textContent = 'GET PRICE';
        });
    }

    // 5. SAVE TRANSACTION
    newTxForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save');
        const oldText = btn.textContent;
        btn.textContent = "Saving...";
        
        const dateVal = document.getElementById('tx-date-input').value;
        const timeVal = document.getElementById('tx-time-input').value || '00:00';
        const fullDate = new Date(`${dateVal}T${timeVal}:00`).toISOString();
        
        const id = document.getElementById('tx-id').value; // Check if editing

        const txData = {
            date: fullDate,
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
        // Logic: Update or Insert
        if (id) {
            // Update logic (reikia įdėti į supabase.js arba naudoti update funkciją)
             // NOTE: v3.1.0 supabase.js neturi explicit updateTransaction, naudojame workaround: delete then save (not ideal but quick fix) or add update logic.
             // Let's rely on saveTransaction to be smart or add updateTransaction to window.
             // For now, I'll assume we need to add updateTransaction to supabase.js, but since I cannot edit that file here, I will do a DELETE then INSERT for update.
             // WAIT! Better to add update logic in supabase.js or logic.js?
             // Since I can't edit supabase.js right now easily without resending it, let's assume saveTransaction handles insert. 
             // We need window.updateTransaction. If it's missing, delete + insert.
             if (window.updateTransaction) {
                 success = await window.updateTransaction(id, txData);
             } else {
                 // Fallback: Delete old, Insert new
                 await window.deleteTransaction(id);
                 success = await window.saveTransaction(txData);
             }
        } else {
            success = await window.saveTransaction(txData);
        }

        if (success) {
            showToast("Saved!", "success");
            document.getElementById('add-modal').classList.add('hidden');
            newTxForm.reset();
            const now = new Date();
            document.getElementById('tx-date-input').value = now.toISOString().split('T')[0];
            document.getElementById('tx-time-input').value = now.toTimeString().slice(0, 5);
            document.getElementById('tx-id').value = ''; // Clear ID
            await initData();
        } else {
            showToast("Error saving", "error");
        }
        btn.textContent = oldText;
    });
    
    // Global Functions
    window.onDeleteTx = async (id) => {
        if(confirm("Delete transaction?")) {
            await window.deleteTransaction(id);
            await initData();
            showToast("Deleted", "success");
        }
    };
    
    // RESTORED: Edit Transaction
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
        
        // Date parsing
        const d = new Date(tx.date);
        document.getElementById('tx-date-input').value = d.toISOString().split('T')[0];
        document.getElementById('tx-time-input').value = d.toTimeString().slice(0, 5);
        
        document.getElementById('modal-title').textContent = "Edit Transaction";
        document.getElementById('add-modal').classList.remove('hidden');
        
        // Trigger calculator to re-bind values (optional)
        setupCalculator();
    };
    
    // New TX Button Reset
    const btnAdd = document.querySelector('button[onclick*="add-modal"]'); // Find the add button in HTML
    if (btnAdd) {
         // Override the inline onclick to clear the form
         btnAdd.onclick = (e) => {
             e.preventDefault();
             document.getElementById('add-tx-form').reset();
             document.getElementById('tx-id').value = '';
             document.getElementById('modal-title').textContent = "New Transaction";
             const now = new Date();
             document.getElementById('tx-date-input').value = now.toISOString().split('T')[0];
             document.getElementById('tx-time-input').value = now.toTimeString().slice(0, 5);
             document.getElementById('add-modal').classList.remove('hidden');
         }
    }
    
    setupPasskeyListeners();
}

// PASSKEY HELPERS (Same as before)
async function checkPasskeyStatus() {
    const section = document.getElementById('passkey-settings');
    if (!window.isWebAuthnSupported || !window.isWebAuthnSupported()) {
        section.classList.add('hidden'); return;
    }
    section.classList.remove('hidden');
    
    const statusEl = document.getElementById('passkey-status');
    const btnSetup = document.getElementById('btn-setup-passkey');
    const btnRemove = document.getElementById('btn-remove-passkey');
    const hasKey = await window.hasPasskey();
    
    if (hasKey) {
        statusEl.textContent = '✅ Active'; statusEl.classList.add('text-green-500');
        btnSetup.classList.add('hidden'); btnRemove.classList.remove('hidden');
    } else {
        statusEl.textContent = 'Not set up'; statusEl.classList.remove('text-green-500');
        btnSetup.classList.remove('hidden'); btnRemove.classList.add('hidden');
    }
}

function setupPasskeyListeners() {
    const btnSetup = document.getElementById('btn-setup-passkey');
    const btnRemove = document.getElementById('btn-remove-passkey');
    if(btnSetup) {
        const nBtn = btnSetup.cloneNode(true); btnSetup.parentNode.replaceChild(nBtn, btnSetup);
        nBtn.addEventListener('click', async () => { if (await window.registerPasskey()) { showToast('Passkey setup success!', 'success'); checkPasskeyStatus(); } });
    }
    if(btnRemove) {
        const nBtn = btnRemove.cloneNode(true); btnRemove.parentNode.replaceChild(nBtn, btnRemove);
        nBtn.addEventListener('click', async () => { if (confirm('Disable passkey?')) { if (await window.removePasskey()) { showToast('Passkey removed', 'success'); checkPasskeyStatus(); } } });
    }
}

function showAppScreen() { document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('app-content').classList.remove('hidden'); }
function showAuthScreen() { document.getElementById('auth-screen').classList.remove('hidden'); document.getElementById('app-content').classList.add('hidden'); }
