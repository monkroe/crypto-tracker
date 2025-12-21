// js/logic.js - v3.9.7 (Fix for crypto_transactions table)

const CACHE_DURATION = 60000; 
const safeFloat = (num) => parseFloat(Number(num || 0).toFixed(8));

export let state = {
    coins: [],
    transactions: [],
    goals: [],
    prices: {},
    holdings: {},
    lastFetchTime: 0
};

export async function loadInitialData() {
    // Patikriname ar funkcijos egzistuoja (iš supabase.js)
    if (!window.getSupportedCoins || !window.getTransactions) {
        console.error("Supabase funkcijos nerastos!");
        return;
    }

    try {
        console.log("🔄 Kraunami duomenys...");
        const [coinsData, txData, goalsData] = await Promise.all([
            window.getSupportedCoins(),
            window.getTransactions(), // Kreipiasi į crypto_transactions
            window.getCryptoGoals()
        ]);
        
        console.log("📦 Gautos transakcijos:", txData?.length || 0);

        state.coins = Array.isArray(coinsData) ? coinsData : [];
        // Rikiuojame pagal datą
        state.transactions = Array.isArray(txData) ? txData.sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
        state.goals = Array.isArray(goalsData) ? goalsData : [];
        
        await fetchPrices();
        return calculateHoldings();
    } catch (e) {
        console.error("❌ Data load error:", e);
        throw e;
    }
}

export async function fetchPrices() {
    if (state.coins.length === 0) return;
    
    const now = Date.now();
    const hasData = Object.keys(state.prices).length > 0;
    const firstKey = Object.keys(state.prices)[0];
    const has30dData = firstKey && state.prices[firstKey].change_30d !== undefined;

    // Cache logika: jei duomenys yra ir jie "švieži" (mažiau nei 1 min)
    if (hasData && has30dData && (now - state.lastFetchTime < CACHE_DURATION)) return;

    const ids = state.coins.map(c => c.coingecko_id).join(',');
    
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=30d`);
        
        if (!res.ok) {
            if (res.status === 429) console.warn('⚠️ API limitas. Naudojamos senos kainos.');
            return;
        }
        
        const dataArray = await res.json();
        const priceMap = {};
        
        dataArray.forEach(coin => {
            priceMap[coin.id] = {
                usd: coin.current_price || 0,
                change_24h: coin.price_change_percentage_24h || 0,
                change_30d: coin.price_change_percentage_30d_in_currency || 0
            };
        });
        
        if (Object.keys(priceMap).length > 0) {
            state.prices = priceMap;
            state.lastFetchTime = now;
        }
    } catch (e) { console.error("Price fetch error:", e); }
}

export function calculateHoldings() {
    state.holdings = {};
    
    // 1. Process Transactions
    state.transactions.forEach(tx => {
        const sym = tx.coin_symbol;
        if (!state.holdings[sym]) state.holdings[sym] = { qty: 0, invested: 0 };
        
        const amount = safeFloat(tx.amount);
        const total = safeFloat(tx.total_cost_usd);
        const fees = safeFloat(tx.fees); // Svarbu: mokesčiai
        
        // Buy Methods
        if (['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy'].includes(tx.type)) {
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty + amount);
            // Investuota suma jau turi įskaičiuotus mokesčius (iš app.js logikos)
            state.holdings[sym].invested = safeFloat(state.holdings[sym].invested + total);
        } 
        // Gift / Staking / Airdrop
        else if (['Gift/Airdrop', 'Staking Reward'].includes(tx.method) || tx.type === 'Receive') {
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty + amount);
            // Jei buvo sumokėti mokesčiai už dovanos atsiėmimą (gas fees), jie pridedami prie savikainos
            state.holdings[sym].invested = safeFloat(state.holdings[sym].invested + fees);
        }
        // Sell Methods
        else if (['Sell', 'Withdraw'].includes(tx.type)) {
            const currentAvgPrice = state.holdings[sym].qty > 0 ? state.holdings[sym].invested / state.holdings[sym].qty : 0;
            
            // Mažiname kiekį
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty - amount);
            
            // Mažiname investiciją proporcingai parduotam kiekiui (FIFO/Avg Cost principas)
            const costOfSold = safeFloat(amount * currentAvgPrice);
            state.holdings[sym].invested = Math.max(0, safeFloat(state.holdings[sym].invested - costOfSold));
        }
    });

    let totalValue = 0;
    let totalInvested = 0;
    let total24hChangeUsd = 0;
    let total30dChangeUsd = 0;

    // 2. Calculate Values
    Object.keys(state.holdings).forEach(sym => {
        const h = state.holdings[sym];
        const coin = state.coins.find(c => c.symbol === sym);
        
        // Saugiklis: jei nerandame kainos, naudojame 0
        const priceData = (coin && state.prices[coin.coingecko_id]) || { usd: 0, change_24h: 0, change_30d: 0 };
        const price = priceData.usd;
        
        h.currentPrice = price;
        h.currentValue = safeFloat(h.qty * price);
        h.pnl = safeFloat(h.currentValue - h.invested);
        h.pnlPercent = h.invested > 0 ? (h.pnl / h.invested) * 100 : 0;

        if (price > 0 && h.qty > 0) {
            // 24H Logic
            const pct24 = priceData.change_24h || 0;
            const val24 = h.currentValue / (1 + (pct24 / 100));
            total24hChangeUsd += (h.currentValue - val24);

            // 30D Logic
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
