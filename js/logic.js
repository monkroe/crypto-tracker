// js/logic.js - v4.1.0 (Fee Integration + Infinity Bug Fix + Transfer Support)

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
        const fee = safeFloat(tx.fee_usd || 0); // ✅ MOKESČIAI

        if (['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy', 'Staking Reward', 'Gift/Airdrop'].includes(tx.type)) {
            // Pirkimas: Didėja kiekis, didėja investuota suma (kaina + mokesčiai)
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty + amount);
            state.holdings[sym].invested = safeFloat(state.holdings[sym].invested + cost + fee);
            
        } else if (['Sell', 'Withdraw', 'Market Sell', 'Limit Sell', 'Instant Sell', 'Stop Loss'].includes(tx.type)) {
            // Pardavimas: Mažėja kiekis, mažėja investuota suma proporcingai
            const currentAvgPrice = state.holdings[sym].qty > 0 ? state.holdings[sym].invested / state.holdings[sym].qty : 0;
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty - amount);
            // Pastaba: Pardavus, fee mažina jūsų gautą pelną, bet čia mažiname cost basis, kad liktų teisinga likusių monetų savikaina
            state.holdings[sym].invested = Math.max(0, safeFloat(state.holdings[sym].invested - safeFloat(amount * currentAvgPrice)));
            
        } else if (['Transfer'].includes(tx.type)) {
            // ✅ TRANSFER LOGIKA:
            // Kiekis nesikeičia (nes pervedate sau), bet sumokate mokestį.
            // Mokestis prisideda prie investuotos sumos (cost basis), nes tai išlaidos.
            state.holdings[sym].invested = safeFloat(state.holdings[sym].invested + fee);
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
        let price = priceData.usd;
        
        // 
        // ✅ INFINITY BUG FIX - Handle Airdrop/Gift with 0 price
        if (price === 0 && h.qty > 0) {
            const hasAirdrop = state.transactions.some(tx => 
                tx.coin_symbol === sym && 
                (tx.type === 'Gift/Airdrop' || parseFloat(tx.price_per_coin) === 0)
            );
            
            if (hasAirdrop) {
                if (coin && state.prices[coin.coingecko_id]?.usd > 0) {
                    price = state.prices[coin.coingecko_id].usd;
                } else {
                    price = h.invested > 0 ? h.invested / h.qty : 0;
                }
            }
        }
        
        h.currentValue = safeFloat(h.qty * price);
        h.currentPrice = price;
        h.pnl = safeFloat(h.currentValue - h.invested);
        
        // ✅ PnL Percent Fix
        if (h.invested > 0) {
            h.pnlPercent = (h.pnl / h.invested) * 100;
        } else if (h.currentValue > 0) {
            h.pnlPercent = 100; // Pure profit (Airdrop)
        } else {
            h.pnlPercent = 0;
        }

        // 24H & 30D Change USD
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
