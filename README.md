# 🚀 Crypto Tracker v3.0.3

Profesionalus kriptovaliutų portfelio valdymo įrankis su **Modular JS** architektūra, tikslia PnL matematika ir Supabase integracija.

## ✨ Naujienos v3.0.3

- **🔧 Config Validation:** Supabase.js dabar automatiškai tikrina konfigūraciją ir rodo aiškias klaidas
- **🧮 Calculator Fix:** Pataisytas skaičiuotuvo timing bug'as modaluose
- **⚡ Performance:** Optimizuotas DOM rendering su DocumentFragment
- **🛡️ Security:** Pridėtas input sanitization prieš saugant į DB
- **📊 GET PRICE:** Dabar veikia automatinis kainos gavimas iš CoinGecko

## ✨ Pagrindinės Funkcijos

- **Portfelio sekimas:** Realaus laiko kainos, PnL skaičiavimas, turto paskirstymas (Allocation Chart)
- **Saugumas:** XSS apsauga, RLS duomenų bazės politika, input validation
- **Biometrinis prisijungimas:** Face ID / Touch ID palaikymas (Local Device Lock)
- **UI/UX:** Automatinė šviesi/tamsi tema, "Toast" pranešimai, pritaikytas dizainas mobiliesiems
- **Smart Calculator:** Automatinis Amount/Price/Total skaičiavimas formuose

## 🛠️ Projekto Struktūra

```text
/
├── index.html          # Pagrindinis UI failas
├── js/
│   ├── app.js          # "Klijai" - sujungia logiką ir UI (v3.0.3)
│   ├── logic.js        # Matematika, duomenų apdorojimas (Fixed PnL)
│   ├── ui.js           # Grafikai, lentelės, DOM manipuliacijos (v3.0.3)
│   ├── utils.js        # Pagalbinės funkcijos (Formatteriai, Logger)
│   └── supabase.js     # API sluoksnis (v3.0.3 - Config Validation)
├── README.md
└── CHANGES.md
```

## 🚀 Quick Start

### 1. Supabase Konfigūracija

**SVARBU:** Prieš paleidžiant, būtina sukonfigūruoti Supabase:

1. Eikite į [Supabase Dashboard](https://supabase.com/dashboard)
2. Pasirinkite projektą (arba sukurkite naują)
3. Eikite į **Settings** → **API**
4. Nukopijuokite:
   - **Project URL** (pvz: `https://xyzcompany.supabase.co`)
   - **anon/public key** (prasideda `eyJhbG...`)

5. Atidarykite `js/supabase.js` failą ir įklijuokite:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 2. Duomenų Bazės Schema

Supabase SQL Editor'yje įvykdykite:

```sql
-- 1. Supported Coins Table
CREATE TABLE supported_coins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    coingecko_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE supported_coins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own coins" ON supported_coins
    FOR ALL USING (auth.uid() = user_id);

-- 2. Transactions Table
CREATE TABLE crypto_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    coin_symbol TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    price_per_coin NUMERIC NOT NULL,
    total_cost_usd NUMERIC NOT NULL,
    exchange TEXT,
    method TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crypto_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions" ON crypto_transactions
    FOR ALL USING (auth.uid() = user_id);

-- 3. Goals Table
CREATE TABLE crypto_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    coin_symbol TEXT NOT NULL,
    target_amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crypto_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own goals" ON crypto_goals
    FOR ALL USING (auth.uid() = user_id);
```

### 3. Paleidimas Lokaliai

Kadangi naudojami ES6 moduliai (`type="module"`), projektą **būtina** paleisti per serverį:

#### Option 1: Python (rekomenduojama)
```bash
# Python 3.x
python -m http.server 8000

# Atidarykite: http://localhost:8000
```

#### Option 2: Node.js
```bash
npx serve .
# arba
npx http-server -p 8000
```

#### Option 3: VS Code Extension
Įdiekite **Live Server** extension ir spustelėkite "Go Live"

⚠️ **NEVEIKS:** Tiesioginis failo atidarymas (`file:///...`) dėl CORS politikos

### 4. Production Deployment

#### Vercel (rekomenduojama)
```bash
npm i -g vercel
vercel
```

#### Netlify
1. Drag & drop projekto folderį į [Netlify Drop](https://app.netlify.com/drop)
2. Arba naudokite Netlify CLI

#### GitHub Pages
⚠️ Reikia pridėti `.nojekyll` failą root directory'je

## 🎯 Kaip Naudotis

### Pridėti Monetą
1. Scroll žemyn iki "Manage Coins"
2. Spauskite **"Add New Coin"**
3. Įveskite:
   - **Symbol:** BTC, ETH, SOL (didžiosios raidės)
   - **CoinGecko ID:** bitcoin, ethereum, solana ([Ieškoti čia](https://www.coingecko.com/))
   - **Target Goal:** 100000 (pasirenkamas)

### Pridėti Transakciją
1. Spauskite **"+ Add Transaction"**
2. Pasirinkite tipą (Buy/Sell)
3. Įveskite du iš trijų laukų (Amount/Price/Total), trečias skaičiuosis automatiškai
4. Arba spauskite **"GET PRICE"** dabartinei kainai
5. Pasirinkite exchange ir metodą
6. **Save Transaction**

### Export/Import CSV
- **Export:** Spauskite "Export CSV" po Transaction History
- **Import:** Spauskite "Import CSV" ir pasirinkite failą

CSV Formatas:
```csv
date,type,coin_symbol,amount,price_per_coin,total_cost_usd,exchange,method,notes
2024-01-15T10:30:00Z,Buy,BTC,0.5,45000,22500,Binance,Market Buy,First purchase
```

## 🐛 Troubleshooting

### Klaida: "Supabase Konfigūracija Trūksta"
✅ **Sprendimas:** Patikrinkite ar teisingai įklijuoti `SUPABASE_URL` ir `SUPABASE_ANON_KEY` į `js/supabase.js`

### Klaida: "Failed to load module"
✅ **Sprendimas:** Paleidžiate per `file://` protokolą. Naudokite lokalų serverį (žr. Paleidimas Lokaliai)

### Kainos nesiatnaujina
✅ **Sprendimas:** Patikrinkite CoinGecko ID - turi būti tiksliai kaip [coingecko.com](https://www.coingecko.com/) (pvz: "bitcoin", ne "BTC")

### Calculator neveikia
✅ **Sprendimas:** v3.0.3 versijoje pataisyta. Atnaujinkite `ui.js` ir `app.js`

## 📊 Changelog

Visa pakeitimų istorija: [CHANGES.md](CHANGES.md)

## 🔒 Saugumas

- ✅ **RLS Enabled:** Row Level Security užtikrina, kad vartotojai mato tik savo duomenis
- ✅ **XSS Protection:** Visi input'ai sanitizuojami prieš saugant
- ✅ **No API Keys Exposure:** Anon key yra public, bet protected per RLS
- ✅ **Biometric Lock:** WebAuthn palaikymas Face ID / Touch ID

## 📞 Support

Jei radote bug'ą ar turite klausimų:
1. Patikrinkite [CHANGES.md](CHANGES.md) changelog'ą
2. Perskaitykite Troubleshooting sekciją
3. Patikrinkite browser console (`F12`) klaidoms

## 📄 License

© 2025 LTV Media PRO. Visos teisės saugomos.

---

**Version:** 3.0.3  
**Last Updated:** 2025-12-20  
**Compatibility:** Modern browsers (Chrome 90+, Safari 14+, Firefox 88+)
