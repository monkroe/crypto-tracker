// --- KONFIGŪRACIJA ---
// 1. Eik į Supabase -> Settings -> API.
// 2. Nukopijuok "Project URL" ir įklijuok žemiau tarp kabučių.
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co';

// 3. Nukopijuok "anon public" raktą ir įklijuok žemiau.
const SUPABASE_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW';

// Inicijuojame Supabase klientą
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- FUNKCIJOS DARBUI SU DUOMENIMIS ---

// 1. Gauti visas transakcijas (naujausios viršuje)
async function getTransactions() {
    const { data, error } = await _supabase
        .from('crypto_transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }); // Rūšiuojam ir pagal sukūrimo laiką
    
    if (error) {
        console.error("Klaida gaunant transakcijas:", error);
        return [];
    }
    return data;
}

// 2. Išsaugoti naują transakciją
async function saveTransaction(txData) {
    const { data, error } = await _supabase
        .from('crypto_transactions')
        .insert([txData])
        .select();

    if (error) {
        console.error("Klaida saugant:", error);
        alert("Nepavyko išsaugoti! Patikrink konsolę.");
        return false;
    }
    return true;
}

// 3. Gauti palaikomas monetas (sąrašui)
async function getSupportedCoins() {
    const { data, error } = await _supabase
        .from('supported_coins')
        .select('*')
        .order('symbol', { ascending: true });
        
    if (error) return [];
    return data;
}

// 4. Pridėti naują monetą į sąrašą
async function saveNewCoin(coinData) {
    const { data, error } = await _supabase
        .from('supported_coins')
        .insert([coinData]);
        
    if (error) {
        console.error("Error saving coin:", error);
        return false;
    }
    return true;
}

// 5. Išsaugoti portfolio istoriją (Snapshot) - ateičiai
async function savePortfolioSnapshot(totalValue, totalInvested) {
    const today = new Date().toISOString().split('T')[0];
    
    // Patikrinam, ar šiandien jau yra įrašas
    const { data: existing } = await _supabase
        .from('portfolio_snapshots')
        .select('id')
        .eq('date', today);

    if (existing && existing.length > 0) {
        // Jei yra, atnaujiname
        await _supabase
            .from('portfolio_snapshots')
            .update({ total_value_usd: totalValue, total_invested_usd: totalInvested })
            .eq('id', existing[0].id);
    } else {
        // Jei nėra, sukuriame naują
        await _supabase
            .from('portfolio_snapshots')
            .insert([{ date: today, total_value_usd: totalValue, total_invested_usd: totalInvested }]);
    }
}

// 6. Ištrinti monetą iš sąrašo (NAUJA FUNKCIJA)
async function deleteSupportedCoin(symbol) {
    const { error } = await _supabase
        .from('supported_coins')
        .delete()
        .eq('symbol', symbol);

    if (error) {
        console.error("Error deleting coin:", error);
        return false;
    }
    return true;
}
