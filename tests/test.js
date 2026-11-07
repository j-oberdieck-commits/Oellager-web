// Ende-zu-Ende-Test der Web-App gegen eine nachgebildete Supabase (läuft bei jedem Push auf GitHub)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const WEB = path.join(__dirname, "..");
const srv = http.createServer((q, r) => {
  const f = path.join(WEB, q.url.split("?")[0] === "/" ? "index.html" : q.url.split("?")[0]);
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html" : f.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
  r.end(fs.readFileSync(f));
}).listen(8765);

// --- simulierte Datenbank ---
const db = { standorte: [{ id: 1, name: "Werkstatt Nord" }, { id: 2, name: "Werkstatt Süd" }], nutzer: [], mitglied: [], bestand: {}, rpc: [] };
const anna = { user_id: "u-anna", email: "anna@test.de", name: "Anna", rolle: "admin", freigegeben: true };
db.nutzer.push(anna); db.mitglied.push({ user_id: "u-anna", standort_id: 1 }, { user_id: "u-anna", standort_id: 2 });
let konfliktEinmal = false;
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
let offline = false;
async function handler(route) {
  if (offline) return route.abort("internetdisconnected");
  const req = route.request(), url = new URL(req.url()), p = url.pathname, m = req.method();
  const body = (() => { try { return req.postData() ? JSON.parse(req.postData()) : null; } catch (e) { return null; } })();
  const q = Object.fromEntries(url.searchParams);
  if (p === "/auth/v1/token") {
    if (body.password !== "geheim1") return json(route, { msg: "Invalid login credentials" }, 400);
    const u = db.nutzer.find((n) => n.email === body.email) || anna;
    db.loginZaehler = (db.loginZaehler || 0) + 1;
    return json(route, { access_token: "t", refresh_token: "r", expires_in: 3600, user: { id: u.user_id, email: u.email,
      factors: u.mfa ? [{ id: "f1", factor_type: "totp", status: "verified" }] : [] } });
  }
  if (p === "/storage/v1/object/list/datenblaetter") return json(route, (db.blaetter || []).map((n, i) => ({ id: String(i + 1), name: n })));
  if (p.startsWith("/storage/v1/object/datenblaetter/") && m === "POST") { (db.blaetter = db.blaetter || []).push(decodeURIComponent(p.split("/").pop())); db.blattTyp = req.headers()["content-type"]; return json(route, { Key: p }); }
  if (p === "/rest/v1/oellager_sicherung") return json(route, db.sicherungen || (db.sicherungen = [{ id: 7, standort_id: 1, erstellt: new Date().toISOString(), art: "automatisch", version: 3 }]));
  if (p === "/rest/v1/rpc/oellager_jetzt_sichern") { db.sicherungen.unshift({ id: 8, standort_id: 1, erstellt: new Date().toISOString(), art: "manuell", version: 4 }); return json(route, 2); }
  if (p === "/rest/v1/rpc/oellager_wiederherstellen") { db.wiederhergestellt = body.p_sicherung; return json(route, 9); }
  if (p === "/auth/v1/factors/f1/challenge") return json(route, { id: "c1" });
  if (p === "/auth/v1/factors/f1/verify") {
    if (body.code !== "123456") return json(route, { msg: "Invalid TOTP code entered" }, 422);
    return json(route, { access_token: "t-aal2", refresh_token: "r2", expires_in: 3600, user: { id: "u-mfa", email: "mfa@test.de" } });
  }
  if (p === "/rest/v1/oellager_fehler" && m === "POST") { (db.fehler = db.fehler || []).push(body); return route.fulfill({ status: 201, body: "" }); }
  if (p === "/auth/v1/recover") { db.recover = { email: body.email, ziel: q.redirect_to }; return json(route, {}); }
  if (p === "/auth/v1/user" && m === "PUT") { db.neuesPw = body.password; return json(route, { id: "u-anna" }); }
  if (p === "/rest/v1/oellager_protokoll") return json(route, [{ zeit: new Date().toISOString(), wer: "ben@test.de", geraet: "Web-App", bereich: "faesser", aktion: "leer gemeldet", text: "Castrol Edge 5W-30 · A1 · 208 L" }]);
  if (p === "/auth/v1/signup") {
    const u = { user_id: "u-" + body.email, email: body.email, name: body.data.name, rolle: "nutzer", freigegeben: false };
    db.nutzer.push(u); body.data.standorte.forEach((s) => db.mitglied.push({ user_id: u.user_id, standort_id: s }));
    db.signup = body;
    return json(route, { access_token: "t2", refresh_token: "r2", expires_in: 3600, user: { id: u.user_id, email: u.email } });
  }
  if (p === "/rest/v1/oellager_standort") {
    if (m === "GET") return json(route, db.standorte);
    if (m === "POST") { const s = { id: db.standorte.length + 1, name: body.name }; db.standorte.push(s); return json(route, [{ id: s.id }], 201); }
  }
  if (p === "/rest/v1/oellager_nutzer") {
    const uid = (q.user_id || "").replace("eq.", "");
    return json(route, uid ? db.nutzer.filter((n) => n.user_id === uid) : db.nutzer);
  }
  if (p === "/rest/v1/oellager_mitglied") {
    if (m === "GET") { const uid = (q.user_id || "").replace("eq.", ""); return json(route, db.mitglied.filter((x) => !uid || x.user_id === uid).map((x) => ({ darf_aendern: false, ...x }))); }
    if (m === "POST") { db.mitglied.push(body); return route.fulfill({ status: 201, body: "" }); }
  }
  if (p === "/rest/v1/oellager_bestand" && !q.standort_id) return json(route, Object.entries(db.bestand).map(([k, v]) => ({ standort_id: Number(k), daten: v.daten })));
  if (p === "/rest/v1/oellager_bestand") {
    const sid = Number(q.standort_id.replace("eq.", ""));
    const b = db.bestand[sid];
    return json(route, b ? [{ ...b, geraet: "Handy", geaendert_von: "ben@test.de", geaendert: "" }] : []);
  }
  if (p === "/rest/v1/rpc/oellager_speichern") {
    db.rpc.push(body);
    const b = db.bestand[body.p_standort];
    if (konfliktEinmal) {
      konfliktEinmal = false;
      // Kollege speichert gleichzeitig eine eigene Sorte mit derselben ID
      const d = JSON.parse(JSON.stringify(b.daten)); d.sorten.push({ id: 2, kategorie: "OEL", marke: "Castrol", name: "Edge", viskositaet: "5W-30", freigabeIds: [] });
      db.bestand[body.p_standort] = { daten: d, version: b.version + 1 };
      return json(route, null);
    }
    if (body.p_version == null && b) return json(route, null);
    if (b && body.p_version !== b.version) return json(route, null);
    db.bestand[body.p_standort] = { daten: body.p_daten, version: (b?.version || 0) + 1 };
    return json(route, db.bestand[body.p_standort].version);
  }
  if (p === "/rest/v1/rpc/oellager_recht_setzen") {
    db.mitglied = db.mitglied.filter((x) => !(x.user_id === body.p_user && x.standort_id === body.p_standort));
    if (body.p_zugeordnet) db.mitglied.push({ user_id: body.p_user, standort_id: body.p_standort, darf_aendern: body.p_darf_aendern });
    return route.fulfill({ status: 204, body: "" });
  }
  if (p === "/rest/v1/rpc/oellager_nutzer_setzen") {
    const n = db.nutzer.find((x) => x.user_id === body.p_user); n.freigegeben = body.p_freigegeben; n.rolle = body.p_rolle;
    return route.fulfill({ status: 204, body: "" });
  }
  return json(route, { message: "unbekannt " + m + " " + p }, 404);
}
const SCHIRM = path.join(__dirname, "bilder/"); fs.mkdirSync(SCHIRM, { recursive: true });
async function kopf(page, a) {
  if (!(await page.isVisible(`#kopf [data-a="${a}"]`))) await page.click('#kopf [data-a="menue"]');
  await page.click(`#kopf [data-a="${a}"]`);
}
async function entwickler(page) {
  await kopf(page, "entwickler");
  if (await page.isVisible("#pin")) { await page.fill("#pin", "geheim1"); await page.click('[data-a="pin-ok"]'); }
  await page.waitForSelector("#dialog >> text=Neuer Standort");
}
const ok = (n, b) => { console.log((b ? "OK   " : "FEHL ") + n); if (!b) process.exitCode = 1; };

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"], ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, serviceWorkers: "block" });
  await ctx.route("https://mykobsukqlrownycektl.supabase.co/**", handler);
  const page = await ctx.newPage();
  const fehler = []; page.on("pageerror", (e) => fehler.push(e.message));
  page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) fehler.push("CSP: " + m.text()); });
  page.on("dialog", (d) => d.accept(d.type() === "prompt" ? "Werkstatt Nord-Ost" : undefined));
  await page.goto("http://localhost:8765/");
  await page.waitForSelector("#login-form");
  ok("Anmeldebildschirm zuerst", await page.isVisible("#l-standort"));
  ok("Standorte vor Anmeldung", (await page.$$eval("#l-standort option", (o) => o.map((x) => x.textContent))).includes("Werkstatt Süd"));
  await page.screenshot({ path: SCHIRM + "1-login.png" });

  await page.fill("#l-email", "anna@test.de"); await page.fill("#l-pw", "falsch1"); await page.selectOption("#l-standort", "1");
  await page.click("#login-form button[type=submit]");
  await page.waitForSelector("text=E-Mail oder Passwort falsch");
  ok("Falsches Passwort gemeldet", true);
  ok("Eingaben bleiben erhalten", (await page.inputValue("#l-email")) === "anna@test.de" && (await page.inputValue("#l-standort")) === "1");
  await page.fill("#l-pw", "geheim1"); await page.click("#login-form button[type=submit]");
  await page.waitForSelector("text=Noch keine Motoröl-Sorten");
  ok("Standort Nord geöffnet", (await page.textContent("#kopf")).includes("Lager Werkstatt Nord"));

  // Sorte anlegen → speichert mit Standort
  await page.click('[data-a="sorte-neu"]');
  await page.fill("#d-marke", "Liqui Moly"); await page.fill("#d-name", "Top Tec 4200"); await page.fill("#d-visko", "5w-30");
  await page.click('[data-a="sorte-speichern"]');
  await page.locator("#kopf", { hasText: "gespeichert ·" }).waitFor();
  ok("Gespeichert mit p_standort=1", db.rpc.at(-1).p_standort === 1 && db.bestand[1].daten.sorten[0].viskositaet === "5W-30");

  // Gleichzeitige Änderung eines Kollegen → zusammenführen
  konfliktEinmal = true;
  await page.click('[data-a="sorte-neu"]');
  await page.fill("#d-marke", "Mobil"); await page.fill("#d-name", "Super 3000"); await page.fill("#d-visko", "5W-40");
  await page.click('[data-a="sorte-speichern"]');
  await page.locator("#kopf", { hasText: "gespeichert ·" }).waitFor();
  await page.waitForTimeout(300);
  const namen = db.bestand[1].daten.sorten.map((x) => x.marke).sort();
  ok("Zusammengeführt: alle drei Sorten", JSON.stringify(namen) === JSON.stringify(["Castrol", "Liqui Moly", "Mobil"]));
  ok("IDs eindeutig", new Set(db.bestand[1].daten.sorten.map((x) => x.id)).size === 3);
  await page.screenshot({ path: SCHIRM + "2-lager.png" });

  // Entwicklermenü: PIN, Standort anlegen, umbenennen
  await entwickler(page);
  db.bestand[1].daten.lieferanten = [{ id: 1, name: "WM SE" }, { id: 2, name: "PVK" }]; db.bestand[1].version++;
  await page.fill("#neuer-standort", "Lager West");
  await page.selectOption("#quelle", "1");
  await page.waitForSelector('#quell-lieferanten .chip[data-lid="2"]');
  await page.click('#quell-lieferanten .chip[data-lid="2"]'); // PVK abwählen
  ok("Name bleibt beim Wählen der Quelle", (await page.inputValue("#neuer-standort")) === "Lager West");
  await page.click('[data-a="standort-anlegen"]');
  await page.waitForSelector("#dialog >> text=Lager West");
  ok("Standort mit 1 übernommenen Lieferanten", db.bestand[3] && db.bestand[3].daten.lieferanten.map((l) => l.name).join() === "WM SE" && db.bestand[3].daten.sorten.length === 0);
  await page.screenshot({ path: SCHIRM + "3-entwickler.png", fullPage: true });
  await page.click('[data-a="schliessen"]');

  // Fass anlegen und als leer melden → Verbrauch in der Auswertung
  await page.click('#app [data-a="gruppe"]');
  await page.click('#app [data-a="fass-neu"]');
  await page.fill("#f-platz", "A1"); await page.fill("#f-preis", "1456");
  await page.click('[data-a="fass-speichern"]');
  await page.locator("#kopf", { hasText: "gespeichert ·" }).waitFor();
  ok("Fass im Bestand", (await page.textContent("#app")).includes("A1"));
  await page.click('#app .fass');
  await page.click('[data-a="fass-leer"]');
  await page.locator("#kopf", { hasText: "gespeichert ·" }).waitFor();
  await page.waitForTimeout(800);
  ok("Fass leer: gespeichert mit leerAm, nicht mehr im Bestand", !!db.bestand[1].daten.faesser.find((f) => f.lagerplatz === "A1")?.leerAm && !(await page.textContent("#app")).includes("Gebinde 208 L"));
  await page.click('[data-a="tab"][data-v="auswertung"]');
  await page.waitForSelector("text=Verbrauch (leer gemeldete Fässer)");
  ok("Verbrauch zeigt 1 Fass · 208 L", (await page.textContent("#app")).includes("1 Fass · 208 L"));
  await page.screenshot({ path: SCHIRM + "6-auswertung.png", fullPage: true });
  await page.click('[data-a="tab"][data-v="lager"]');
  // Standortvergleich (Entwickler)
  await entwickler(page);
  await page.click('[data-a="vergleich"]');
  await page.waitForSelector("text=Bestand je Standort");
  ok("Standortvergleich öffnet", (await page.textContent("#dialog")).includes("Alle Standorte"));
  await page.click('#dialog [data-a="schliessen"]');
  // Standort wechseln → Süd ist leer, eigener Bestand
  await kopf(page, "standort-wechseln");
  await page.click('#app [data-a="standort-oeffnen"][data-v="2"]');
  await page.waitForSelector("text=Noch keine Motoröl-Sorten");
  ok("Süd hat eigenes (leeres) Lager", (await page.textContent("#kopf")).includes("Werkstatt Süd"));

  // Abmelden → Registrierung eines neuen Nutzers
  await kopf(page, "abmelden");
  await page.click('[data-a="zu-registrieren"]');
  await page.fill("#r-name", "Ben"); await page.fill("#r-email", "ben@test.de"); await page.fill("#r-pw", "geheim1"); await page.fill("#r-pw2", "geheim1");
  await page.click('#r-standorte .chip[data-sid="1"]'); await page.click('#r-standorte .chip[data-sid="2"]');
  await page.screenshot({ path: SCHIRM + "4-registrieren.png" });
  await page.click("#registrier-form button[type=submit]");
  await page.waitForSelector("text=Warten auf Freigabe");
  ok("Registrierung mit 2 Standorten + Name", db.signup.data.name === "Ben" && db.signup.data.standorte.join() === "1,2");
  ok("Wartet auf Freigabe", true);
  // Admin gibt frei (simuliert) → erneut prüfen → Standortwahl
  db.nutzer.find((n) => n.email === "ben@test.de").freigegeben = true;
  await page.click('[data-a="freigabe-pruefen"]');
  await page.waitForSelector("text=Standort wählen");
  ok("Nach Freigabe: Standortwahl mit 2 Standorten", (await page.$$('#app [data-a="standort-oeffnen"]')).length === 2);
  await page.click('#app [data-a="standort-oeffnen"][data-v="1"]');
  await page.waitForSelector("text=5W-30");
  ok("Ben sieht Lager Nord", (await page.textContent("#app")).includes("Liqui Moly"));
  ok("Ben: Nur-Lesen-Hinweis", (await page.textContent("#app")).includes("Nur Leserechte"));
  ok("Ben: kein + Sorte", !(await page.isVisible('[data-a="sorte-neu"]')));
  const rpcVorher = db.rpc.length;
  if (!(await page.isVisible('#app [data-a="sorte-bearbeiten"]'))) await page.click('#app [data-a="gruppe"]');
  await page.click('#app [data-a="sorte-bearbeiten"]');
  ok("Ben: Sorte ansehen ohne Speichern-Knopf", await page.isVisible("#d-marke") && !(await page.isVisible('[data-a="sorte-speichern"]')));
  await page.click('[data-a="schliessen"]');
  // Entwickler gibt Ben Ändern-Recht für Nord
  db.mitglied.find((x) => x.user_id === "u-ben@test.de" && x.standort_id === 1).darf_aendern = true;
  await kopf(page, "standort-wechseln"); await page.click('#app [data-a="standort-oeffnen"][data-v="1"]');
  await page.waitForSelector('[data-a="sorte-neu"]');
  ok("Ben mit Ändern-Recht: + Sorte da, kein Hinweis", !(await page.textContent("#app")).includes("Nur Leserechte"));
  ok("Ben hat als Leser nichts gespeichert", db.rpc.length === rpcVorher);

  // Neu laden: Standort muss wieder gewählt werden
  await page.reload();
  await page.waitForSelector("text=Standort wählen");
  ok("Nach Neuladen wieder Standortwahl", true);
  // Passwort vergessen
  await kopf(page, "abmelden");
  await page.click('[data-a="zu-vergessen"]');
  await page.fill("#v-email", "anna@test.de"); await page.click("#vergessen-form button[type=submit]");
  await page.waitForSelector("text=E-Mail verschickt");
  ok("Passwort-vergessen-Mail angefordert, Ziel = Web-App", db.recover.email === "anna@test.de" && db.recover.ziel === "http://localhost:8765/");
  // Rückkehr über den Link (#…type=recovery)
  const jwt = "x." + Buffer.from(JSON.stringify({ sub: "u-anna", email: "anna@test.de" })).toString("base64url") + ".y";
  await page.goto("about:blank"); await page.goto(`http://localhost:8765/#access_token=${jwt}&refresh_token=r9&expires_in=3600&type=recovery`);
  await page.waitForSelector("#passwort-form");
  ok("Formular für neues Passwort, Adresse bereinigt", !page.url().includes("access_token"));
  await page.fill("#n-pw", "neues123"); await page.fill("#n-pw2", "neues123"); await page.click("#passwort-form button[type=submit]");
  await page.waitForSelector("text=Standort wählen");
  ok("Neues Passwort gesetzt, danach Standortwahl", db.neuesPw === "neues123");
  // Protokoll in der Auswertung
  await page.click('#app [data-a="standort-oeffnen"][data-v="1"]');
  await page.waitForSelector('[data-a="tab"][data-v="auswertung"]');
  await page.click('[data-a="tab"][data-v="auswertung"]');
  await page.waitForSelector("text=Fass leer gemeldet:");
  ok("Protokoll angezeigt", (await page.textContent("#app")).includes("Castrol Edge 5W-30"));
  await page.screenshot({ path: SCHIRM + "5-protokoll.png" });
  // Fahrzeugsuche
  db.bestand[1].daten.sorten[0].spezifikation = "ACEA C3, VW 504 00 / 507 00"; db.bestand[1].version++;
  await kopf(page, "neu-laden"); await page.waitForTimeout(500);
  await page.click('[data-a="tab"][data-v="lager"]');
  await page.click('[data-a="fahrzeug"]');
  await page.click('[data-a="fz-marke"][data-v="VW · Audi · Seat · Škoda"]');
  await page.click('[data-a="fz-motor"][data-v="0"]');
  await page.waitForSelector("text=Passende Sorten (1)");
  ok("Fahrzeugsuche findet Sorte mit VW 504 00", (await page.textContent("#dialog")).includes(db.bestand[1].daten.sorten[0].marke));
  await page.screenshot({ path: SCHIRM + "7-fahrzeug.png" });
  await page.click('#dialog [data-a="schliessen"]');
  // Export als Excel (CSV)
  await page.click('[data-a="tab"][data-v="auswertung"]');
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click('[data-a="export-preise"]')]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  ok("Preis-CSV mit BOM, Semikolon, Kopfzeile", csv.startsWith("\uFEFFKategorie;Viskosität / Typ;Sorte") && dl.suggestedFilename().endsWith(".csv"));
  // Offline: zuletzt geladener Stand, nur lesen
  offline = true;
  await page.reload();
  await page.waitForSelector("text=Standort wählen");
  await page.click('#app [data-a="standort-oeffnen"][data-v="1"]');
  await page.waitForSelector("text=Offline");
  ok("Offline: Stand aus dem Speicher, nur lesen", (await page.textContent("#app")).includes("Liqui Moly") && !(await page.isVisible('[data-a="sorte-neu"]')));
  await page.screenshot({ path: SCHIRM + "8-offline.png" });
  offline = false;
  await page.reload(); await page.waitForSelector("text=Standort wählen");
  await page.click('#app [data-a="standort-oeffnen"][data-v="1"]');
  await page.waitForSelector('[data-a="sorte-neu"]');
  // Verkaufspreis: Aufschlag 40 % → Kundenpreis = netto * 1,4 * 1,19
  await page.click('[data-a="tab"][data-v="stamm"]');
  await page.fill("#aufschlag", "40"); await page.click('[data-a="aufschlag-speichern"]');
  await page.locator("#kopf", { hasText: "gespeichert ·" }).waitFor();
  ok("Aufschlag im Lagerstand gespeichert", db.bestand[1].daten.einstellungen?.aufschlagProzent === 40);
  // Fass mit 7,00 €/L anlegen, dann ein teureres → Warnung
  await page.click('[data-a="tab"][data-v="lager"]');
  if (!(await page.isVisible('#app [data-a="fass-neu"]'))) await page.click('#app [data-a="gruppe"]');
  await page.click('#app [data-a="fass-neu"]');
  await page.fill("#f-groesse", "200"); await page.fill("#f-preis", "1400"); await page.click('[data-a="fass-speichern"]');
  await page.locator("#kopf", { hasText: "gespeichert ·" }).waitFor();
  await page.click('#app [data-a="fass-neu"]');
  await page.fill("#f-groesse", "200"); await page.fill("#f-preis", "1600"); await page.click('[data-a="fass-speichern"]');
  await page.waitForSelector("text=14 % teurer als die letzte Lieferung");
  ok("Warnung bei 14 % teurer", true);
  await page.click('[data-a="brutto"]'); await page.click('[data-a="brutto"]');
  await page.waitForSelector("text=Kundenpreise: Einkauf + 40 %");
  ok("Kundenpreis-Ansicht: 7,00 € → 11,66 €", (await page.textContent("#app")).includes("11,66"));
  await page.click('[data-a="brutto"]'); // zurück auf Netto
  // Fotos/Datenblätter + Preisentwicklung im Sorten-Dialog
  await page.click('#app [data-a="sorte-bearbeiten"]');
  await page.waitForSelector("text=Preisentwicklung Einkauf");
  ok("Preisentwicklung mit +14 %", (await page.textContent("#dialog")).includes("+14 %"));
  await page.setInputFiles("#blatt-datei", { name: "Datenblatt Öl.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await page.waitForSelector('#blaetter [data-a="blatt-oeffnen"]');
  ok("Datenblatt hochgeladen (PDF, Name bereinigt)", db.blattTyp === "application/pdf" && /^Datenblatt_Oel_\d{4}-\d{2}-\d{2}_\d{6}\.pdf$/.test(db.blaetter[0]));
  await page.screenshot({ path: SCHIRM + "9-sorte.png", fullPage: true });
  await page.click('#dialog [data-a="schliessen"]');
  // Sicherungen
  await entwickler(page);
  await page.click('[data-a="sicherungen"]');
  await page.waitForSelector("text=Jetzt sichern");
  await page.click('[data-a="jetzt-sichern"]');
  await page.waitForSelector("#dialog >> text=manuell");
  await page.click('[data-a="sicherung-zurueck"][data-v="7"]');
  await page.waitForTimeout(500);
  ok("Sicherung angelegt und zurückgeholt", db.wiederhergestellt === 7);
  await page.click('#dialog [data-a="schliessen"]');
  // Tablet-Ansicht
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.waitForSelector(".geteilt .detail");
  ok("Breiter Bildschirm: Liste links, Details rechts", await page.isVisible(".geteilt .detail .sorte"));
  await page.screenshot({ path: SCHIRM + "10-tablet.png" });
  // Oberflächen (Entwickler wählt für den Standort)
  await page.setViewportSize({ width: 412, height: 900 });
  for (const [ob, merkmal] of [["dunkel", null], ["kompakt", ".kp-tabelle"], ["kennzahlen", ".kz-karte"], ["glas", null]]) {
    await entwickler(page);
    await page.click(`[data-a="ob-setzen"][data-v="${ob}"]`);
    await page.click('#dialog [data-a="schliessen"]');
    await page.locator("#kopf", { hasText: "gespeichert ·" }).waitFor();
    const gesetzt = await page.evaluate(() => document.documentElement.dataset.ob || "glas");
    ok(`Oberfläche ${ob} aktiv${merkmal ? " mit " + merkmal : ""}`, gesetzt === ob && db.bestand[1].daten.einstellungen.oberflaeche === ob && (!merkmal || await page.isVisible(merkmal)));
    await page.screenshot({ path: SCHIRM + `ob-${ob}.png` });
  }
  // Zwei-Faktor-Anmeldung
  await page.setViewportSize({ width: 412, height: 900 });
  db.nutzer.push({ user_id: "u-mfa", email: "mfa@test.de", name: "Mia", rolle: "nutzer", freigegeben: true, mfa: true });
  db.mitglied.push({ user_id: "u-mfa", standort_id: 1, darf_aendern: false });
  await kopf(page, "abmelden");
  await page.fill("#l-email", "mfa@test.de"); await page.fill("#l-pw", "geheim1"); await page.selectOption("#l-standort", "1");
  await page.click("#login-form button[type=submit]");
  await page.waitForSelector("#code-form");
  ok("Zwei-Faktor: Code wird abgefragt", true);
  await page.fill("#c-code", "000000"); await page.click("#code-form button[type=submit]");
  await page.waitForSelector("text=Code falsch oder abgelaufen");
  await page.fill("#c-code", "123456"); await page.click("#code-form button[type=submit]");
  await page.waitForSelector('[data-a="tab"][data-v="lager"]');
  ok("Zwei-Faktor: falscher Code abgelehnt, richtiger öffnet den Standort", JSON.parse(await page.evaluate(() => localStorage.getItem("oel_sitzung"))).access === "t-aal2");
  ok("Kein Entwicklermenü für normale Nutzer", !(await page.evaluate(() => { document.querySelector('#kopf [data-a="menue"]').click(); return !!document.querySelector('#kopf [data-a="entwickler"]'); })));
  ok("Keine JS-Fehler", fehler.length === 0 || (console.log(fehler), false));
  await browser.close(); srv.close();
  if (process.exitCode) console.log("\nMindestens ein Test ist fehlgeschlagen.");
})().catch((e) => { console.error(e); process.exit(1); });
