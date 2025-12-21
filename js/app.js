// js/app.js - v3.9.7 (Final Stable)
// Features: Smart Calculator, Fees, Gift Lock, Bulk Delete, Goals, CSV Import/Export

import { state, loadInitialData, calculateHoldings, resetPriceCache } from './logic.js';
import { 
    setupThemeHandlers, updateDashboardUI, renderGoals, 
    renderCoinCards, renderTransactionJournal, renderAllocationChart, renderPnLChart 
} from './ui.js';
import { showToast, sanitizeText, parseCSV } from './utils.js';

const APP_VERSION = 'v3.9.7';

// ==========================================
// 1. INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log(`🚀 Crypto Tracker ${APP_VERSION} Loading...`);
        
        // Set version in footer
        const versionEl = document.getElementById('app-version');
        if (versionEl) versionEl.textContent = APP_VERSION;
        
        // Load data and setup UI
        await loadInitialData();
        setupThemeHandlers();
        setupEventListeners();
        setupModalCalculations();
        refreshUI();
        
        console.log('✅ App initialized successfully');
    } catch (e) {
        console.error("❌ Init Error:", e);
        showToast('Klaida kraunant programą', 'error');
    }
});

// ==========================================
// 2. UI REFRESH
// ==========================================
function refreshUI() {
    const totals = calculateHoldings();
    updateDashboardUI(totals);
    renderCoinCards();
    renderGoals();
    renderTransactionJournal();
    renderAllocationChart();
    
    const currentTimeframe = document.getElementById('tf-indicator')?.textContent || 'ALL';
    renderPnLChart(currentTimeframe);
    
    // Update coin dropdowns
    updateCoinSelects();
}

