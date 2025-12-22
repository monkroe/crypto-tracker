// js/app.js - v4.1.0
// Features: Fee Coin-to-USD Conversion, Fee Support, Dynamic Method Dropdown, Coin Detail Modal, Invested by Timeframe

import { showToast, parseCSV, debugLog, sanitizeText } from './utils.js';
import { loadInitialData, calculateHoldings, state, resetPriceCache } from './logic.js';
import { updateDashboardUI, renderCoinCards, renderTransactionJournal, renderGoals, renderAllocationChart, renderPnLChart, setupThemeHandlers } from './ui.js';

const APP_VERSION = '4.1.0';

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
        setVal('tx-fee', tx.fee_usd || 0);
        setVal('tx-exchange', tx.exchange || '');
        setVal('tx-method', tx.method || 'Market Buy');
        setVal('tx-notes', tx.notes || '');
        
        // Reset Checkbox (DB visada saugo USD)
        const feeChk = document.getElementById('chk-fee-in-coin');
        if(feeChk) {
            feeChk.checked = false;
            feeChk.dispatchEvent(new Event('change'));
        }
        
        // Handle Coin Select
        const coinSelect = document.getElementById('tx-coin');
        if (coinSelect) {
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
        
        updateMethodOptions();
        setVal('tx-method', tx.method || 'Market Buy');
        
        document.getElementById('modal-title').textContent = "Redaguoti Transakciją";
        document.getElementById('btn-save').textContent = "Atnaujinti";
        
        document.getElementById('add-modal').classList.remove('hidden');
        
    } catch (e) {
        console.error('Edit error:', e);
        showToast('Klaida atidarant formą', 'error');
    }
};

// Goal Edit
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
    } catch (e) { console.error('Goal edit error:', e); }
};

// PnL Chart Timeframe Switcher
window.changePnLTimeframe = (timeframe) => {
    document.getElementById('tf-indicator').textContent = timeframe;
    const label = document.getElementById('header-timeframe-label');
    if(label) label.textContent = timeframe;
    
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
    
    updateInvestedByTimeframe(timeframe);
    renderPnLChart(timeframe);
};

