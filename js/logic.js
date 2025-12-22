// js/logic.js - v4.5.0 (MERGED: Auth + Fees + Fixes)

import { showToast } from './utils.js';

const CACHE_DURATION = 60000; 
const safeFloat = (num) => parseFloat(Number(num).toFixed(8));

// 1. GLOBAL STATE
export let state = {
    coins: [],
    transactions: [],
    goals: [],
    prices: {},
    holdings: {},
    lastFetchTime: 0
};

// ==========================================
// 2. AUTHENTICATION (Būtina prisijungimui!)
// ==========================================

window.userLogin = async (email, password) => {
    try {
        if (!window._supabase) throw new Error("Supabase nepaleistas (patikrinkite js/supabase.js)");
        const { data, error } = await window._supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { data };
    } catch (e) {
        console.error("Login fail:", e);
        return { error: e };
    }
};

window.userSignUp = async (email, password) => {
    try {
        const { data, error } = await window._supabase.auth.signUp({ email, password });
        if (error) throw error;
        return { data };
    } catch (e) {
        return { error: e };
    }
};

window.userSignOut = async () => {
    if (window._supabase) await window._supabase.auth.signOut();
    localStorage.clear();
    window.location.reload();
};

// Passkey placeholderiai (kad nemestų klaidų nustatymuose)
window.isWebAuthnSupported = () => window.PublicKeyCredential !== undefined;
window.hasPasskey = async () => false;
window.registerPasskey = async () => { showToast('Funkcija kuriama', 'info'); return false; };
window.removePasskey = async () => { return true; };


// ==========================================
// 3. DATA LOADING & CALCULATIONS
// ==========================================

export async function loadInitialData() {
    // Čia naudojame tiesiogines užklausas, nes CRUD funkcijos žemiau
    const { data: { session } } = await window._supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;

    try {
        const [coinsRes, txRes, goalsRes] = await Promise.all([
            window._supabase.from('supported_coins').select('*').eq('user_id', userId),
            window._supabase.from('transactions').select('*').eq('user_id', userId),
            window._supabase.from('crypto_goals').select('*').eq('user_id', userId)
        ]);

        if (coinsRes.error) throw coinsRes.error;
        if (txRes.error) throw txRes.error;

        state.coins = coinsRes.data || [];
        state.transactions = (txRes.data || []).sort((a, b) => new Date(a.date) - new Date(b.date));
        state.goals = goalsRes.data || [];
        
        await fetchPrices();
        return calculateHoldings(); // Grąžiname rezultatus į app.js
    } catch (e) {
        console.error("Klaida kraunant duomenis:", e);
        throw e;
    }
}

