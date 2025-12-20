# Changelog

Visa projekto pakeitimų istorija.

## [v2.0.2] - 2025-12-19 (Quality Assurance Update)
Klaidų taisymas, saugumo patobulinimai ir kodo švara.

### 🐛 Ištaisytos Klaidos (Bug Fixes)
- **Toast Icons:** Ištaisyta klaida, kai pranešimuose dubliuodavosi emodžiai (pvz., dvi žalios varnelės). Dabar tekstas išvalomas prieš rodant.
- **CSV Number Parsing:** Pataisytas skaičių nuskaitymas importuojant CSV. Sistema dabar teisingai supranta `1,234.56` formatą (pašalina tūkstančių skirtukus).
- **Input Validation:** Pridėta griežta validacija – neleidžiama įvesti neigiamų kainų ar kiekių formose.

### ✨ Naujos Funkcijos
- **Smart CSV Import:** Automatinis skirtuko (`,`) arba (`;`) aptikimas pagal failo antraštę.
- **Debug Mode:** Pridėtas `DEBUG_MODE` jungiklis. Produkcinėje versijoje konsolė nebus teršiama nereikalingais pranešimais.
- **Accessibility (A11y):** Pridėti `aria-label` atributai mygtukams be teksto (tik su ikonomis).

### 🔒 Saugumas & UX
- **Passkey Warning:** Vartotojai informuojami, kad "Local Device" Passkey bus prarastas išvalius naršyklės podėlį (cache).
- **Chart Colors:** PnL grafikas dabar pilnai adaptuojasi prie Tamsios/Šviesios temos (keičiasi ašių spalvos).

---

## [v2.0.1] - 2025-12-19 (UI & Performance Polish)
Našumo optimizacija, temos valdymas ir UI patobulinimai.

### ⚡ Optimizacija
- **Smart Charting:** Perrašytas grafiko generavimo algoritmas (O(N) sudėtingumas). Dideli duomenų kiekiai užsikrauna akimirksniu.

### 🎨 UI/UX
- **Theme Auto-detect:** Automatinis šviesios/tamsios temos aptikimas.
- **Goals Sorting:** Tikslai rikiuojami pagal pasiekimo procentą (didžiausi viršuje).
- **Number Formatting:** Standartizuotas formatas `87,958.07` (US locale).

---

## [v2.0.0] - 2025-12-19 (Final Release)
Didysis atnaujinimas su biometrine autentifikacija.

### 🚀 Funkcijos
- **WebAuthn / Passkey:** Face ID / Touch ID palaikymas.
- **Saugumas:** RLS (Row Level Security) duomenų bazėje.
- **Bulk Operations:** Masinis transakcijų trynimas.

---

## [v1.9.11] - 2025-12-18 (Performance Update)
- **Bulk Delete:** Optimizuotas trynimas su `.in()`.
- **API Cache:** CoinGecko kainų spartinanti atmintinė (1 min).

## [v1.0.0] - 2025-12-13 (Project Start)
- Pradinė versija.
