// js/supabase.js - Versija 1.3.4 (Su Auth Funkcijomis)

// --- ĮKLIJUOK SAVO DUOMENIS ČIA (Jie turi sutapti su tais, kuriuos turėjai) ---
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW';

// Sukuriame klientą
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- AUTH FUNKCIJOS (ŠIŲ TRŪKO) ---

async function userLogin(email, password) {
    const { data, error } = await _supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    if (error) throw error;
    return data;
}

async function userSignUp(email, password) {
    const { data, error } = await _supabase.auth.signUp({
        email: email,
        password: password,
    });
    if (error) throw error;
    return data;
}

async function userSignOut() {
    const { error } = await _supabase.auth.signOut();
    if (error) console.error('Logout error:', error);
}

// --- DUOMENŲ FUNKCIJOS ---

async function getTransactions() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await _supabase
        .from('crypto_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
    
    if (error) console.error("Get Tx Error:", error);
    return data || [];
}

async function saveTransaction(txData) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;

    const dataWithUser = { ...txData, user_id: user.id };
    const { error } = await _supabase.from('crypto_transactions').insert([dataWithUser]);

    if (error) {
        alert("KLAIDA: " + error.message);
        return false;
    }
    return true;
}

async function getSupportedCoins() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return [];

    const { data } = await _supabase
        .from('supported_coins')
        .select('*')
        .eq('user_id', user.id)
        .order('symbol', { ascending: true });
        
    return data || [];
}

async function saveNewCoin(coinData) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;

    const dataWithUser = { ...coinData, user_id: user.id };
    const { error } = await _supabase.from('supported_coins').insert([dataWithUser]);
    if (error) {
        alert("KLAIDA: " + error.message);
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
        .eq('user_id', user.id);

    if (error) {
        alert("KLAIDA: " + error.message);
        return false;
    }
    return true;
}
