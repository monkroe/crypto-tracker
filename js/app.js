// js/app.js - v3.1.0 (Feature Complete)
import { showToast, debugLog, sanitizeText } from './utils.js';
import { loadInitialData, calculateHoldings, state } from './logic.js';
import { updateDashboardUI, renderCoinCards, renderTransactionJournal, renderAllocationChart, setupCalculator, setupThemeHandlers } from './ui.js';

const APP_VERSION = '3.1.0';

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
    // 1. SETTINGS & PASSKEY
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        // Safe listener pattern
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

    // 3. TRANSACTION FORM & CALCULATOR
    const txForm = document.getElementById('add-tx-form');
    const newTxForm = txForm.cloneNode(true);
    txForm.parentNode.replaceChild(newTxForm, txForm);
    
    // SETUP CALCULATOR NOW
    setupCalculator();

    // 4. GET PRICE BUTTON IMPLEMENTATION (NEW!)
    const btnGetPrice = document.getElementById('btn-fetch-price');
    if (btnGetPrice) {
        // Remove inline onclick from HTML first or clone
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
                        document.getElementById('tx-price').value = price;
                        // Trigger calculator
                        document.getElementById('tx-price').dispatchEvent(new Event('input'));
                        showToast(`Price: $${price}`, 'success');
                    }
                }
            } catch(e) { showToast('API Error', 'error'); }
            newBtnPrice.textContent = 'GET PRICE';
        });
    }

    // 5. SAVE TRANSACTION (With Sanitization)
    newTxForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save');
        const oldText = btn.textContent;
        btn.textContent = "Saving...";
        
        const dateVal = document.getElementById('tx-date-input').value;
        const timeVal = document.getElementById('tx-time-input').value || '00:00';
        const fullDate = new Date(`${dateVal}T${timeVal}:00`).toISOString();

        const txData = {
            date: fullDate,
            type: document.getElementById('tx-type').value,
            coin_symbol: document.getElementById('tx-coin').value,
            amount: document.getElementById('tx-amount').value,
            total_cost_usd: document.getElementById('tx-total').value,
            price_per_coin: document.getElementById('tx-price').value,
            exchange: document.getElementById('tx-exchange').value,
            method: document.getElementById('tx-method').value,
            notes: sanitizeText(document.getElementById('tx-notes').value) // SANITIZED!
        };

        const success = await window.saveTransaction(txData);
        if (success) {
            showToast("Saved!", "success");
            document.getElementById('add-modal').classList.add('hidden');
            newTxForm.reset();
            const now = new Date();
            document.getElementById('tx-date-input').value = now.toISOString().split('T')[0];
            document.getElementById('tx-time-input').value = now.toTimeString().slice(0, 5);
            await initData();
        } else {
            showToast("Error saving", "error");
        }
        btn.textContent = oldText;
    });
    
    // 6. CSV IMPORT (Basic Implementation)
    const csvInput = document.getElementById('csv-file-input');
    if (csvInput) {
        const newCsv = csvInput.cloneNode(true);
        csvInput.parentNode.replaceChild(newCsv, csvInput);
        newCsv.addEventListener('change', async (e) => {
             const file = e.target.files[0];
             if (!file) return;
             showToast('Importing CSV...', 'info');
             // Čia ateityje galima įdėti pilną CSV parserį
             showToast('CSV Feature coming in v3.2', 'info');
        });
    }

    // Global delete
    window.onDeleteTx = async (id) => {
        if(confirm("Delete transaction?")) {
            await window.deleteTransaction(id);
            await initData();
            showToast("Deleted", "success");
        }
    };
    
    setupPasskeyListeners();
}

// PASSKEY HELPERS
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
