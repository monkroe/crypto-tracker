// js/logic.js - v3.3.0
import { debugLog } from './utils.js';

export let state = {
    coins: [],
    transactions: [],
    goals: [],
    prices: {},
    holdings: {},
    lastFetchTime: 0
};

const CACHE_DURATION = 300000; 
const safeFloat = (num) => parseFloat(Number(num).toFixed(8));

export async function loadInitialData() {
    // Įsitikiname, kad window funkcijos egzistuoja
    if (!window.getSupportedCoins) {
        console.error("Supabase funkcijos nerastos!");
        return;
    }

    const [coinsData, txData, goalsData] = await Promise.all([
        window.getSupportedCoins(),
        window.getTransactions(),
        window.getCryptoGoals()
    ]);
    
    state.coins = Array.isArray(coinsData) ? coinsData : [];
    state.transactions = Array.isArray(txData) ? txData.sort((a, b) => a.date.localeCompare(b.date)) : [];
    state.goals = Array.isArray(goalsData) ? goalsData : [];
    
    await fetchPrices();
    return calculateHoldings();
}

export async function fetchPrices() {
    if (state.coins.length === 0) return;
    const now = Date.now();
    if (now - state.lastFetchTime < CACHE_DURATION && Object.keys(state.prices).length > 0) return;

    const ids = state.coins.map(c => c.coingecko_id).join(',');
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        if (res.ok) {
            state.prices = await res.json();
            state.lastFetchTime = now;
        }
    } catch (e) { console.warn("Price fetch error:", e); }
}

export function calculateHoldings() {
    state.holdings = {};
    let totalInvestedPortfolio = 0;
    
    state.transactions.forEach(tx => {
        const sym = tx.coin_symbol;
        if (!state.holdings[sym]) state.holdings[sym] = { qty: 0, invested: 0, avgPrice: 0 };
        const amount = safeFloat(tx.amount);
        const cost = safeFloat(tx.total_cost_usd);

        if (['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy'].includes(tx.type)) {
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty + amount);
            state.holdings[sym].invested = safeFloat(state.holdings[sym].invested + cost);
        } else if (['Sell', 'Withdraw'].includes(tx.type)) {
            const currentAvgPrice = state.holdings[sym].qty > 0 ? state.holdings[sym].invested / state.holdings[sym].qty : 0;
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty - amount);
            state.holdings[sym].invested = Math.max(0, safeFloat(state.holdings[sym].invested - safeFloat(amount * currentAvgPrice)));
        }
        
        if (state.holdings[sym].qty > 0) {
            state.holdings[sym].avgPrice = state.holdings[sym].invested / state.holdings[sym].qty;
        } else {
            state.holdings[sym].qty = 0; state.holdings[sym].invested = 0;
        }
    });

    let totalValuePortfolio = 0;
    Object.keys(state.holdings).forEach(sym => {
        const h = state.holdings[sym];
        const coin = state.coins.find(c => c.symbol === sym);
        const currentPrice = (coin && state.prices[coin.coingecko_id]) ? state.prices[coin.coingecko_id].usd : 0;

        h.currentPrice = currentPrice;
        h.currentValue = safeFloat(h.qty * currentPrice);
        h.pnl = safeFloat(h.currentValue - h.invested);
        h.pnlPercent = h.invested > 0 ? (h.pnl / h.invested) * 100 : 0;

        totalValuePortfolio += h.currentValue;
        totalInvestedPortfolio += h.invested;
    });

    return {
        totalValue: totalValuePortfolio,
        totalInvested: totalInvestedPortfolio,
        totalPnL: totalValuePortfolio - totalInvestedPortfolio,
        totalPnLPercent: totalInvestedPortfolio > 0 ? ((totalValuePortfolio - totalInvestedPortfolio) / totalInvestedPortfolio) * 100 : 0
    };
}

export function resetPriceCache() {
    state.lastFetchTime = 0;
    console.log('Price cache reset');
}

// Expose resetPriceCache to window
window.resetPriceCache = resetPriceCache;