export async function fetchPrices() {
    if (state.coins.length === 0) return;
    
    const now = Date.now();
    if (now - state.lastFetchTime < CACHE_DURATION && Object.keys(state.prices).length > 0) {
        return;
    }

    const ids = state.coins.map(c => c.coingecko_id).join(',');
    
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=30d`);
        if (!res.ok) {
            if (res.status === 429) console.warn('API limitas.');
            return;
        }
        
        const dataArray = await res.json();
        const priceMap = {};
        
        dataArray.forEach(coin => {
            priceMap[coin.id] = {
                usd: coin.current_price,
                change_24h: coin.price_change_percentage_24h,
                change_30d: coin.price_change_percentage_30d_in_currency
            };
        });
        
        if (Object.keys(priceMap).length > 0) {
            state.prices = priceMap;
            state.lastFetchTime = now;
        }
    } catch (e) { console.error("Fetch error:", e); }
}

export function calculateHoldings() {
    state.holdings = {};
    
    // 1. Transaction processing
    state.transactions.forEach(tx => {
        const sym = tx.coin_symbol;
        if (!state.holdings[sym]) state.holdings[sym] = { qty: 0, invested: 0 };
        
        const amount = safeFloat(tx.amount);
        const cost = safeFloat(tx.total_cost_usd);
        const fee = safeFloat(tx.fee_usd || 0);

        if (['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy', 'Staking Reward', 'Gift/Airdrop'].includes(tx.type)) {
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty + amount);
            state.holdings[sym].invested = safeFloat(state.holdings[sym].invested + cost + fee);
            
        } else if (['Sell', 'Withdraw', 'Market Sell', 'Limit Sell', 'Instant Sell', 'Stop Loss'].includes(tx.type)) {
            const currentAvgPrice = state.holdings[sym].qty > 0 ? state.holdings[sym].invested / state.holdings[sym].qty : 0;
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty - amount);
            state.holdings[sym].invested = Math.max(0, safeFloat(state.holdings[sym].invested - safeFloat(amount * currentAvgPrice)));
            
        } else if (['Transfer'].includes(tx.type)) {
            state.holdings[sym].invested = safeFloat(state.holdings[sym].invested + fee);
        }
    });

    let totalValue = 0;
    let totalInvested = 0;
    let total24hChangeUsd = 0;
    let total30dChangeUsd = 0;

    // 2. Value Calculation
    Object.keys(state.holdings).forEach(sym => {
        const h = state.holdings[sym];
        const coin = state.coins.find(c => c.symbol === sym);
        
        const priceData = (coin && state.prices[coin.coingecko_id]) || { usd: 0, change_24h: 0, change_30d: 0 };
        let price = priceData.usd;
        
        // Zero price fix (Airdrops)
        if (price === 0 && h.qty > 0) {
            const hasAirdrop = state.transactions.some(tx => tx.coin_symbol === sym && (tx.type === 'Gift/Airdrop' || parseFloat(tx.price_per_coin) === 0));
            if (hasAirdrop) {
                price = (coin && state.prices[coin.coingecko_id]?.usd > 0) ? state.prices[coin.coingecko_id].usd : (h.invested > 0 ? h.invested / h.qty : 0);
            }
        }
        
        h.currentValue = safeFloat(h.qty * price);
        h.currentPrice = price;
        h.pnl = safeFloat(h.currentValue - h.invested);
        
        if (h.invested > 0) h.pnlPercent = (h.pnl / h.invested) * 100;
        else if (h.currentValue > 0) h.pnlPercent = 100;
        else h.pnlPercent = 0;

        if (price > 0 && h.qty > 0) {
            const pct24 = priceData.change_24h || 0;
            const val24 = h.currentValue / (1 + (pct24 / 100));
            total24hChangeUsd += (h.currentValue - val24);

            const pct30 = priceData.change_30d || 0;
            const val30 = h.currentValue / (1 + (pct30 / 100));
            total30dChangeUsd += (h.currentValue - val30);
        }

        totalValue += h.currentValue;
        totalInvested += h.invested;
    });

    return {
        totalValue,
        totalInvested,
        totalPnL: totalValue - totalInvested,
        totalPnLPercent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
        change24hUsd: total24hChangeUsd,
        change30dUsd: total30dChangeUsd
    };
}

export function resetPriceCache() { state.lastFetchTime = 0; }
window.resetPriceCache = resetPriceCache;

// ==========================================
// 4. DATABASE CRUD OPERATIONS (Prikabinta prie window)
// ==========================================

window.saveTransaction = async (txData) => {
    const { data: { session } } = await window._supabase.auth.getSession();
    if (!session) return false;
    const { error } = await window._supabase.from('transactions').insert([{ ...txData, user_id: session.user.id }]);
    if (error) { showToast('Klaida saugant', 'error'); return false; }
    return true;
};

window.updateTransaction = async (id, txData) => {
    const { error } = await window._supabase.from('transactions').update(txData).eq('id', id);
    return !error;
};

window.deleteTransaction = async (id) => {
    const { error } = await window._supabase.from('transactions').delete().eq('id', id);
    return !error;
};

window.saveNewCoin = async (coinData) => {
    const { data: { session } } = await window._supabase.auth.getSession();
    if (!session) return false;
    const { error } = await window._supabase.from('supported_coins').insert([{ ...coinData, user_id: session.user.id }]);
    return !error;
};

window.deleteSupportedCoin = async (symbol) => {
    const { error } = await window._supabase.from('supported_coins').delete().eq('symbol', symbol);
    return !error;
};

window.saveCryptoGoal = async (data) => {
    const { data: { session } } = await window._supabase.auth.getSession();
    if (!session) return false;
    const { error } = await window._supabase.from('crypto_goals').insert([{ ...data, user_id: session.user.id }]);
    return !error;
};

window.updateCryptoGoal = async (id, target) => {
    const { error } = await window._supabase.from('crypto_goals').update({ target_amount: target }).eq('id', id);
    return !error;
};

window.deleteCryptoGoal = async (id) => {
    const { error } = await window._supabase.from('crypto_goals').delete().eq('id', id);
    return !error;
};
