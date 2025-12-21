// js/logic.js - v3.0.0 (Fix: Price Fetch Error Handling & Empty Cache)
import { debugLog } from './utils.js';

export let state = {
    coins: [],
    transactions: [],
    goals: [],
    prices: {},
    holdings: {},
    lastFetchTime: 0
};

const CACHE_DURATION = 300000; // 5 minutės
const safeFloat = (num) => parseFloat(Number(num).toFixed(8));

export async function loadInitialData() {
    // Įsitikiname, kad window funkcijos egzistuoja (Supabase.js turi būti užkrautas)
    if (!window.getSupportedCoins) {
        console.error("CRITICAL: Supabase funkcijos nerastos! Patikrinkite script'ų eiliškumą.");
        return;
    }

    try {
        const [coinsData, txData, goalsData] = await Promise.all([
            window.getSupportedCoins(),
            window.getTransactions(),
            window.getCryptoGoals()
        ]);
        
        state.coins = Array.isArray(coinsData) ? coinsData : [];
        // Rūšiuojame pagal datą, kad FIFO skaičiavimai būtų teisingi
        state.transactions = Array.isArray(txData) ? txData.sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
        state.goals = Array.isArray(goalsData) ? goalsData : [];
        
        await fetchPrices();
        return calculateHoldings();
    } catch (e) {
        console.error("Klaida kraunant pradinius duomenis:", e);
        throw e;
    }
}

// ✅ FIX #11: Pataisyta fetchPrices funkcija su geresniu klaidų valdymu
export async function fetchPrices() {
    if (state.coins.length === 0) return;
    
    const now = Date.now();
    
    // Naudojame cache TIK jei turime validžių kainų ir laikas dar nepraėjo
    if (now - state.lastFetchTime < CACHE_DURATION && Object.keys(state.prices).length > 0) {
        console.log('Using cached prices');
        return;
    }

    const ids = state.coins.map(c => c.coingecko_id).join(',');
    
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        
        if (!res.ok) {
            if (res.status === 429) {
                console.warn('CoinGecko rate limit hit. Using old prices if available.');
                // Neatnaujiname lastFetchTime, kad bandytų vėl kitą kartą
            } else {
                throw new Error(`API error: ${res.status}`);
            }
            return;
        }
        
        const data = await res.json();
        
        // Validacija: ar gavome bent vieną kainą?
        const validPrices = Object.keys(data).filter(key => data[key]?.usd);
        
        if (validPrices.length === 0) {
            console.warn('CoinGecko grąžino tuščią atsakymą. Galbūt blogi CoinGecko ID?');
            return;
        }
        
        // Viskas gerai - atnaujiname state ir laiką
        state.prices = data;
        state.lastFetchTime = now;
        console.log('Prices updated successfully');
        
    } catch (e) { 
        console.error("Price fetch error:", e); 
        // Klaidų atveju laiko neatnaujiname, kad bandytų iš naujo
    }
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
            // Pirkimas: didiname kiekį ir investuotą sumą
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty + amount);
            state.holdings[sym].invested = safeFloat(state.holdings[sym].invested + cost);
        } else if (['Sell', 'Withdraw'].includes(tx.type)) {
            // Pardavimas: mažiname kiekį ir proporcingai mažiname investuotą sumą (FIFO/Avg Cost logic)
            // Tai apsaugo, kad Cost Basis netaptų neigiamas, jei pelningai parduodama
            const currentAvgPrice = state.holdings[sym].qty > 0 ? state.holdings[sym].invested / state.holdings[sym].qty : 0;
            
            state.holdings[sym].qty = safeFloat(state.holdings[sym].qty - amount);
            
            // Mažiname savikainą (invested) pagal vidutinę kainą
            const costReduction = safeFloat(amount * currentAvgPrice);
            state.holdings[sym].invested = Math.max(0, safeFloat(state.holdings[sym].invested - costReduction));
        }
        
        // Perskaičiuojame vidutinę kainą
        if (state.holdings[sym].qty > 0) {
            state.holdings[sym].avgPrice = state.holdings[sym].invested / state.holdings[sym].qty;
        } else {
            state.holdings[sym].qty = 0; 
            state.holdings[sym].invested = 0;
            state.holdings[sym].avgPrice = 0;
        }
    });

    let totalValuePortfolio = 0;
    
    // Skaičiuojame vertes pagal dabartines kainas
    Object.keys(state.holdings).forEach(sym => {
        const h = state.holdings[sym];
        // Randame CoinGecko ID pagal simbolį
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

// Expose resetPriceCache to window for debugging or manual refresh
window.resetPriceCache = resetPriceCache;
