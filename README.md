# 🚀 Crypto Tracker v2.0.3

Profesionalus kriptovaliutų portfelio valdymo įrankis su interaktyviais grafikais, biometrine autentifikacija ir automatine tema.

## ✨ Pagrindinės Funkcijos

- **Advanced Charting:** Interaktyvus PnL grafikas su laiko filtrais (1W, 1M, 3M, 6M, 1Y, 5Y, ALL) ir vizualiniais patobulinimais.
- **Portfelio sekimas:** Realaus laiko kainos, PnL skaičiavimas, turto paskirstymas.
- **Saugumas:** Pilna XSS apsauga, RLS duomenų bazės politika, saugus CSV nuskaitymas.
- **Biometrinis prisijungimas:** Face ID / Touch ID / Windows Hello palaikymas (Local Device Lock).
- **UI/UX:** Automatinė šviesi/tamsi tema, "Toast" pranešimai, pritaikytas dizainas mobiliesiems.

## 🛠️ Setup Instrukcijos

### 1. Supabase Konfigūracija

Eikite į [Supabase SQL Editor](https://supabase.com/dashboard) ir paleiskite šį kodą (jei dar nesukūrėte lentelių):

```sql
-- ===============================================
-- 1. SUPPORTED_COINS LENTELĖ
-- ===============================================
CREATE TABLE supported_coins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    symbol TEXT NOT NULL,
    coingecko_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_coin UNIQUE(user_id, symbol)
);

CREATE INDEX idx_supported_coins_user ON supported_coins(user_id);
ALTER TABLE supported_coins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coins" ON supported_coins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own coins" ON supported_coins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own coins" ON supported_coins FOR DELETE USING (auth.uid() = user_id);

-- ===============================================
-- 2. CRYPTO_TRANSACTIONS LENTELĖ
-- ===============================================
CREATE TABLE crypto_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    type TEXT NOT NULL,
    coin_symbol TEXT NOT NULL,
    exchange TEXT,
    method TEXT,
    notes TEXT,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    price_per_coin NUMERIC NOT NULL CHECK (price_per_coin >= 0),
    total_cost_usd NUMERIC NOT NULL CHECK (total_cost_usd >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON crypto_transactions(user_id, date DESC);
ALTER TABLE crypto_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON crypto_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON crypto_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON crypto_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON crypto_transactions FOR DELETE USING (auth.uid() = user_id);

-- ===============================================
-- 3. CRYPTO_GOALS LENTELĖ
-- ===============================================
CREATE TABLE crypto_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    coin_symbol TEXT NOT NULL,
    target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_goal UNIQUE(user_id, coin_symbol)
);

ALTER TABLE crypto_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals" ON crypto_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON crypto_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON crypto_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON crypto_goals FOR DELETE USING (auth.uid() = user_id);
```
### 2. Projekto Failai
​Faile js/supabase.js įrašykite savo projekto duomenis:

```javascript 
const SUPABASE_URL = '[https://jusu-projektas.supabase.co](https://jusu-projektas.supabase.co)';
const SUPABASE_ANON_KEY = 'jusu-anon-public-key';
```
### 3. WebAuthn (Passkey) Reikalavimai
​Kad veiktų Face ID / Touch ID, projektas privalo būti talpinamas serveryje su HTTPS (pvz., Vercel, Netlify, GitHub Pages) arba testuojamas per localhost.

​📊 CSV Importo Formatas
​Rekomenduojamas formatas importavimui:

```csv
Data,Tipas,Moneta,Kiekis,Kaina,Viso USD,Birža,Metodas,Pastabos
2025-12-25,Buy,BTC,0.005,95000,475,Binance,Market Buy,Kalėdinis pirkimas
2025-12-26,Sell,ETH,1.5,4500,6750,Kraken,Limit Sell,Pelnas
```
© 2025 LTV Media PRO
