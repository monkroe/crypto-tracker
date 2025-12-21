// js/supabase.js - Corrected Table Names

const SUPABASE_URL = 'https://hciuercmhrxqxnndkvbs.supabase.co'; // Įrašykite savo URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjaXVlcmNtaHJ4cXhubmRrdmJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2Njg1NzAsImV4cCI6MjA4MTI0NDU3MH0.j5PLJI-8Brcx4q7wFXdmWcciRlBXS3Z2w9O50yAbDWs'; // Įrašykite savo KEY

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Padarome supabase objektą pasiekiamą globaliai (pvz. coin add funkcijai)
window.supabase = supabase;

// --- 1. GET DATA ---
window.getSupportedCoins = async function() {
    const { data, error } = await supabase.from('supported_coins').select('*');
    if (error) { console.error('Error fetching coins:', error); return []; }
    return data;
};

window.getTransactions = async function() {
    // Čia svarbu: crypto_transactions
    const { data, error } = await supabase.from('crypto_transactions').select('*');
    if (error) { console.error('Error fetching transactions:', error); return []; }
    return data;
};

window.getCryptoGoals = async function() {
    const { data, error } = await supabase.from('crypto_goals').select('*');
    if (error) { console.error('Error fetching goals:', error); return []; }
    return data;
};

// --- 2. TRANSACTIONS (CRUD) ---
window.addTransaction = async function(txData) {
    const { data, error } = await supabase.from('crypto_transactions').insert([txData]).select();
    if (error) throw error;
    return data;
};

window.updateTransaction = async function(id, txData) {
    const { data, error } = await supabase.from('crypto_transactions').update(txData).eq('id', id).select();
    if (error) throw error;
    return data;
};

window.deleteTransaction = async function(id) {
    const { error } = await supabase.from('crypto_transactions').delete().eq('id', id);
    if (error) throw error;
};

// --- 3. GOALS (CRUD) ---
window.addGoal = async function(goalData) {
    const { data, error } = await supabase.from('crypto_goals').insert([goalData]).select();
    if (error) throw error;
    return data;
};

window.updateGoal = async function(id, targetAmount) {
    const { data, error } = await supabase.from('crypto_goals').update({ target_amount: targetAmount }).eq('id', id).select();
    if (error) throw error;
    return data;
};

window.deleteGoal = async function(id) {
    const { error } = await supabase.from('crypto_goals').delete().eq('id', id);
    if (error) throw error;
};

window.deleteSupportedCoin = async function(symbol) {
    const { error } = await supabase.from('supported_coins').delete().eq('symbol', symbol);
    if (error) return false;
    return true;
};
