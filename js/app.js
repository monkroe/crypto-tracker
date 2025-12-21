// js/app.js - v3.0.0
// Features: Goals CRUD, Transaction Updates, CSV Validation, PnL Chart, Passkeys

import { showToast, parseCSV, debugLog, sanitizeText } from './utils.js';
import { loadInitialData, calculateHoldings, state, resetPriceCache } from './logic.js';
import { updateDashboardUI, renderCoinCards, renderTransactionJournal, renderGoals, renderAllocationChart, renderPnLChart, setupThemeHandlers } from './ui.js';

const APP_VERSION = '3.0.0';

// ==========================================
// 1. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('app-version').textContent = APP_VERSION;
    setupThemeHandlers();
    
    // Settings Button Handler
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        btnSettings.onclick = async () => {
            document.getElementById('settings-modal').classList.remove('hidden');
            await checkPasskeyStatus();
        };
    }

    // Check Auth Session
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
        console.error(e); 
        showToast("Klaida kraunant duomenis", "error"); 
    }
}

function refreshUI() {
    const totals = calculateHoldings();
    updateDashboardUI(totals);
    renderCoinCards();
    renderTransactionJournal();
    renderGoals();
    renderAllocationChart();
    renderPnLChart(); // Default view
    
    // Update Dropdowns
    const coinSelects = [document.getElementById('tx-coin'), document.getElementById('delete-coin-select')];
    coinSelects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '';
        state.coins.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.symbol; 
            opt.textContent = c.symbol; 
            sel.appendChild(opt);
        });
    });
}

// ==========================================
// 2. GLOBAL HANDLERS (For HTML onclick)
// ==========================================

// Transaction Delete
window.onDeleteTx = async (id) => {
    if(confirm("Ar tikrai norite ištrinti šią transakciją?")) {
        await window.deleteTransaction(id);
        await initData();
        showToast("Ištrinta sėkmingai", "success");
    }
};

// Transaction Edit (Opens Modal with Data)
window.onEditTx = (id) => {
    try {
        const tx = state.transactions.find(t => String(t.id) === String(id));
        if (!tx) {
            showToast('Transakcija nerasta', 'error');
            return;
        }
        
        // Helper to set values safely
        const setVal = (elId, value) => {
            const el = document.getElementById(elId);
            if (el) el.value = value ?? '';
        };
        
        setVal('tx-id', tx.id);
        setVal('tx-type', tx.type || 'Buy');
        setVal('tx-amount', tx.amount);
        setVal('tx-price', tx.price_per_coin);
        setVal('tx-total', tx.total_cost_usd);
        setVal('tx-exchange', tx.exchange || '');
        setVal('tx-method', tx.method || 'Market Buy');
        setVal('tx-notes', tx.notes || '');
        
        // Handle Coin Select
        const coinSelect = document.getElementById('tx-coin');
        if (coinSelect) {
            // If coin was deleted but tx exists, add temp option
            const optionExists = Array.from(coinSelect.options).some(opt => opt.value === tx.coin_symbol);
            if (!optionExists && tx.coin_symbol) {
                const opt = document.createElement('option');
                opt.value = tx.coin_symbol;
                opt.textContent = tx.coin_symbol;
                coinSelect.appendChild(opt);
            }
            coinSelect.value = tx.coin_symbol;
        }
        
        // Handle Date/Time
        try {
            const d = new Date(tx.date);
            if (!isNaN(d.getTime())) {
                setVal('tx-date-input', d.toISOString().split('T')[0]);
                setVal('tx-time-input', d.toTimeString().slice(0, 5));
            }
        } catch (dateErr) { console.warn('Date error', dateErr); }
        
        // Update Modal Title & Button
        document.getElementById('modal-title').textContent = "Redaguoti Transakciją";
        document.getElementById('btn-save').textContent = "Atnaujinti";
        
        document.getElementById('add-modal').classList.remove('hidden');
        
    } catch (e) {
        console.error('Edit error:', e);
        showToast('Klaida atidarant formą', 'error');
    }
};

