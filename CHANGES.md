# Changelog

Visa projekto pakeitimų istorija.

## [v4.4.0] - 2025-12-20 (Architecture Overhaul)
Esminis kodo perrašymas ir logikos taisymas. Perėjimas prie modulinės sistemos.

### 🏗️ Architektūra
- **Modular JS:** Didžiulis `app.js` failas išskaidytas į 4 atskirus failus:
  - `logic.js`: Atsakingas tik už matematiką ir duomenų būseną.
  - `ui.js`: Atsakingas tik už vaizdavimą (HTML generavimą).
  - `utils.js`: Bendrosios funkcijos (formatavimas, debug).
  - `app.js`: Inicijavimas ir įvykių valdymas.
- **ES6 Modules:** Pradėtas naudoti `import`/`export` standartas švaresniam kodui.

### ⚡ Logika (Critical Fixes)
- **Cost Basis Correction:** Ištaisyta kritinė klaida skaičiuojant "Average Buy Price" po pardavimo (`Sell`). Dabar sistema teisingai mažina investuotą sumą proporcingai parduotam kiekiui, išlaikydama tikslią likusių monetų savikainą.
- **Supabase Global Scope:** `supabase.js` pritaikytas veikti su moduliais, eksportuojant funkcijas į `window` objektą.

### 📉 UI/UX
- **Simplified Charts:** Laikinai supaprastintas istorinis grafikas, siekiant išvengti klaidinančių istorinių verčių atvaizdavimo (kai nežinoma tiksli istorinė kaina).
- **Cleaner Code:** Pašalintas perteklinis kodas, optimizuotas DOM atnaujinimas.

---

## [v2.0.3] - 2025-12-19 (Advanced Charting Update)
Didelis grafinės sąsajos atnaujinimas, orientuotas į profesionalų duomenų atvaizdavimą.

### 📈 Grafikai ir Vizualizacija
- **Timeframe Selectors:** Pridėti filtrai: 1W, 1M, 3M, 6M, 1Y, 5Y, ALL.
- **Smooth Curves:** Grafiko linija naudoja `tension: 0.4`.
- **Gradient Fill:** Modernus permatomas gradientas po grafiko linija.

---

## [v2.0.2] - 2025-12-19 (Quality Assurance)
- **Bugfix:** Ištaisyta dvigubų ikonų klaida "Toast" pranešimuose.
- **CSV:** Pataisytas skaičių formatavimas importuojant.

## [v2.0.0] - 2025-12-19 (Final Release v2)
- **WebAuthn:** Biometrinis prisijungimas.
- **RLS:** Duomenų bazės saugumas.

## [v1.0.0] - 2025-12-13 (Project Start)
- Pradinė versija.
