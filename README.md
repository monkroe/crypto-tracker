# 🚀 Crypto Tracker v3.0.0

Profesionalus kriptovaliutų portfelio valdymo įrankis su **Modular JS** architektūra, tikslia PnL matematika ir Supabase integracija.

## ✨ Naujienos v3.0.0

- **Modular Architecture:** Kodas išskaidytas į loginius modulius (`logic.js`, `ui.js`, `utils.js`), todėl jį lengva prižiūrėti ir plėsti.
- **Fixed PnL Logic:** Ištaisyta "Average Buy Price" skaičiavimo klaida parduodant turtą. Dabar savikaina mažėja proporcingai, o ne pagal pardavimo kainą.
- **Optimized Performance:** Atskirtas UI renderinimas nuo duomenų apdorojimo.

## ✨ Pagrindinės Funkcijos

- **Portfelio sekimas:** Realaus laiko kainos, PnL skaičiavimas, turto paskirstymas (Allocation Chart).
- **Saugumas:** XSS apsauga, RLS duomenų bazės politika.
- **Biometrinis prisijungimas:** Face ID / Touch ID palaikymas (Local Device Lock).
- **UI/UX:** Automatinė šviesi/tamsi tema, "Toast" pranešimai, pritaikytas dizainas mobiliesiems.

## 🛠️ Projekto Struktūra (Nauja)

```text
/
├── index.html          # Pagrindinis UI failas
├── js/
│   ├── app.js          # "Klijai" - sujungia logiką ir UI
│   ├── logic.js        # Matematika, duomenų apdorojimas (Business Logic)
│   ├── ui.js           # Grafikai, lentelės, DOM manipuliacijos
│   ├── utils.js        # Pagalbinės funkcijos (Formatteriai, Logger)
│   └── supabase.js     # API sluoksnis (Global Window Scope)
└── ...
```
🛠️ Setup Instrukcijos
​1. Supabase Konfigūracija
​Eikite į Supabase SQL Editor ir įsitikinkite, kad sukurtos supported_coins, crypto_transactions ir crypto_goals lentelės (žr. senesnes versijas SQL kodui).
​2. Projekto Failai
​Faile js/supabase.js būtinai įrašykite savo projekto duomenis:
```const SUPABASE_URL = '[https://jusu-projektas.supabase.co](https://jusu-projektas.supabase.co)';
const SUPABASE_ANON_KEY = 'jusu-anon-public-key';
```
3. Paleidimas
​Kadangi naudojami ES6 moduliai (type="module"), projektą būtina leisti per serverį (Localhost arba Vercel/Netlify). Tiesioginis failo atidarymas (file://) neveiks dėl CORS politikos.

​© 2025 LTV Media PRO