// Goal Edit (Opens Goal Modal)
window.editGoal = (goalId) => {
    try {
        const goal = state.goals.find(g => String(g.id) === String(goalId));
        if (!goal) {
            showToast('Tikslas nerastas', 'error');
            return;
        }
        
        document.getElementById('edit-goal-id').value = goal.id;
        document.getElementById('edit-goal-coin').textContent = goal.coin_symbol;
        document.getElementById('edit-goal-target').value = goal.target_amount;
        
        document.getElementById('edit-goal-modal').classList.remove('hidden');
    } catch (e) {
        console.error('Goal edit error:', e);
    }
};

// PnL Chart Timeframe Switcher
window.changePnLTimeframe = (timeframe) => {
    document.getElementById('tf-indicator').textContent = timeframe;
    
    document.querySelectorAll('.tf-btn').forEach(btn => {
        const tf = btn.getAttribute('data-tf');
        if (tf === timeframe) {
            btn.classList.add('text-white', 'bg-gray-800', 'dark:bg-gray-600', 'rounded', 'shadow-sm');
            btn.classList.remove('text-gray-400', 'hover:text-gray-900', 'dark:hover:text-white');
        } else {
            btn.classList.remove('text-white', 'bg-gray-800', 'dark:bg-gray-600', 'rounded', 'shadow-sm');
            btn.classList.add('text-gray-400', 'hover:text-gray-900', 'dark:hover:text-white');
        }
    });
    
    renderPnLChart(timeframe);
};

