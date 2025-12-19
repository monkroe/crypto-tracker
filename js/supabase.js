// js/supabase.js - Versija 2.0.0 (Security + WebAuthn + Bulk Operations)

// ======================================
// 1. SUPABASE KONFIGŪRACIJA
// ======================================
// PAKEISKITE ŠIUOS DUOMENIS SAVO SUPABASE KREDENCIALAIS:
const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; // Pvz: https://xyz.supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_2Mie2DLsYQgNxshA3Z8hVA_tBzvLOZW'; // Tik anon key!

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔗 Supabase initialized v2.0.0');

// ======================================
// 2. AUTENTIFIKACIJA
// ======================================
async function userSignUp(email, password) {
    try {
        const result = await _supabase.auth.signUp({ 
            email, 
            password 
        });
        return result;
    } catch (e) {
        console.error('Sign up error:', e);
        return { data: null, error: e };
    }
}

async function userLogin(email, password) {
    try {
        const result = await _supabase.auth.signInWithPassword({ 
            email, 
            password 
        });
        return result;
    } catch (e) {
        console.error('Login error:', e);
        return { data: null, error: e };
    }
}

async function userSignOut() {
    try {
        const { error } = await _supabase.auth.signOut();
        return { error };
    } catch (e) {
        console.error('Sign out error:', e);
        return { error: e };
    }
}

// ======================================
// 3. WEBAUTHN / PASSKEY PALAIKYMAS
// ======================================

/**
 * Patikrina ar įrenginys palaiko WebAuthn
 */
function isWebAuthnSupported() {
    return window.PublicKeyCredential !== undefined && 
           navigator.credentials !== undefined;
}

/**
 * Patikrina ar vartotojas turi užregistruotą passkey (supaprastinta versija)
 * Tikram gamybiniam naudojimui reikėtų tikrinti serverio pusėje.
 */
async function hasPasskey() {
    if (!isWebAuthnSupported()) return false;
    
    // Tikriname vietinį indikatorių, nes naršyklė neleidžia tiesiogiai "paklausti" ar yra raktas
    // be vartotojo interakcijos.
    return localStorage.getItem('webauthn_enabled') === 'true';
}

/**
 * Registruoja naują passkey
 */
async function registerPasskey() {
    if (!isWebAuthnSupported()) {
        alert('❌ Jūsų įrenginys nepalaiko Passkey/Face ID.');
        return false;
    }
    
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        // Generuojame atsitiktinį challenge
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        // 1. Sukuriame WebAuthn credential
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: challenge,
                rp: {
                    name: 'Crypto Tracker',
                    id: window.location.hostname
                },
                user: {
                    id: stringToUint8Array(user.id),
                    name: user.email,
                    displayName: user.email
                },
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' },  // ES256
                    { alg: -257, type: 'public-key' } // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform', // Face ID / Touch ID
                    userVerification: 'required',
                    requireResidentKey: false
                },
                timeout: 60000,
                attestation: 'none'
            }
        });
        
        if (!credential) throw new Error('Credential creation failed');
        
        // 2. Išsaugome ID lokaliai
        // Pastaba: Tikram saugumui credential ID ir public key reiktų siųsti į serverį
        localStorage.setItem('webauthn_credential_id', arrayBufferToBase64(credential.rawId));
        localStorage.setItem('webauthn_enabled', 'true');
        
        console.log('✅ Passkey registered locally');
        return true;
        
    } catch (e) {
        console.error('❌ Passkey registration error:', e);
        if (e.name !== 'NotAllowedError') {
            alert('Klaida registruojant Passkey: ' + e.message);
        }
        return false;
    }
}

/**
 * Prisijungimas su passkey
 */
