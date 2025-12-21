// js/supabase.js - v3.0.0
// Includes: Goals CRUD, Transaction Updates, WebAuthn

// ======================================
// 1. CONFIGURATION
// ======================================
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjaXVlcmNtaHJ4cXhubmRrdmJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2Njg1NzAsImV4cCI6MjA4MTI0NDU3MH0.j5PLJI-8Brcx4q7wFXdmWcciRlBXS3Z2w9O50yAbDWs';

// Safety Check
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_SUPABASE')) {
    console.error('❌ CRITICAL: Supabase credentials missing in js/supabase.js');
    throw new Error('Supabase URL or Key is missing.');
}

// Initialize Client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabase = _supabase;
console.log('🔗 Supabase Connected v3.0.0');

// ======================================
// 2. WEBAUTHN (Passkey) UTILS
// ======================================
function stringToUint8Array(str) { return new TextEncoder().encode(str); }
function arrayBufferToBase64(buffer) {
    let binary = ''; const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

window.isWebAuthnSupported = function() {
    return window.PublicKeyCredential !== undefined && navigator.credentials !== undefined;
};

window.hasPasskey = async function() {
    if (!window.isWebAuthnSupported()) return false;
    return localStorage.getItem('webauthn_enabled') === 'true';
};

window.registerPasskey = async function() {
    if (!window.isWebAuthnSupported()) { alert('Device not supported'); return false; }
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        if (!confirm('Passkey bus išsaugotas tik šiame įrenginyje. Tęsti?')) return false;
        
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: challenge,
                rp: { name: 'Crypto Tracker', id: window.location.hostname },
                user: { id: stringToUint8Array(user.id), name: user.email, displayName: user.email },
                pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
                authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
                timeout: 60000, attestation: 'none'
            }
        });
        
        if (!credential) throw new Error('Failed to create credential');
        
        localStorage.setItem('webauthn_credential_id', arrayBufferToBase64(credential.rawId));
        localStorage.setItem('webauthn_enabled', 'true');
        return true;
    } catch (e) { 
        console.error(e); 
        alert('Error: ' + e.message); 
        return false; 
    }
};

window.removePasskey = async function() {
    localStorage.removeItem('webauthn_credential_id');
    localStorage.removeItem('webauthn_enabled');
    return true;
};

// ======================================
// 3. AUTHENTICATION
// ======================================
window.userSignUp = async function(email, password) {
    try { return await _supabase.auth.signUp({ email, password }); } catch (e) { return { error: e }; }
};

window.userLogin = async function(email, password) {
    try { return await _supabase.auth.signInWithPassword({ email, password }); } catch (e) { return { error: e }; }
};

window.userSignOut = async function() {
    try { return await _supabase.auth.signOut(); } catch (e) { return { error: e }; }
};

// ======================================
// 4. TRANSACTIONS
// ======================================
window.getTransactions = async function() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await _supabase.from('crypto_transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
        if (error) throw error; return data || [];
    } catch (e) { console.error('getTransactions error:', e); return []; }
};

window.saveTransaction = async function(txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const cleanData = { 
            ...txData, 
            amount: parseFloat(parseFloat(txData.amount).toFixed(8)), 
            price_per_coin: parseFloat(parseFloat(txData.price_per_coin).toFixed(8)), 
            total_cost_usd: parseFloat(parseFloat(txData.total_cost_usd).toFixed(2)), 
            user_id: user.id 
        };
        
        const { error } = await _supabase.from('crypto_transactions').insert([cleanData]);
        if (error) throw error; 
        return true;
    } catch (e) { console.error('saveTransaction error:', e); return false; }
};

// ✅ FIX: Update function (Better than Delete+Insert)
window.updateTransaction = async function(id, txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const cleanData = { 
            date: txData.date,
            type: txData.type,
            coin_symbol: txData.coin_symbol,
            amount: parseFloat(parseFloat(txData.amount).toFixed(8)), 
            price_per_coin: parseFloat(parseFloat(txData.price_per_coin).toFixed(8)), 
            total_cost_usd: parseFloat(parseFloat(txData.total_cost_usd).toFixed(2)),
            exchange: txData.exchange,
            method: txData.method,
            notes: txData.notes
        };
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .update(cleanData)
            .eq('id', id)
            .eq('user_id', user.id);
            
        if (error) throw error;
        return true;
    } catch (e) { 
        console.error('updateTransaction error:', e); 
        return false; 
    }
};

window.deleteTransaction = async function(id) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('crypto_transactions').delete().eq('id', id).eq('user_id', user.id);
        if (error) throw error; 
        return true;
    } catch (e) { console.error('deleteTransaction error:', e); return false; }
};

// ======================================
// 5. SUPPORTED COINS (Watchlist)
// ======================================
window.getSupportedCoins = async function() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await _supabase.from('supported_coins').select('*').eq('user_id', user.id);
        if (error) throw error; 
        return data || [];
    } catch (e) { console.error('getSupportedCoins error:', e); return []; }
};

window.saveNewCoin = async function(coinData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('supported_coins').insert([{ ...coinData, user_id: user.id }]);
        if (error) throw error; 
        return true;
    } catch (e) { console.error('saveNewCoin error:', e); return false; }
};

window.deleteSupportedCoin = async function(symbol) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('supported_coins').delete().eq('user_id', user.id).eq('symbol', symbol);
        if (error) throw error; 
        return true;
    } catch (e) { console.error('deleteSupportedCoin error:', e); return false; }
};

// ======================================
// 6. CRYPTO GOALS (New v3.0 Features)
// ======================================
window.getCryptoGoals = async function() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await _supabase.from('crypto_goals').select('*').eq('user_id', user.id);
        if (error) throw error; 
        return data || [];
    } catch (e) { console.error('getCryptoGoals error:', e); return []; }
};

// ✅ FIX: Create new goal
window.saveCryptoGoal = async function(goalData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const cleanData = {
            coin_symbol: goalData.coin_symbol,
            target_amount: parseFloat(goalData.target_amount),
            user_id: user.id
        };
        
        const { error } = await _supabase.from('crypto_goals').insert([cleanData]);
        if (error) throw error;
        return true;
    } catch (e) { 
        console.error('saveCryptoGoal error:', e); 
        return false; 
    }
};

// ✅ FIX: Update existing goal
window.updateCryptoGoal = async function(goalId, newTargetAmount) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const { error } = await _supabase
            .from('crypto_goals')
            .update({ target_amount: parseFloat(newTargetAmount) })
            .eq('id', goalId)
            .eq('user_id', user.id);
            
        if (error) throw error;
        return true;
    } catch (e) { 
        console.error('updateCryptoGoal error:', e); 
        return false; 
    }
};

// ✅ FIX: Delete goal
window.deleteCryptoGoal = async function(goalId) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const { error } = await _supabase
            .from('crypto_goals')
            .delete()
            .eq('id', goalId)
            .eq('user_id', user.id);
            
        if (error) throw error;
        return true;
    } catch (e) { 
        console.error('deleteCryptoGoal error:', e); 
        return false; 
    }
};