// ==========================================
// 3. EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
    
    // --- TRANSACTION FORM (Create & Update) ---
    const form = document.getElementById('add-tx-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-save');
            const originalText = btn.textContent;
            btn.textContent = "Saugoma...";
            btn.disabled = true;
            
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
            try {
                if (id) {
                    // UPDATE existing
                    success = await window.updateTransaction(id, txData);
                } else {
                    // CREATE new
                    success = await window.saveTransaction(txData);
                }
            } catch (err) {
                console.error('Save error:', err);
            }

            if (success) {
                showToast("Išsaugota sėkmingai!", "success");
                document.getElementById('add-modal').classList.add('hidden');
                form.reset();
                await initData();
            } else {
                showToast("Nepavyko išsaugoti", "error");
            }
            
            btn.textContent = originalText;
            btn.disabled = false;
        };
    }

    // --- CSV IMPORT ---
    const csvInput = document.getElementById('csv-file-input');
    if (csvInput) {
        csvInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            const parsed = parseCSV(text);
            
            if (parsed.length === 0) return showToast('Netinkamas arba tuščias CSV failas', 'error');
            
            // Validation: Check if coins exist
            const validCoins = state.coins.map(c => c.symbol);
            const invalidTxs = parsed.filter(tx => !validCoins.includes(tx.coin_symbol));
            
            if (invalidTxs.length > 0) {
                const unknownSymbols = [...new Set(invalidTxs.map(tx => tx.coin_symbol))];
                return showToast(`Nežinomos monetos: ${unknownSymbols.join(', ')}. Pirmiau pridėkite jas į sistemą!`, 'error');
            }
            
            if (!confirm(`Rasta ${parsed.length} transakcijų. Importuoti?`)) return;

            showToast('Importuojama...', 'info');
            let count = 0;
            for (const tx of parsed) {
                if (await window.saveTransaction(tx)) count++;
            }
            showToast(`Sėkmingai importuota: ${count}`, 'success');
            await initData();
            e.target.value = '';
        };
    }

    // --- COIN & GOAL MANAGEMENT ---
    // Save New Coin
    document.getElementById('btn-save-coin').onclick = async () => {
        const symbol = document.getElementById('new-coin-symbol').value.toUpperCase();
        const coingeckoId = document.getElementById('new-coin-id').value.toLowerCase().trim();
        const targetAmount = parseFloat(document.getElementById('new-coin-target').value);
        
        if(!symbol || !coingeckoId) return showToast('Užpildykite simbolį ir ID', 'error');
        
        const btn = document.getElementById('btn-save-coin');
        const originalText = btn.textContent;
        btn.textContent = 'Tikrinama...';
        btn.disabled = true;
        
        try {
            // Validate via API
            const testRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=usd`);
            const testData = await testRes.json();
            
            if (!testData[coingeckoId]) {
                showToast(`Neteisingas CoinGecko ID: "${coingeckoId}"`, 'error');
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }
            
            // Save coin to DB
            if (await window.saveNewCoin({ symbol, coingecko_id: coingeckoId })) {
                // Save goal if provided
                if (targetAmount && targetAmount > 0) {
                    await window.saveCryptoGoal({ coin_symbol: symbol, target_amount: targetAmount });
                }
                
                showToast('Moneta pridėta sėkmingai', 'success');
                document.getElementById('new-coin-modal').classList.add('hidden');
                
                // Reset inputs
                document.getElementById('new-coin-symbol').value = '';
                document.getElementById('new-coin-id').value = '';
                document.getElementById('new-coin-target').value = '';
                
                resetPriceCache();
                await initData();
            } else {
                showToast('Klaida išsaugant monetą', 'error');
            }
        } catch (e) {
            showToast('API klaida. Bandykite vėliau.', 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    // Delete Coin
    document.getElementById('btn-delete-coin').onclick = async () => {
        const symbol = document.getElementById('delete-coin-select').value;
        if (!symbol) return showToast('Pasirinkite monetą', 'error');
        
        if (!confirm(`Ar tikrai ištrinti ${symbol}? Bus ištrinti ir susiję tikslai.`)) return;
        
        if (await window.deleteSupportedCoin(symbol)) {
            showToast('Moneta ištrinta', 'success');
            document.getElementById('delete-coin-modal').classList.add('hidden');
            await initData();
        } else {
            showToast('Klaida trinant', 'error');
        }
    };
    
    // --- GOAL MODAL ACTIONS ---
    // Update Goal
    document.getElementById('btn-update-goal').onclick = async () => {
        const goalId = document.getElementById('edit-goal-id').value;
        const newTarget = parseFloat(document.getElementById('edit-goal-target').value);
        
        if (!newTarget || newTarget <= 0) return showToast('Įveskite teisingą skaičių', 'error');
        
        if (await window.updateCryptoGoal(goalId, newTarget)) {
            showToast('Tikslas atnaujintas', 'success');
            document.getElementById('edit-goal-modal').classList.add('hidden');
            await initData();
        } else {
            showToast('Klaida atnaujinant', 'error');
        }
    };
    
    // Delete Goal
    document.getElementById('btn-delete-goal').onclick = async () => {
        const goalId = document.getElementById('edit-goal-id').value;
        if (!confirm("Ar tikrai ištrinti šį tikslą?")) return;
        
        if (await window.deleteCryptoGoal(goalId)) {
            showToast('Tikslas ištrintas', 'success');
            document.getElementById('edit-goal-modal').classList.add('hidden');
            await initData();
        } else {
            showToast('Klaida trinant', 'error');
        }
    };
    
    // --- AUTHENTICATION ---
    document.getElementById('btn-login').onclick = async () => {
        const btn = document.getElementById('btn-login');
        const email = document.getElementById('auth-email').value.trim();
        const pass = document.getElementById('auth-pass').value;
        
        if (!email || !pass) return showToast('Įveskite duomenis', 'error');
        
        btn.textContent = 'Jungiamasi...';
        btn.disabled = true;
        
        try {
            const result = await window.userLogin(email, pass);
            if (result.error) {
                showToast('Prisijungti nepavyko', 'error');
            } else if (result.data?.user) {
                showToast('Sveiki sugrįžę!', 'success');
                showAppScreen();
                await initData();
            }
        } catch (e) {
            showToast('Ryšio klaida', 'error');
        } finally {
            btn.textContent = 'Prisijungti';
            btn.disabled = false;
        }
    };
    
    document.getElementById('btn-signup').onclick = async () => {
        const btn = document.getElementById('btn-signup');
        const email = document.getElementById('auth-email').value.trim();
        const pass = document.getElementById('auth-pass').value;
        
        if (!email || !pass) return showToast('Įveskite duomenis', 'error');
        if (pass.length < 6) return showToast('Slaptažodis per trumpas (min 6)', 'error');
        
        btn.textContent = 'Registruojama...';
        btn.disabled = true;
        
        const result = await window.userSignUp(email, pass);
        if (result.error) {
            showToast(result.error.message, 'error');
        } else {
            showToast('Registracija sėkminga! Patikrinkite el. paštą.', 'success');
        }
        btn.textContent = 'Registruotis';
        btn.disabled = false;
    };
    
    document.getElementById('btn-logout').onclick = async () => { 
        await window.userSignOut(); 
        showAuthScreen(); 
        showToast('Atsijungta sėkmingai', 'success');
    };
    
    // --- EXPORT CSV ---
    document.getElementById('btn-export-csv').onclick = () => {
        if (state.transactions.length === 0) return showToast('Nėra duomenų eksportui', 'error');
        
        const headers = ['date', 'type', 'coin_symbol', 'amount', 'price_per_coin', 'total_cost_usd', 'exchange', 'method', 'notes'];
        const csvContent = [
            headers.join(','),
            ...state.transactions.map(tx => 
                headers.map(h => {
                    const value = (tx[h] || '').toString();
                    return `"${value.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
                }).join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `crypto-export-${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        showToast('Failas paruoštas atsisiuntimui', 'success');
    };
    
    // --- FETCH PRICE API ---
    document.getElementById('btn-fetch-price').onclick = async () => {
        const btn = document.getElementById('btn-fetch-price');
        const coinSymbol = document.getElementById('tx-coin').value;
        const coin = state.coins.find(c => c.symbol === coinSymbol);
        
        if (!coin) return showToast('Pasirinkite monetą', 'error');
        
        const originalText = btn.innerHTML;
        btn.innerHTML = '...';
        btn.disabled = true;
        
        try {
            const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin.coingecko_id)}&vs_currencies=usd`);
            if(!res.ok) throw new Error();
            const data = await res.json();
            
            if (data[coin.coingecko_id]?.usd) {
                document.getElementById('tx-price').value = data[coin.coingecko_id].usd;
                // Trigger calculation
                document.getElementById('tx-price').dispatchEvent(new Event('input'));
                showToast('Kaina atnaujinta', 'success');
            } else {
                showToast('Kaina nerasta', 'error');
            }
        } catch (e) {
            showToast('Nepavyko gauti kainos (API limitas?)', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };
    
    // --- PASSKEY HANDLERS ---
    document.getElementById('btn-setup-passkey').onclick = async () => {
        if (await window.registerPasskey()) {
            showToast('Passkey sėkmingai sukurtas!', 'success');
            await checkPasskeyStatus();
        }
    };

    document.getElementById('btn-remove-passkey').onclick = async () => {
        if (confirm('Pašalinti passkey?')) {
            await window.removePasskey();
            showToast('Passkey pašalintas', 'success');
            await checkPasskeyStatus();
        }
    };
    
    // --- CALCULATOR & UI HELPERS ---
    setupCalculator();
    setupBulkSelection();
    
    // Reset Add Modal on Open
    const btnAdd = document.querySelector('button[onclick*="add-modal"]');
    if (btnAdd) {
         btnAdd.onclick = (e) => {
             // If manual listener is needed (usually HTML onclick handles class removal)
             document.getElementById('add-tx-form').reset();
             document.getElementById('tx-id').value = '';
             document.getElementById('modal-title').textContent = "Nauja Transakcija";
             document.getElementById('btn-save').textContent = "Išsaugoti";
             const now = new Date();
             document.getElementById('tx-date-input').value = now.toISOString().split('T')[0];
             document.getElementById('tx-time-input').value = now.toTimeString().slice(0, 5);
             document.getElementById('add-modal').classList.remove('hidden');
         }
    }
}