function updateInvestedByTimeframe(timeframe) {
    const now = new Date();
    const cutoff = new Date();
    
    if (timeframe === '24H') cutoff.setHours(now.getHours() - 24);
    else if (timeframe === '1W') cutoff.setDate(now.getDate() - 7);
    else if (timeframe === '1M') cutoff.setMonth(now.getMonth() - 1);
    else if (timeframe === '3M') cutoff.setMonth(now.getMonth() - 3);
    else if (timeframe === '6M') cutoff.setMonth(now.getMonth() - 6);
    else if (timeframe === '1Y') cutoff.setFullYear(now.getFullYear() - 1);
    else if (timeframe === '5Y') cutoff.setFullYear(now.getFullYear() - 5);
    else if (timeframe === 'ALL') cutoff.setFullYear(2000);
    
    const relevantTxs = state.transactions.filter(tx => new Date(tx.date) >= cutoff);
    
    let totalInvested = 0;
    relevantTxs.forEach(tx => {
        const isBuy = ['Buy', 'Instant Buy', 'Market Buy', 'Limit Buy', 'Recurring Buy'].includes(tx.type);
        if (isBuy) {
            totalInvested += Number(tx.total_cost_usd) + Number(tx.fee_usd || 0);
        } else if (tx.type === 'Transfer') {
            totalInvested += Number(tx.fee_usd || 0);
        }
    });
    
    const investedEl = document.getElementById('header-total-invested');
    if (investedEl) {
        investedEl.textContent = `$${totalInvested.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
}

window.updateMethodOptions = function() {
    const type = document.getElementById('tx-type').value;
    const methodSelect = document.getElementById('tx-method');
    
    const optionsMap = {
        'Buy': [
            { value: 'Market Buy', label: 'Market Buy' },
            { value: 'Limit Buy', label: 'Limit Buy' },
            { value: 'Instant Buy', label: 'Instant Buy (Card)' },
            { value: 'Recurring Buy', label: 'Recurring Buy (DCA)' },
            { value: 'Swap', label: 'Swap / DeFi' },
            { value: 'Staking Reward', label: 'Staking Reward' },
            { value: 'Gift/Airdrop', label: 'Gift / Airdrop' }
        ],
        'Sell': [
            { value: 'Market Sell', label: 'Market Sell' },
            { value: 'Limit Sell', label: 'Limit Sell' },
            { value: 'Instant Sell', label: 'Instant Sell' },
            { value: 'Stop Loss', label: 'Stop Loss' }
        ],
        'Transfer': [
            { value: 'Transfer to Cold Wallet', label: '→ Cold Wallet (Ledger, Tangem)' },
            { value: 'Transfer to Hot Wallet', label: '→ Hot Wallet (Phantom, Rabby)' },
            { value: 'Transfer to Exchange', label: '→ Kita Birža' },
            { value: 'Transfer from Wallet', label: '← Iš Piniginės' },
            { value: 'Transfer from Exchange', label: '← Iš Biržos' }
        ]
    };
    
    const options = optionsMap[type] || optionsMap['Buy'];
    methodSelect.innerHTML = '';
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        methodSelect.appendChild(option);
    });
};

window.openCoinDetail = async function(symbol) {
    const modal = document.getElementById('coin-detail-modal');
    if (!modal) return;
    
    const coin = state.coins.find(c => c.symbol === symbol);
    const holding = state.holdings[symbol];
    if (!coin || !holding) return;
    
    document.getElementById('coin-detail-symbol').textContent = symbol;
    document.getElementById('coin-detail-qty').textContent = holding.qty.toLocaleString(undefined, {maximumFractionDigits: 4});
    document.getElementById('coin-detail-value').textContent = `$${holding.currentValue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('coin-detail-invested').textContent = `$${holding.invested.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    const pnlEl = document.getElementById('coin-detail-pnl');
    pnlEl.textContent = `${holding.pnl >= 0 ? '+' : ''}$${Math.abs(holding.pnl).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    pnlEl.className = `text-xl font-bold ${holding.pnl >= 0 ? 'text-primary-500' : 'text-red-500'}`;
    
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.coingecko_id}?localization=false&tickers=true&market_data=true&sparkline=false`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.tickers && data.tickers.length > 0) renderExchangePrices(data.tickers, symbol);
    } catch (e) { console.warn('CG Error'); }
    
    const coinTxs = state.transactions.filter(tx => tx.coin_symbol === symbol);
    const exchanges = [...new Set(coinTxs.map(tx => tx.exchange).filter(Boolean))];
    const exchangesContainer = document.getElementById('coin-detail-exchanges');
    if (exchangesContainer) {
        exchangesContainer.innerHTML = '';
        exchanges.forEach(ex => {
            const badge = document.createElement('span');
            badge.className = 'px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 mr-2';
            badge.textContent = ex;
            exchangesContainer.appendChild(badge);
        });
    }
    renderCoinTransactions(coinTxs);
    modal.classList.remove('hidden');
};

function renderExchangePrices(tickers, symbol) { /* ... Placeholder for future ... */ }

function renderCoinTransactions(txs) {
    const container = document.getElementById('coin-detail-transactions');
    if (!container) return;
    container.innerHTML = '';
    
    const sorted = txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(tx => {
        const isBuy = ['Buy', 'Instant Buy', 'Market Buy', 'Limit Buy', 'Recurring Buy'].includes(tx.type);
        const typeColor = isBuy ? 'text-primary-500' : 'text-red-500';
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800 mb-2';
        row.innerHTML = `
            <div>
                <p class="font-bold text-sm ${typeColor}">${tx.type}</p>
                <p class="text-xs text-gray-500">${new Date(tx.date).toLocaleDateString()}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-sm text-gray-900 dark:text-white">${isBuy ? '+' : '-'}${Number(tx.amount).toFixed(4)}</p>
                <p class="text-xs font-bold text-gray-700 dark:text-gray-300">$${Number(tx.total_cost_usd).toFixed(2)}</p>
            </div>`;
        container.appendChild(row);
    });
}

// ==========================================
// 3. EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
    
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

            // ✅ FEE CONVERSION LOGIC
            let finalFee = parseFloat(document.getElementById('tx-fee').value) || 0;
            const isFeeInCoin = document.getElementById('chk-fee-in-coin').checked;
            const price = parseFloat(document.getElementById('tx-price').value) || 0;
            
            if (isFeeInCoin && price > 0) {
                finalFee = finalFee * price; // Convert 1 KAS -> $0.15
            }

            const txData = {
                date: new Date(`${dVal}T${tVal}:00`).toISOString(),
                type: document.getElementById('tx-type').value,
                coin_symbol: document.getElementById('tx-coin').value,
                amount: document.getElementById('tx-amount').value,
                total_cost_usd: document.getElementById('tx-total').value,
                price_per_coin: document.getElementById('tx-price').value,
                fee_usd: finalFee, // ✅ Save calculated USD fee
                exchange: document.getElementById('tx-exchange').value,
                method: document.getElementById('tx-method').value,
                notes: sanitizeText(document.getElementById('tx-notes').value)
            };

            let success = false;
            try {
                if (id) success = await window.updateTransaction(id, txData);
                else success = await window.saveTransaction(txData);
            } catch (err) { console.error('Save error:', err); }

            if (success) {
                showToast("Išsaugota!", "success");
                document.getElementById('add-modal').classList.add('hidden');
                form.reset();
                await initData();
            } else { showToast("Klaida saugant", "error"); }
            btn.textContent = originalText;
            btn.disabled = false;
        };
    }
    
    const txTypeSelect = document.getElementById('tx-type');
    if (txTypeSelect) txTypeSelect.addEventListener('change', updateMethodOptions);

    // CSV Import
    const csvInput = document.getElementById('csv-file-input');
    if (csvInput) {
        csvInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            const parsed = parseCSV(text);
            if (parsed.length === 0) return showToast('Klaida CSV', 'error');
            if (!confirm(`Importuoti ${parsed.length}?`)) return;
            
            showToast('Importuojama...', 'info');
            let count = 0;
            for (const tx of parsed) if (await window.saveTransaction(tx)) count++;
            showToast(`Importuota: ${count}`, 'success');
            await initData();
            e.target.value = '';
        };
    }

    // Coin Management
    document.getElementById('btn-save-coin').onclick = async () => {
        const symbol = document.getElementById('new-coin-symbol').value.toUpperCase();
        const id = document.getElementById('new-coin-id').value.toLowerCase().trim();
        const target = parseFloat(document.getElementById('new-coin-target').value);
        if(!symbol || !id) return;
        
        try {
            const testRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
            const testData = await testRes.json();
            if (!testData[id]) return showToast('Neteisingas ID', 'error');
            
            if (await window.saveNewCoin({ symbol, coingecko_id: id })) {
                if (target > 0) await window.saveCryptoGoal({ coin_symbol: symbol, target_amount: target });
                showToast('Pridėta', 'success');
                document.getElementById('new-coin-modal').classList.add('hidden');
                await initData();
            }
        } catch (e) { showToast('Klaida', 'error'); }
    };

    document.getElementById('btn-delete-coin').onclick = async () => {
        const s = document.getElementById('delete-coin-select').value;
        if (s && confirm('Trinti?')) {
            if (await window.deleteSupportedCoin(s)) {
                showToast('Ištrinta', 'success');
                document.getElementById('delete-coin-modal').classList.add('hidden');
                await initData();
            }
        }
    };
    
    // Goal Management
    document.getElementById('btn-update-goal').onclick = async () => {
        const id = document.getElementById('edit-goal-id').value;
        const t = parseFloat(document.getElementById('edit-goal-target').value);
        if (await window.updateCryptoGoal(id, t)) {
            showToast('Atnaujinta', 'success');
            document.getElementById('edit-goal-modal').classList.add('hidden');
            await initData();
        }
    };
    document.getElementById('btn-delete-goal').onclick = async () => {
        const id = document.getElementById('edit-goal-id').value;
        if (await window.deleteCryptoGoal(id)) {
            showToast('Ištrinta', 'success');
            document.getElementById('edit-goal-modal').classList.add('hidden');
            await initData();
        }
    };
    
    // Auth
    document.getElementById('btn-login').onclick = async () => {
        const btn = document.getElementById('btn-login');
        const e = document.getElementById('auth-email').value.trim();
        const p = document.getElementById('auth-pass').value;
        if (!e || !p) return;
        btn.textContent = '...'; btn.disabled = true;
        try {
            const res = await window.userLogin(e, p);
            if (res.error) showToast('Klaida', 'error');
            else { showAppScreen(); await initData(); }
        } catch(err) { showToast('Ryšio klaida', 'error'); }
        finally { btn.textContent = 'Prisijungti'; btn.disabled = false; }
    };
    document.getElementById('btn-signup').onclick = async () => {
        const e = document.getElementById('auth-email').value.trim();
        const p = document.getElementById('auth-pass').value;
        if (p.length<6) return showToast('Per trumpas slaptažodis', 'error');
        const res = await window.userSignUp(e, p);
        if(res.error) showToast(res.error.message,'error');
        else showToast('Patikrinkite paštą','success');
    };
    document.getElementById('btn-logout').onclick = async () => { 
        await window.userSignOut(); 
        showAuthScreen(); 
    };
    
    // Export & Fetch
    document.getElementById('btn-export-csv').onclick = () => {
        if (state.transactions.length === 0) return showToast('Nėra duomenų', 'error');
        const h = ['date', 'type', 'coin_symbol', 'amount', 'price_per_coin', 'total_cost_usd', 'fee_usd', 'exchange', 'method', 'notes'];
        const c = [h.join(','), ...state.transactions.map(tx => h.map(k => `"${(tx[k]||'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
        const b = new Blob([c], { type: 'text/csv;charset=utf-8;' });
        const l = document.createElement('a');
        l.href = URL.createObjectURL(b);
        l.download = `export-${new Date().toISOString().slice(0,10)}.csv`;
        l.click();
    };
    
    document.getElementById('btn-fetch-price').onclick = async () => {
        const btn = document.getElementById('btn-fetch-price');
        const s = document.getElementById('tx-coin').value;
        const c = state.coins.find(x => x.symbol === s);
        if (!c) return;
        btn.innerHTML = '...';
        try {
            const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${c.coingecko_id}&vs_currencies=usd`);
            const d = await r.json();
            if (d[c.coingecko_id]?.usd) {
                document.getElementById('tx-price').value = d[c.coingecko_id].usd;
                document.getElementById('tx-price').dispatchEvent(new Event('input'));
            }
        } catch(e) { showToast('Klaida', 'error'); }
        finally { btn.innerHTML = 'GAUTI KAINĄ'; }
    };

    // Passkeys
    const btnSetup = document.getElementById('btn-setup-passkey');
    if(btnSetup) btnSetup.onclick = async () => { if(await window.registerPasskey()) await checkPasskeyStatus(); };
    const btnRemove = document.getElementById('btn-remove-passkey');
    if(btnRemove) btnRemove.onclick = async () => { if(confirm('Trinti?') && await window.removePasskey()) await checkPasskeyStatus(); };
    
    setupCalculator();
    setupBulkSelection();
    
    // Reset Modal
    const btnAdd = document.querySelector('button[onclick*="add-modal"]');
    if (btnAdd) btnAdd.onclick = () => {
        document.getElementById('add-tx-form').reset();
        document.getElementById('tx-id').value = '';
        document.getElementById('modal-title').textContent = "Nauja Transakcija";
        document.getElementById('btn-save').textContent = "Išsaugoti";
        updateMethodOptions();
        
        // Reset check
        const chk = document.getElementById('chk-fee-in-coin');
        if(chk) { chk.checked = false; chk.dispatchEvent(new Event('change')); }
        
        document.getElementById('add-modal').classList.remove('hidden');
    };
}

// ==========================================
// 4. UTILITY FUNCTIONS
// ==========================================

function setupCalculator() {
    const getVal = (id) => parseFloat(document.getElementById(id).value) || 0;
    const feeLabel = document.getElementById('fee-label-currency');
    const feeHelper = document.getElementById('fee-helper-text');
    const feeCheck = document.getElementById('chk-fee-in-coin');
    
    if (feeCheck) {
        feeCheck.onchange = () => {
            const isCoin = feeCheck.checked;
            const sym = document.getElementById('tx-coin').value || 'Coin';
            feeLabel.textContent = isCoin ? `(${sym})` : '($)';
            
            // Re-trigger calculation to update visual helper text
            document.getElementById('tx-fee').dispatchEvent(new Event('input'));
        };
    }

    const calc = (src) => {
        const amountIn = document.getElementById('tx-amount');
        const priceIn = document.getElementById('tx-price');
        const totalIn = document.getElementById('tx-total');
        if (!amountIn || !priceIn || !totalIn) return;
        
        const a = getVal('tx-amount');
        const p = getVal('tx-price');
        const f = getVal('tx-fee');
        const type = document.getElementById('tx-type').value;
        const isFeeInCoin = feeCheck?.checked;

        let feeUSD = f;
        if (isFeeInCoin && p > 0) {
            feeUSD = f * p;
            if (feeHelper) feeHelper.textContent = `= $${feeUSD.toFixed(2)}`;
        } else {
            if (feeHelper) feeHelper.textContent = 'USD vertė';
        }

        if (src === 'total') { 
            if(a>0) priceIn.value=(getVal('tx-total')/a).toFixed(8); 
        }
        else if (src === 'amount' || src === 'price' || src === 'fee') { 
            if (a > 0 && p > 0) {
                let base = a * p;
                if(type === 'Buy') totalIn.value = (base + feeUSD).toFixed(2);
                else if(type === 'Sell') totalIn.value = Math.max(0, base - feeUSD).toFixed(2);
                else totalIn.value = base.toFixed(2);
            }
        }
    };

    ['tx-amount', 'tx-price', 'tx-total', 'tx-fee'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', (e) => calc(e.target.id.split('-')[1]));
    });
}

function setupBulkSelection() {
    const cbAll = document.getElementById('select-all-tx');
    if (cbAll) cbAll.onchange = () => {
        document.querySelectorAll('.tx-checkbox').forEach(c => c.checked = cbAll.checked);
        updateDeleteSelectedButton();
    };

    const btnDel = document.getElementById('btn-delete-selected');
    if (btnDel) btnDel.onclick = async () => {
        const ids = Array.from(document.querySelectorAll('.tx-checkbox:checked')).map(c => c.dataset.txId);
        if (!ids.length || !confirm(`Trinti ${ids.length}?`)) return;
        await Promise.all(ids.map(id => window.deleteTransaction(id)));
        showToast('Ištrinta', 'success');
        document.getElementById('select-all-tx').checked = false;
        await initData();
    };
}

window.updateDeleteSelectedButton = () => {
    const count = document.querySelectorAll('.tx-checkbox:checked').length;
    const btn = document.getElementById('btn-delete-selected');
    const span = document.getElementById('selected-count');
    if (btn) {
        if (count > 0) { btn.classList.remove('hidden'); btn.classList.add('flex'); }
        else { btn.classList.add('hidden'); btn.classList.remove('flex'); }
    }
    if (span) span.textContent = count;
};

async function checkPasskeyStatus() {
    const s = document.getElementById('passkey-settings');
    const st = document.getElementById('passkey-status');
    const bSet = document.getElementById('btn-setup-passkey');
    const bRem = document.getElementById('btn-remove-passkey');
    
    if (!window.isWebAuthnSupported()) { if(s) s.classList.add('hidden'); return; }
    if(s) s.classList.remove('hidden');
    
    const has = await window.hasPasskey();
    if (has) {
        if(st) st.textContent = 'Aktyvuota';
        if(bSet) bSet.classList.add('hidden');
        if(bRem) bRem.classList.remove('hidden');
    } else {
        if(st) st.textContent = 'Neaktyvuota';
        if(bSet) bSet.classList.remove('hidden');
        if(bRem) bRem.classList.add('hidden');
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