function updateCoinSelects() {
    const coinSelects = [
        document.getElementById('tx-coin'),
        document.getElementById('delete-coin-select')
    ];
    
    coinSelects.forEach(select => {
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '';
        
        state.coins.forEach(coin => {
            const option = document.createElement('option');
            option.value = coin.coingecko_id;
            option.textContent = coin.symbol;
            select.appendChild(option);
        });
        
        // Restore previous selection if exists
        if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

// ==========================================
// 3. SMART CALCULATOR + GIFT LOGIC
// ==========================================
function setupModalCalculations() {
    const methodEl = document.getElementById('tx-method');
    const amountEl = document.getElementById('tx-amount');
    const priceEl = document.getElementById('tx-price');
    const feesEl = document.getElementById('tx-fees');
    const totalEl = document.getElementById('tx-total');
    const typeEl = document.getElementById('tx-type');

    if (!methodEl || !amountEl || !priceEl || !feesEl || !totalEl || !typeEl) {
        console.warn('⚠️ Calculator elements not found');
        return;
    }

    // A. GIFT MODE (Lock fields and set to 0)
    const handleMethodChange = () => {
        const isGift = methodEl.value === 'Gift/Airdrop' || methodEl.value === 'Staking Reward';
        
        if (isGift) {
            // Set to 0
            priceEl.value = 0;
            totalEl.value = 0;
            feesEl.value = 0;
            
            // Lock and gray out
            [priceEl, totalEl, feesEl].forEach(el => {
                el.disabled = true;
                el.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-200', 'dark:bg-gray-800');
                el.classList.remove('bg-white', 'dark:bg-gray-900');
            });
        } else {
            // Unlock
            [priceEl, totalEl, feesEl].forEach(el => {
                el.disabled = false;
                el.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-200', 'dark:bg-gray-800');
                el.classList.add('bg-white', 'dark:bg-gray-900');
            });
        }
    };

    // B. CALCULATE: Amount/Price → TOTAL (with fees)
    const calcFromPrice = () => {
        if (methodEl.value === 'Gift/Airdrop' || methodEl.value === 'Staking Reward') return;

        const amount = parseFloat(amountEl.value) || 0;
        const price = parseFloat(priceEl.value) || 0;
        const fees = parseFloat(feesEl.value) || 0;

        if (amount > 0 && price >= 0) {
            let total = amount * price;
            
            // Buy: Cost = Price + Fees
            // Sell: Revenue = Price - Fees
            if (typeEl.value === 'Buy') {
                total += fees;
            } else {
                total -= fees;
            }
            
            totalEl.value = total.toFixed(2);
        }
    };

    // C. CALCULATE: Total → PRICE (Reverse calculation)
    const calcFromTotal = () => {
        if (methodEl.value === 'Gift/Airdrop' || methodEl.value === 'Staking Reward') return;

        const amount = parseFloat(amountEl.value) || 0;
        const total = parseFloat(totalEl.value) || 0;
        const fees = parseFloat(feesEl.value) || 0;

        if (amount > 0) {
            // Reverse: Extract price from total
            let cleanTotal = total;
            if (typeEl.value === 'Buy') {
                cleanTotal -= fees; // Remove fees from total
            } else {
                cleanTotal += fees; // Add fees back
            }

            const price = cleanTotal / amount;
            priceEl.value = price > 0 ? price.toFixed(8) : 0;
        }
    };

    // Event Listeners
    methodEl.addEventListener('change', handleMethodChange);
    typeEl.addEventListener('change', calcFromPrice);
    
    amountEl.addEventListener('input', calcFromPrice);
    priceEl.addEventListener('input', calcFromPrice);
    feesEl.addEventListener('input', calcFromPrice);
    
    totalEl.addEventListener('input', calcFromTotal);
}

// ==========================================
// 4. EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
    
    // --- TRANSACTION FORM SUBMIT ---
    const form = document.getElementById('add-tx-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('btn-save');
            const originalText = btn.textContent;
            btn.textContent = 'Saugoma...';
            btn.disabled = true;

            try {
                const method = document.getElementById('tx-method').value;
                const isGift = method === 'Gift/Airdrop' || method === 'Staking Reward';
                
                const coinSelect = document.getElementById('tx-coin');
                const selectedOption = coinSelect.options[coinSelect.selectedIndex];
                
                const txData = {
                    type: document.getElementById('tx-type').value,
                    coin_symbol: selectedOption.textContent,
                    coin_id: selectedOption.value,
                    date: document.getElementById('tx-date-input').value + 'T' + 
                          (document.getElementById('tx-time-input').value || '00:00') + ':00',
                    amount: parseFloat(document.getElementById('tx-amount').value) || 0,
                    price_per_coin: isGift ? 0 : (parseFloat(document.getElementById('tx-price').value) || 0),
                    fees: isGift ? 0 : (parseFloat(document.getElementById('tx-fees').value) || 0),
                    total_cost_usd: isGift ? 0 : (parseFloat(document.getElementById('tx-total').value) || 0),
                    exchange: document.getElementById('tx-exchange').value || '',
                    method: method,
                    notes: sanitizeText(document.getElementById('tx-notes').value || '')
                };

                const txId = document.getElementById('tx-id').value;
                
                if (txId) {
                    await window.updateTransaction(txId, txData);
                    showToast('Transakcija atnaujinta', 'success');
                } else {
                    await window.addTransaction(txData);
                    showToast('Transakcija pridėta', 'success');
                }

                // Close modal and reset
                document.getElementById('add-modal').classList.add('hidden');
                form.reset();
                document.getElementById('tx-id').value = '';
                document.getElementById('modal-title').textContent = 'Nauja Transakcija';
                
                // Unlock fields after reset
                unlockGiftFields();

                // Reload data
                await loadInitialData();
                refreshUI();

            } catch (err) {
                console.error('Save error:', err);
                showToast('Klaida saugant: ' + err.message, 'error');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };
    }

    // --- FETCH PRICE FROM API ---
    const btnFetchPrice = document.getElementById('btn-fetch-price');
    if (btnFetchPrice) {
        btnFetchPrice.onclick = async () => {
            const coinId = document.getElementById('tx-coin').value;
            if (!coinId) return showToast('Pasirinkite monetą', 'error');
            
            const btn = btnFetchPrice;
            const originalText = btn.textContent;
            btn.textContent = '...';
            btn.disabled = true;
            
            try {
                const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
                const data = await res.json();
                
                if (data[coinId]?.usd) {
                    document.getElementById('tx-price').value = data[coinId].usd;
                    document.getElementById('tx-price').dispatchEvent(new Event('input'));
                    showToast('Kaina atnaujinta', 'success');
                } else {
                    showToast('Kaina nerasta', 'error');
                }
            } catch (e) {
                console.error('Fetch price error:', e);
                showToast('Nepavyko gauti kainos', 'error');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };
    }

    // --- CSV IMPORT ---
    const csvInput = document.getElementById('csv-file-input');
    if (csvInput) {
        csvInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const parsed = parseCSV(text);
                
                if (parsed.length === 0) {
                    return showToast('Netinkamas arba tuščias CSV failas', 'error');
                }
                
                // Validate coins exist
                const validCoins = state.coins.map(c => c.symbol);
                const invalidTxs = parsed.filter(tx => !validCoins.includes(tx.coin_symbol));
                
                if (invalidTxs.length > 0) {
                    const unknownSymbols = [...new Set(invalidTxs.map(tx => tx.coin_symbol))];
                    return showToast(`Nežinomos monetos: ${unknownSymbols.join(', ')}. Pirmiau pridėkite jas!`, 'error');
                }
                
                if (!confirm(`Rasta ${parsed.length} transakcijų. Importuoti?`)) return;

                showToast('Importuojama...', 'info');
                let count = 0;
                
                for (const tx of parsed) {
                    try {
                        await window.addTransaction(tx);
                        count++;
                    } catch (err) {
                        console.error('Import error for tx:', tx, err);
                    }
                }
                
                showToast(`Sėkmingai importuota: ${count}`, 'success');
                await loadInitialData();
                refreshUI();
                
            } catch (err) {
                console.error('CSV import error:', err);
                showToast('CSV importo klaida', 'error');
            } finally {
                e.target.value = ''; // Reset input
            }
        };
    }

    // --- BULK DELETE ---
    const btnDeleteSelected = document.getElementById('btn-delete-selected');
    if (btnDeleteSelected) {
        btnDeleteSelected.onclick = async () => {
            const selectedIds = Array.from(document.querySelectorAll('.tx-checkbox:checked'))
                .map(cb => cb.dataset.txId);
            
            if (selectedIds.length === 0) return showToast('Nepasirinkta nieko', 'error');
            if (!confirm(`Ištrinti ${selectedIds.length} įrašus?`)) return;
            
            btnDeleteSelected.disabled = true;
            const originalHtml = btnDeleteSelected.innerHTML;
            btnDeleteSelected.innerHTML = 'Trinama...';
            
            let deleted = 0;
            for (const id of selectedIds) {
                try {
                    await window.deleteTransaction(id);
                    deleted++;
                } catch (err) {
                    console.error('Delete error:', err);
                }
            }
            
            showToast(`Ištrinta: ${deleted}`, 'success');
            await loadInitialData();
            refreshUI();
            
            btnDeleteSelected.disabled = false;
            btnDeleteSelected.innerHTML = originalHtml;
        };
    }

    // --- COIN MANAGEMENT ---
    const btnSaveCoin = document.getElementById('btn-save-coin');
    if (btnSaveCoin) {
        btnSaveCoin.onclick = async () => {
            const symbol = document.getElementById('new-coin-symbol').value.toUpperCase().trim();
            const coingeckoId = document.getElementById('new-coin-id').value.toLowerCase().trim();
            const targetAmount = parseFloat(document.getElementById('new-coin-target').value) || 0;
            
            if (!symbol || !coingeckoId) return showToast('Užpildykite simbolį ir ID', 'error');
            
            const btn = btnSaveCoin;
            const originalText = btn.textContent;
            btn.textContent = 'Tikrinama...';
            btn.disabled = true;
            
            try {
                // Validate via API
                const testRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=usd`);
                const testData = await testRes.json();
                
                if (!testData[coingeckoId]) {
                    showToast(`Neteisingas CoinGecko ID: "${coingeckoId}"`, 'error');
                    return;
                }
                
                // Add coin to DB
                const coinData = { symbol, coingecko_id: coingeckoId };
                await window.supabase.from('supported_coins').insert([coinData]);
                
                // Add goal if provided
                if (targetAmount > 0) {
                    await window.addGoal({ coin_symbol: symbol, target_amount: targetAmount });
                }
                
                showToast('Moneta pridėta sėkmingai', 'success');
                document.getElementById('new-coin-modal').classList.add('hidden');
                
                // Reset inputs
                document.getElementById('new-coin-symbol').value = '';
                document.getElementById('new-coin-id').value = '';
                document.getElementById('new-coin-target').value = '';
                
                resetPriceCache();
                await loadInitialData();
                refreshUI();
                
            } catch (e) {
                console.error('Add coin error:', e);
                showToast('Klaida pridedant monetą', 'error');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };
    }

    const btnDeleteCoin = document.getElementById('btn-delete-coin');
    if (btnDeleteCoin) {
        btnDeleteCoin.onclick = async () => {
            const symbol = document.getElementById('delete-coin-select').value;
            if (!symbol) return showToast('Pasirinkite monetą', 'error');
            
            // Find coin ID
            const coin = state.coins.find(c => c.symbol === symbol);
            if (!coin) return showToast('Moneta nerasta', 'error');
            
            if (!confirm(`Ar tikrai ištrinti ${symbol}? Bus ištrinti ir susiję tikslai bei transakcijos!`)) return;
            
            try {
                // Delete coin (cascades to goals and transactions via DB)
                await window.supabase.from('supported_coins').delete().eq('symbol', symbol);
                
                showToast('Moneta ištrinta', 'success');
                document.getElementById('delete-coin-modal').classList.add('hidden');
                
                resetPriceCache();
                await loadInitialData();
                refreshUI();
                
            } catch (e) {
                console.error('Delete coin error:', e);
                showToast('Klaida trinant monetą', 'error');
            }
        };
    }

    // --- GOAL MANAGEMENT ---
    const btnUpdateGoal = document.getElementById('btn-update-goal');
    if (btnUpdateGoal) {
        btnUpdateGoal.onclick = async () => {
            const goalId = document.getElementById('edit-goal-id').value;
            const newTarget = parseFloat(document.getElementById('edit-goal-target').value);
            
            if (!newTarget || newTarget <= 0) return showToast('Įveskite teisingą skaičių', 'error');
            
            try {
                await window.updateGoal(goalId, newTarget);
                showToast('Tikslas atnaujintas', 'success');
                document.getElementById('edit-goal-modal').classList.add('hidden');
                
                await loadInitialData();
                refreshUI();
                
            } catch (e) {
                console.error('Update goal error:', e);
                showToast('Klaida atnaujinant tikslą', 'error');
            }
        };
    }

    const btnDeleteGoal = document.getElementById('btn-delete-goal');
    if (btnDeleteGoal) {
        btnDeleteGoal.onclick = async () => {
            const goalId = document.getElementById('edit-goal-id').value;
            if (!confirm('Ar tikrai ištrinti šį tikslą?')) return;
            
            try {
                await window.deleteGoal(goalId);
                showToast('Tikslas ištrintas', 'success');
                document.getElementById('edit-goal-modal').classList.add('hidden');
                
                await loadInitialData();
                refreshUI();
                
            } catch (e) {
                console.error('Delete goal error:', e);
                showToast('Klaida trinant tikslą', 'error');
            }
        };
    }

    // --- MODAL RESET ON OPEN ---
    const btnAddTransaction = document.querySelector('button[onclick*="add-modal"]');
    if (btnAddTransaction) {
        const originalOnclick = btnAddTransaction.onclick;
        btnAddTransaction.onclick = (e) => {
            if (originalOnclick) originalOnclick(e);
            
            // Reset form
            const form = document.getElementById('add-tx-form');
            if (form) form.reset();
            
            document.getElementById('tx-id').value = '';
            document.getElementById('modal-title').textContent = 'Nauja Transakcija';
            
            const now = new Date();
            document.getElementById('tx-date-input').value = now.toISOString().split('T')[0];
            document.getElementById('tx-time-input').value = now.toTimeString().slice(0, 5);
            
            // Reset to Buy mode
            document.getElementById('tx-type').value = 'Buy';
            
            // Unlock fields
            unlockGiftFields();
        };
    }
}

// ==========================================
// 5. GLOBAL HANDLERS (for HTML onclick)
// ==========================================

// Edit Transaction
window.onEditTx = (id) => {
    const tx = state.transactions.find(t => t.id == id);
    if (!tx) {
        showToast('Transakcija nerasta', 'error');
        return;
    }

    document.getElementById('tx-id').value = tx.id;
    document.getElementById('modal-title').textContent = 'Redaguoti Transakciją';
    
    document.getElementById('tx-type').value = tx.type || 'Buy';
    
    // Set Coin Select
    const coinSelect = document.getElementById('tx-coin');
    for (let i = 0; i < coinSelect.options.length; i++) {
        if (coinSelect.options[i].textContent === tx.coin_symbol) {
            coinSelect.selectedIndex = i;
            break;
        }
    }
    
    // Date & Time
    try {
        const d = new Date(tx.date);
        document.getElementById('tx-date-input').value = d.toISOString().split('T')[0];
        document.getElementById('tx-time-input').value = d.toTimeString().slice(0, 5);
    } catch (e) {
        console.warn('Date parsing error:', e);
    }
    
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-method').value = tx.method || 'Market Buy';
    document.getElementById('tx-exchange').value = tx.exchange || '';
    document.getElementById('tx-notes').value = tx.notes || '';
    
    // Check if Gift logic applies
    const isGift = tx.method === 'Gift/Airdrop' || tx.method === 'Staking Reward';
    const priceEl = document.getElementById('tx-price');
    const totalEl = document.getElementById('tx-total');
    const feesEl = document.getElementById('tx-fees');

    if (isGift) {
        // Lock and set to 0
        priceEl.value = 0;
        totalEl.value = 0;
        feesEl.value = 0;
        
        [priceEl, totalEl, feesEl].forEach(el => {
            el.disabled = true;
            el.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-200', 'dark:bg-gray-800');
            el.classList.remove('bg-white', 'dark:bg-gray-900');
        });
    } else {
        // Recalculate price from total and fees
        let priceVal = 0;
        const amount = parseFloat(tx.amount) || 0;
        
        if (amount > 0) {
            const total = parseFloat(tx.total_cost_usd) || 0;
            const fees = parseFloat(tx.fees) || 0;
            
            // Reverse calculation: Extract price
            let cleanTotal = total;
            if (tx.type === 'Buy') {
                cleanTotal -= fees;
            } else {
                cleanTotal += fees;
            }
            
            priceVal = cleanTotal / amount;
        }
        
        priceEl.value = priceVal > 0 ? priceVal.toFixed(8) : 0;
        totalEl.value = tx.total_cost_usd || 0;
        feesEl.value = tx.fees || 0;
        
        // Unlock
        [priceEl, totalEl, feesEl].forEach(el => {
            el.disabled = false;
            el.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-200', 'dark:bg-gray-800');
            el.classList.add('bg-white', 'dark:bg-gray-900');
        });
    }

    document.getElementById('add-modal').classList.remove('hidden');
};

// Delete Transaction
window.onDeleteTx = async (id) => {
    if (!confirm('Ar tikrai norite ištrinti šią transakciją?')) return;
    
    try {
        await window.deleteTransaction(id);
        showToast('Transakcija ištrinta', 'success');
        
        await loadInitialData();
        refreshUI();
    } catch (e) {
        console.error('Delete error:', e);
        showToast('Klaida trinant transakciją', 'error');
    }
};

// Edit Goal
window.editGoal = (goalId) => {
    const goal = state.goals.find(g => g.id == goalId);
    if (!goal) {
        showToast('Tikslas nerastas', 'error');
        return;
    }
    
    document.getElementById('edit-goal-id').value = goal.id;
    document.getElementById('edit-goal-coin').textContent = goal.coin_symbol;
    document.getElementById('edit-goal-target').value = goal.target_amount;
    
    document.getElementById('edit-goal-modal').classList.remove('hidden');
};

// PnL Chart Timeframe
window.changePnLTimeframe = (timeframe) => {
    const indicator = document.getElementById('tf-indicator');
    if (indicator) indicator.textContent = timeframe;
    
    document.querySelectorAll('.tf-btn').forEach(btn => {
        if (btn.textContent.trim() === timeframe) {
            btn.classList.add('text-white', 'bg-gray-800', 'dark:bg-gray-600');
            btn.classList.remove('text-gray-400');
        } else {
            btn.classList.remove('text-white', 'bg-gray-800', 'dark:bg-gray-600');
            btn.classList.add('text-gray-400');
        }
    });
    
    renderPnLChart(timeframe);
};

// Bulk Selection Helper
window.updateDeleteSelectedButton = () => {
    const selectedCount = document.querySelectorAll('.tx-checkbox:checked').length;
    const deleteBtn = document.getElementById('btn-delete-selected');
    const countSpan = document.getElementById('selected-count');
    
    if (deleteBtn) {
        if (selectedCount > 0) {
            deleteBtn.classList.remove('hidden');
        } else {
            deleteBtn.classList.add('hidden');
        }
    }
    
    if (countSpan) countSpan.textContent = selectedCount;
};

// ==========================================
// 6. UTILITY FUNCTIONS
// ==========================================

function unlockGiftFields() {
    const priceEl = document.getElementById('tx-price');
    const totalEl = document.getElementById('tx-total');
    const feesEl = document.getElementById('tx-fees');
    
    [priceEl, totalEl, feesEl].forEach(el => {
        if (el) {
            el.disabled = false;
            el.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-200', 'dark:bg-gray-800');
            el.classList.add('bg-white', 'dark:bg-gray-900');
        }
    });
}

// Fallback Toast if utils.js doesn't have it
if (!window.showToast) {
    window.showToast = function(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const div = document.createElement('div');
        div.className = `toast show px-4 py-2 rounded shadow-lg text-white text-sm font-bold ${
            type === 'error' ? 'bg-red-500' : 
            type === 'info' ? 'bg-blue-500' : 
            'bg-primary-500'
        }`;
        div.textContent = msg;
        
        container.appendChild(div);
        
        setTimeout(() => {
            div.classList.remove('show');
            setTimeout(() => div.remove(), 300);
        }, 3000);
    };
}

console.log(`✅ app.js ${APP_VERSION} loaded successfully`);
