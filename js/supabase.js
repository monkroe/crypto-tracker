// js/supabase.js - Versija 1.4.0 (Su Update/Delete)

const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- AUTH ---
async function userLogin(email, password) {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}
async function userSignUp(email, password) {
    const { data, error } = await _supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
}
async function userSignOut() {
    await _supabase.auth.signOut();
}

// --- DATA ---
async function getTransactions() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await _supabase
        .from('crypto_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
    if (error) console.error(error);
    return data || [];
}

async function saveTransaction(txData) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;
    const dataWithUser = { ...txData, user_id: user.id };
    const { error } = await _supabase.from('crypto_transactions').insert([dataWithUser]);
    if (error) { alert("Error: " + error.message); return false; }
    return true;
}

// NAUJA: Atnaujinti esamą
async function updateTransaction(id, txData) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;
    const { error } = await _supabase
        .from('crypto_transactions')
        .update(txData)
        .eq('id', id)
        .eq('user_id', user.id);
    if (error) { alert("Error updating: " + error.message); return false; }
    return true;
}

// NAUJA: Ištrinti
async function deleteTransaction(id) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;
    const { error } = await _supabase
        .from('crypto_transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
    if (error) { alert("Error deleting: " + error.message); return false; }
    return true;
}

async function getSupportedCoins() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return [];
    const { data } = await _supabase.from('supported_coins').select('*').eq('user_id', user.id).order('symbol');
    return data || [];
}

async function saveNewCoin(coinData) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;
    const { error } = await _supabase.from('supported_coins').insert([{ ...coinData, user_id: user.id }]);
    if (error) { alert("Error: " + error.message); return false; }
    return true;
}

async function deleteSupportedCoin(symbol) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;
    const { error } = await _supabase.from('supported_coins').delete().eq('symbol', symbol).eq('user_id', user.id);
    if (error) { alert("Error: " + error.message); return false; }
    return true;
}
