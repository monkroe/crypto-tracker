// js/app.js - v3.0.1 Fix
import { showToast, debugLog } from './utils.js';
import { loadInitialData, calculateHoldings, state } from './logic.js';
import { updateDashboardUI, renderCoinCards, renderTransactionJournal, renderAllocationChart, setupCalculator, setupThemeHandlers } from './ui.js';

const APP_VERSION = '3.0.1';

// ===================================
// INIT
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    debugLog(`✅ App v${APP_VERSION} starting...`);
    document.getElementById('app-version').textContent = APP_VERSION;
    
    // Setup UI interactivity (Themes, Calculator)
    setupThemeHandlers();
    
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
        // Svarbu: skaičiuotuvas aktyvuojamas po duomenų užkrovimo, 
        // nes tik tada modalas pilnai veikia DOM'e.
        setupCalculator(); 
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
    
    // Atnaujiname select meniu
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
    // 1. Settings Modal (Gear Icon) - Pataisyta!
    document.getElementById('btn-settings').addEventListener('click', async () => {
        document.getElementById('settings-modal').classList.remove('hidden');
        await checkPasskeyStatus();
    });

    // 2. Auth
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

    // 3. Transaction Form
    const txForm = document.getElementById('add-tx-form');
    // Pašaliname senus listenerius klonuojant
    const newTxForm = txForm.cloneNode(true);
    txForm.parentNode.replaceChild(newTxForm, txForm);

    newTxForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save');
        const oldText = btn.textContent;
        btn.textContent = "Saving...";
        
        // Pataisytas laikas (S25 Ultra data picker fix)
        const dateVal = document.getElementById('tx-date-input').value;
        const timeVal = document.getElementById('tx-time-input').value || '00:00';
        const fullDate = new Date(`${dateVal}T${timeVal}:00`).toISOString();

        const txData = {
            date: fullDate,
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
            newTxForm.reset();
            // Reset date to today
            const now = new Date();
            document.getElementById('tx-date-input').value = now.toISOString().split('T')[0];
            document.getElementById('tx-time-input').value = now.toTimeString().slice(0, 5);
            await initData();
        } else {
            showToast("Error saving", "error");
        }
        btn.textContent = oldText;
    });
    
    // 4. Global Functions for Buttons (Delete/Edit)
    window.onDeleteTx = async (id) => {
        if(confirm("Delete transaction?")) {
            await window.deleteTransaction(id);
            await initData();
            showToast("Deleted", "success");
        }
    };

    // 5. Passkey Setup Listeners
    setupPasskeyListeners();
}

// ===================================
// PASSKEY LOGIC (Settings)
// ===================================
async function checkPasskeyStatus() {
    const section = document.getElementById('passkey-settings');
    if (!window.isWebAuthnSupported()) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');
    
    const statusEl = document.getElementById('passkey-status');
    const btnSetup = document.getElementById('btn-setup-passkey');
    const btnRemove = document.getElementById('btn-remove-passkey');

    const hasKey = await window.hasPasskey();
    
    if (hasKey) {
        statusEl.textContent = '✅ Active';
        statusEl.classList.add('text-green-500');
        btnSetup.classList.add('hidden');
        btnRemove.classList.remove('hidden');
    } else {
        statusEl.textContent = 'Not set up';
        statusEl.classList.remove('text-green-500');
        btnSetup.classList.remove('hidden');
        btnRemove.classList.add('hidden');
    }
}

function setupPasskeyListeners() {
    const btnSetup = document.getElementById('btn-setup-passkey');
    const btnRemove = document.getElementById('btn-remove-passkey');
    
    if(btnSetup) {
        btnSetup.addEventListener('click', async () => {
            if (await window.registerPasskey()) {
                showToast('Passkey setup success!', 'success');
                checkPasskeyStatus();
            }
        });
    }
    
    if(btnRemove) {
        btnRemove.addEventListener('click', async () => {
            if (confirm('Disable passkey?')) {
                if (await window.removePasskey()) {
                    showToast('Passkey removed', 'success');
                    checkPasskeyStatus();
                }
            }
        });
    }
}

function showAppScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
}

function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-content').classList.add('hidden');
}
