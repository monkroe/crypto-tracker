// js/app.js - v3.9.7 (Final Stable)
// Features: Smart Calc, Fees, Gift Lock, Goals, CSV Import/Export

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
        
        const versionEl = document.getElementById('app-version');
        if (versionEl) versionEl.textContent = APP_VERSION;
        
        await loadInitialData();
        setupThemeHandlers();
        setupEventListeners();
        setupModalCalculations(); // Įjungiame išmanią skaičiuoklę
        refreshUI();
        
    } catch (e) {
        console.error("❌ Init Error:", e);
        if (typeof showToast === 'function') showToast('Klaida kraunant programą', 'error');
    }
});

function refreshUI() {
    const totals = calculateHoldings();
    updateDashboardUI(totals);
    renderCoinCards();
    renderGoals();
    renderTransactionJournal();
    renderAllocationChart();
    
    const currentTimeframe = document.getElementById('tf-indicator')?.textContent || 'ALL';
    renderPnLChart(currentTimeframe);
    
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
        if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

// ==========================================
// 2. SMART CALCULATOR + GIFT LOGIC
// ==========================================
function setupModalCalculations() {
    const methodEl = document.getElementById('tx-method');
    const amountEl = document.getElementById('tx-amount');
    const priceEl = document.getElementById('tx-price');
    const feesEl = document.getElementById('tx-fees');
    const totalEl = document.getElementById('tx-total');
    const typeEl = document.getElementById('tx-type');

    if (!methodEl || !amountEl || !priceEl || !feesEl || !totalEl || !typeEl) return;

    // A. GIFT MODE (Užrakina laukelius)
    const handleMethodChange = () => {
        const isGift = methodEl.value === 'Gift/Airdrop' || methodEl.value === 'Staking Reward';
        
        if (isGift) {
            priceEl.value = 0;
            totalEl.value = 0;
            feesEl.value = 0;
            
            [priceEl, totalEl, feesEl].forEach(el => {
                el.disabled = true;
                el.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-200', 'dark:bg-gray-800');
                el.classList.remove('bg-white', 'dark:bg-gray-900');
            });
        } else {
            [priceEl, totalEl, feesEl].forEach(el => {
                el.disabled = false;
                el.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-200', 'dark:bg-gray-800');
                el.classList.add('bg-white', 'dark:bg-gray-900');
            });
        }
    };

    // B. Skaičiuoti VISO (Kiekis * Kaina +/- Mokesčiai)
    const calcFromPrice = () => {
        if (methodEl.value === 'Gift/Airdrop' || methodEl.value === 'Staking Reward') return;

        const amount = parseFloat(amountEl.value) || 0;
        const price = parseFloat(priceEl.value) || 0;
        const fees = parseFloat(feesEl.value) || 0;

        if (amount > 0) {
            let total = amount * price;
            // Buy: Viso = Kaina + Mokesčiai
            // Sell: Viso = Kaina - Mokesčiai (į rankas)
            if (typeEl.value === 'Buy') total += fees;
            else total -= fees;
            
            totalEl.value = total.toFixed(2);
        }
    };

    // C. Skaičiuoti KAINĄ (Viso -> Kaina, atmetus mokesčius)
    const calcFromTotal = () => {
        if (methodEl.value === 'Gift/Airdrop' || methodEl.value === 'Staking Reward') return;

        const amount = parseFloat(amountEl.value) || 0;
        const total = parseFloat(totalEl.value) || 0;
        const fees = parseFloat(feesEl.value) || 0;

        if (amount > 0) {
            let cleanTotal = total;
            if (typeEl.value === 'Buy') cleanTotal -= fees;
            else cleanTotal += fees;

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
    
    totalEl.addEventListener('input', calcFromTotal); // ✅ Reaguoja į Viso keitimą
}

// ==========================================
// 3. EVENT LISTENERS & CRUD
// ==========================================
function setupEventListeners() {
    
    // --- ADD / EDIT TRANSACTION ---
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
                    // Jei Gift - viskas 0
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
                    await window.addTransaction(txData); // ✅ Naudoja addTransaction iš supabase.js
                    showToast('Transakcija pridėta', 'success');
                }

                document.getElementById('add-modal').classList.add('hidden');
                form.reset();
                document.getElementById('tx-id').value = '';
                document.getElementById('modal-title').textContent = 'Nauja Transakcija';
                
                unlockGiftFields(); // Atstatome laukelius kitam kartui
                await loadInitialData();
                refreshUI();

            } catch (err) {
                console.error('Save error:', err);
                showToast('Klaida: ' + err.message, 'error');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };
    }

    // --- FETCH PRICE API ---
    const btnFetch = document.getElementById('btn-fetch-price');
    if (btnFetch) {
        btnFetch.onclick = async () => {
            const coinId = document.getElementById('tx-coin').value;
            if (!coinId) return showToast('Pasirinkite monetą', 'error');
            
            const originalText = btnFetch.textContent;
            btnFetch.textContent = '...';
            
            try {
                const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`);
                const data = await res.json();
                
                if (data[coinId]?.usd) {
                    document.getElementById('tx-price').value = data[coinId].usd;
                    document.getElementById('tx-price').dispatchEvent(new Event('input')); // Trigger calc
                    showToast('Kaina gauta', 'success');
                } else {
                    showToast('Kaina nerasta', 'error');
                }
            } catch (e) {
                showToast('API klaida', 'error');
            } finally {
                btnFetch.textContent = originalText;
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
                
                if (parsed.length === 0) return showToast('Tuščias CSV', 'error');
                if (!confirm(`Importuoti ${parsed.length} įrašus?`)) return;

                showToast('Importuojama...', 'info');
                let count = 0;
                for (const tx of parsed) {
                    try {
                        await window.addTransaction(tx);
                        count++;
                    } catch (err) { console.error(err); }
                }
                
                showToast(`Įkelta: ${count}`, 'success');
                await loadInitialData();
                refreshUI();
            } catch (err) {
                showToast('CSV klaida', 'error');
            } finally {
                e.target.value = '';
            }
        };
    }

    // --- BULK DELETE ---
    const btnDeleteAll = document.getElementById('btn-delete-selected');
    if (btnDeleteAll) {
        btnDeleteAll.onclick = async () => {
            const ids = Array.from(document.querySelectorAll('.tx-checkbox:checked')).map(cb => cb.dataset.txId);
            if (ids.length === 0) return;
            if (!confirm(`Trinti ${ids.length} įrašus?`)) return;
            
            for (const id of ids) await window.deleteTransaction(id);
            showToast('Ištrinta', 'success');
            await loadInitialData();
            refreshUI();
        };
    }

    // --- COIN MANAGEMENT ---
    const btnSaveCoin = document.getElementById('btn-save-coin');
    if (btnSaveCoin) {
        btnSaveCoin.onclick = async () => {
            const sym = document.getElementById('new-coin-symbol').value.toUpperCase().trim();
            const id = document.getElementById('new-coin-id').value.toLowerCase().trim();
            const tgt = parseFloat(document.getElementById('new-coin-target').value) || 0;
            
            if (!sym || !id) return showToast('Būtina užpildyti', 'error');
            
            try {
                // Tiesioginis įrašymas
                const { error } = await window.supabase.from('supported_coins').insert([{ symbol: sym, coingecko_id: id }]);
                if (error) throw error;
                
                if (tgt > 0) await window.addGoal({ coin_symbol: sym, target_amount: tgt });
                
                showToast('Pridėta', 'success');
                document.getElementById('new-coin-modal').classList.add('hidden');
                resetPriceCache();
                await loadInitialData();
                refreshUI();
            } catch (e) {
                showToast('Klaida pridedant', 'error');
            }
        };
    }
    
    const btnDeleteCoin = document.getElementById('btn-delete-coin');
    if (btnDeleteCoin) {
        btnDeleteCoin.onclick = async () => {
            const sym = document.getElementById('delete-coin-select').value;
            if(!sym) return;
            if(!confirm('Trinti monetą ir visus jos duomenis?')) return;
            
            if (await window.deleteSupportedCoin(sym)) {
                showToast('Ištrinta', 'success');
                document.getElementById('delete-coin-modal').classList.add('hidden');
                await loadInitialData();
                refreshUI();
            }
        };
    }

    // --- GOAL MANAGEMENT ---
    const btnUpdateGoal = document.getElementById('btn-update-goal');
    if (btnUpdateGoal) {
        btnUpdateGoal.onclick = async () => {
            const id = document.getElementById('edit-goal-id').value;
            const val = parseFloat(document.getElementById('edit-goal-target').value);
            if(await window.updateGoal(id, val)) {
                showToast('Atnaujinta', 'success');
                document.getElementById('edit-goal-modal').classList.add('hidden');
                await loadInitialData();
                refreshUI();
            }
        };
    }
    
    const btnDeleteGoal = document.getElementById('btn-delete-goal');
    if (btnDeleteGoal) {
        btnDeleteGoal.onclick = async () => {
            const id = document.getElementById('edit-goal-id').value;
            if(!confirm('Trinti tikslą?')) return;
            if(await window.deleteGoal(id)) {
                showToast('Ištrinta', 'success');
                document.getElementById('edit-goal-modal').classList.add('hidden');
                await loadInitialData();
                refreshUI();
            }
        };
    }

    // --- MODAL RESET HELPER ---
    const btnAdd = document.querySelector('button[onclick*="add-modal"]');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            const form = document.getElementById('add-tx-form');
            form.reset();
            document.getElementById('tx-id').value = '';
            document.getElementById('modal-title').textContent = 'Nauja Transakcija';
            
            const now = new Date();
            document.getElementById('tx-date-input').value = now.toISOString().split('T')[0];
            document.getElementById('tx-time-input').value = now.toTimeString().slice(0, 5);
            
            document.getElementById('tx-type').value = 'Buy';
            unlockGiftFields();
        });
    }
}

// ==========================================
// 4. GLOBAL HANDLERS
// ==========================================

// Edit
window.onEditTx = (id) => {
    const tx = state.transactions.find(t => t.id == id);
    if (!tx) return;

    document.getElementById('tx-id').value = tx.id;
    document.getElementById('modal-title').textContent = 'Redaguoti Transakciją';
    document.getElementById('tx-type').value = tx.type;
    
    // Coin Select
    const coinSelect = document.getElementById('tx-coin');
    for (let i = 0; i < coinSelect.options.length; i++) {
        if (coinSelect.options[i].textContent === tx.coin_symbol) {
            coinSelect.selectedIndex = i;
            break;
        }
    }
    
    // Date
    const d = new Date(tx.date);
    document.getElementById('tx-date-input').value = d.toISOString().split('T')[0];
    document.getElementById('tx-time-input').value = d.toTimeString().slice(0, 5);
    
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-method').value = tx.method || 'Market Buy';
    document.getElementById('tx-exchange').value = tx.exchange || '';
    document.getElementById('tx-notes').value = tx.notes || '';
    
    // Gift Logic Check
    const isGift = tx.method === 'Gift/Airdrop' || tx.method === 'Staking Reward';
    const priceEl = document.getElementById('tx-price');
    const totalEl = document.getElementById('tx-total');
    const feesEl = document.getElementById('tx-fees');

    if (isGift) {
        priceEl.value = 0; totalEl.value = 0; feesEl.value = 0;
        [priceEl, totalEl, feesEl].forEach(el => {
            el.disabled = true;
            el.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-200');
            el.classList.remove('bg-white');
        });
    } else {
        // Recalc Price Logic (Total +/- Fees)
        let priceVal = 0;
        const amount = parseFloat(tx.amount) || 0;
        if (amount > 0) {
            const total = parseFloat(tx.total_cost_usd) || 0;
            const fees = parseFloat(tx.fees) || 0;
            let cleanTotal = total;
            if (tx.type === 'Buy') cleanTotal -= fees; else cleanTotal += fees;
            priceVal = cleanTotal / amount;
        }
        priceEl.value = priceVal > 0 ? priceVal.toFixed(8) : 0;
        totalEl.value = tx.total_cost_usd || 0;
        feesEl.value = tx.fees || 0;
        
        [priceEl, totalEl, feesEl].forEach(el => {
            el.disabled = false;
            el.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-200');
            el.classList.add('bg-white');
        });
    }

    document.getElementById('add-modal').classList.remove('hidden');
};

// Delete
window.onDeleteTx = async (id) => {
    if (confirm('Trinti?')) {
        await window.deleteTransaction(id);
        await loadInitialData();
        refreshUI();
    }
};

// Helpers
function unlockGiftFields() {
    const priceEl = document.getElementById('tx-price');
    const totalEl = document.getElementById('tx-total');
    const feesEl = document.getElementById('tx-fees');
    
    [priceEl, totalEl, feesEl].forEach(el => {
        if (el) {
            el.disabled = false;
            el.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-200');
            el.classList.add('bg-white');
        }
    });
}

window.updateDeleteSelectedButton = () => {
    const count = document.querySelectorAll('.tx-checkbox:checked').length;
    const btn = document.getElementById('btn-delete-selected');
    if (btn) {
        btn.style.display = count > 0 ? 'flex' : 'none';
        btn.querySelector('span').textContent = count;
    }
};

// Goals handlers
window.editGoal = (id) => { 
    const goal = state.goals.find(g => g.id == id);
    if (!goal) return;
    document.getElementById('edit-goal-id').value = goal.id;
    document.getElementById('edit-goal-coin').textContent = goal.coin_symbol;
    document.getElementById('edit-goal-target').value = goal.target_amount;
    document.getElementById('edit-goal-modal').classList.remove('hidden');
}; 

window.changePnLTimeframe = (tf) => { 
    document.getElementById('tf-indicator').textContent = tf;
    renderPnLChart(tf);
};
