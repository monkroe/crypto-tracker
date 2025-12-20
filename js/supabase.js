// js/supabase.js - v3.1.0 (Robust Config)

// ⚠️ ĮKLIJUOKITE SAVO DUOMENIS ČIA:
// Replace these placeholders with your actual Supabase credentials from https://supabase.com/dashboard
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; // Example: 'https://xyzcompany.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW'; // Must be a JWT token starting with 'eyJ...'

// 1. Griežtesnė konfigūracijos patikra
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || 
    SUPABASE_URL.includes('YOUR_SUPABASE_URL_HERE') || 
    SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY_HERE') ||
    SUPABASE_URL.includes('JŪSŲ') || 
    SUPABASE_ANON_KEY.includes('JŪSŲ') ||
    !SUPABASE_ANON_KEY.startsWith('eyJ')) {
    console.error('❌ CRITICAL: SUPABASE CONFIG MISSING or INVALID in js/supabase.js');
    console.error('💡 The anon key must be a valid JWT token starting with "eyJ..."');
    console.error('💡 Get your credentials from: https://supabase.com/dashboard → Settings → API');
    // Stop execution so the developer sees the error
    throw new Error('⚠️ Set SUPABASE_URL and SUPABASE_ANON_KEY in js/supabase.js. Anon key must be a JWT token (starts with "eyJ").');
}

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabase = _supabase;

console.log('🔗 Supabase Connected v3.1.0');

// ======================================
// WEBAUTHN (Passkey)
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
        if (!credential) throw new Error('Failed');
        localStorage.setItem('webauthn_credential_id', arrayBufferToBase64(credential.rawId));
        localStorage.setItem('webauthn_enabled', 'true');
        return true;
    } catch (e) { console.error(e); alert('Error: ' + e.message); return false; }
};

window.removePasskey = async function() {
    localStorage.removeItem('webauthn_credential_id');
    localStorage.removeItem('webauthn_enabled');
    return true;
};

// ======================================
// AUTH & DATA
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

window.getTransactions = async function() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await _supabase.from('crypto_transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
        if (error) throw error; return data || [];
    } catch (e) { return []; }
};

window.saveTransaction = async function(txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        // Float protection
        const cleanData = { 
            ...txData, 
            amount: parseFloat(parseFloat(txData.amount).toFixed(8)), 
            price_per_coin: parseFloat(parseFloat(txData.price_per_coin).toFixed(8)), 
            total_cost_usd: parseFloat(parseFloat(txData.total_cost_usd).toFixed(2)), 
            user_id: user.id 
        };
        const { error } = await _supabase.from('crypto_transactions').insert([cleanData]);
        if (error) throw error; return true;
    } catch (e) { console.error(e); return false; }
};

window.deleteTransaction = async function(id) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('crypto_transactions').delete().eq('id', id).eq('user_id', user.id);
        if (error) throw error; return true;
    } catch (e) { return false; }
};

window.getSupportedCoins = async function() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await _supabase.from('supported_coins').select('*').eq('user_id', user.id);
        if (error) throw error; return data || [];
    } catch (e) { return []; }
};

window.saveNewCoin = async function(coinData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('supported_coins').insert([{ ...coinData, user_id: user.id }]);
        if (error) throw error; return true;
    } catch (e) { return false; }
};

window.deleteSupportedCoin = async function(symbol) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const { error } = await _supabase.from('supported_coins').delete().eq('user_id', user.id).eq('symbol', symbol);
        if (error) throw error; return true;
    } catch (e) { return false; }
};

window.getCryptoGoals = async function() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await _supabase.from('crypto_goals').select('*').eq('user_id', user.id);
        if (error) throw error; return data || [];
    } catch (e) { return []; }
};
