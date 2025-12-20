// js/supabase.js - v3.0.2 (Fix: Global Exports)

// ⚠️ ĮKLIJUOKITE SAVO DUOMENIS ČIA:
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW';

if (SUPABASE_URL.includes('JŪSŲ') || SUPABASE_ANON_KEY.includes('JŪSŲ')) {
    console.error('❌ TRŪKSTA SUPABASE RAKTŲ! Įrašykite juos js/supabase.js faile.');
}

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabase = _supabase;

console.log('🔗 Supabase Connected v3.0.2');

// ======================================
// 1. GLOBAL UTILS (WEBAUTHN) - PATAISYTA
// ======================================

// Helperiai, kad nereiktų kartoti
function stringToUint8Array(str) { return new TextEncoder().encode(str); }
function arrayBufferToBase64(buffer) {
    let binary = ''; const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}
function base64ToUint8Array(base64) {
    const binary = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// EKSPORTUOJAME Į WINDOW, KAD MATYTŲ app.js
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
// 2. AUTH & DATA (Be pakeitimų)
// ======================================

window.userSignUp = async function(email, password) {
    try { return await _supabase.auth.signUp({ email, password }); } 
    catch (e) { return { error: e }; }
};

window.userLogin = async function(email, password) {
    try { return await _supabase.auth.signInWithPassword({ email, password }); } 
    catch (e) { return { error: e }; }
};

window.userSignOut = async function() {
    try { return await _supabase.auth.signOut(); } 
    catch (e) { return { error: e }; }
};

window.getTransactions = async function() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await _supabase.from('crypto_transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
        if (error) throw error; return data || [];
    } catch (e) { console.error(e); return []; }
};

window.saveTransaction = async function(txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        const cleanData = { ...txData, amount: parseFloat(txData.amount), price_per_coin: parseFloat(txData.price_per_coin), total_cost_usd: parseFloat(txData.total_cost_usd), user_id: user.id };
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
    } catch (e) { console.error(e); return false; }
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
