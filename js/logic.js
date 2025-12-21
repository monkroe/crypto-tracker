// js/logic.js - v3.7.0
// Features: 24h Change Calculation, Error Handling

const CACHE_DURATION = 60000; // 1 minutė (dažniau, nes reikia 24h pokyčio)
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

// ✅ ATNAUJINTA: Prašome 'include_24hr_change=true'
export async function fetchPrices() {
    if (state.coins.length === 0) return;
    
    const now = Date.now();
    if (now - state.lastFetchTime < CACHE_DURATION && Object.keys(state.prices).length > 0) {
        return;
    }

    const ids = state.coins.map(c => c.coingecko_id).join(',');
    
    try {
        // Pridėta: &include_24hr_change=true
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
        
        if (!res.ok) {
            if (res.status === 429) console.warn('API limitas. Naudojamos senos kainos.');
            return;
        }
        
        const data = await res.json();
        const validPrices = Object.keys(data).filter(key => data[key]?.usd);
        
        if (validPrices.length > 0) {
            state.prices = data;
            state.lastFetchTime = now;
        }
    } catch (e) { 
        console.error("Fetch error:", e); 
    }
}

export function calculateHoldings() {
    state.holdings = {};
    let totalInvestedPortfolio = 0;
    
    // 1. Skaičiuojame kiekius ir investicijas
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

    let totalValuePortfolio = 0;
    let total24hChangeUsd = 0; // ✅ NAUJA: Kaupiame 24h pokytį doleriais

    // 2. Skaičiuojame vertes
    Object.keys(state.holdings).forEach(sym => {
        const h = state.holdings[sym];
        const coin = state.coins.find(c => c.symbol === sym);
        
        // Gauname kainą ir 24h pokytį
        const priceData = (coin && state.prices[coin.coingecko_id]) || { usd: 0, usd_24h_change: 0 };
        const currentPrice = priceData.usd;
        const changePct24h = priceData.usd_24h_change || 0;

        h.currentPrice = currentPrice;
        h.currentValue = safeFloat(h.qty * currentPrice);
        h.pnl = safeFloat(h.currentValue - h.invested);
        h.pnlPercent = h.invested > 0 ? (h.pnl / h.invested) * 100 : 0;

        // ✅ 24H Pokyčio skaičiavimas doleriais
        // Formulė: Dabartinė vertė - (Dabartinė vertė / (1 + pokytis/100))
        if (currentPrice > 0 && h.qty > 0) {
            const oldValue = h.currentValue / (1 + (changePct24h / 100));
            const changeUsd = h.currentValue - oldValue;
            total24hChangeUsd += changeUsd;
        }

        totalValuePortfolio += h.currentValue;
        totalInvestedPortfolio += h.invested;
    });

    return {
        totalValue: totalValuePortfolio,
        totalInvested: totalInvestedPortfolio,
        totalPnL: totalValuePortfolio - totalInvestedPortfolio,
        totalPnLPercent: totalInvestedPortfolio > 0 ? ((totalValuePortfolio - totalInvestedPortfolio) / totalInvestedPortfolio) * 100 : 0,
        change24hUsd: total24hChangeUsd // ✅ Grąžiname 24h pokytį
    };
}

export function resetPriceCache() {
    state.lastFetchTime = 0;
}
window.resetPriceCache = resetPriceCache;
