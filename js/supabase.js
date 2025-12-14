// js/supabase.js - Versija 1.7.1 (Saugos ir klaidų tvarkymo patobulinimas)

// ⚠️ SVARBU: Pakeiskite šias reikšmes savo Supabase projekto duomenimis!
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW';

// Inicializuoti Supabase klientą
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Prisijungimas su el. paštu ir slaptažodžiu
 */
async function userLogin(email, password) {
    try {
        const { data, error } = await _supabase.auth.signInWithPassword({ 
            email, 
            password 
        });
        if (error) {
            // Šitas pranešimas dabar bus rodomas programėlėje!
            throw new Error(error.message || 'Prisijungti nepavyko. Patikrinkite duomenis.');
        }
        return { data, error: null };
    } catch (error) {
        console.error('Login error:', error);
        return { data: null, error: error };
    }
}

/**
 * Registracija su el. paštu ir slaptažodžiu
 */
async function userSignUp(email, password) {
    try {
        const { data, error } = await _supabase.auth.signUp({ 
            email, 
            password 
        });
        if (error) {
            throw new Error(error.message || 'Registracija nepavyko.');
        }
        return { data, error: null };
    } catch (error) {
        console.error('Signup error:', error);
        return { data: null, error: error };
    }
}

/**
 * Atsijungimas
 */
async function userSignOut() {
    try {
        const { error } = await _supabase.auth.signOut();
        if (error) throw error;
        return { error: null };
    } catch (error) {
        console.error('Signout error:', error);
        return { error };
    }
}

// =============================================================================
// TRANSACTIONS
// =============================================================================

/**
 * Gauti visas vartotojo transakcijas
 */
async function getTransactions() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.warn('No user logged in');
            return [];
        }
        
        const { data, error } = await _supabase
            .from('crypto_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });
        
        if (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
        
        return data || [];
    } catch (error) {
        console.error('Unexpected error in getTransactions:', error);
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
            alert('Klaida: Vartotojas neprisijungęs!');
            return false;
        }
        
        const dataWithUser = { ...txData, user_id: user.id };
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .insert([dataWithUser]);
        
        if (error) {
            console.error('Error saving transaction:', error);
            alert(`Klaida išsaugant: ${error.message}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Unexpected error in saveTransaction:', error);
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
            alert('Klaida: Vartotojas neprisijungęs!');
            return false;
        }
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .update(txData)
            .eq('id', id)
            .eq('user_id', user.id);
        
        if (error) {
            console.error('Error updating transaction:', error);
            alert(`Klaida atnaujinant: ${error.message}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Unexpected error in updateTransaction:', error);
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
            alert('Klaida: Vartotojas neprisijungęs!');
            return false;
        }
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
        
        if (error) {
            console.error('Error deleting transaction:', error);
            alert(`Klaida trinant: ${error.message}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Unexpected error in deleteTransaction:', error);
        alert('Netikėta klaida. Bandykite dar kartą.');
        return false;
    }
}

// =============================================================================
// SUPPORTED COINS
// =============================================================================

/**
 * Gauti visas vartotojo pridėtas monetas
 */
async function getSupportedCoins() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.warn('No user logged in');
            return [];
        }
        
        const { data, error } = await _supabase
            .from('supported_coins')
            .select('*')
            .eq('user_id', user.id)
            .order('symbol', { ascending: true });
        
        if (error) {
            console.error('Error fetching coins:', error);
            return [];
        }
        
        return data || [];
    } catch (error) {
        console.error('Unexpected error in getSupportedCoins:', error);
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
            alert('Klaida: Vartotojas neprisijungęs!');
            return false;
        }
        
        // Patikrinti ar moneta jau egzistuoja
        const existing = await _supabase
            .from('supported_coins')
            .select('id')
            .eq('user_id', user.id)
            .eq('symbol', coinData.symbol)
            .maybeSingle(); // Pakeista į maybeSingle, kad tvarkytų 0 ar 1 rezultatą
        
        if (existing.data) {
            alert(`Moneta ${coinData.symbol} jau egzistuoja!`);
            return false;
        }
        
        const { error } = await _supabase
            .from('supported_coins')
            .insert([{ ...coinData, user_id: user.id }]);
        
        if (error) {
            console.error('Error saving coin:', error);
            alert(`Klaida pridedant monetą: ${error.message}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Unexpected error in saveNewCoin:', error);
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
            alert('Klaida: Vartotojas neprisijungęs!');
            return false;
        }
        
        const { error } = await _supabase
            .from('supported_coins')
            .delete()
            .eq('symbol', symbol)
            .eq('user_id', user.id);
        
        if (error) {
            console.error('Error deleting coin:', error);
            alert(`Klaida trinant monetą: ${error.message}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Unexpected error in deleteSupportedCoin:', error);
        alert('Netikėta klaida. Bandykite dar kartą.');
        return false;
    }
}

// =============================================================================
// GOALS
// =============================================================================

/**
 * Gauti visus vartotojo tikslus
 */
async function getCryptoGoals() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.warn('No user logged in');
            return [];
        }
        
        const { data, error } = await _supabase
            .from('crypto_goals')
            .select('*')
            .eq('user_id', user.id);
        
        if (error) {
            console.error('Error fetching goals:', error);
            return [];
        }
        
        return data || [];
    } catch (error) {
        console.error('Unexpected error in getCryptoGoals:', error);
        return [];
    }
}

/**
 * Išsaugoti arba atnaujinti tikslą
 */
async function saveOrUpdateGoal(coinSymbol, targetAmount) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            alert('Klaida: Vartotojas neprisijungęs!');
            return false;
        }
        
        // Patikrinti ar tikslas jau egzistuoja
        const { data: existing } = await _supabase
            .from('crypto_goals')
            .select('id')
            .eq('user_id', user.id)
            .eq('coin_symbol', coinSymbol)
            .maybeSingle(); // Pakeista į maybeSingle
        
        if (existing) {
            // Atnaujinti esamą
            const { error } = await _supabase
                .from('crypto_goals')
                .update({ target_amount: targetAmount })
                .eq('id', existing.id);
            
            if (error) throw error;
        } else {
            // Sukurti naują
            const { error } = await _supabase
                .from('crypto_goals')
                .insert([{
                    user_id: user.id,
                    coin_symbol: coinSymbol,
                    target_amount: targetAmount
                }]);
            
            if (error) throw error;
        }
        
        return true;
    } catch (error) {
        console.error('Error saving goal:', error);
        alert(`Klaida išsaugant tikslą: ${error.message}`);
        return false;
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Patikrinti ar vartotojas prisijungęs
 */
async function isUserLoggedIn() {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        return !!session;
    } catch (error) {
        console.error('Error checking login status:', error);
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
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// =============================================================================
// CONSOLE INFO (Development only)
// =============================================================================

console.log('✅ Supabase initialized');
console.log('📊 Available functions:', {
    auth: ['userLogin', 'userSignUp', 'userSignOut'],
    transactions: ['getTransactions', 'saveTransaction', 'updateTransaction', 'deleteTransaction'],
    coins: ['getSupportedCoins', 'saveNewCoin', 'deleteSupportedCoin'],
    goals: ['getCryptoGoals', 'saveOrUpdateGoal'],
    utils: ['isUserLoggedIn', 'getCurrentUser']
});
