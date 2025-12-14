// js/supabase.js - Versija 1.8.0 (Pataisytas error handling)

// ======================================
// 1. SUPABASE KONFIGŪRACIJA
// ======================================
// ⚠️ SVARBU: Pakeiskite šiuos duomenis savo projekto raktais!
// Rasite: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api

const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔗 Supabase initialized');

// ======================================
// 2. AUTENTIFIKACIJOS FUNKCIJOS
// ======================================

/**
 * Užsiregistruoti su el. paštu ir slaptažodžiu
 */
async function userSignUp(email, password) {
    try {
        const result = await _supabase.auth.signUp({ email, password });
        if (result.error) {
            console.error('❌ Signup error:', result.error);
        } else {
            console.log('✅ User signed up:', result.data.user?.email);
        }
        return result;
    } catch (e) {
        console.error('❌ Unexpected signup error:', e);
        return { data: null, error: e };
    }
}

/**
 * Prisijungti su el. paštu ir slaptažodžiu
 */
async function userLogin(email, password) {
    try {
        const result = await _supabase.auth.signInWithPassword({ email, password });
        if (result.error) {
            console.error('❌ Login error:', result.error);
        } else {
            console.log('✅ User logged in:', result.data.user?.email);
        }
        return result;
    } catch (e) {
        console.error('❌ Unexpected login error:', e);
        return { data: null, error: e };
    }
}

/**
 * Atsijungti
 */
async function userSignOut() {
    try {
        const { error } = await _supabase.auth.signOut();
        if (error) {
            console.error('❌ Logout error:', error);
        } else {
            console.log('✅ User signed out');
        }
        return { error };
    } catch (e) {
        console.error('❌ Unexpected logout error:', e);
        return { error: e };
    }
}

// ======================================
// 3. TRANSAKCIJŲ FUNKCIJOS
// ======================================

/**
 * Gauti visas vartotojo transakcijas
 */
async function getTransactions() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.warn('⚠️ No user logged in');
            return [];
        }
        
        const { data, error } = await _supabase
            .from('crypto_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });
            
        if (error) {
            console.error('❌ Error fetching transactions:', error);
            return [];
        }
        
        console.log(`✅ Loaded ${data?.length || 0} transactions`);
        return data || [];
    } catch (e) {
        console.error('❌ Unexpected error in getTransactions:', e);
        return [];
    }
}

/**
 * Išsaugoti naują transakciją
 */
async function saveTransaction(txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.error('❌ No user logged in');
            alert('Klaida: Vartotojas neprisijungęs.');
            return false;
        }
        
        const dataWithUser = { ...txData, user_id: user.id };
        
        const { data, error } = await _supabase
            .from('crypto_transactions')
            .insert([dataWithUser])
            .select();
            
        if (error) {
            console.error('❌ Error saving transaction:', error);
            alert('Klaida išsaugant transakciją: ' + error.message);
            return false;
        }
        
        console.log('✅ Transaction saved:', data[0]?.id);
        return true;
    } catch (e) {
        console.error('❌ Unexpected error in saveTransaction:', e);
        alert('Netikėta klaida. Bandykite dar kartą.');
        return false;
    }
}

/**
 * Atnaujinti esamą transakciją
 */
async function updateTransaction(id, txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.error('❌ No user logged in');
            alert('Klaida: Vartotojas neprisijungęs.');
            return false;
        }
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .update(txData)
            .eq('id', id)
            .eq('user_id', user.id);
            
        if (error) {
            console.error('❌ Error updating transaction:', error);
            alert('Klaida atnaujinant transakciją: ' + error.message);
            return false;
        }
        
        console.log('✅ Transaction updated:', id);
        return true;
    } catch (e) {
        console.error('❌ Unexpected error in updateTransaction:', e);
        alert('Netikėta klaida. Bandykite dar kartą.');
        return false;
    }
}

/**
 * Ištrinti transakciją
 */
async function deleteTransaction(id) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.error('❌ No user logged in');
            alert('Klaida: Vartotojas neprisijungęs.');
            return false;
        }
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
            
        if (error) {
            console.error('❌ Error deleting transaction:', error);
            alert('Klaida trinant transakciją: ' + error.message);
            return false;
        }
        
        console.log('✅ Transaction deleted:', id);
        return true;
    } catch (e) {
        console.error('❌ Unexpected error in deleteTransaction:', e);
        alert('Netikėta klaida. Bandykite dar kartą.');
        return false;
    }
}

// ======================================
// 4. MONETŲ FUNKCIJOS
// ======================================

/**
 * Gauti visas vartotojo monetas
 */
async function getSupportedCoins() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.warn('⚠️ No user logged in');
            return [];
        }
        
        const { data, error } = await _supabase
            .from('supported_coins')
            .select('*')
            .eq('user_id', user.id)
            .order('symbol', { ascending: true });
            
        if (error) {
            console.error('❌ Error fetching coins:', error);
            return [];
        }
        
        console.log(`✅ Loaded ${data?.length || 0} coins`);
        return data || [];
    } catch (e) {
        console.error('❌ Unexpected error in getSupportedCoins:', e);
        return [];
    }
}

