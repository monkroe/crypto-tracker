// js/supabase.js - Versija 1.3.1 (With User Auth Logic)

// ĮKLIJUOK SAVO DUOMENIS ČIA:
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- FUNKCIJOS ---

async function getTransactions() {
    // Paimame tik prisijungusio vartotojo duomenis
    const { data: { user } } = await _supabase.auth.getUser();
    
    // Jei vartotojas neprisijungęs, grąžiname tuščią (arba galima rodyti klaidą)
    if (!user) return [];

    const { data, error } = await _supabase
        .from('crypto_transactions')
        .select('*')
        .eq('user_id', user.id) // SVARBU: Filtruojame tik tavo duomenis
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
    
    if (error) console.error("Get Tx Error:", error);
    return data || [];
}

async function saveTransaction(txData) {
    // 1. Gauname vartotoją
    const { data: { user } } = await _supabase.auth.getUser();
    
    if (!user) {
        alert("Klaida: Vartotojas neprisijungęs.");
        return false;
    }

    // 2. Papildome duomenis vartotojo ID
    const dataWithUser = {
        ...txData,
        user_id: user.id
    };

    const { data, error } = await _supabase
        .from('crypto_transactions')
        .insert([dataWithUser])
        .select();

    if (error) {
        alert("KLAIDA ĮRAŠANT: " + error.message);
        console.error("Save Error:", error);
        return false;
    }
    return true;
}

async function getSupportedCoins() {
    // Monetų sąrašas gali būti bendras, bet jei nori asmeninio:
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return [];

    const { data } = await _supabase
        .from('supported_coins')
        .select('*')
        .eq('user_id', user.id) // Kiekvienas vartotojas turi savo monetų sąrašą
        .order('symbol', { ascending: true });
        
    return data || [];
}

async function saveNewCoin(coinData) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;

    // Pridedame user_id
    const dataWithUser = { ...coinData, user_id: user.id };

    const { error } = await _supabase.from('supported_coins').insert([dataWithUser]);
    if (error) {
        alert("KLAIDA (New Coin): " + error.message);
        return false;
    }
    return true;
}

async function deleteSupportedCoin(symbol) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;

    const { error } = await _supabase
        .from('supported_coins')
        .delete()
        .eq('symbol', symbol)
        .eq('user_id', user.id); // Triname tik savo monetą

    if (error) {
        alert("KLAIDA (Delete): " + error.message);
        return false;
    }
    return true;
}

// Papildoma funkcija prisijungimui (Autentifikacijai), jei jos prireiktų
async function signInWithEmail(email, password) {
    const { data, error } = await _supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    return { data, error };
}
