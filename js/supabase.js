// --- KONFIGŪRACIJA ---
// Pakeisk šiuos duomenis savo tikrais iš Supabase -> Settings -> API
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- FUNKCIJOS ---

async function getTransactions() {
    const { data, error } = await _supabase
        .from('crypto_transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
    
    if (error) console.error("Get Tx Error:", error);
    return data || [];
}

async function saveTransaction(txData) {
    const { data, error } = await _supabase
        .from('crypto_transactions')
        .insert([txData])
        .select();

    if (error) {
        // Rodo klaidą ekrane, jei nepavyksta
        alert("KLAIDA ĮRAŠANT: " + error.message);
        console.error("Save Error:", error);
        return false;
    }
    return true;
}

async function getSupportedCoins() {
    const { data } = await _supabase.from('supported_coins').select('*').order('symbol', { ascending: true });
    return data || [];
}

async function saveNewCoin(coinData) {
    const { error } = await _supabase.from('supported_coins').insert([coinData]);
    if (error) {
        alert("KLAIDA (New Coin): " + error.message);
        return false;
    }
    return true;
}

// Funkcija ištrinti monetai
async function deleteSupportedCoin(symbol) {
    const { error } = await _supabase.from('supported_coins').delete().eq('symbol', symbol);
    if (error) {
        alert("KLAIDA (Delete): " + error.message);
        return false;
    }
    return true;
}