/**
 * Pridėti naują monetą
 */
async function saveNewCoin(coinData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.error('❌ No user logged in');
            alert('Klaida: Vartotojas neprisijungęs.');
            return false;
        }

        const dataWithUser = { ...coinData, user_id: user.id };
        
        const { data, error } = await _supabase
            .from('supported_coins')
            .insert([dataWithUser])
            .select();
            
        if (error) {
            // Check for duplicate key error
            if (error.code === '23505') {
                console.error('❌ Coin already exists');
                alert(`Moneta ${coinData.symbol} jau egzistuoja!`);
            } else {
                console.error('❌ Error saving coin:', error);
                alert('Klaida pridedant monetą: ' + error.message);
            }
            return false;
        }
        
        console.log('✅ Coin added:', coinData.symbol);
        return true;
    } catch (e) {
        console.error('❌ Unexpected error in saveNewCoin:', e);
        alert('Netikėta klaida. Bandykite dar kartą.');
        return false;
    }
}

/**
 * Ištrinti monetą
 */
async function deleteSupportedCoin(symbol) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.error('❌ No user logged in');
            alert('Klaida: Vartotojas neprisijungęs.');
            return false;
        }
        
        const { error } = await _supabase
            .from('supported_coins')
            .delete()
            .eq('user_id', user.id)
            .eq('symbol', symbol);

        if (error) {
            console.error('❌ Error deleting coin:', error);
            alert('Klaida trinant monetą: ' + error.message);
            return false;
        }
        
        console.log('✅ Coin deleted:', symbol);
        return true;
    } catch (e) {
        console.error('❌ Unexpected error in deleteSupportedCoin:', e);
        alert('Netikėta klaida. Bandykite dar kartą.');
        return false;
    }
}

// ======================================
// 5. TIKSLŲ (GOALS) FUNKCIJOS
// ======================================

/**
 * Gauti visus vartotojo tikslus
 */
async function getCryptoGoals() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.warn('⚠️ No user logged in');
            return [];
        }
        
        const { data, error } = await _supabase
            .from('crypto_goals')
            .select('*')
            .eq('user_id', user.id);
            
        if (error) {
            console.error('❌ Error fetching goals:', error);
            return [];
        }
        
        console.log(`✅ Loaded ${data?.length || 0} goals`);
        return data || [];
    } catch (e) {
        console.error('❌ Unexpected error in getCryptoGoals:', e);
        return [];
    }
}

/**
 * Išsaugoti arba atnaujinti tikslą (upsert)
 */
async function saveOrUpdateGoal(symbol, target) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.error('❌ No user logged in');
            alert('Klaida: Vartotojas neprisijungęs.');
            return false;
        }
        
        const goalData = {
            coin_symbol: symbol,
            target_amount: target,
            user_id: user.id
        };

        const { error } = await _supabase
            .from('crypto_goals')
            .upsert(goalData, { 
                onConflict: 'user_id,coin_symbol',
                ignoreDuplicates: false 
            });
            
        if (error) {
            console.error('❌ Error upserting goal:', error);
            alert('Klaida išsaugant tikslą: ' + error.message);
            return false;
        }
        
        console.log('✅ Goal saved:', symbol, target);
        return true;
    } catch (e) {
        console.error('❌ Unexpected error in saveOrUpdateGoal:', e);
        alert('Netikėta klaida. Bandykite dar kartą.');
        return false;
    }
}

/**
 * Ištrinti tikslą
 */
async function deleteGoal(symbol) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.error('❌ No user logged in');
            return false;
        }
        
        const { error } = await _supabase
            .from('crypto_goals')
            .delete()
            .eq('user_id', user.id)
            .eq('coin_symbol', symbol);
            
        if (error) {
            console.error('❌ Error deleting goal:', error);
            return false;
        }
        
        console.log('✅ Goal deleted:', symbol);
        return true;
    } catch (e) {
        console.error('❌ Unexpected error in deleteGoal:', e);
        return false;
    }
}

// ======================================
// 6. UTILITY FUNKCIJOS
// ======================================

/**
 * Patikrinti ar vartotojas prisijungęs
 */
async function isUserLoggedIn() {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        return !!session;
    } catch (e) {
        console.error('❌ Error checking login status:', e);
        return false;
    }
}

/**
 * Gauti dabartinį vartotoją
 */
async function getCurrentUser() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        return user;
    } catch (e) {
        console.error('❌ Error getting current user:', e);
        return null;
    }
}

// ======================================
// 7. DEBUG INFO
// ======================================

console.log('📚 Available functions:', {
    auth: ['userLogin', 'userSignUp', 'userSignOut'],
    transactions: ['getTransactions', 'saveTransaction', 'updateTransaction', 'deleteTransaction'],
    coins: ['getSupportedCoins', 'saveNewCoin', 'deleteSupportedCoin'],
    goals: ['getCryptoGoals', 'saveOrUpdateGoal', 'deleteGoal'],
    utils: ['isUserLoggedIn', 'getCurrentUser']
});