// ==========================================
// 4. UTILITY FUNCTIONS
// ==========================================

function setupCalculator() {
    // Auto-calculate fields
    const calc = (src) => {
        const amountIn = document.getElementById('tx-amount');
        const priceIn = document.getElementById('tx-price');
        const totalIn = document.getElementById('tx-total');
        if (!amountIn || !priceIn || !totalIn) return;
        
        const val = (el) => parseFloat(el.value) || 0;
        const a = val(amountIn), p = val(priceIn), t = val(totalIn);
        
        if (src === 'total') { 
            if(a>0) priceIn.value=(t/a).toFixed(8); 
            else if(p>0) amountIn.value=(t/p).toFixed(6); 
        }
        else if (src === 'amount') { 
            if(t>0) priceIn.value=(t/a).toFixed(8); 
            else if(p>0) totalIn.value=(a*p).toFixed(2); 
        }
        else if (src === 'price') { 
            if(a>0) totalIn.value=(a*p).toFixed(2); 
            else if(t>0) amountIn.value=(t/p).toFixed(6); 
        }
    };

    ['tx-amount', 'tx-price', 'tx-total'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', (e) => calc(e.target.id.split('-')[1]));
    });
}

function setupBulkSelection() {
    const selectAllCheckbox = document.getElementById('select-all-tx');
    if (selectAllCheckbox) {
        selectAllCheckbox.onchange = () => {
            const isChecked = selectAllCheckbox.checked;
            document.querySelectorAll('.tx-checkbox').forEach(cb => {
                cb.checked = isChecked;
            });
            updateDeleteSelectedButton();
        };
    }

    const deleteSelectedBtn = document.getElementById('btn-delete-selected');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.onclick = async () => {
            const selectedIds = Array.from(document.querySelectorAll('.tx-checkbox:checked'))
                .map(cb => cb.dataset.txId);
            
            if (selectedIds.length === 0) return showToast('Nepasirinkta nieko', 'error');
            if (!confirm(`Ištrinti ${selectedIds.length} įrašus?`)) return;
            
            deleteSelectedBtn.disabled = true;
            deleteSelectedBtn.innerHTML = 'Trinama...';
            
            const results = await Promise.all(selectedIds.map(id => window.deleteTransaction(id)));
            const deleted = results.filter(Boolean).length;
            
            showToast(`Ištrinta: ${deleted}`, 'success');
            document.getElementById('select-all-tx').checked = false;
            await initData();
            
            deleteSelectedBtn.disabled = false;
        };
    }
}

