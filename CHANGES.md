# Changelog

Visa projekto pakeitimų istorija.

## [v2.0.3] - 2025-12-19 (Advanced Charting Update)
Didelis grafinės sąsajos atnaujinimas, orientuotas į profesionalų duomenų atvaizdavimą.

### 📈 Grafikai ir Vizualizacija
- **Timeframe Selectors:** Pridėta galimybė filtruoti portfelio istoriją pagal laikotarpius: 1 savaitė (1W), 1 mėnuo (1M), 3 mėnesiai (3M), 6 mėnesiai (6M), 1 metai (1Y), 5 metai (5Y) ir Visas laikas (ALL).
- **Smooth Curves:** Grafiko linija dabar naudoja `tension: 0.4`, kad kreivės būtų glotnios ir estetiškos.
- **Gradient Fill:** Po grafiko linija pridėtas permatomas spalvos gradientas, suteikiantis modernią išvaizdą (kaip profesionaliose biržose).
- **Clean Look:** Panaikinti taškai ant linijos (jie atsiranda tik užvedus pelę), paslėptos X ašies etiketės švaresniam vaizdui.

### ⚡ Logika
- **Dynamic Filtering:** `generateHistoryChart` funkcija perrašyta taip, kad perskaičiuotų pradinį balansą prieš pasirinktą laikotarpį, užtikrinant tikslų "Start Value" atvaizdavimą.

---

## [v2.0.2] - 2025-12-19 (Quality Assurance Update)
Klaidų taisymas, saugumo patobulinimai ir kodo švara.

### 🐛 Ištaisytos Klaidos
- **Toast Icons:** Ištaisyta klaida su dvigubais emodžiais pranešimuose.
- **CSV Parsing:** Pataisytas skaičių formatavimas importuojant (`1,234.56` vs `1.234,56`).
- **Validation:** Griežta apsauga nuo neigiamų skaičių įvedimo.

### ✨ Naujos Funkcijos
- **Debug Mode:** `DEBUG_MODE` jungiklis švariai konsolei.
- **Smart CSV:** Automatinis skirtuko (`,`, `;`) aptikimas.

---

## [v2.0.1] - 2025-12-19 (UI & Performance Polish)
- **Smart Charting:** O(N) algoritmas grafikams.
- **Auto-Theme:** Automatinis šviesios/tamsios temos parinkimas.
- **Goals Sorting:** Tikslų rikiavimas pagal progresą.

## [v2.0.0] - 2025-12-19 (Final Release)
- **WebAuthn:** Biometrinis prisijungimas.
- **RLS:** Duomenų bazės saugumas.

## [v1.0.0] - 2025-12-13 (Project Start)
- Pradinė versija.