async function loginWithPasskey() {
    if (!isWebAuthnSupported()) {
        return { data: null, error: new Error('WebAuthn not supported') };
    }
    
    try {
        const credentialId = localStorage.getItem('webauthn_credential_id');
        
        if (!credentialId) {
            throw new Error('No passkey registered');
        }
        
        // Generuojame atsitiktinį challenge
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        // 1. Gaunamas credential iš įrenginio
        const credential = await navigator.credentials.get({
            publicKey: {
                challenge: challenge,
                rpId: window.location.hostname,
                userVerification: 'required',
                allowCredentials: [{
                    type: 'public-key',
                    id: base64ToUint8Array(credentialId),
                    transports: ['internal']
                }]
            }
        });
        
        if (!credential) throw new Error('Credential retrieval failed');
        
        console.log('✅ Biometric check passed');
        
        // Čia simuliuojame prisijungimą.
        // SVARBU: Kadangi Supabase JS klientas dar neturi pilno client-side Passkey login palaikymo be serverio,
        // mes naudojame tai kaip "2-ąjį faktorių" arba patogumo priemonę.
        // Jei sesija galioja - tiesiog leidžiame. Jei ne - vartotojas turės įvesti slaptažodį.
        
        const { data: { session } } = await _supabase.auth.getSession();
        if (session) {
            return { data: { session }, error: null };
        } else {
            // Jei sesijos nėra, WebAuthn vienas pats (be serverio) negali išduoti naujo tokeno.
            // Reikėtų naudoti Supabase MFA API, bet tai sudėtingiau.
            // Šiuo atveju grąžiname klaidą, kad reikia prisijungti su slaptažodžiu.
            alert("Saugumo sumetimais, prašome vieną kartą prisijungti su slaptažodžiu, kad atnaujintumėte sesiją.");
            return { data: null, error: new Error('Session expired') };
        }
        
    } catch (e) {
        console.error('❌ Passkey login error:', e);
        return { data: null, error: e };
    }
}

/**
 * Išregistruoja passkey
 */
async function removePasskey(factorId) {
    try {
        localStorage.removeItem('webauthn_credential_id');
        localStorage.removeItem('webauthn_enabled');
        console.log('✅ Passkey removed');
        return true;
    } catch (e) {
        console.error('❌ Remove passkey error:', e);
        return false;
    }
}

// ======================================
// 4. TRANSAKCIJOS
// ======================================
async function getTransactions() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [];
        
        const { data, error } = await _supabase
            .from('crypto_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Get transactions error:', e);
        return [];
    }
}

async function saveTransaction(txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .insert([{ ...txData, user_id: user.id }]);
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Save transaction error:', e);
        throw e; // Leisti app.js pagauti klaidą
    }
}

/**
 * Masinis transakcijų išsaugojimas (CSV importui)
 */
async function saveMultipleTransactions(txArray) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        // Pridedame user_id prie kiekvieno įrašo
        const dataWithUser = txArray.map(tx => ({ 
            ...tx, 
            user_id: user.id 
        }));
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .insert(dataWithUser);
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Bulk save error:', e);
        throw e;
    }
}

async function updateTransaction(id, txData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .update(txData)
            .eq('id', id)
            .eq('user_id', user.id);
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Update transaction error:', e);
        throw e;
    }
}

async function deleteTransaction(id) {
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
        console.error('Delete transaction error:', e);
        throw e;
    }
}

/**
 * Masinis transakcijų trynimas (NAUJA - Optimizuota)
 */
async function deleteMultipleTransactions(ids) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const { error } = await _supabase
            .from('crypto_transactions')
            .delete()
            .in('id', ids)
            .eq('user_id', user.id);
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Bulk delete error:', e);
        throw e;
    }
}

// ======================================
// 5. MONETOS
// ======================================
async function getSupportedCoins() {
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
}

async function saveNewCoin(coinData) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        const { error } = await _supabase
            .from('supported_coins')
            .insert([{ ...coinData, user_id: user.id }]);
        
        if (error) throw error;
        return true;
    } catch (e) {
        // Ignoruojame unikalumo klaidą (jei moneta jau yra)
        if (e.code !== '23505') { 
            throw e;
        }
        return false;
    }
}

async function deleteSupportedCoin(symbol) {
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
        throw e;
    }
}

// ======================================
// 6. TIKSLAI
// ======================================
async function getCryptoGoals() {
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
}

async function saveOrUpdateGoal(symbol, target) {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return false;
        
        // Upsert funkcija (įterpia arba atnaujina)
        const { error } = await _supabase
            .from('crypto_goals')
            .upsert({ 
                coin_symbol: symbol, 
                target_amount: target, 
                user_id: user.id 
            }, { 
                onConflict: 'user_id,coin_symbol' 
            });
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Save goal error:', e);
        return false;
    }
}

// ======================================
// 7. HELPER FUNKCIJOS (WebAuthn)
// ======================================
function base64ToUint8Array(base64) {
    const binary = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function stringToUint8Array(str) {
    return new TextEncoder().encode(str);
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

console.log('✅ Supabase.js loaded successfully v2.0.0');
