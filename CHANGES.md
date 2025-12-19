# Changelog

Visa projekto pakeitimų istorija.

## [v2.0.0] - 2025-12-19 (Final Release)
Didysis atnaujinimas su biometrine autentifikacija ir duomenų bazės saugumu.

### 🚀 Naujos Funkcijos
- **WebAuthn / Passkey:** Face ID, Touch ID ir Windows Hello integracija prisijungimui.
- **Settings Modal:** Naujas nustatymų langas biometrijos valdymui.
- **Toast Notifications:** Modernūs pranešimai apie veiksmus (vietoj `alert()`).
- **UI:** Pridėta "Select All" varnelė masiniam žymėjimui.

### 🔒 Saugumas
- **RLS (Row Level Security):** Duomenų bazė užrakinta. Vartotojai mato tik savo įrašus.
- **Anon Key:** Perėjimas prie saugaus viešo rakto naudojimo.

---

## [v1.9.11] - 2025-12-18 (Performance Update)
Optimizuotas veikimas dideliems duomenų kiekiams.

### ⚡ Optimizacija
- **Bulk Delete:** Transakcijų trynimas dabar vyksta viena užklausa (`.in()`), o ne ciklu. Greitis padidėjo ~20 kartų.
- **Event Delegation:** Pataisytas atminties nutekėjimas ir checkbox'ų veikimas akordeonuose.
- **API Cache:** Kainų užklausos saugomos 1 min., kad nebūtų viršytas CoinGecko limitas.
- **Debounce:** Skaičiuoklė nebestabdo naršyklės rašant skaičius.

---

## [v1.9.10] - 2025-12-18 (Security Hotfix)
Kritinis saugumo atnaujinimas.

### 🐛 Ištaisytos Klaidos
- **XSS Fix:** Panaikintas `innerHTML` naudojimas transakcijų atvaizdavime.
- **Sanitization:** Pridėta `sanitizeText()` funkcija vartotojo įvesčiai valyti.

---

## [v1.9.9] - 2025-12-17 (CSV Logic Fix)
Duomenų importo taisymas.

### 🐛 Ištaisytos Klaidos
- **CSV Importas:** Pataisyta logika, kai `Exchange` ir `Method` stulpeliai susimaišydavo.
- **Smart Parsing:** Sistema dabar atpažįsta "Recurring Buy" iš pastabų laukelio.

---

## [v1.0.0] - 2025-12-13 (Project Start)
Projekto pradžia.

### ✨ Funkcijos
- Prisijungimas su el. paštu.
- Rankinis transakcijų pridėjimas.
- Portfelio vertės skaičiavimas realiu laiku.
- Pelnas/Nuostolis (PnL) grafikas.
- Turto pasiskirstymo (Allocation) "donatų" diagrama.
