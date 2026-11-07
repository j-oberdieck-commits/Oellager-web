# Öllager – Web-App

Web-Version der Öllager-App. Gleiche Daten wie die Android-App (Supabase, Frankfurt), Anmeldung mit demselben Konto.

Aufruf: https://j-oberdieck-commits.github.io/Oellager-web/

- **Quellcode:** liegt hier (index.html, zusammenfuehren.js, fahrzeuge.js, sw.js).
- **Tests:** `tests/test.js` prüft die Web-App in Chrome gegen eine nachgebildete Datenbank – bei jedem Push.
- **Veröffentlichung:** nur wenn alle Tests bestanden sind (GitHub Pages über Actions).
- **Supabase wach halten:** tägliche Abfrage, damit das kostenlose Projekt nicht pausiert.
