// js/supabase.js - v3.0.0 (Global API Layer)

// ======================================
// 1. SUPABASE KONFIGŪRACIJA
// ======================================
// ⚠️ ĮKLIJUOKITE SAVO DUOMENIS ČIA:
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW';

// Patikrinimas, kad netyčia nepaleistumėte be raktų
if (SUPABASE_URL.includes('JŪSŲ') || SUPABASE_ANON_KEY.includes('JŪSŲ')) {
    console.error('❌ TRŪKSTA SUPABASE RAKTŲ! Įrašykite juos js/supabase.js faile.');
    alert('Nustatymų klaida: Trūksta Supabase raktų (žr. konsolę).');
}

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Eksportuojame į window objektą, kad pasiektų moduliai (app.js, logic.js)
window._supabase = _supabase;

console.log('🔗 Supabase Connected v3.0.0');

// ======================================
// 2. AUTENTIFIKACIJA (Global functions)
// ======================================

window.userSignUp = async function(email, password) {
    try {
        const result = await _supabase.auth.signUp({ email, password });
        return result;
    } catch (e) {
        console.error('Sign up error:', e);
        return { data: null, error: e };
    }
};

window.userLogin = async function(email, password) {
    try {
        const result = await _supabase.auth.signInWithPassword({ email, password });
        return result;
    } catch (e) {
        console.error('Login error:', e);
        return { data: null, error: e };
    }
};

window.userSignOut = async function() {
    try {
        const { error } = await _supabase.auth.signOut();
        return { error };
    } catch (e) {
        return { error: e };
    }
};

// ======================================
// 3. DUOMENYS: TRANSAKCIJOS
// ======================================

window.getTransactions = async function() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        
        const { data, error } = await _supabase
            .from('crypto_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false }); // Naujausi viršuje
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Get tx error:', e);
        return [];
    }
};

window.saveTransaction = async function(txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        // Užtikriname, kad skaičiai yra skaičiai
        const cleanData = {
            ...txData,
            amount: parseFloat(txData.amount),
            price_per_coin: parseFloat(txData.price_per_coin),
            total_cost_usd: parseFloat(txData.total_cost_usd),
            user_id: user.id
        };

        const { error } = await _supabase
            .from('crypto_transactions')
            .insert([cleanData]);
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Save tx error:', e);
        return false;
    }
};

window.deleteTransaction = async function(id) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Delete tx error:', e);
        return false;
    }
};

// ======================================
// 4. DUOMENYS: MONETOS
// ======================================

window.getSupportedCoins = async function() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        
        const { data, error } = await _supabase
            .from('supported_coins')
            .select('*')
            .eq('user_id', user.id);
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Get coins error:', e);
        return [];
    }
};

window.saveNewCoin = async function(coinData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const { error } = await _supabase
            .from('supported_coins')
            .insert([{ ...coinData, user_id: user.id }]);
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Save coin error:', e);
        return false;
    }
};

window.deleteSupportedCoin = async function(symbol) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const { error } = await _supabase
            .from('supported_coins')
            .delete()
            .eq('user_id', user.id)
            .eq('symbol', symbol);
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Delete coin error:', e);
        return false;
    }
};

// ======================================
// 5. DUOMENYS: TIKSLAI (Goals)
// ======================================

window.getCryptoGoals = async function() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        
        const { data, error } = await _supabase
            .from('crypto_goals')
            .select('*')
            .eq('user_id', user.id);
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Get goals error:', e);
        return [];
    }
};
