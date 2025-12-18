// js/supabase.js - Versija 1.9.4 (Bulk Import Support)

// ======================================
// 1. SUPABASE KONFIGŪRACIJA
// ======================================
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; // Pakeiskite savo URL
const SUPABASE_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW'; // Pakeiskite savo KEY
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔗 Supabase initialized v1.9.4');

// ======================================
// 2. AUTENTIFIKACIJA
// ======================================
async function userSignUp(email, password) {
    try {
        const result = await _supabase.auth.signUp({ email, password });
        return result;
    } catch (e) { return { data: null, error: e }; }
}

async function userLogin(email, password) {
    try {
        const result = await _supabase.auth.signInWithPassword({ email, password });
        return result;
    } catch (e) { return { data: null, error: e }; }
}

async function userSignOut() {
    try {
        const { error } = await _supabase.auth.signOut();
        return { error };
    } catch (e) { return { error: e }; }
}

// ======================================
// 3. TRANSAKCIJOS
// ======================================
async function getTransactions() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await _supabase.from('crypto_transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) { console.error(e); return []; }
}

async function saveTransaction(txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('crypto_transactions').insert([{ ...txData, user_id: user.id }]);
        if (error) throw error;
        return true;
    } catch (e) { alert(e.message); return false; }
}

// NAUJA: Masinis išsaugojimas (Importui)
async function saveMultipleTransactions(txArray) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        // Pridedame user_id prie kiekvieno įrašo
        const dataWithUser = txArray.map(tx => ({ ...tx, user_id: user.id }));
        
        const { error } = await _supabase.from('crypto_transactions').insert(dataWithUser);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Bulk save error:', e);
        alert('Klaida importuojant: ' + e.message);
        return false;
    }
}

async function updateTransaction(id, txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('crypto_transactions').update(txData).eq('id', id).eq('user_id', user.id);
        if (error) throw error;
        return true;
    } catch (e) { alert(e.message); return false; }
}

async function deleteTransaction(id) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('crypto_transactions').delete().eq('id', id).eq('user_id', user.id);
        if (error) throw error;
        return true;
    } catch (e) { alert(e.message); return false; }
}

// ======================================
// 4. MONETOS
// ======================================
async function getSupportedCoins() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await _supabase.from('supported_coins').select('*').eq('user_id', user.id);
        if (error) throw error;
        return data || [];
    } catch (e) { return []; }
}

async function saveNewCoin(coinData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('supported_coins').insert([{ ...coinData, user_id: user.id }]);
        if (error) throw error;
        return true;
    } catch (e) { 
        if (e.code !== '23505') alert(e.message); // Ignoruoti duplicate error
        return false; 
    }
}

async function deleteSupportedCoin(symbol) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('supported_coins').delete().eq('user_id', user.id).eq('symbol', symbol);
        if (error) throw error;
        return true;
    } catch (e) { alert(e.message); return false; }
}

// ======================================
// 5. TIKSLAI
// ======================================
async function getCryptoGoals() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await _supabase.from('crypto_goals').select('*').eq('user_id', user.id);
        return data || [];
    } catch (e) { return []; }
}

async function saveOrUpdateGoal(symbol, target) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('crypto_goals').upsert({ coin_symbol: symbol, target_amount: target, user_id: user.id }, { onConflict: 'user_id,coin_symbol' });
        if (error) throw error;
        return true;
    } catch (e) { return false; }
}
