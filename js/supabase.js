// js/supabase.js - Versija 1.7.3 (Pilna Auth & Data Manager)

// ⚠️ SVARBU: Pakeiskite šias reikšmes savo Supabase projekto duomenimis!
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW';

// Inicijuojame klientą ir padarome jį pasiekiamą visur (globaliai)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 1. AUTH FUNKCIJOS
// ==========================================

async function userSignUp(email, password) {
    try {
        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message || 'Registracija nepavyko.');
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error };
    }
}

async function userLogin(email, password) {
    try {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message || 'Prisijungti nepavyko. Patikrinkite duomenis.');
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error };
    }
}

async function userSignOut() {
    const { error } = await _supabase.auth.signOut();
    return { error };
}

// ==========================================
// 2. DUOMENŲ FUNKCIJOS (CRUD)
// ==========================================

// --- TRANSAKCIJOS ---

async function getTransactions() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await _supabase
        .from('crypto_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
    
    if (error) console.error("Get Tx Error:", error);
    return data || [];
}

async function saveTransaction(txData) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) { alert("Klaida: Vartotojas neprisijungęs."); return false; }
    
    const dataWithUser = { ...txData, user_id: user.id };

    const { error } = await _supabase.from('crypto_transactions').insert([dataWithUser]);
    if (error) { alert("KLAIDA ĮRAŠANT: " + error.message); console.error("Save Error:", error); return false; }
    return true;
}

async function updateTransaction(id, txData) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) { alert("Klaida: Vartotojas neprisijungęs."); return false; }

    const { error } = await _supabase
        .from('crypto_transactions')
        .update(txData)
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) { alert("KLAIDA ATNAUJINANT: " + error.message); return false; }
    return true;
}

async function deleteTransaction(id) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;

    const { error } = await _supabase
        .from('crypto_transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
    
    if (error) { alert("KLAIDA TRINANT: " + error.message); return false; }
    return true;
}

// --- MONETOS ---

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
    if (!user) { alert("Klaida: Vartotojas neprisijungęs."); return false; }

    // RLS (Row Level Security) ir UNIQUE (naudotojas, simbolis) apribojimai apsaugo nuo dublikatų
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
        .eq('user_id', user.id); 

    if (error) { alert("KLAIDA (Delete Coin): " + error.message); return false; }
    return true;
}

// --- TIKSLAMS ---

async function getCryptoGoals() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await _supabase
        .from('crypto_goals')
        .select('*')
        .eq('user_id', user.id);
        
    if (error) console.error("Goals Error:", error);
    return data || [];
}

async function saveOrUpdateGoal(coinSymbol, targetAmount) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;

    const { error } = await _supabase
        .from('crypto_goals')
        .upsert({ user_id: user.id, coin_symbol: coinSymbol, target_amount: targetAmount }, { onConflict: 'user_id, coin_symbol' });
    
    if (error) { alert("KLAIDA (Save Goal): " + error.message); return false; }
    return true;
}
