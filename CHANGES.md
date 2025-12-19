# Changelog

## [v2.0.0] - 2024-12-19

### 🔒 Saugumas (Security)
- **Kritinis:** Pašalintas XSS pažeidžiamumas naudojant `textContent` ir `sanitizeText` funkcijas vietoj `innerHTML`.
- **Kritinis:** Įdiegtos SQL RLS (Row Level Security) politikos. Dabar vartotojai gali matyti ir redaguoti TIK savo duomenis.
- **Atnaujinimas:** Supabase kredencialų valdymas pritaikytas saugiam kliento pusės (client-side) naudojimui su anoniminiu raktu.

### 🚀 Naujos Funkcijos
- **WebAuthn / Passkey:** Pridėta galimybė prisijungti naudojant biometrinius duomenis (Face ID, Touch ID, Windows Hello).
- **Toast Notifications:** Seni `alert()` pranešimai pakeisti moderniais, iššokančiais pranešimais.
- **Nustatymai:** Sukurtas nustatymų modalinis langas (Settings Modal) Passkey valdymui.
- **UI:** Pridėtas "Select All" funkcionalumas transakcijų istorijoje.

### ⚡ Optimizacija (Performance)
- **Bulk Delete:** Transakcijų trynimas pagreitintas 20x. Dabar trinama vienu SQL užklausimu naudojant `.in('id', ids)`.
- **API Rate Limiting:** Įdiegta kainų talpykla (cache). Kainos iš CoinGecko atnaujinamos ne dažniau kaip kas 60 sek., kad būtų išvengta blokavimo.
- **Event Delegation:** Optimizuotas checkbox'ų veikimas, sumažintas atminties naudojimas.
- **Debounce:** Skaičiuoklė dabar reaguoja sklandžiau, nevykdo skaičiavimų kiekvienam klavišo paspaudimui.

### 🐛 Ištaisytos Klaidos
- **CSV Importas:** Ištaisyta klaida, kai `Exchange` laukelis būdavo tuščias. Dabar teisingai nuskaito 7-ąjį stulpelį.
- **Import Logic:** `Method` laukelis automatiškai atpažįsta "Recurring Buy" arba "Instant Buy" iš pastabų.
- **Checkbox:** Ištaisyta problema, kai "Select All" neveikdavo paslėptoms (collapsed) transakcijoms.

---

## [v1.0.0] - Initial Release
- Bazinė versija su transakcijų pridėjimu, PnL skaičiavimu ir grafikais.