// Exported for UI.js usage
window.updateDeleteSelectedButton = () => {
    const selectedCount = document.querySelectorAll('.tx-checkbox:checked').length;
    const deleteBtn = document.getElementById('btn-delete-selected');
    const countSpan = document.getElementById('selected-count');
    
    if (deleteBtn) {
        if (selectedCount > 0) {
            deleteBtn.classList.remove('hidden');
            deleteBtn.classList.add('flex');
        } else {
            deleteBtn.classList.add('hidden');
            deleteBtn.classList.remove('flex');
        }
    }
    if (countSpan) countSpan.textContent = selectedCount;
};

async function checkPasskeyStatus() {
    const settingsSection = document.getElementById('passkey-settings');
    const statusEl = document.getElementById('passkey-status');
    const setupBtn = document.getElementById('btn-setup-passkey');
    const removeBtn = document.getElementById('btn-remove-passkey');
    
    if (!window.isWebAuthnSupported()) {
        if (settingsSection) settingsSection.classList.add('hidden');
        return;
    }
    
    if (settingsSection) settingsSection.classList.remove('hidden');
    
    const hasKey = await window.hasPasskey();
    if (hasKey) {
        if (statusEl) statusEl.textContent = 'Aktyvuota';
        if (setupBtn) setupBtn.classList.add('hidden');
        if (removeBtn) removeBtn.classList.remove('hidden');
    } else {
        if (statusEl) statusEl.textContent = 'Neaktyvuota';
        if (setupBtn) setupBtn.classList.remove('hidden');
        if (removeBtn) removeBtn.classList.add('hidden');
    }
}

function showAppScreen() { document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('app-content').classList.remove('hidden'); }
function showAuthScreen() { document.getElementById('auth-screen').classList.remove('hidden'); document.getElementById('app-content').classList.add('hidden'); }
