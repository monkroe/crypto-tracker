// js/logic.js - v3.9.0 (Dual Stats: 24H & 30D)

const CACHE_DURATION = 60000; 
const safeFloat = (num) => parseFloat(Number(num).toFixed(8));

export let state = {
    coins: [],
    transactions: [],
    goals: [],
    prices: {},
    holdings: {},
    lastFetchTime: 0
};

export async function loadInitialData() {
    if (!window.getSupportedCoins) {
        console.error("Supabase funkcijos nerastos!");
        return;
    }

    try {
        const [coinsData, txData, goalsData] = await Promise.all([
            window.getSupportedCoins(),
            window.getTransactions(),
            window.getCryptoGoals()
        ]);
        
        state.coins = Array.isArray(coinsData) ? coinsData : [];
        state.transactions = Array.isArray(txData) ? txData.sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
        state.goals = Array.isArray(goalsData) ? goalsData : [];
        
        await fetchPrices();
        return calculateHoldings();
    } catch (e) {
        console.error("Klaida kraunant duomenis:", e);
        throw e;
    }
}

// ✅ ATNAUJINTA: Imame ir 24h, ir 30d
export async function fetchPrices() {
    if (state.coins.length === 0) return;
    
    const now = Date.now();
    if (now - state.lastFetchTime < CACHE_DURATION && Object.keys(state.prices).length > 0) {
        return;
    }

    const ids = state.coins.map(c => c.coingecko_id).join(',');
    
    try {
        // Prašome 30d. 24h CoinGecko 'markets' endpointas duoda pagal nutylėjimą.
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

        if (['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy'].includes(tx.type)) {
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty + amount);
            state.holdings[sym].invested = safeFloat(state.holdings[sym].invested + cost);
        } else if (['Sell', 'Withdraw'].includes(tx.type)) {
            const currentAvgPrice = state.holdings[sym].qty > 0 ? state.holdings[sym].invested / state.holdings[sym].qty : 0;
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty - amount);
            state.holdings[sym].invested = Math.max(0, safeFloat(state.holdings[sym].invested - safeFloat(amount * currentAvgPrice)));
        }
    });

    let totalValue = 0;
    let totalInvested = 0;
    let total24hChangeUsd = 0;
    let total30dChangeUsd = 0;

    // 2. Value & Change Calculation
    Object.keys(state.holdings).forEach(sym => {
        const h = state.holdings[sym];
        const coin = state.coins.find(c => c.symbol === sym);
        
        const priceData = (coin && state.prices[coin.coingecko_id]) || { usd: 0, change_24h: 0, change_30d: 0 };
        const price = priceData.usd;
        
        h.currentValue = safeFloat(h.qty * price);
        h.currentPrice = price;
        h.pnl = safeFloat(h.currentValue - h.invested);
        h.pnlPercent = h.invested > 0 ? (h.pnl / h.invested) * 100 : 0;

        // 24H Change USD
        if (price > 0 && h.qty > 0) {
            const pct24 = priceData.change_24h || 0;
            const val24 = h.currentValue / (1 + (pct24 / 100));
            total24hChangeUsd += (h.currentValue - val24);

            // 30D Change USD
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
