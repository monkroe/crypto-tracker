// js/logic.js - Verslo logika ir duomenų valdymas
import { debugLog } from './utils.js';

// State
export let state = {
    coins: [],
    transactions: [],
    goals: [],
    prices: {},
    holdings: {},
    lastFetchTime: 0
};

// Config
const CACHE_DURATION = 300000; // 5 minutės (taupome API kvotą)

// ==========================================
// 1. DUOMENŲ GAVIMAS (Supabase + CoinGecko)
// ==========================================

export async function loadInitialData() {
    // Naudojame globalų _supabase (iš window objekto)
    const [coinsData, txData, goalsData] = await Promise.all([
        window.getSupportedCoins(),
        window.getTransactions(),
        window.getCryptoGoals()
    ]);
    
    state.coins = Array.isArray(coinsData) ? coinsData : [];
    state.transactions = Array.isArray(txData) ? txData : [];
    state.goals = Array.isArray(goalsData) ? goalsData : [];
    
    await fetchPrices();
    calculateHoldings();
    
    return state;
}

export async function fetchPrices() {
    if (state.coins.length === 0) return;
    
    const now = Date.now();
    // Cache Check
    if (now - state.lastFetchTime < CACHE_DURATION && Object.keys(state.prices).length > 0) {
        debugLog('💰 Using cached prices');
        return;
    }

    const ids = state.coins.map(c => c.coingecko_id).join(',');
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        if (res.ok) {
            state.prices = await res.json();
            state.lastFetchTime = now;
            debugLog('💰 Prices updated form API');
        }
    } catch (e) {
        console.warn("⚠️ Price fetch error:", e);
    }
}

// ==========================================
// 2. MATEMATIKA (PnL & Holdings) - IŠTAISYTA!
// ==========================================

export function calculateHoldings() {
    state.holdings = {};
    let totalInvestedPortfolio = 0;
    
    // Svarbu: skaičiuojame chronologiškai nuo seniausios transakcijos!
    const sortedTxs = [...state.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTxs.forEach(tx => {
        const sym = tx.coin_symbol;
        if (!state.holdings[sym]) {
            state.holdings[sym] = { 
                qty: 0, 
                invested: 0, // Tai yra mūsų "Cost Basis"
                avgPrice: 0 
            };
        }

        const amount = Number(tx.amount);
        const cost = Number(tx.total_cost_usd); // Transaction total value

        // 1. PIRKIMAS (Buy, Instant Buy ir t.t.)
        if (['Buy', 'Instant Buy', 'Recurring Buy', 'Limit Buy', 'Market Buy'].includes(tx.type)) {
            state.holdings[sym].qty += amount;
            state.holdings[sym].invested += cost;
        } 
        // 2. DOVANOS / STAKING (Gauname nemokamai arba su 0 savikaina, bet kiekis didėja)
        else if (['Staking Reward', 'Gift/Airdrop', 'Bonus'].includes(tx.type)) {
            state.holdings[sym].qty += amount;
            // Invested (savikaina) nedidėja, jei tai dovana. Jei staking reward turi mokestinę vertę, reikėtų pridėti, bet supaprastintai laikome 0.
        }
        // 3. PARDAVIMAS (Sell, Withdraw) - KRITINIS PATAISYMAS
        else if (['Sell', 'Withdraw'].includes(tx.type)) {
            // Skaičiuojame dabartinę vidutinę kainą PRIEŠ pardavimą
            const currentAvgPrice = state.holdings[sym].qty > 0 
                ? state.holdings[sym].invested / state.holdings[sym].qty 
                : 0;

            state.holdings[sym].qty -= amount;
            
            // Mažiname savikainą (Invested) PROPORCINGAI parduotam kiekiui.
            // Pavyzdys: Turiu 2 BTC už 20k (Avg 10k). Parduodu 1 BTC už 50k.
            // Invested mažėja: 1 * 10k = 10k. Likutis: 1 BTC už 10k.
            state.holdings[sym].invested -= (amount * currentAvgPrice);
        }

        // Atnaujiname vidutinę kainą po kiekvieno veiksmo
        if (state.holdings[sym].qty > 0) {
            state.holdings[sym].avgPrice = state.holdings[sym].invested / state.holdings[sym].qty;
        } else {
            state.holdings[sym].qty = 0;
            state.holdings[sym].invested = 0;
            state.holdings[sym].avgPrice = 0;
        }
    });

    // 4. DABARTINĖS VERTĖS SKAIČIAVIMAS
    let totalValuePortfolio = 0;

    Object.keys(state.holdings).forEach(sym => {
        const h = state.holdings[sym];
        const coin = state.coins.find(c => c.symbol === sym);
        const currentPrice = (coin && state.prices[coin.coingecko_id]) ? state.prices[coin.coingecko_id].usd : 0;

        h.currentPrice = currentPrice;
        h.currentValue = h.qty * currentPrice;
        
        // Pelnas = Dabartinė vertė - Likusi savikaina
        h.pnl = h.currentValue - h.invested;
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

