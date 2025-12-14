// js/supabase.js - Versija 1.7.6

// ======================================
// 1. SUPABASE KONFIGŪRACIJA
// ======================================
// Pakeiskite šiuos duomenis savo projekto raktais!
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW'; 

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ======================================
// 2. AUTENTIFIKACIJOS FUNKCIJOS
// ======================================

async function userSignUp(email, password) {
    return _supabase.auth.signUp({
        email,
        password,
    });
}

async function userLogin(email, password) {
    return _supabase.auth.signInWithPassword({
        email,
        password,
    });
}

async function userSignOut() {
    const { error } = await _supabase.auth.signOut();
    if (error) {
        console.error("Logout error:", error);
    }
}


// ======================================
// 3. DUOMENŲ FUNKCIJOS (CRUD)
// ======================================

// --- TRANSAKCIJOS ---

async function getTransactions() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await _supabase
        .from('crypto_transactions')
        .select('*')
        .eq('user_id', user.id);
        
    if (error) {
        console.error("Error fetching transactions:", error);
        return [];
    }
    return data;
}

async function saveTransaction(txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) { alert("Klaida: Vartotojas neprisijungęs."); return false; }
        
        const dataWithUser = { ...txData, user_id: user.id };
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .insert([dataWithUser]);
            
        if (error) {
            alert("KLAIDA ĮRAŠANT TRANSAKCIJĄ: " + error.message);
            console.error("Save Tx Error:", error);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Unexpected error in saveTransaction:", e);
        return false;
    }
}

async function updateTransaction(id, txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) { alert("Klaida: Vartotojas neprisijungęs."); return false; }
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .update(txData)
            .eq('id', id)
            .eq('user_id', user.id); // Saugumas
            
        if (error) {
            alert("KLAIDA ATNAUJINANT TRANSAKCIJĄ: " + error.message);
            console.error("Update Tx Error:", error);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Unexpected error in updateTransaction:", e);
        return false;
    }
}

async function deleteTransaction(id) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) { alert("Klaida: Vartotojas neprisijungęs."); return false; }
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id); // Saugumas
            
        if (error) {
            alert("KLAIDA TRINANT TRANSAKCIJĄ: " + error.message);
            console.error("Delete Tx Error:", error);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Unexpected error in deleteTransaction:", e);
        return false;
    }
}


// --- MONETŲ SĄRAŠAS ---

async function getSupportedCoins() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await _supabase
        .from('supported_coins')
        .select('*')
        .eq('user_id', user.id);
        
    if (error) {
        console.error("Error fetching supported coins:", error);
        return [];
    }
    return data;
}

async function saveNewCoin(coinData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) { alert("Klaida: Vartotojas neprisijungęs."); return false; }

        const dataWithUser = { ...coinData, user_id: user.id };
        
        const { error } = await _supabase
            .from('supported_coins')
            .insert([dataWithUser]);
            
        if (error) {
            alert("KLAIDA ĮRAŠANT MONETĄ: " + error.message);
            console.error("Save Coin Error:", error);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Unexpected error in saveNewCoin:", e);
        return false;
    }
}

async function deleteSupportedCoin(symbol) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) { alert("Klaida: Vartotojas neprisijungęs."); return false; }
        
        const { error } = await _supabase
            .from('supported_coins')
            .delete()
            .eq('user_id', user.id)
            .eq('symbol', symbol); 

        if (error) {
            alert("KLAIDA TRINANT MONETĄ: " + error.message);
            console.error("Delete Coin Error:", error);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Unexpected error in deleteSupportedCoin:", e);
        return false;
    }
}


// --- TIKSLAI (GOALS) ---

async function getCryptoGoals() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await _supabase
        .from('crypto_goals')
        .select('*')
        .eq('user_id', user.id);
        
    if (error) {
        console.error("Error fetching goals:", error);
        return [];
    }
    return data;
}

async function saveOrUpdateGoal(symbol, target) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) { alert("Klaida: Vartotojas neprisijungęs."); return false; }
        
        const goalData = {
            coin_symbol: symbol,
            target_amount: target,
            user_id: user.id
        };

        const { error } = await _supabase
            .from('crypto_goals')
            .upsert(goalData, { onConflict: 'user_id, coin_symbol' }); // Atnaujina, jei egzistuoja
            
        if (error) {
            alert("KLAIDA ĮRAŠANT/ATNAUJINANT TIKSLĄ: " + error.message);
            console.error("Goal Upsert Error:", error);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Unexpected error in saveOrUpdateGoal:", e);
        return false;
    }
}


// --- ISTORINĖS KAINOS (NAUJA) ---
async function saveHistoricalPrice(historyData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) { 
            alert("Klaida: Vartotojas neprisijungęs."); 
            return false; 
        }

        const dataWithUser = { 
            ...historyData, 
            user_id: user.id 
        };

        const { error } = await _supabase
            .from('crypto_history')
            .insert([dataWithUser]);

        if (error) {
            // Unikalumo klaida reiškia, kad jau yra įrašas (tai nėra kritinė klaida)
            if (error.code !== '23505') { 
                alert("KLAIDA ĮRAŠANT ISTORINĘ KAINĄ: " + error.message);
            }
            console.error("Save History Error:", error);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Unexpected error in saveHistoricalPrice:", e);
        return false;
    }
}
