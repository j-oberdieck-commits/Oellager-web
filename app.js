"use strict";
// ---------- Verbindung (Supabase-Projekt „Oellager-webapp“, Frankfurt) ----------
const SB_URL = "https://mykobsukqlrownycektl.supabase.co";
const SB_KEY = "sb_publishable_gS2RdAZbARY-zn-e0A4fag_NoxLOTgb";

const QUELLEN = [
  { code: "WM", name: "WM SE" },
  { code: "PVK", name: "PVK" },
  { code: "KFZ24", name: "kfzteile24.de" }
];
const KATEGORIEN = {
  OEL: { titel: "Motoröl", gruppe: "Viskosität", platzhalter: "z. B. 5W-30", groessen: [20, 60, 205, 208, 1000],
         vorschlaege: ["0W-20", "0W-30", "5W-20", "5W-30", "5W-40", "10W-40", "15W-40"] },
  KUEHL: { titel: "Kühlmittel", gruppe: "Typ", platzhalter: "z. B. G12evo", groessen: [5, 20, 60, 200, 1000],
           vorschlaege: ["G11", "G12", "G12+", "G12++", "G12evo", "G13", "G30", "G40", "G48"] }
};

// ---------- Zustand ----------
const S = {
  sitzung: null, daten: null, version: null, geaendert: "", geraet: "", basis: null,
  ansicht: "anmelden", standorte: [], meine: new Set(), aenderbar: new Set(), ich: null, nutzer: [], quellLieferanten: [],
  standort: Number(localStorage.getItem("oel_standort")) || null, meldung: "", laeuft: false,
  tab: "lager", kat: "OEL", offen: null, suche: "", ungespeichert: false, speichert: false, fehler: "",
  preisModus: localStorage.getItem("oel_preis") || (localStorage.getItem("oel_brutto") === "1" ? "brutto" : "netto"), mwst: 19
};

// ---------- Hilfen ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const fmtEur = (v) => eur.format(v);
const aufschlag = () => Number(S.daten?.einstellungen?.aufschlagProzent) || 0;
const preisWert = (netto) => S.preisModus === "kunde" ? netto * (1 + aufschlag() / 100) * (1 + S.mwst / 100)
  : S.preisModus === "brutto" ? netto * (1 + S.mwst / 100) : netto;
const fmtP = (netto) => fmtEur(preisWert(netto));
const PREIS_TEXT = { netto: "Netto", brutto: "Brutto", kunde: "Kunde" };
const fmtZahl = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace(".", ","));
function zahl(text) {
  const t = String(text ?? "").replace(/[€\s]/g, "");
  if (!t) return null;
  const n = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}
const naechsteId = (liste) => liste.reduce((m, e) => Math.max(m, Number(e.id) || 0), 0) + 1;
const anzeigename = (so) => {
  const m = (so.marke || "").trim(), n = (so.name || "").trim();
  if (!m) return n; if (!n) return m;
  return n.toLowerCase().startsWith(m.toLowerCase()) ? n : `${m} ${n}`;
};
const viskoKey = (v) => String(v || "").toUpperCase().replace(/[\s-]/g, "");
const literpreis = (f) => (f.gebindeL > 0 ? f.preisFass / f.gebindeL : 0);
const schnitt = (faesser) => {
  const l = faesser.reduce((s, f) => s + (f.gebindeL || 0), 0);
  return l > 0 ? faesser.reduce((s, f) => s + (f.preisFass || 0), 0) / l : null;
};
const angebotLp = (a) => (a.preisGebinde != null && a.gebindeL > 0 ? a.preisGebinde / a.gebindeL : null);
const jetztText = () => new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function gruppenFarbe(key, kat) {
  const k = key.toUpperCase();
  if (kat === "OEL") {
    const m = k.match(/^(\d+)W/);
    const kalt = m ? Number(m[1]) : null;
    return { 0: "#2E9E6A", 5: "#2F7FD1", 10: "#E08A1E", 15: "#C0533A" }[kalt] ?? (kalt == null ? "#7A8A90" : "#8E5BB5");
  }
  if (k.startsWith("G12EVO")) return "#8E44D9";
  if (k.startsWith("G12++")) return "#B04BD0";
  if (k.startsWith("G12+") || k === "G12") return "#E0457B";
  if (k.startsWith("G13")) return "#A46BE0";
  if (k.startsWith("G11")) return "#2BA6A0";
  if (k.startsWith("G40")) return "#D9529A";
  if (k.startsWith("G48")) return "#2E9E8F";
  return k ? "#5C6BC0" : "#7A8A90";
}
const PALETTE = ["#2F7FD1", "#2E9E6A", "#E08A1E", "#8E5BB5", "#C0533A", "#2BA6A0", "#D9529A", "#5C6BC0"];
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function badge(marke) {
  const w = String(marke || "?").trim().split(/[\s-]+/).filter(Boolean);
  const k = w.length === 0 ? "?" : w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0];
  const f = PALETTE[hash(String(marke || "").toLowerCase()) % PALETTE.length];
  return `<span class="badge" style="background:${f}2e;color:${f}">${esc(k.toUpperCase())}</span>`;
}
function toast(text) {
  document.querySelectorAll(".toast").forEach((x) => x.remove());
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = text; t.setAttribute("role", "status");
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ---------- Anmeldung (Supabase Auth, ohne Zusatzbibliothek) ----------
function sitzungSpeichern(s) {
  S.sitzung = s;
  try { s ? localStorage.setItem("oel_sitzung", JSON.stringify(s)) : localStorage.removeItem("oel_sitzung"); } catch (e) { /* privat */ }
}
function sitzungAus(j) {
  return { access: j.access_token, refresh: j.refresh_token, ablauf: Date.now() + (j.expires_in || 3600) * 1000 - 60000,
           userId: j.user.id, email: j.user.email };
}
/** fetch mit klarer Meldung, wenn keine Verbindung besteht (für den Offline-Modus). */
async function netz(url, opts) {
  try { return await fetch(url, opts); }
  catch (e) { const f = new Error("Keine Verbindung"); f.offline = true; throw f; }
}
async function auth(pfad, body) {
  const r = await netz(SB_URL + pfad, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = j.msg || j.error_description || j.message || `HTTP ${r.status}`;
    throw new Error(/Invalid login/i.test(m) ? "E-Mail oder Passwort falsch" : /not confirmed/i.test(m) ? "E-Mail noch nicht bestätigt – bitte den Link in der Mail öffnen"
      : /already registered/i.test(m) ? "Diese E-Mail ist schon registriert – bitte anmelden" : /Password should/i.test(m) ? "Passwort zu kurz (mindestens 6 Zeichen)"
      : /rate limit/i.test(m) ? "Zu viele Versuche – bitte kurz warten" : m);
  }
  return j;
}
async function token() {
  const s = S.sitzung;
  if (!s) throw new Error("Nicht angemeldet");
  if (s.access && Date.now() < s.ablauf) return s.access;
  if (!navigator.onLine) { const f = new Error("Keine Verbindung"); f.offline = true; throw f; }
  const j = await auth("/auth/v1/token?grant_type=refresh_token", { refresh_token: s.refresh });
  sitzungSpeichern(sitzungAus(j));
  return S.sitzung.access;
}
async function rest(methode, pfad, body, extra = {}) {
  const h = { apikey: SB_KEY, "Content-Type": "application/json", Accept: "application/json", ...extra };
  if (S.sitzung) h.Authorization = "Bearer " + (await token());
  const r = await netz(SB_URL + pfad, { method: methode, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) {
    const m = (() => { try { return JSON.parse(text).message; } catch (e) { return text; } })() || `HTTP ${r.status}`;
    throw new Error(/duplicate/i.test(m) ? "Diesen Namen gibt es schon" : /Kein Zugriff/i.test(m) ? "Kein Zugriff auf diesen Standort" : /Nur Leserechte/i.test(m) ? "Nur Leserechte für diesen Standort"
      : /row-level security/i.test(m) ? "Keine Berechtigung – nur der Entwickler darf das"
      : /mindestens ein Admin/i.test(m) ? "Es muss mindestens ein Admin bleiben" : /Nur für Admins/i.test(m) ? "Nur Admins dürfen das" : m);
  }
  return text ? JSON.parse(text) : null;
}

// ---------- Daten laden und speichern ----------
const leererStand = () => ({ app: "Öllager", datenbankVersion: 6, lieferanten: [], freigaben: [], sorten: [], faesser: [], angebote: [], historie: [] });

async function standorteLaden() {
  try { S.standorte = await rest("GET", "/rest/v1/oellager_standort?select=id,name&order=name"); } catch (e) { /* offline */ }
}
async function verwaltungLaden() {
  try { await verwaltungLadenOnline(); cacheSchreiben("oel_cache_meta", { ich: S.ich, standorte: S.standorte, meine: [...S.meine], aenderbar: [...S.aenderbar] }); }
  catch (e) {
    const c = e.offline && cacheLesen("oel_cache_meta");
    if (!c || c.ich?.user_id !== S.sitzung?.userId) throw e;
    S.ich = c.ich; S.standorte = c.standorte; S.meine = new Set(c.meine); S.aenderbar = new Set(c.aenderbar); S.offline = true;
  }
}
async function verwaltungLadenOnline() {
  const uid = S.sitzung.userId;
  const ich = await rest("GET", `/rest/v1/oellager_nutzer?select=user_id,email,name,rolle,freigegeben&user_id=eq.${uid}`);
  S.ich = ich[0] || null;
  await standorteLaden();
  if (!S.ich?.freigegeben) return;
  if (S.ich.rolle === "admin") {
    // Entwickler: alle Standorte, überall ändern
    S.meine = new Set(S.standorte.map((x) => x.id)); S.aenderbar = new Set(S.meine);
    const zu = await rest("GET", "/rest/v1/oellager_mitglied?select=user_id,standort_id,darf_aendern");
    S.nutzer = (await rest("GET", "/rest/v1/oellager_nutzer?select=user_id,email,name,rolle,freigegeben&order=erstellt"))
      .map((n) => {
        const z = zu.filter((x) => x.user_id === n.user_id);
        return { ...n, standorte: new Set(z.map((x) => x.standort_id)), aendern: new Set(z.filter((x) => x.darf_aendern).map((x) => x.standort_id)) };
      });
  } else {
    const m = await rest("GET", `/rest/v1/oellager_mitglied?select=standort_id,darf_aendern&user_id=eq.${uid}`);
    S.meine = new Set(m.map((x) => x.standort_id)); S.aenderbar = new Set(m.filter((x) => x.darf_aendern).map((x) => x.standort_id));
  }
}
/** Nach der Anmeldung: Freigabe prüfen, dann gewählten Standort öffnen oder zur Standortwahl. */
async function nachAnmeldung(gewuenscht) {
  await verwaltungLaden();
  if (!S.ich?.freigegeben) { S.ansicht = "warten"; return; }
  const ziel = gewuenscht ?? (S.meine.size === 1 ? [...S.meine][0] : null);
  if (ziel != null && S.meine.has(ziel)) { await standortOeffnen(ziel); return; }
  if (gewuenscht != null) S.meldung = "Du bist dem gewählten Standort nicht zugeordnet.";
  S.ansicht = "standortwahl";
}
async function standortOeffnen(id) {
  if (S.ungespeichert && !S.offline) await speichern();
  S.standort = id; localStorage.setItem("oel_standort", String(id));
  S.ansicht = "app"; S.daten = null; zeichnen();
  await laden();
}
const standortName = () => S.standorte.find((x) => x.id === S.standort)?.name || "";
const oberflaeche = () => (S.ansicht === "app" && S.daten?.einstellungen?.oberflaeche) || "glas";
function oberflaecheAnwenden() {
  const o = oberflaeche(), r = document.documentElement;
  if (o === "glas") delete r.dataset.ob; else r.dataset.ob = o;
}
const OBERFLAECHEN = [["glas", "Glas", "Glaskacheln auf farbigem Hintergrund – wie bisher"],
  ["dunkel", "Werkstatt dunkel", "Fast schwarz, große Zahlen, Bernstein als Akzent"],
  ["kompakt", "Klar & kompakt", "Weiß, als Liste – viele Sorten auf einen Blick"],
  ["kennzahlen", "Übersicht mit Kennzahlen", "Kennzahlen-Karte oben, Kacheln zu zweit"]];
const darfAendern = () => !S.offline && (S.ich?.rolle === "admin" || S.aenderbar.has(S.standort));
const istEntwickler = () => S.ich?.rolle === "admin" && S.ich?.freigegeben;
const wartendeAnzahl = () => (istEntwickler() ? S.nutzer.filter((n) => !n.freigegeben).length : 0);

function cacheLesen(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
function cacheSchreiben(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* Speicher voll */ } }

async function laden() {
  let rows;
  try {
    rows = await rest("GET", `/rest/v1/oellager_bestand?select=daten,version,geaendert,geraet,geaendert_von&standort_id=eq.${S.standort}`);
    S.offline = false;
  } catch (e) {
    const c = e.offline && cacheLesen("oel_cache_" + S.standort);
    if (!c) throw e;
    // Offline: zuletzt geladenen Stand nur lesend anzeigen
    S.offline = c.zeit; rows = c.rows;
  }
  if (!S.offline) cacheSchreiben("oel_cache_" + S.standort, { zeit: new Date().toISOString(), rows });
  if (rows.length === 0) { S.daten = leererStand(); S.version = null; S.geaendert = ""; S.geraet = ""; }
  else {
    const d = rows[0].daten;
    for (const k of ["lieferanten", "freigaben", "sorten", "faesser", "angebote", "historie"]) d[k] = d[k] || [];
    S.daten = d; S.version = rows[0].version; S.geaendert = rows[0].geaendert;
    S.geraet = [rows[0].geaendert_von, rows[0].geraet].filter(Boolean).join(" · ");
  }
  S.basis = JSON.parse(JSON.stringify(S.daten));
  S.ungespeichert = false; S.fehler = "";
}

let speicherTimer = null;
function geaendert() {
  S.ungespeichert = true;
  clearTimeout(speicherTimer);
  speicherTimer = setTimeout(speichern, 700);
  zeichnen();
}
/** Speichern mit Versionsprüfung. Hat inzwischen jemand anderes gespeichert, werden beide Stände zusammengeführt. */
async function speichern() {
  if (!S.ungespeichert || S.speichert) return;
  S.speichert = true; kopfZeichnen();
  try {
    // Preisverlauf begrenzen: je Sorte und Quelle die letzten 40 Einträge
    const gruppen = new Map();
    for (const h of S.daten.historie) { const k = h.sorteId + "|" + h.quelle; if (!gruppen.has(k)) gruppen.set(k, []); gruppen.get(k).push(h); }
    S.daten.historie = [...gruppen.values()].flatMap((l) => l.sort((a, b) => b.zeitpunkt - a.zeitpunkt).slice(0, 40)).sort((a, b) => a.zeitpunkt - b.zeitpunkt);
    for (let runde = 0; runde < 4; runde++) {
      const stand = JSON.parse(JSON.stringify(S.daten));
      const v = await rest("POST", "/rest/v1/rpc/oellager_speichern",
        { p_standort: S.standort, p_daten: stand, p_geraet: "Web-App", p_version: S.version });
      if (v != null) {
        S.version = v; S.basis = stand; S.geraet = "Web-App"; S.fehler = ""; S.protokollFuer = null;
        // Während des Speicherns weiter getippt? Dann gleich nochmal
        S.ungespeichert = !Zusammenfuehren.gleich(stand, S.daten);
        if (S.ungespeichert) { clearTimeout(speicherTimer); speicherTimer = setTimeout(speichern, 700); }
        break;
      }
      const rows = await rest("GET", `/rest/v1/oellager_bestand?select=daten,version&standort_id=eq.${S.standort}`);
      if (!rows.length) { S.version = null; continue; }
      S.daten = Zusammenfuehren.zusammenfuehren(S.basis, S.daten, rows[0].daten);
      S.basis = rows[0].daten; S.version = rows[0].version;
      toast("Änderungen eines Kollegen wurden übernommen");
      if (runde === 3) S.fehler = "Zu viele gleichzeitige Änderungen – bitte erneut speichern";
    }
  } catch (e) {
    S.fehler = e.message;
  }
  S.speichert = false; zeichnen();
}

// ---------- Auswertungen ----------
const sortenDer = (kat) => S.daten.sorten.filter((s) => (s.kategorie || "OEL") === kat);
const faesserVon = (id) => S.daten.faesser.filter((f) => f.sorteId === id && !f.leerAm);
const lieferant = (id) => S.daten.lieferanten.find((l) => l.id === id);
const freigabe = (id) => S.daten.freigaben.find((f) => f.id === id);
function gruppen(kat) {
  const sorten = sortenDer(kat).filter((s) => s.aktiv !== false || faesserVon(s.id).length > 0);
  const map = new Map();
  for (const s of sorten) { const k = viskoKey(s.viskositaet); if (!map.has(k)) map.set(k, []); map.get(k).push(s); }
  const zahlen = (k) => { const m = k.match(/(\d+)W(\d+)/); return m ? [Number(m[1]), Number(m[2])] : [999, 999]; };
  return [...map.entries()].map(([key, liste]) => {
    const mit = liste.find((s) => (s.viskositaet || "").trim());
    const titel = mit ? (kat === "OEL" ? mit.viskositaet.trim().toUpperCase() : mit.viskositaet.trim()) : "Ohne " + KATEGORIEN[kat].gruppe;
    const ids = new Set(liste.map((s) => s.id));
    return { key, titel, sorten: liste.sort((a, b) => anzeigename(a).localeCompare(anzeigename(b), "de")),
             faesser: S.daten.faesser.filter((f) => ids.has(f.sorteId) && !f.leerAm) };
  }).sort((a, b) => (a.key === "") - (b.key === "") || zahlen(a.key)[0] - zahlen(b.key)[0] || zahlen(a.key)[1] - zahlen(b.key)[1] || a.key.localeCompare(b.key));
}
function preisMerken(sorteId, quelle, preisGebinde, gebindeL) {
  if (!(gebindeL > 0)) return;
  const lp = preisGebinde / gebindeL;
  const alt = S.daten.historie.filter((h) => h.sorteId === sorteId && h.quelle === quelle).sort((a, b) => b.zeitpunkt - a.zeitpunkt)[0];
  if (alt && Math.abs(alt.literpreis - lp) < 0.0005) return;
  S.daten.historie.push({ id: naechsteId(S.daten.historie), sorteId, quelle, literpreis: lp, preisGebinde, gebindeL, zeitpunkt: Date.now() });
}

// ---------- Oberfläche ----------
function kopfZeichnen() {
  const st = S.ansicht !== "app" ? "" : S.speichert ? "speichert …" : S.ungespeichert ? "nicht gespeichert" :
    S.fehler ? "Fehler: " + S.fehler : S.daten ? ["gespeichert", S.ich?.name || S.sitzung?.email].filter(Boolean).join(" · ") : "";
  $("#kopf").innerHTML = `
    <h1>${S.ansicht === "app" && standortName() ? "Lager " + esc(standortName()) : "Öllager"}<span class="unter status ${S.fehler ? "fehler" : ""}">${esc(st)}</span></h1>
    ${S.sitzung && S.ansicht === "app" ? `
      <button class="knopf klein" data-a="brutto" title="Preisanzeige: Einkauf netto, Einkauf brutto oder Kundenpreis" aria-label="Preisanzeige umschalten">${PREIS_TEXT[S.preisModus]}</button>
      <button class="icon" data-a="menue" aria-haspopup="true" aria-expanded="${!!S.menueOffen}" aria-label="Menü">⋮${wartendeAnzahl() ? `<span class="zaehler">${wartendeAnzahl()}</span>` : ""}</button>
      ${S.menueOffen ? `<div class="menue glas" role="menu">
        <button role="menuitem" data-a="standort-wechseln">⌖ Standort wechseln</button>
        <button role="menuitem" data-a="neu-laden">⟳ Neu laden</button>
        <button role="menuitem" data-a="thema">◐ Hell / Dunkel</button>
        <button role="menuitem" data-a="zwei-faktor">🔐 Zwei-Faktor-Anmeldung</button>
        ${istEntwickler() ? `<button role="menuitem" data-a="entwickler">⚙ Entwicklermenü${wartendeAnzahl() ? ` <span class="zaehler">${wartendeAnzahl()}</span>` : ""}</button>` : ""}
        <button role="menuitem" data-a="abmelden">⎋ Abmelden</button></div>` : ""}` : S.sitzung ? `
      <button class="icon" data-a="abmelden" title="Abmelden" aria-label="Abmelden">⎋</button>` : ""}`;
}

function zeichnen() {
  oberflaecheAnwenden();
  kopfZeichnen();
  const app = $("#app");
  if (S.ansicht !== "app") {
    $("#tabs").hidden = true;
    app.innerHTML = ({ anmelden: loginHtml, registrieren: registrierHtml, warten: warteHtml, standortwahl: standortWahlHtml,
      vergessen: vergessenHtml, "neues-passwort": neuesPasswortHtml, code: codeHtml })[S.ansicht]();
    return;
  }
  if (!S.daten) { app.innerHTML = `<div class="stapel">${[1, 2, 3].map(() => `<div class="glas skelett"></div>`).join("")}</div>`; return; }
  $("#tabs").hidden = false;
  document.body.classList.toggle("nur-lesen", !darfAendern());
  $("#tabs").innerHTML = `<div class="seg" role="tablist">${[["lager", "Lager"], ["sorten", "Sorten"], ["preise", "Preise"], ["auswertung", "Auswertung"], ["stamm", "Stammdaten"]]
    .map(([t, n]) => `<button role="tab" aria-pressed="${S.tab === t}" data-a="tab" data-v="${t}">${n}</button>`).join("")}</div>`;

  let html = "";
  {
    html += `<div class="seg" style="margin-top:12px">${Object.entries(KATEGORIEN)
      .map(([k, v]) => `<button aria-pressed="${S.kat === k}" data-a="kat" data-v="${k}">${v.titel}</button>`).join("")}</div>`;
  }
  if (S.preisModus === "kunde") html += `<div class="banner">🏷️ Kundenpreise: Einkauf + ${fmtZahl(aufschlag())} % Aufschlag + ${S.mwst} % MwSt.</div>`;
  if (typeof S.offline === "string") html += `<div class="banner">📴 Offline – Stand vom ${new Date(S.offline).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}, nur lesen. <button class="knopf klein" data-a="neu-laden">Erneut verbinden</button></div>`;
  else if (S.offline) html += `<div class="banner">📴 Offline – nur lesen</div>`;
  else if (!darfAendern()) html += `<div class="banner">🔒 Nur Leserechte an diesem Standort</div>`;
  html += ({ lager: lagerHtml, sorten: sortenHtml, preise: preiseHtml, auswertung: auswertungHtml, stamm: stammHtml })[S.tab]();
  app.innerHTML = html;
}

const meldungHtml = () => (S.meldung ? `<div class="status ${/angelegt|bestätig/i.test(S.meldung) ? "" : "fehler"}" style="font-size:14px">${esc(S.meldung)}</div>` : "");
const warten = () => (S.laeuft ? `<div class="status">Bitte warten …</div>` : "");

function standortSelect(id = "l-standort") {
  if (!S.standorte.length) return `<p class="neben" style="margin:0">Noch kein Standort angelegt – das geht nach der Anmeldung.</p>`;
  return `<label class="feld"><span>Standort</span><select id="${id}" required>
    <option value="">Bitte wählen</option>
    ${S.standorte.map((x) => `<option value="${x.id}" ${x.id === S.standort ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>`;
}

function loginHtml() {
  return `<form class="login glas" id="login-form">
    <h2 style="margin:0">Anmelden</h2>
    <label class="feld"><span>E-Mail</span><input type="email" id="l-email" autocomplete="username" required value="${esc(S.formEmail ?? localStorage.getItem("oel_email") ?? "")}"></label>
    <label class="feld"><span>Passwort</span><input type="password" id="l-pw" autocomplete="current-password" required minlength="6"></label>
    ${standortSelect()}
    ${meldungHtml()}${warten()}
    <button class="knopf haupt" type="submit" ${S.laeuft ? "disabled" : ""}>Anmelden</button>
    <button class="knopf" type="button" data-a="zu-registrieren">Neu registrieren</button>
    <button class="knopf" type="button" data-a="zu-vergessen" style="border:0;background:transparent">Passwort vergessen?</button>
  </form>`;
}

function vergessenHtml() {
  return `<form class="login glas" id="vergessen-form">
    <h2 style="margin:0">Passwort zurücksetzen</h2>
    <p class="neben" style="margin:0">Du bekommst eine E-Mail mit Link. Darüber legst du hier ein neues Passwort fest – es gilt auch in der Handy-App.</p>
    <label class="feld"><span>E-Mail</span><input type="email" id="v-email" autocomplete="username" required value="${esc(S.formEmail ?? localStorage.getItem("oel_email") ?? "")}"></label>
    ${meldungHtml()}${warten()}
    <button class="knopf haupt" type="submit" ${S.laeuft ? "disabled" : ""}>Link senden</button>
    <button class="knopf" type="button" data-a="zu-anmelden">Zurück zur Anmeldung</button>
  </form>`;
}

function neuesPasswortHtml() {
  return `<form class="login glas" id="passwort-form">
    <h2 style="margin:0">Neues Passwort</h2>
    <p class="neben" style="margin:0">Für ${esc(S.sitzung?.email || "")}</p>
    <label class="feld"><span>Neues Passwort (mind. 6 Zeichen)</span><input type="password" id="n-pw" autocomplete="new-password" required minlength="6"></label>
    <label class="feld"><span>Wiederholen</span><input type="password" id="n-pw2" autocomplete="new-password" required minlength="6"></label>
    ${meldungHtml()}${warten()}
    <button class="knopf haupt" type="submit" ${S.laeuft ? "disabled" : ""}>Passwort speichern</button>
  </form>`;
}

function registrierHtml() {
  return `<form class="login glas" id="registrier-form">
    <h2 style="margin:0">Registrieren</h2>
    <label class="feld"><span>Name</span><input type="text" id="r-name" autocomplete="name" required></label>
    <label class="feld"><span>E-Mail</span><input type="email" id="r-email" autocomplete="username" required></label>
    <label class="feld"><span>Passwort (mind. 6 Zeichen)</span><input type="password" id="r-pw" autocomplete="new-password" required minlength="6"></label>
    <label class="feld"><span>Passwort wiederholen</span><input type="password" id="r-pw2" autocomplete="new-password" required minlength="6"></label>
    <div class="feld"><span class="neben">Standorte (einen oder mehrere)</span>
      ${S.standorte.length ? `<div class="chips" id="r-standorte">${S.standorte.map((x) => `<button type="button" class="chip" data-sid="${x.id}" aria-pressed="false">${esc(x.name)}</button>`).join("")}</div>`
        : `<span class="neben">Noch keine Standorte – der erste Nutzer legt sie nach der Anmeldung an.</span>`}</div>
    <p class="neben" style="margin:0">Nach der Registrierung muss der Entwickler dein Konto freigeben. Neue Nutzer haben zunächst nur Leserechte.</p>
    ${meldungHtml()}${warten()}
    <button class="knopf haupt" type="submit" ${S.laeuft ? "disabled" : ""}>Konto anlegen</button>
    <button class="knopf" type="button" data-a="zu-anmelden">Zurück zur Anmeldung</button>
  </form>`;
}

function warteHtml() {
  return `<div class="login glas"><h2 style="margin:0">Warten auf Freigabe</h2>
    <p style="margin:0">Dein Konto ${esc(S.sitzung?.email)} ist angelegt. Der Entwickler muss es noch freigeben – danach geht es hier weiter.</p>
    ${meldungHtml()}<button class="knopf haupt" data-a="freigabe-pruefen">Erneut prüfen</button></div>`;
}

function standortWahlHtml() {
  const liste = S.standorte.filter((x) => S.meine.has(x.id));
  return `<div class="login glas"><h2 style="margin:0">Standort wählen</h2>
    <p class="neben" style="margin:0">Angemeldet als ${esc(S.ich?.name || S.sitzung?.email)}</p>
    ${liste.length ? liste.map((x) => `<button class="knopf haupt" data-a="standort-oeffnen" data-v="${x.id}">${esc(x.name)}</button>`).join("")
      : `<p style="margin:0">${istEntwickler() ? "Noch kein Standort angelegt – über „Standorte verwalten“ anlegen." : "Dir ist noch kein Standort zugeordnet. Bitte den Entwickler, dich zuzuordnen."}</p>`}
    ${meldungHtml()}${istEntwickler() ? `<button class="knopf" data-a="entwickler">Standorte verwalten</button>` : ""}</div>`;
}

// ---------- Entwicklermenü: nur für den Entwickler, Öffnen mit Passwort bestätigen ----------
// Die Rechte prüft ohnehin die Datenbank; die Bestätigung schützt einen offen stehenden Rechner.
function pinDialog() {
  if (!istEntwickler()) { toast("Das Entwicklermenü ist nur für den Entwickler."); return; }
  if (S.entwicklerBis && Date.now() < S.entwicklerBis) { S.entwicklerOffen = true; verwaltungDialog(); return; }
  dialog("Entwicklermenü öffnen", `<p class="neben" style="margin:0">Bitte mit deinem Passwort bestätigen.</p>
    <input type="password" id="pin" autocomplete="current-password" aria-label="Passwort">
    <div class="status fehler" id="pin-fehler"></div>`,
    `<button class="knopf" data-a="schliessen">Abbrechen</button><button class="knopf haupt" data-a="pin-ok">Öffnen</button>`);
  const f = $("#pin"); f.focus();
  f.addEventListener("keydown", (e) => { if (e.key === "Enter") pinPruefen(); });
}
async function pinPruefen() {
  const pw = $("#pin").value;
  if (pw.length < 6) { $("#pin-fehler").textContent = "Passwort eingeben"; return; }
  try {
    // Nur prüfen – die bestehende (evtl. mit Code bestätigte) Anmeldung bleibt erhalten
    const r = await netz(SB_URL + "/auth/v1/token?grant_type=password", { method: "POST",
      headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: S.sitzung.email, password: pw }) });
    if (!r.ok) throw new Error("Passwort falsch");
    S.entwicklerBis = Date.now() + 10 * 60_000; S.entwicklerOffen = true; verwaltungDialog();
  } catch (e) { $("#pin").value = ""; $("#pin-fehler").textContent = e.message; }
}
function verwaltungDialog() {
  const theme = document.documentElement.dataset.theme || "system";
  const darstellung = `<div class="abschnitt-titel">Darstellung</div>
    <div class="seg">${[["system", "Wie System"], ["light", "Hell"], ["dark", "Dunkel"]].map(([w, t]) => `<button aria-pressed="${theme === w}" data-a="thema-setzen" data-v="${w}">${t}</button>`).join("")}</div>`;
  if (!istEntwickler()) {
    dialog("Entwicklermenü", `<p style="margin:0">Standorte und Rechte verwaltet der Entwickler.</p>${darstellung}`, `<button class="knopf haupt" data-a="schliessen">Fertig</button>`);
    return;
  }
  const quelle = Number(S.quelle) || "";
  dialog("Entwicklermenü", `
    <div class="abschnitt-titel" style="margin-top:0">Standorte</div>
    <div class="glas">${S.standorte.map((x) => {
      const offen = x.id === S.standort && S.ansicht === "app";
      const n = S.nutzer.filter((u) => u.standorte.has(x.id)).length;
      return `<div class="liste-zeile" style="cursor:default;flex-wrap:wrap">
        <div style="flex:1 1 140px"><b>${esc(x.name)}</b> ${offen ? `<span class="pille">geöffnet</span>` : ""}<div class="neben">${n} Nutzer</div></div>
        <div class="reihe" style="margin-left:auto;gap:6px">
          ${offen ? "" : `<button class="knopf klein" data-a="standort-oeffnen" data-v="${x.id}">Öffnen</button>`}
          <button class="knopf klein" data-a="standort-umbenennen" data-v="${x.id}">Umbenennen</button>
          <button class="knopf klein gefahr" data-a="standort-entfernen" data-v="${x.id}">Löschen</button>
        </div></div>`;
    }).join("") || `<div class="leer">Noch keine Standorte.</div>`}</div>
    <div class="reihe" style="margin-top:8px;flex-wrap:wrap;gap:8px">
      <button class="knopf" data-a="vergleich">Standortvergleich</button>
      <button class="knopf" data-a="sicherungen">Sicherungen</button>
      <button class="knopf" data-a="anmeldungen">Anmelde-Protokoll</button>
      <button class="knopf" data-a="fehlerberichte">Fehlerberichte</button></div>
    ${S.ansicht === "app" ? `<div class="abschnitt-titel">Oberfläche für alle am Standort ${esc(standortName())}</div>
    <div class="glas">${OBERFLAECHEN.map(([w, t, b]) => `<label class="liste-zeile" style="cursor:pointer"><input type="radio" name="ob" data-a="ob-setzen" data-v="${w}" ${oberflaeche() === w ? "checked" : ""}>
      <div style="flex:1"><b>${t}</b><div class="neben">${b}</div></div></label>`).join("")}</div>
    <p class="neben" style="margin:0">Gilt für alle Nutzer dieses Standorts, in App und Web-App.</p>` : ""}
    <div class="abschnitt-titel">Neuer Standort</div>
    <input type="text" id="neuer-standort" placeholder="Name, z. B. Werkstatt Nord" value="${esc(S.neuerName || "")}">
    ${S.standorte.length ? `<label class="feld"><span>Lieferanten übernehmen von</span><select id="quelle" data-a="quelle-waehlen">
      <option value="">Keine übernehmen</option>${S.standorte.map((x) => `<option value="${x.id}" ${x.id === quelle ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
      ${quelle ? (S.quellLieferanten.length ? `<div class="chips" id="quell-lieferanten">${S.quellLieferanten.map((l) =>
        `<button type="button" class="chip" data-lid="${l.id}" aria-pressed="true">${esc(l.name)}</button>`).join("")}</div>` : `<span class="neben">Dort sind keine Lieferanten eingetragen.</span>`) : ""}` : ""}
    <button class="knopf haupt" data-a="standort-anlegen">Standort anlegen</button>
    <p class="neben" style="margin:0">Jeder Standort hat eigene Sorten, Fässer und Preise. Übernommene Lieferanten sind danach unabhängige Kopien.</p>
    <div class="abschnitt-titel">Nutzer</div>
    <p class="neben" style="margin:0 4px">Pro Standort: <b>lesen</b> = sieht das Lager, <b>ändern</b> = darf Sorten, Fässer, Preise bearbeiten.</p>
    <div class="glas">${S.nutzer.map((n) => `<div class="liste-zeile" style="cursor:default;flex-wrap:wrap">
        <div style="flex:1;min-width:200px"><b>${esc(n.name || n.email)}</b> ${!n.freigegeben ? `<span class="pille alarm">wartet</span>` : n.rolle === "admin" ? `<span class="pille">Entwickler</span>` : ""}
          <div class="neben">${esc(n.email)}</div>
          ${n.rolle === "admin" ? `<div class="neben">Alle Rechte an allen Standorten</div>` : `<div style="display:grid;gap:4px;margin-top:6px">${S.standorte.map((x) => {
            const zu = n.standorte.has(x.id), ae = n.aendern.has(x.id);
            return `<div class="reihe" style="gap:6px;flex-wrap:wrap"><span style="flex:1;min-width:100px">${esc(x.name)}</span>
              <div class="seg" style="flex:0 0 auto">
                <button type="button" aria-pressed="${!zu}" data-a="recht" data-v="${n.user_id}|${x.id}|kein">kein</button>
                <button type="button" aria-pressed="${zu && !ae}" data-a="recht" data-v="${n.user_id}|${x.id}|lesen">lesen</button>
                <button type="button" aria-pressed="${ae}" data-a="recht" data-v="${n.user_id}|${x.id}|aendern">ändern</button></div></div>`;
          }).join("")}</div>`}</div>
        ${n.user_id === S.sitzung.userId ? `<span class="neben">du</span>` : `<div class="reihe" style="gap:6px;flex-wrap:wrap">
          <button class="knopf klein ${n.freigegeben ? "" : "haupt"}" data-a="nutzer-frei" data-v="${n.user_id}">${n.freigegeben ? "Sperren" : "Freigeben"}</button>
          <button class="knopf klein" data-a="nutzer-admin" data-v="${n.user_id}">${n.rolle === "admin" ? "Kein Entwickler" : "Zum Entwickler machen"}</button>
          <button class="knopf klein gefahr" data-a="konto-entfernen" data-v="${n.user_id}">Konto löschen</button></div>`}
      </div>`).join("")}</div>
    ${darstellung}`,
    `<button class="knopf haupt" data-a="schliessen">Fertig</button>`);
}
const zeitKurz = (iso) => (iso ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
function geraetKurz(ua = "") {
  if (!ua) return "";
  if (/okhttp|Dalvik|Java/i.test(ua)) return "Android-App";
  if (/Android/i.test(ua)) return "Browser (Android)";
  if (/iPhone|iPad/i.test(ua)) return "Browser (iOS)";
  if (/Windows/i.test(ua)) return "Browser (Windows)";
  if (/Mac/i.test(ua)) return "Browser (Mac)";
  return ua.slice(0, 40);
}
function protokollDialog(titel, liste, zeile) {
  dialog(titel, liste.length ? `<div class="glas">${liste.map((o) => { const [a, b] = zeile(o); return `<div class="liste-zeile" style="cursor:default;display:block">${a}<div class="neben">${b}</div></div>`; }).join("")}</div>`
    : `<div class="leer">Keine Einträge. 👍</div>`, `<button class="knopf" data-a="zurueck-entwickler">Zurück</button><button class="knopf haupt" data-a="schliessen">Fertig</button>`);
}
function sicherungenDialog() {
  const gruppen = new Map();
  for (const x of S.sicherungen) { if (!gruppen.has(x.standort_id)) gruppen.set(x.standort_id, []); gruppen.get(x.standort_id).push(x); }
  dialog("Sicherungen", `<p class="neben" style="margin:0">Jeden Sonntag früh wird jeder Standort automatisch gesichert (die letzten 12 bleiben). Beim Zurückholen wird der aktuelle Stand vorher selbst gesichert.</p>
    <button class="knopf haupt" data-a="jetzt-sichern" style="justify-self:start">Jetzt sichern</button>
    ${[...gruppen].map(([sid, l]) => `<div class="abschnitt-titel">${esc(S.standorte.find((y) => y.id === sid)?.name || "Standort " + sid)}</div><div class="glas">${l.map((x) =>
      `<div class="liste-zeile" style="cursor:default"><div style="flex:1"><b>${new Date(x.erstellt).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</b>
        <div class="neben">${esc(x.art)} · Version ${x.version}</div></div><button class="knopf klein" data-a="sicherung-zurueck" data-v="${x.id}">Zurückholen</button></div>`).join("")}</div>`).join("") || `<div class="leer">Noch keine Sicherungen.</div>`}`,
    `<button class="knopf" data-a="zurueck-entwickler">Zurück</button><button class="knopf haupt" data-a="schliessen">Fertig</button>`);
}
function vergleichDialog(rows) {
  S.vergleichRows = rows; const kat = S.vergleichKat || "OEL";
  const name = (id) => S.standorte.find((x) => x.id === id)?.name || "Standort " + id;
  const vk = (v) => String(v || "").toUpperCase().replace(/[\s-]/g, "");
  const alle = rows.flatMap((r) => {
    const so = new Map((r.daten.sorten || []).map((x) => [x.id, x]));
    return (r.daten.faesser || []).filter((f) => !f.leerAm && f.gebindeL > 0 && so.has(f.sorteId)).map((f) => {
      const x = so.get(f.sorteId);
      return { st: r.standort_id, kat: x.kategorie || "OEL", visko: (x.viskositaet || "").trim(), sorte: [x.marke, x.name].filter(Boolean).join(" "), l: f.gebindeL, p: f.preisFass || 0 };
    });
  });
  const schnitt = (l) => { const li = l.reduce((s, f) => s + f.l, 0); return li > 0 ? l.reduce((s, f) => s + f.p, 0) / li : null; };
  const proSt = (l) => [...new Set(l.map((f) => f.st))].map((st) => [st, schnitt(l.filter((f) => f.st === st))]).filter((x) => x[1] != null).sort((a, b) => a[1] - b[1]);
  const zeilen = (paare) => paare.map(([st, p], i) => `<div class="reihe"><span style="flex:1">${esc(name(st))}</span>
    <b style="${i === 0 && paare.length > 1 ? "color:var(--gut)" : "font-weight:400"}">${fmtP(p)}/L</b></div>`).join("");
  const inKat = alle.filter((f) => f.kat === kat);
  const visko = new Map(); for (const f of inKat) { const k = vk(f.visko); if (!visko.has(k)) visko.set(k, []); visko.get(k).push(f); }
  const gleich = new Map(); for (const f of inKat) { const k = (f.sorte + " " + f.visko).toLowerCase().replace(/\s+/g, " ").trim(); if (!gleich.has(k)) gleich.set(k, []); gleich.get(k).push(f); }
  const mehrfach = [...gleich.values()].filter((l) => new Set(l.map((f) => f.st)).size > 1);
  dialog("Standortvergleich", `
    <div class="abschnitt-titel" style="margin-top:0">Bestand je Standort</div>
    <div class="glas">${rows.map((r) => { const l = alle.filter((f) => f.st === r.standort_id);
      return `<div class="liste-zeile" style="cursor:default"><div style="flex:1"><b>${esc(name(r.standort_id))}</b><div class="neben">${l.length} Fässer · Ø Motoröl ${schnitt(l.filter((f) => f.kat === "OEL")) != null ? fmtP(schnitt(l.filter((f) => f.kat === "OEL"))) + "/L" : "–"}</div></div><b>${fmtP(l.reduce((s, f) => s + f.p, 0))}</b></div>`; }).join("")}
      <div class="liste-zeile" style="cursor:default"><div style="flex:1"><b>Alle Standorte</b><div class="neben">${alle.length} Fässer</div></div><b style="color:var(--primary)">${fmtP(alle.reduce((s, f) => s + f.p, 0))}</b></div></div>
    <div class="seg">${Object.entries(KATEGORIEN).map(([k, x]) => `<button aria-pressed="${kat === k}" data-a="vergleich-kat" data-v="${k}">${x.titel}</button>`).join("")}</div>
    <div class="abschnitt-titel">Ø Literpreis je ${KATEGORIEN[kat].gruppe}</div>
    <div class="glas" style="padding:8px 16px">${[...visko.entries()].sort().map(([k, l]) => `<div style="margin:8px 0"><b style="color:${gruppenFarbe(k, kat)}">${esc(l[0].visko || "Ohne")}</b>${zeilen(proSt(l))}</div>`).join("") || `<div class="neben">Keine Fässer.</div>`}</div>
    <div class="abschnitt-titel">Gleiche Sorte an mehreren Standorten</div>
    <div class="glas" style="padding:8px 16px">${mehrfach.map((l) => { const p = proSt(l);
      return `<div style="margin:8px 0"><b>${esc(l[0].sorte + " " + l[0].visko)}</b>${zeilen(p)}${p.length > 1 && p.at(-1)[1] - p[0][1] > 0.005 ? `<div class="neben" style="font-size:12px">${esc(name(p[0][0]))} kauft ${fmtP(p.at(-1)[1] - p[0][1])}/L günstiger ein als ${esc(name(p.at(-1)[0]))}</div>` : ""}</div>`; }).join("") || `<div class="neben">Keine Sorte ist an mehr als einem Standort eingelagert.</div>`}</div>`,
    `<button class="knopf" data-a="zurueck-entwickler">Zurück</button><button class="knopf haupt" data-a="schliessen">Fertig</button>`);
}
function fahrzeugDialog() {
  const f = S.fz || (S.fz = { marke: null, idx: null });
  const liste = Fahrzeuge.liste.map((v, i) => ({ ...v, i })).filter((v) => v.kategorie === S.kat);
  const marken = [...new Set(liste.map((v) => v.hersteller))];
  const v = f.idx != null ? Fahrzeuge.liste[f.idx] : null;
  let treffer = "";
  if (v && v.kategorie === S.kat) {
    const t = sortenDer(S.kat).filter((so) => so.aktiv !== false).filter((so) => Fahrzeuge.passt(v,
      (so.freigabeIds || []).map(freigabe).filter(Boolean).flatMap((x) => [x.bezeichnung, x.hersteller + " " + x.bezeichnung]), so.spezifikation))
      .map((so) => ({ so, lp: schnitt(faesserVon(so.id)) })).sort((a, b) => (a.lp ?? 1e9) - (b.lp ?? 1e9));
    treffer = `<div class="abschnitt-titel">${t.length ? `Passende Sorten (${t.length})` : "Keine passende Sorte im Lager"}</div><div class="glas">${t.map(({ so, lp }, i) =>
      `<div class="liste-zeile" data-a="fahrzeug-sorte" data-v="${so.id}">${badge(so.marke || so.name)}<div style="flex:1"><b>${esc(anzeigename(so))}</b>
        <div class="neben">${esc([so.viskositaet, lieferant(so.lieferantId)?.name, faesserVon(so.id).length + " Fässer"].filter(Boolean).join(" · "))}</div></div>
        <div class="preis ${i === 0 && lp != null ? "gut" : ""}">${lp != null ? fmtP(lp) + "/L" : "–"}</div></div>`).join("") ||
      `<div class="leer">Keine Sorte hat ${esc(v.normen.map((n) => n[0]).join(" + "))}. Prüfe die Freigaben deiner Sorten.</div>`}</div>`;
  }
  dialog("Welches Öl passt?", `<p class="neben" style="margin:0">Ohne Gewähr – maßgeblich ist die Betriebsanleitung. Geprüft werden Freigaben und Spezifikation deiner ${esc(KATEGORIEN[S.kat].titel)}-Sorten.</p>
    <div class="feld"><span class="neben">Marke</span><div class="chips">${marken.map((m) => `<button type="button" class="chip" data-a="fz-marke" data-v="${esc(m)}" aria-pressed="${f.marke === m}">${esc(m)}</button>`).join("")}</div></div>
    ${f.marke ? `<div class="feld"><span class="neben">Motor / Baujahr</span><div style="display:grid;gap:6px">${liste.filter((x) => x.hersteller === f.marke).map((x) =>
      `<button type="button" class="chip" style="text-align:left;border-radius:12px;padding:8px 12px" data-a="fz-motor" data-v="${x.i}" aria-pressed="${f.idx === x.i}">${esc(x.titel)}
        <div style="font-size:12px;opacity:.75">${esc(x.normen.map((n) => n[0]).join(" + "))}${x.viskositaet ? " · meist " + esc(x.viskositaet) : ""}</div></button>`).join("")}</div></div>` : ""}
    ${treffer}`, `<button class="knopf haupt" data-a="schliessen">Fertig</button>`);
}

// ---------- Export: Excel (CSV) und Drucken/PDF ----------
const zahlDe = (v) => (v == null ? "" : Number(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
function csvLaden(name, zeilen) {
  const feld = (t) => { t = String(t ?? ""); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const text = "\uFEFF" + zeilen.map((z) => z.map(feld).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const dateiName = (art, endung) => `Oellager_${art}_${(standortName() || "Lager").replace(/[^A-Za-z0-9ÄÖÜäöüß-]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.${endung}`;
function bestandZeilen() {
  return S.daten.faesser.filter((f) => !f.leerAm).map((f) => ({ f, so: S.daten.sorten.find((x) => x.id === f.sorteId) })).filter((x) => x.so)
    .sort((a, b) => (a.so.kategorie || "OEL").localeCompare(b.so.kategorie || "OEL") || viskoKey(a.so.viskositaet).localeCompare(viskoKey(b.so.viskositaet)) || anzeigename(a.so).localeCompare(anzeigename(b.so), "de"));
}
function bestandCsv() {
  const z = bestandZeilen();
  csvLaden(dateiName("Bestand", "csv"), [["Kategorie", "Viskosität / Typ", "Marke", "Produkt", "Spezifikation", "Lieferant", "Lagerplatz", "Gebinde (L)", "Preis Fass netto (€)", "Literpreis netto (€)", "Lieferdatum"],
    ...z.map(({ f, so }) => [KATEGORIEN[so.kategorie || "OEL"].titel, so.viskositaet, so.marke, so.name, so.spezifikation, lieferant(so.lieferantId)?.name || "", f.lagerplatz, zahlDe(f.gebindeL), zahlDe(f.preisFass), zahlDe(literpreis(f)), f.lieferdatum]),
    ["Summe", "", "", "", "", "", z.length + " Fässer", "", zahlDe(z.reduce((s, x) => s + x.f.preisFass, 0)), "", ""]]);
}
function preiseCsv() {
  const sorten = S.daten.sorten.filter((x) => x.aktiv !== false).sort((a, b) => viskoKey(a.viskositaet).localeCompare(viskoKey(b.viskositaet)) || anzeigename(a).localeCompare(anzeigename(b), "de"));
  csvLaden(dateiName("Preise", "csv"), [["Kategorie", "Viskosität / Typ", "Sorte", "Ø Einkauf netto €/L", ...QUELLEN.map((q) => q.name + " netto €/L"), "Bester Preis"],
    ...sorten.map((so) => {
      const eigen = schnitt(faesserVon(so.id));
      const preise = QUELLEN.map((q) => { const a = S.daten.angebote.find((x) => x.sorteId === so.id && x.quelle === q.code); return a ? angebotLp(a) : null; });
      const best = [...preise.map((p, i) => [QUELLEN[i].name, p]), ["Eigener Einkauf", eigen]].filter((x) => x[1] != null).sort((a, b) => a[1] - b[1])[0];
      return [KATEGORIEN[so.kategorie || "OEL"].titel, so.viskositaet, anzeigename(so), zahlDe(eigen), ...preise.map(zahlDe), best ? best[0] : ""];
    })]);
}
function bestandDrucken() {
  const z = bestandZeilen();
  const w = window.open("", "_blank");
  if (!w) { toast("Bitte Pop-ups für diese Seite erlauben"); return; }
  w.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${esc(dateiName("Bestand", "pdf"))}</title>
    <style>body{font:11px system-ui,Arial,sans-serif;margin:24px}h1{font-size:18px;margin:0}p{color:#666;margin:2px 0 14px}table{border-collapse:collapse;width:100%}
    th,td{padding:4px 6px;border-bottom:1px solid #ddd;text-align:left}th{font-size:10px;text-transform:uppercase;color:#444}td.r,th.r{text-align:right}tfoot td{font-weight:700;border-top:2px solid #333}</style></head><body>
    <h1>Bestandsliste ${standortName() ? "Lager " + esc(standortName()) : ""}</h1><p>Stand ${new Date().toLocaleDateString("de-DE")} · Preise netto</p>
    <table><thead><tr><th>Visk./Typ</th><th>Sorte</th><th>Lieferant</th><th>Lagerplatz</th><th class="r">Gebinde</th><th class="r">Preis Fass</th><th class="r">€/L</th></tr></thead><tbody>
    ${z.map(({ f, so }) => `<tr><td>${esc(so.viskositaet)}</td><td>${esc(anzeigename(so))}</td><td>${esc(lieferant(so.lieferantId)?.name || "")}</td><td>${esc(f.lagerplatz)}</td>
      <td class="r">${fmtZahl(f.gebindeL)} L</td><td class="r">${fmtEur(f.preisFass)}</td><td class="r">${fmtEur(literpreis(f))}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="5">${z.length} Fässer</td><td class="r">${fmtEur(z.reduce((s, x) => s + x.f.preisFass, 0))}</td><td></td></tr></tfoot></table>
    </body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* Fenster zu */ } }, 400);
}

async function verwalten(aktion, erfolg) {
  try {
    await aktion();
    await verwaltungLaden();
    if (erfolg) toast(erfolg);
  } catch (e) { toast(e.message); }
  if (dlg.open && S.entwicklerOffen) verwaltungDialog();
  zeichnen();
}

function summenHtml(sorten, faesser) {
  const sch = schnitt(faesser);
  if (oberflaeche() === "kennzahlen") {
    const lps = faesser.map(literpreis), min = Math.min(...lps), max = Math.max(...lps);
    const pos = sch != null && max - min > 0.005 ? Math.round((sch - min) / (max - min) * 100) : null;
    return `<section class="kz-karte" aria-label="Kennzahlen">
      <div class="reihe" style="align-items:flex-end"><div style="flex:1"><div class="hell">Ø Literpreis ${S.preisModus === "kunde" ? "Kundenpreis" : S.preisModus}</div><div class="kz-gross">${sch != null ? fmtP(sch) : "–"}</div></div>
        <div style="text-align:right"><b style="font-size:24px">${faesser.length}</b><div class="hell">Fässer</div></div>
        <div style="text-align:right;margin-left:14px"><b style="font-size:24px">${sorten.length}</b><div class="hell">Sorten</div></div></div>
      ${pos != null ? `<div class="kz-balken"><i style="left:${pos}%"></i></div><div class="reihe hell"><span style="flex:1">günstigstes Fass ${fmtP(min)}</span><span>teuerstes ${fmtP(max)}</span></div>` : ""}
    </section>`;
  }
  if (oberflaeche() === "kompakt") {
    return `<div class="reihe neben" style="margin-top:12px;justify-content:space-between"><span><b style="color:var(--text)">${faesser.length}</b> Fässer · <b style="color:var(--text)">${sorten.length}</b> Sorten</span>
      <span>Ø <b style="color:var(--text)">${sch != null ? fmtP(sch) : "–"}</b> / L</span></div>`;
  }
  return `<div class="raster3" style="margin-top:12px">
    <div class="glas kachel-zahl"><div class="l">Sorten</div><div class="w">${sorten.length}</div></div>
    <div class="glas kachel-zahl"><div class="l">Fässer</div><div class="w">${faesser.length}</div></div>
    <div class="glas kachel-zahl akzent"><div class="l">Ø Literpreis ${S.preisModus === "kunde" ? "Kundenpreis" : S.preisModus}</div><div class="w">${sch != null ? fmtP(sch) : "–"}</div></div>
  </div>`;
}

function lagerHtml() {
  const gs = gruppen(S.kat);
  const alle = gs.flatMap((g) => g.faesser);
  const lps = alle.map(literpreis);
  const min = Math.min(...lps), max = Math.max(...lps);
  const farbe = (v) => (lps.length < 2 || max - min < 0.005 ? "" : v <= min + 0.005 ? "gut" : v >= max - 0.005 ? "teuer" : "");
  const sorten = sortenDer(S.kat).filter((s) => s.aktiv !== false);
  let html = summenHtml(sorten, alle);
  html += `<div class="reihe" style="margin-top:12px"><input type="search" placeholder="Suchen: Marke, Sorte, Freigabe, Lagerplatz" data-a="suche" value="${esc(S.suche)}">
    ${SPRACHE ? `<button class="knopf" data-a="sprache" title="Sprachsuche" aria-label="Sprachsuche">🎤</button>` : ""}
    <button class="knopf haupt" data-a="sorte-neu">+ Sorte</button></div>
    <button class="knopf" data-a="fahrzeug" style="width:100%;margin-top:10px">🚗 Welches Öl passt? – nach Fahrzeug</button>`;
  const q = S.suche.trim().toLowerCase();
  const passt = (s) => !q || [s.name, s.marke, s.viskositaet, s.spezifikation, lieferant(s.lieferantId)?.name,
    ...(s.freigabeIds || []).map((i) => freigabe(i)?.bezeichnung), ...faesserVon(s.id).map((f) => f.lagerplatz)]
    .some((t) => String(t || "").toLowerCase().includes(q));
  const gefiltert = gs.map((g) => ({ ...g, sorten: g.sorten.filter(passt) })).filter((g) => g.sorten.length);
  if (!gefiltert.length) return html + `<div class="glas leer" style="margin-top:12px">${q ? "Keine Treffer." : `Noch keine ${KATEGORIEN[S.kat].titel}-Sorten. Lege oben eine an.`}</div>`;
  if (oberflaeche() === "kompakt") return html + kompaktHtml(gefiltert, q, farbe);
  if (oberflaeche() === "kennzahlen" && !istBreit()) return html + kennzahlenHtml(gefiltert, q, farbe);
  // Tablet/PC: Liste links, Details der gewählten Viskosität rechts
  const geteilt = istBreit();
  const auswahl = geteilt ? (gefiltert.find((g) => g.key === S.offen) || gefiltert[0]) : null;
  html += geteilt ? `<div class="geteilt"><div class="stapel" style="margin-top:12px">` : `<div class="stapel raster-gruppen">`;
  for (const g of gefiltert) {
    const f = gruppenFarbe(g.key, S.kat);
    const offen = geteilt ? auswahl === g : (q || S.offen === g.key);
    const marken = [...new Set(g.sorten.map((s) => s.marke || s.name).filter(Boolean))].join(" · ");
    const glp = g.faesser.map(literpreis);
    const ab = glp.length ? Math.min(...glp) : null, bis = glp.length ? Math.max(...glp) : null;
    html += `<div class="glas gruppe ${geteilt && offen ? "gewaehlt" : ""}">
      <div class="gruppe-kopf" data-a="gruppe" data-v="${esc(g.key)}" role="button" tabindex="0" aria-expanded="${!!offen}">
        <span class="streifen" style="background:${f}"></span>
        <div class="bestand" style="background:${f}2e"><b style="color:${f}">${g.faesser.length}</b><span>${g.faesser.length === 1 ? "Fass" : "Fässer"}</span></div>
        <div style="flex:1;min-width:0">
          <div class="gruppe-titel" style="color:${f}">${esc(g.titel)}</div>
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(marken || "Ohne Marke")}</div>
          <div class="neben">${g.sorten.length} ${g.sorten.length === 1 ? "Sorte" : "Sorten"} · ${g.faesser.length} ${g.faesser.length === 1 ? "Fass" : "Fässer"}</div>
        </div>
        <div class="preis ${ab != null ? farbe(ab) : ""}">${ab == null ? `<span class="neben">Kein Fass</span>` :
          `${ab === bis ? "" : `<div class="neben" style="font-weight:400">ab</div>`}<div class="preis-gross">${fmtP(ab)}</div><div class="neben" style="font-weight:400">pro Liter${ab !== bis ? " · bis " + fmtP(bis) : ""}</div>`}</div>
      </div>
      ${offen && !geteilt ? `<div class="innen">${g.sorten.map((s) => sorteImLagerHtml(s, farbe)).join("")}</div>` : ""}
    </div>`;
  }
  if (geteilt) {
    const f = gruppenFarbe(auswahl.key, S.kat);
    html += `</div><div class="glas detail"><div class="reihe" style="padding:14px 16px 4px"><span class="streifen" style="background:${f};min-height:28px"></span>
      <b style="font-size:22px;color:${f}">${esc(auswahl.titel)}</b><span class="neben">${auswahl.sorten.length} Sorten · ${auswahl.faesser.length} Fässer</span></div>
      <div class="innen" style="border-top:0;padding-left:16px">${auswahl.sorten.map((s) => sorteImLagerHtml(s, farbe)).join("")}</div></div></div>`;
    return html;
  }
  return html + `</div>`;
}
const istBreit = () => window.innerWidth >= 1000;

/** Oberfläche „Klar & kompakt“: eine Tabellenzeile je Viskosität, aufgeklappt mit den Sorten darunter. */
function kompaktHtml(gruppen, q, farbe) {
  return `<div class="kp-tabelle"><div class="kp-kopf"><span>Visk.</span><span>Marken</span><span class="r">Fässer</span><span class="r">ab € / L</span></div>
    ${gruppen.map((g) => {
      const f = gruppenFarbe(g.key, S.kat), lps = g.faesser.map(literpreis), ab = lps.length ? Math.min(...lps) : null, bis = lps.length ? Math.max(...lps) : null;
      const offen = q || S.offen === g.key;
      const marken = [...new Set(g.sorten.map((s) => s.marke || s.name).filter(Boolean))].join(" · ");
      return `<div class="kp-zeile ${offen ? "offen" : ""}" data-a="gruppe" data-v="${esc(g.key)}" role="button" tabindex="0" aria-expanded="${!!offen}">
          <span style="display:flex;align-items:center;gap:8px;font-weight:800"><span style="width:10px;height:10px;border-radius:50%;background:${f}"></span>${esc(g.titel)}</span>
          <span style="min-width:0"><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(marken || "Ohne Marke")}</span><span class="neben">${g.sorten.length} Sorten${bis != null && bis !== ab ? " · bis " + fmtP(bis) : ""}</span></span>
          <span class="r" style="font-weight:700">${g.faesser.length}</span>
          <span class="r preis ${ab != null ? farbe(ab) : ""}">${ab != null ? `<span class="preis-gross" style="font-size:17px">${fmtP(ab)}</span>` : "–"}</span></div>
        ${offen ? `<div class="innen" style="padding-left:8px">${g.sorten.map((s) => sorteImLagerHtml(s, farbe)).join("")}</div>` : ""}`;
    }).join("")}</div>`;
}

/** Oberfläche „Übersicht mit Kennzahlen“: Kacheln zu zweit, Details darunter. */
function kennzahlenHtml(gruppen, q, farbe) {
  const offen = gruppen.find((g) => g.key === S.offen);
  return `<div class="kz-raster">${gruppen.map((g) => {
      const f = gruppenFarbe(g.key, S.kat), lps = g.faesser.map(literpreis), ab = lps.length ? Math.min(...lps) : null, bis = lps.length ? Math.max(...lps) : null;
      return `<div class="kz-kachel ${offen === g ? "gewaehlt" : ""}" data-a="gruppe" data-v="${esc(g.key)}" role="button" tabindex="0" style="${offen === g ? "outline:2px solid var(--primary)" : ""}">
        <div class="band" style="background:${f}"></div><div class="inhalt">
          <div class="reihe" style="justify-content:space-between;gap:6px"><b style="font-size:21px;color:${f};white-space:nowrap">${esc(g.titel)}</b>
            <span class="pille" style="background:${f}22;color:${f};font-weight:700;white-space:nowrap;margin:0">${g.faesser.length} ${g.faesser.length === 1 ? "Fass" : "Fässer"}</span></div>
          <div class="neben" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc([...new Set(g.sorten.map((s) => s.marke || s.name).filter(Boolean))].join(" · ") || "Ohne Marke")}</div>
          <div class="preis ${ab != null ? farbe(ab) : ""}" style="text-align:left">${ab != null ? `<span class="preis-gross" style="font-size:24px">${fmtP(ab)}</span>` : `<span class="neben">Kein Fass</span>`}</div>
          <div class="neben" style="font-size:12px">${ab != null ? (bis !== ab ? "ab · bis " + fmtP(bis) : "pro Liter") : ""}</div></div></div>`;
    }).join("")}
    ${darfAendern() ? `<button class="kz-kachel" data-a="sorte-neu" style="border:2px dashed var(--kante);background:transparent;min-height:140px;font-weight:700;color:var(--primary)">+ Neue Sorte</button>` : ""}</div>
    ${offen ? `<div class="glas" style="margin-top:12px"><div class="innen" style="border-top:0;padding-left:16px">${offen.sorten.map((s) => sorteImLagerHtml(s, farbe)).join("")}</div></div>` : ""}`;
}

function sorteImLagerHtml(s, farbe) {
  const fs = faesserVon(s.id).sort((a, b) => String(a.lagerplatz).localeCompare(String(b.lagerplatz), "de"));
  const sch = schnitt(fs);
  const fr = (s.freigabeIds || []).map(freigabe).filter(Boolean);
  return `<div class="sorte">
    <div class="reihe">${badge(s.marke || s.name)}
      <div style="flex:1;min-width:0"><b>${esc(anzeigename(s))}</b>${s.aktiv === false ? ` <span class="pille">ersetzt</span>` : ""}${s.nachbestellen ? ` <span class="pille alarm">nachbestellen</span>` : ""}
        <div class="neben">${esc([s.spezifikation, s.lieferform, lieferant(s.lieferantId)?.name].filter(Boolean).join(" · "))}</div></div>
      <div class="preis">${sch != null ? "Ø " + fmtP(sch) + " / L" : ""}</div>
      <button class="knopf klein" data-a="sorte-bearbeiten" data-v="${s.id}">Ändern</button></div>
    ${fr.length ? `<div style="margin:6px 0 0 42px">${fr.map((f) => `<span class="pille">${esc(f.bezeichnung)}</span>`).join("")}</div>` : ""}
    <div style="margin-left:42px">
      ${fs.map((f) => `<div class="fass" data-a="fass-bearbeiten" data-v="${f.id}" role="button" tabindex="0">
        <div style="flex:1"><b>${esc(f.lagerplatz || "Ohne Lagerplatz")}</b>
          <div class="neben">Gebinde ${fmtZahl(f.gebindeL)} L${f.lieferdatum ? " · geliefert " + esc(f.lieferdatum) : ""}</div></div>
        <div class="preis">${fmtP(f.preisFass)}<div class="neben" style="font-weight:400">pro Fass</div></div>
        <div class="preis ${farbe(literpreis(f))}" style="min-width:86px">${fmtP(literpreis(f))}<div class="neben" style="font-weight:400">pro Liter</div></div>
      </div>`).join("")}
      <button class="knopf klein" style="margin-top:8px" data-a="fass-neu" data-v="${s.id}">+ Fass</button>
    </div>
  </div>`;
}

function sortenHtml() {
  const q = S.suche.trim().toLowerCase();
  const sorten = sortenDer(S.kat).filter((s) => !q || [s.name, s.marke, s.viskositaet, s.spezifikation, s.artikelnummer, s.ean]
    .some((t) => String(t || "").toLowerCase().includes(q))).sort((a, b) => anzeigename(a).localeCompare(anzeigename(b), "de"));
  let html = `<div class="reihe" style="margin-top:12px"><input type="search" placeholder="Sorten durchsuchen" data-a="suche" value="${esc(S.suche)}">
    <button class="knopf haupt" data-a="sorte-neu">+ Sorte</button></div>`;
  if (!sorten.length) return html + `<div class="glas leer" style="margin-top:12px">Keine Sorten.</div>`;
  html += `<div class="glas" style="margin-top:12px">`;
  for (const s of sorten) {
    const fs = faesserVon(s.id), sch = schnitt(fs);
    html += `<div class="liste-zeile" data-a="sorte-bearbeiten" data-v="${s.id}" role="button" tabindex="0">${badge(s.marke || s.name)}
      <div style="flex:1;min-width:0"><b>${esc(anzeigename(s))}</b>${s.aktiv === false ? ` <span class="pille">ersetzt</span>` : ""}
      <div class="neben">${esc([s.viskositaet, s.spezifikation, lieferant(s.lieferantId)?.name, fs.length + (fs.length === 1 ? " Fass" : " Fässer")].filter(Boolean).join(" · "))}</div></div>
      <div class="preis">${sch != null ? "Ø " + fmtP(sch) + " / L" : "–"}</div></div>`;
  }
  return html + `</div>`;
}

function preiseHtml() {
  const sorten = sortenDer(S.kat).filter((s) => s.aktiv !== false).sort((a, b) => viskoKey(a.viskositaet).localeCompare(viskoKey(b.viskositaet)) || anzeigename(a).localeCompare(anzeigename(b), "de"));
  let html = `<p class="neben" style="margin:12px 4px 0">Preise je Lieferant antippen zum Eintragen. Rabatte aus der Android-App werden hier nicht abgezogen.</p>`;
  if (!sorten.length) return html + `<div class="glas leer" style="margin-top:12px">Keine Sorten.</div>`;
  html += `<div class="stapel">`;
  for (const s of sorten) {
    const eigen = schnitt(faesserVon(s.id));
    const ang = S.daten.angebote.filter((a) => a.sorteId === s.id);
    const best = ang.filter((a) => angebotLp(a) != null).sort((a, b) => angebotLp(a) - angebotLp(b))[0];
    html += `<div class="glas" style="padding:14px 16px">
      <div class="reihe">${badge(s.marke || s.name)}<b style="flex:1">${esc(anzeigename(s))}</b><span class="neben">${esc(s.viskositaet || "")}</span></div>
      ${s.zielpreis ? `<span class="pille alarm" style="margin-top:6px">Preisalarm bei ≤ ${fmtP(s.zielpreis)} / L</span>` : ""}
      <div class="reihe" style="margin-top:8px"><span style="flex:1">Dein Einkauf</span><span class="preis">${eigen != null ? "Ø " + fmtP(eigen) + " / L" : `<span class="neben">kein Fass</span>`}</span></div>
      ${QUELLEN.map((q) => {
        const a = ang.find((x) => x.quelle === q.code); const lp = a ? angebotLp(a) : null;
        return `<div class="fass" data-a="angebot" data-v="${s.id}|${q.code}" role="button" tabindex="0">
          <div style="flex:1"><b>${q.name}</b><div class="neben">${a ? esc([a.artikelnummer && "Art.-Nr. " + a.artikelnummer, a.gebindeL && fmtZahl(a.gebindeL) + " L", a.stand].filter(Boolean).join(" · ")) : "Noch kein Preis – antippen"}</div></div>
          <div class="preis">${lp != null ? fmtP(lp) + " / L" : "–"}${best && a === best ? `<div><span class="pille bester">Bester Preis</span></div>` : ""}</div></div>`;
      }).join("")}
      ${best && eigen ? `<div class="neben" style="margin-top:8px;font-weight:600">${angebotLp(best) < eigen - 0.005 ? `Bester Preis ist ${Math.round((eigen - angebotLp(best)) / eigen * 100)} % günstiger als dein Einkauf.` : "Dein Einkauf ist günstiger oder gleich."}</div>` : ""}
    </div>`;
  }
  return html + `</div>`;
}

// ---------- Auswertung: Änderungsprotokoll (Verbrauch und Bestandswert folgen darüber) ----------
const PROTOKOLL_BEREICH = { sorten: "Sorte", faesser: "Fass", lieferanten: "Lieferant", freigaben: "Freigabe", angebote: "Preis", lager: "Lager" };
async function protokollLaden() {
  try {
    S.protokoll = await rest("GET", `/rest/v1/oellager_protokoll?select=zeit,wer,geraet,bereich,aktion,text&standort_id=eq.${S.standort}&order=zeit.desc&limit=300`);
    S.protokollFuer = S.standort;
  } catch (e) { S.protokoll = null; S.protokollFehler = e.message; }
  if (S.tab === "auswertung") zeichnen();
}
function protokollHtml() {
  if (S.protokollFuer !== S.standort) { protokollLaden(); return `<div class="glas leer">Wird geladen …</div>`; }
  if (!S.protokoll) return `<div class="glas leer">${esc(S.protokollFehler || "Nicht verfügbar")}</div>`;
  if (!S.protokoll.length) return `<div class="glas leer">Noch keine Änderungen aufgezeichnet.</div>`;
  const heute = new Date().toDateString(), gestern = new Date(Date.now() - 864e5).toDateString();
  const tage = new Map();
  for (const e of S.protokoll) {
    const d = new Date(e.zeit), k = d.toDateString();
    const titel = k === heute ? "Heute" : k === gestern ? "Gestern" : d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    if (!tage.has(titel)) tage.set(titel, []);
    tage.get(titel).push(e);
  }
  return [...tage].map(([t, liste]) => `<div class="abschnitt-titel">${esc(t)}</div><div class="glas">${liste.map((e) =>
    `<div class="liste-zeile" style="cursor:default;align-items:flex-start"><div style="flex:1"><b>${esc(PROTOKOLL_BEREICH[e.bereich] || e.bereich)} ${esc(e.aktion)}:</b> ${esc(e.text)}
      <div class="neben">${[new Date(e.zeit).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }), e.wer, e.geraet].filter(Boolean).map(esc).join(" · ")}</div></div></div>`).join("")}</div>`).join("");
}
function datumAus(t) {
  const x = String(t || "").trim();
  let m = x.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) return new Date(Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = x.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
function balken(label, wert, max, text, farbe = "var(--primary)") {
  const pr = max > 0 && wert > 0 ? Math.max(2, Math.round((wert / max) * 100)) : 0;
  return `<div style="display:grid;grid-template-columns:62px 1fr;gap:8px;align-items:center;margin:6px 0">
    <span class="neben">${label}</span><div><div style="height:10px;border-radius:5px;background:${farbe};width:${pr}%"></div>
    <div class="neben" style="font-size:12px">${text}</div></div></div>`;
}
function auswertungBestandHtml() {
  const ids = new Set(sortenDer(S.kat).map((x) => x.id));
  const alle = S.daten.faesser.filter((f) => ids.has(f.sorteId));
  const heute = new Date();
  const monate = [5, 4, 3, 2, 1, 0].map((i) => new Date(heute.getFullYear(), heute.getMonth() - i, 1));
  const werte = monate.map((m, i) => {
    const stichtag = i === 5 ? heute : new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59);
    return alle.filter((f) => { const g = datumAus(f.lieferdatum), l = datumAus(f.leerAm); return (!g || g <= stichtag) && (!l || l > stichtag); })
      .reduce((s, f) => s + (f.preisFass || 0), 0);
  });
  const leer = alle.filter((f) => f.leerAm).map((f) => ({ f, d: datumAus(f.leerAm) })).filter((x) => x.d);
  const proMonat = monate.map((m) => leer.filter((x) => x.d.getFullYear() === m.getFullYear() && x.d.getMonth() === m.getMonth()).map((x) => x.f));
  const maxW = Math.max(...werte, 0.01), maxL = Math.max(...proMonat.map((l) => l.reduce((s, f) => s + f.gebindeL, 0)), 0.01);
  const aktiv = alle.filter((f) => !f.leerAm);
  return `<div class="raster3" style="margin-top:12px">
      <div class="glas kachel-zahl"><div class="l">Fässer im Bestand</div><div class="w">${aktiv.length}</div></div>
      <div class="glas kachel-zahl akzent"><div class="l">Bestandswert</div><div class="w">${fmtP(aktiv.reduce((s, f) => s + f.preisFass, 0))}</div></div>
      <div class="glas kachel-zahl"><div class="l">Leer gemeldet</div><div class="w">${leer.length}</div></div></div>
    <div class="abschnitt-titel">Bestandswert der letzten 6 Monate</div>
    <div class="glas" style="padding:10px 16px">${monate.map((m, i) => balken(`${MONATE[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`, werte[i], maxW, fmtP(werte[i]))).join("")}
      <div class="neben" style="font-size:12px">Stand jeweils am Monatsende, berechnet aus Lieferdatum und „Fass leer“.</div></div>
    <div class="abschnitt-titel">Verbrauch (leer gemeldete Fässer)</div>
    <div class="glas" style="padding:10px 16px">${leer.length ? monate.map((m, i) => {
      const l = proMonat[i], liter = l.reduce((s, f) => s + f.gebindeL, 0);
      return balken(`${MONATE[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`, liter, maxL,
        `${l.length} ${l.length === 1 ? "Fass" : "Fässer"} · ${fmtZahl(liter)} L · ${fmtP(l.reduce((s, f) => s + f.preisFass, 0))}`, "var(--akzent)");
    }).join("") : `<div class="neben">Noch kein Fass als leer gemeldet. Fass antippen → „Fass leer“.</div>`}</div>
    ${leer.length ? `<div class="glas" style="margin-top:8px">${leer.sort((a, b) => b.d - a.d).slice(0, 15).map(({ f, d }) => {
      const so = S.daten.sorten.find((x) => x.id === f.sorteId);
      return `<div class="liste-zeile" style="cursor:default"><div style="flex:1"><b>${esc(so ? anzeigename(so) : "Sorte gelöscht")}</b>
        <div class="neben">leer seit ${d.toLocaleDateString("de-DE")} · ${esc([f.lagerplatz, fmtZahl(f.gebindeL) + " L", fmtP(f.preisFass)].filter(Boolean).join(" · "))}</div></div>
        <button class="knopf klein" data-a="fass-aktiv" data-v="${f.id}">Wieder aktiv</button></div>`;
    }).join("")}</div>` : ""}`;
}
function auswertungHtml() {
  return `<div class="reihe" style="margin-top:12px;flex-wrap:wrap;gap:8px">
      <button class="knopf klein" data-a="export-bestand">Bestand als Excel</button>
      <button class="knopf klein" data-a="export-preise">Preise als Excel</button>
      <button class="knopf klein" data-a="export-druck">Bestand drucken / PDF</button></div>` + auswertungBestandHtml() + `<div class="reihe" style="margin-top:18px"><b style="flex:1;font-size:17px">Änderungsprotokoll</b>
    <button class="knopf klein" data-a="protokoll-neu">Aktualisieren</button></div>${protokollHtml()}`;
}

function stammHtml() {
  const verkauf = `<div class="abschnitt-titel">Verkaufspreis</div><div class="glas" style="padding:12px 16px">
    <div class="reihe"><label class="feld" style="flex:1"><span>Aufschlag auf den Einkaufspreis für ${esc(standortName() || "diesen Standort")} (%)</span>
      <input type="text" id="aufschlag" inputmode="decimal" value="${fmtZahl(aufschlag())}" ${darfAendern() ? "" : "disabled"}></label>
      <button class="knopf haupt" data-a="aufschlag-speichern" style="align-self:end">Speichern</button></div>
    <div class="neben" style="margin-top:6px">Kundenpreis = Einkauf netto + Aufschlag + ${S.mwst} % MwSt. Anzeige über den Knopf oben (Netto → Brutto → Kunde). Gilt für alle Nutzer dieses Standorts.</div></div>`;
  return verkauf + stammHtmlRest();
}
function stammHtmlRest() {
  const lief = [...S.daten.lieferanten].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const fr = S.daten.freigaben.filter((f) => !f.kategorie || f.kategorie === S.kat)
    .sort((a, b) => a.hersteller.localeCompare(b.hersteller, "de") || a.bezeichnung.localeCompare(b.bezeichnung, "de"));
  let html = `<div class="abschnitt-titel">Lieferanten</div><div class="glas">`;
  html += lief.map((l) => `<div class="liste-zeile" data-a="lieferant" data-v="${l.id}" role="button" tabindex="0">${badge(l.name)}
    <div style="flex:1"><b>${esc(l.name)}</b><div class="neben">${esc([l.ansprechpartner, l.telefon, l.email].filter(Boolean).join(" · "))}</div></div></div>`).join("")
    || `<div class="leer">Noch keine Lieferanten.</div>`;
  html += `</div><button class="knopf" style="margin-top:8px" data-a="lieferant" data-v="neu">+ Lieferant</button>`;
  html += `<div class="abschnitt-titel">Herstellerfreigaben (${KATEGORIEN[S.kat].titel})</div><div class="glas">`;
  html += fr.map((f) => {
    const n = S.daten.sorten.filter((s) => (s.freigabeIds || []).includes(f.id)).length;
    return `<div class="liste-zeile" data-a="freigabe" data-v="${f.id}" role="button" tabindex="0"><div style="flex:1"><b>${esc(f.bezeichnung)}</b><div class="neben">${esc(f.hersteller)}</div></div><span class="neben">${n} ${n === 1 ? "Sorte" : "Sorten"}</span></div>`;
  }).join("") || `<div class="leer">Noch keine Freigaben.</div>`;
  return html + `</div><button class="knopf" style="margin-top:8px" data-a="freigabe" data-v="neu">+ Freigabe</button>`;
}

// ---------- Zwei-Faktor-Anmeldung (Authenticator-App) ----------
async function faktoren() {
  const r = await netz(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + (await token()) } });
  const j = await r.json();
  return (j.factors || []).filter((f) => f.factor_type === "totp");
}
async function authMitToken(methode, pfad, body) {
  const r = await netz(SB_URL + pfad, { method: methode, headers: { apikey: SB_KEY, Authorization: "Bearer " + (await token()), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 422 || /invalid/i.test(j.msg || "") ? "Code falsch oder abgelaufen" : (j.msg || j.message || "Fehler " + r.status));
  return j;
}
async function codePruefenUndAnmelden(faktorId, code) {
  const ch = await authMitToken("POST", `/auth/v1/factors/${faktorId}/challenge`, {});
  const j = await authMitToken("POST", `/auth/v1/factors/${faktorId}/verify`, { challenge_id: ch.id, code });
  sitzungSpeichern(sitzungAus(j));
}
async function zweiFaktorDialog() {
  let liste = [];
  try { liste = await faktoren(); } catch (e) { toast(e.message); return; }
  const aktiv = liste.some((f) => f.status === "verified");
  dialog("Zwei-Faktor-Anmeldung", aktiv
    ? `<p style="margin:0">Ist eingeschaltet. Bei jeder Anmeldung mit Passwort wird zusätzlich ein Code aus deiner Authenticator-App abgefragt.</p>`
    : `<p style="margin:0">Zusätzlich zum Passwort fragt die Anmeldung einen 6-stelligen Code aus einer Authenticator-App ab (z. B. Google oder Microsoft Authenticator).
       Für das Entwicklerkonto gelten die Entwicklerrechte dann nur nach Code-Eingabe.</p><div id="zf-einrichtung"></div>`,
    aktiv ? `<button class="knopf gefahr" data-a="zf-aus">Ausschalten</button><button class="knopf haupt" data-a="schliessen">Schließen</button>`
      : `<button class="knopf" data-a="schliessen">Schließen</button><button class="knopf haupt" data-a="zf-einrichten">Einrichten</button>`);
}
async function zweiFaktorEinrichten() {
  try {
    for (const f of await faktoren()) if (f.status !== "verified") await authMitToken("DELETE", `/auth/v1/factors/${f.id}`);
    const j = await authMitToken("POST", "/auth/v1/factors", { factor_type: "totp", friendly_name: "Öllager " + (Date.now() % 10000), issuer: "Öllager" });
    S.zfId = j.id;
    $("#zf-einrichtung").innerHTML = `<p class="neben">1. Code mit der Authenticator-App scannen oder den Schlüssel abtippen:</p>
      <img src="${esc(j.totp.qr_code)}" alt="QR-Code" style="width:200px;height:200px;background:#fff;border-radius:12px;padding:8px;justify-self:center">
      <code style="user-select:all;font-size:13px;word-break:break-all">${esc(j.totp.secret.replace(/(.{4})/g, "$1 "))}</code>
      <label class="feld"><span>2. Angezeigten Code eingeben</span><input type="text" id="zf-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>
      <button class="knopf haupt" data-a="zf-bestaetigen">Bestätigen</button>`;
    $("#zf-einrichtung").style.display = "grid"; $("#zf-einrichtung").style.gap = "8px";
  } catch (e) { toast(e.message); }
}
async function zweiFaktorBestaetigen() {
  try { await codePruefenUndAnmelden(S.zfId, $("#zf-code").value.trim()); dlg.close(); toast("Zwei-Faktor-Anmeldung ist eingeschaltet"); }
  catch (e) { toast(e.message); }
}
async function zweiFaktorAus() {
  try { for (const f of await faktoren()) await authMitToken("DELETE", `/auth/v1/factors/${f.id}`); dlg.close(); toast("Zwei-Faktor-Anmeldung ausgeschaltet"); }
  catch (e) { toast("Zum Ausschalten bitte zuerst mit Code anmelden (abmelden und neu anmelden)."); }
}
function codeHtml() {
  return `<form class="login glas" id="code-form">
    <h2 style="margin:0">Bestätigungscode</h2>
    <p class="neben" style="margin:0">Öffne deine Authenticator-App und gib den 6-stelligen Code für „Öllager“ ein.</p>
    <label class="feld"><span>Code</span><input type="text" id="c-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></label>
    ${meldungHtml()}${warten()}
    <button class="knopf haupt" type="submit" ${S.laeuft ? "disabled" : ""}>Bestätigen</button>
    <button class="knopf" type="button" data-a="abmelden-still">Abbrechen</button>
  </form>`;
}

// ---------- Sprachsuche (Chrome/Edge/Safari) ----------
const SPRACHE = window.SpeechRecognition || window.webkitSpeechRecognition;
function sprachZuSuche(text) {
  let t = text.toLowerCase();
  const zahlen = { null: "0", fünf: "5", zehn: "10", fünfzehn: "15", zwanzig: "20", dreißig: "30", vierzig: "40", fünfzig: "50", sechzig: "60" };
  for (const [w, z] of Object.entries(zahlen)) t = t.replace(new RegExp("(^|\\s)" + w + "(?=\\s|$)", "g"), "$1" + z);
  let m = t.match(/(\d{1,2})\s*-?\s*w\s*-?\s*(\d{2})/);
  if (m) return `${m[1]}W-${m[2]}`;
  m = t.match(/\bg\s*(\d{2})\s*(evo|plus plus|plus|\+\+|\+)?/);
  if (m) return "G" + m[1] + ({ evo: "evo", "plus plus": "++", "++": "++", plus: "+", "+": "+" }[m[2]] || "");
  const fuell = new Set("welches welcher welche haben hab wir gibt es noch da öl oel motoröl das der die im lager zeig zeige mir suche such nach ein eine wo ist steht liegt von mit bitte vorrätig auf an".split(" "));
  return t.replace(/[?!.,]/g, " ").split(/\s+/).filter((w) => w && !fuell.has(w)).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function spracheStarten() {
  const r = new SPRACHE(); r.lang = "de-DE"; r.interimResults = false; r.maxAlternatives = 1;
  r.onresult = (e) => { S.suche = sprachZuSuche(e.results[0][0].transcript); S.offen = null; zeichnen(); toast("Gesucht: " + S.suche); };
  r.onerror = (e) => toast(e.error === "not-allowed" ? "Mikrofon nicht erlaubt" : "Nichts verstanden – bitte nochmal");
  r.start(); toast("Sprich jetzt … z. B. „Welches 5W-30 haben wir?“");
}

// ---------- Dialoge ----------
const dlg = $("#dialog");
dlg.addEventListener("close", () => { S.entwicklerOffen = false; });
function dialog(titel, inhalt, knoepfe) {
  $("#dialog-innen").innerHTML = `<h2>${esc(titel)}</h2>${inhalt}<div class="reihe" style="justify-content:flex-end;flex-wrap:wrap">${knoepfe}</div>`;
  if (!dlg.open) dlg.showModal();
}
const feld = (id, label, wert = "", typ = "text", extra = "") =>
  `<label class="feld"><span>${esc(label)}</span><input type="${typ}" id="${id}" value="${esc(wert)}" ${extra}></label>`;
const wert = (id) => ($("#" + id)?.value ?? "").trim();

function sorteDialog(s) {
  const neu = !s;
  s = s || { id: 0, name: "", marke: "", viskositaet: "", spezifikation: "", lieferantId: null, artikelnummer: "", notiz: "", aktiv: true,
             ersetztDurchId: null, kategorie: S.kat, lieferform: "", ean: "", zielpreis: null, nachbestellen: false, freigabeIds: [] };
  const k = KATEGORIEN[s.kategorie || "OEL"];
  const gewaehlt = new Set(s.freigabeIds || []);
  const fr = S.daten.freigaben.filter((f) => !f.kategorie || f.kategorie === (s.kategorie || "OEL"));
  dialog(neu ? `Neue Sorte (${k.titel})` : "Sorte ändern", `
    ${feld("d-marke", "Marke", s.marke)}${feld("d-name", "Produktname", s.name)}
    ${feld("d-visko", k.gruppe, s.viskositaet, "text", `placeholder="${k.platzhalter}" list="d-visko-liste"`)}
    <datalist id="d-visko-liste">${k.vorschlaege.map((v) => `<option value="${v}">`).join("")}</datalist>
    ${feld("d-spez", "Spezifikation", s.spezifikation)}
    ${s.kategorie === "KUEHL" ? feld("d-form", "Lieferform", s.lieferform, "text", `placeholder="Konzentrat oder Fertiggemisch -37 °C"`) : ""}
    <label class="feld"><span>Lieferant</span><select id="d-lief"><option value="">Kein Lieferant</option>
      ${S.daten.lieferanten.map((l) => `<option value="${l.id}" ${l.id === s.lieferantId ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>
    ${feld("d-artnr", "Artikelnummer beim Lieferanten", s.artikelnummer)}${feld("d-ean", "EAN / Barcode", s.ean)}
    ${feld("d-ziel", "Preisalarm: Zielpreis €/L (netto)", s.zielpreis != null ? fmtZahl(s.zielpreis) : "", "text", `inputmode="decimal"`)}
    <div class="feld"><span class="neben">Herstellerfreigaben</span><div class="chips" id="d-fr">
      ${fr.map((f) => `<button type="button" class="chip" data-fid="${f.id}" aria-pressed="${gewaehlt.has(f.id)}">${esc(f.bezeichnung)}</button>`).join("") || `<span class="neben">Noch keine Freigaben (Stammdaten).</span>`}</div></div>
    <label class="reihe"><input type="checkbox" id="d-nach" ${s.nachbestellen ? "checked" : ""}> Auf die Nachbestell-Liste</label>
    ${neu ? "" : preisentwicklungHtml(s.id)}
    ${neu ? "" : `<div class="feld"><span class="neben">Fotos und Datenblätter</span><div id="blaetter" class="chips"><span class="neben">Wird geladen …</span></div>
      ${darfAendern() ? `<label class="knopf klein" style="justify-self:start;cursor:pointer">+ Foto oder PDF<input type="file" id="blatt-datei" accept="image/*,application/pdf" capture="environment" hidden></label>` : ""}</div>`}
    <label class="feld"><span>Notiz</span><textarea id="d-notiz" rows="2">${esc(s.notiz)}</textarea></label>`,
    `${neu ? "" : `<button class="knopf gefahr" data-a="sorte-loeschen" data-v="${s.id}">Löschen</button>`}
     <button class="knopf" data-a="schliessen">Abbrechen</button><button class="knopf haupt" data-a="sorte-speichern" data-v="${neu ? 0 : s.id}">Speichern</button>`);
  if (!neu) {
    S.blattSorte = s.id; blaetterLaden(s.id);
    $("#blatt-datei")?.addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const stempel = new Date().toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "");
      const basis = blattName(f.name.replace(/\.[^.]+$/, "")).slice(0, 40) || "Datenblatt";
      const endung = (f.name.match(/\.([A-Za-z0-9]{2,5})$/) || [, f.type === "application/pdf" ? "pdf" : "jpg"])[1].toLowerCase();
      toast("Wird hochgeladen …");
      try { await speicher("POST", `/storage/v1/object/datenblaetter/${S.standort}/${s.id}/${encodeURIComponent(`${basis}_${stempel}.${endung}`)}`, f, f.type || "application/octet-stream"); toast("Für alle Nutzer gespeichert"); }
      catch (err) { toast(err.message); }
      blaetterLaden(s.id);
    });
  }
  $("#d-fr").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
  });
}
/** Einkaufspreise je Liter über die Lieferungen als kleines Liniendiagramm. */
function preisentwicklungHtml(sorteId) {
  const h = S.daten.historie.filter((x) => x.sorteId === sorteId && x.quelle === "EINKAUF").sort((a, b) => a.zeitpunkt - b.zeitpunkt);
  if (h.length < 2) return h.length ? `<div class="neben">Einkauf bisher: ${fmtP(h[0].literpreis)} / L (eine Lieferung)</div>` : "";
  const w = 300, ht = 70, min = Math.min(...h.map((x) => x.literpreis)), max = Math.max(...h.map((x) => x.literpreis));
  const t0 = h[0].zeitpunkt, t1 = h.at(-1).zeitpunkt;
  const pt = (x) => [(t1 === t0 ? w / 2 : (x.zeitpunkt - t0) / (t1 - t0) * (w - 10) + 5), (max === min ? ht / 2 : ht - 6 - (x.literpreis - min) / (max - min) * (ht - 12))];
  const pfad = h.map((x, i) => (i ? "L" : "M") + pt(x).map((v) => v.toFixed(1)).join(" ")).join(" ");
  const diff = (h.at(-1).literpreis / h[0].literpreis - 1) * 100;
  return `<div class="feld"><span class="neben">Preisentwicklung Einkauf (${h.length} Lieferungen)</span>
    <svg viewBox="0 0 ${w} ${ht}" style="width:100%;height:70px;background:var(--feld);border-radius:12px" role="img" aria-label="Preisentwicklung">
      <path d="${pfad}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round"/>
      ${h.map((x) => { const [a, b] = pt(x); return `<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="3.5" fill="var(--primary)"><title>${new Date(x.zeitpunkt).toLocaleDateString("de-DE")}: ${fmtP(x.literpreis)}/L</title></circle>`; }).join("")}
    </svg>
    <div class="neben">${new Date(t0).toLocaleDateString("de-DE")}: ${fmtP(h[0].literpreis)}/L → ${new Date(t1).toLocaleDateString("de-DE")}: ${fmtP(h.at(-1).literpreis)}/L
      <b style="color:${diff > 0.5 ? "var(--teuer)" : diff < -0.5 ? "var(--gut)" : "inherit"}">(${diff > 0 ? "+" : ""}${Math.round(diff)} %)</b></div></div>`;
}

// ---------- Fotos und Datenblätter (Supabase Storage, Ordner <standort>/<sorte>/) ----------
const blattName = (n) => n.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss").replace(/[^A-Za-z0-9._-]/g, "_");
async function speicher(methode, pfad, body, typ) {
  const h = { apikey: SB_KEY, Authorization: "Bearer " + (await token()) };
  if (typ) h["Content-Type"] = typ;
  if (methode === "POST" && pfad.startsWith("/storage/v1/object/datenblaetter/")) h["x-upsert"] = "true";
  const r = await netz(SB_URL + pfad, { method: methode, headers: h, body });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(r.status === 413 || /size/i.test(t) ? "Datei zu groß (max. 10 MB)" : /mime/i.test(t) ? "Nur Fotos und PDFs möglich" : /security|403/.test(t + r.status) ? "Keine Berechtigung" : "Fehler " + r.status);
  }
  return r;
}
async function blaetterLaden(sorteId) {
  const box = $("#blaetter"); if (!box) return;
  try {
    const r = await speicher("POST", "/storage/v1/object/list/datenblaetter", JSON.stringify({ prefix: `${S.standort}/${sorteId}`, limit: 200, offset: 0 }), "application/json");
    const liste = (await r.json()).filter((x) => x.id);
    if (!$("#blaetter")) return;
    box.innerHTML = liste.length ? liste.map((x) => `<span class="chip" style="display:inline-flex;gap:6px;align-items:center">
        <a href="#" data-a="blatt-oeffnen" data-v="${esc(x.name)}" style="color:inherit">${/\.pdf$/i.test(x.name) ? "📄" : "🖼️"} ${esc(x.name.replace(/_\d{4}-\d{2}-\d{2}_\d{6}/, ""))}</a>
        ${darfAendern() ? `<button type="button" class="icon" style="padding:0 2px;font-size:13px" data-a="blatt-loeschen" data-v="${esc(x.name)}" aria-label="Löschen">✕</button>` : ""}</span>`).join("")
      : `<span class="neben">Noch keine – z. B. Etikett oder Datenblatt fotografieren.</span>`;
  } catch (e) { box.innerHTML = `<span class="neben">${esc(e.message)}</span>`; }
}

function sorteSpeichern(id) {
  const name = wert("d-name"), marke = wert("d-marke");
  if (!name && !marke) { toast("Bitte Marke oder Produktname eintragen"); return; }
  let s = S.daten.sorten.find((x) => x.id === id);
  const kat = s ? (s.kategorie || "OEL") : S.kat;
  if (!s) { s = { id: naechsteId(S.daten.sorten), aktiv: true, ersetztDurchId: null, kategorie: kat }; S.daten.sorten.push(s); }
  const visko = wert("d-visko");
  Object.assign(s, {
    name, marke, viskositaet: kat === "OEL" ? visko.toUpperCase() : visko, spezifikation: wert("d-spez"),
    lieferform: kat === "KUEHL" ? wert("d-form") : "", lieferantId: wert("d-lief") ? Number(wert("d-lief")) : null,
    artikelnummer: wert("d-artnr"), ean: wert("d-ean"), zielpreis: (() => { const z = zahl(wert("d-ziel")); return z && z > 0 ? z : null; })(),
    nachbestellen: $("#d-nach").checked, notiz: wert("d-notiz"),
    freigabeIds: [...document.querySelectorAll('#d-fr .chip[aria-pressed="true"]')].map((b) => Number(b.dataset.fid))
  });
  dlg.close(); geaendert(); toast("Sorte gespeichert");
}
function sorteLoeschen(id) {
  const s = S.daten.sorten.find((x) => x.id === id); if (!s) return;
  const n = faesserVon(id).length;
  if (!confirm(`„${anzeigename(s)}“${n ? ` mit ${n} ${n === 1 ? "Fass" : "Fässern"}` : ""} löschen?`)) return;
  S.daten.sorten = S.daten.sorten.filter((x) => x.id !== id);
  S.daten.sorten.forEach((x) => { if (x.ersetztDurchId === id) x.ersetztDurchId = null; });
  S.daten.faesser = S.daten.faesser.filter((f) => f.sorteId !== id);
  S.daten.angebote = S.daten.angebote.filter((a) => a.sorteId !== id);
  S.daten.historie = S.daten.historie.filter((h) => h.sorteId !== id);
  dlg.close(); geaendert(); toast("Gelöscht");
}

function fassDialog(f, sorteId) {
  const neu = !f;
  const so = S.daten.sorten.find((x) => x.id === (f ? f.sorteId : sorteId));
  const k = KATEGORIEN[so?.kategorie || "OEL"];
  f = f || { id: 0, sorteId, lagerplatz: "", gebindeL: k.groessen.includes(208) ? 208 : 20, preisFass: null, lieferdatum: new Date().toLocaleDateString("de-DE"), notiz: "" };
  dialog(neu ? "Neues Fass" : "Fass ändern", `
    <div class="neben">${esc(so ? anzeigename(so) : "")}</div>
    ${feld("f-platz", "Lagerplatz", f.lagerplatz, "text", `placeholder="z. B. Regal A1"`)}
    <div class="chips">${k.groessen.map((g) => `<button type="button" class="chip" data-g="${g}">${g} L</button>`).join("")}</div>
    ${feld("f-groesse", "Gebindegröße (L)", fmtZahl(f.gebindeL), "text", `inputmode="decimal"`)}
    <div class="seg"><button type="button" aria-pressed="true" data-modus="fass">Preis pro Fass</button><button type="button" aria-pressed="false" data-modus="liter">Preis pro Liter</button></div>
    ${feld("f-preis", "Preis netto (€)", f.preisFass != null ? fmtZahl(f.preisFass) : "", "text", `inputmode="decimal"`)}
    <div class="glas" style="padding:10px 12px"><span class="neben">Literpreis</span><div class="preis" style="text-align:left;font-size:20px" id="f-lp">–</div></div>
    ${feld("f-datum", "Lieferdatum", f.lieferdatum)}
    <label class="feld"><span>Notiz</span><textarea id="f-notiz" rows="2">${esc(f.notiz)}</textarea></label>`,
    `${neu ? "" : `<button class="knopf gefahr" data-a="fass-loeschen" data-v="${f.id}">Löschen</button><button class="knopf" data-a="fass-leer" data-v="${f.id}">Fass leer</button>`}
     <button class="knopf" data-a="schliessen">Abbrechen</button><button class="knopf haupt" data-a="fass-speichern" data-v="${neu ? 0 : f.id}" data-s="${f.sorteId}">Speichern</button>`);
  let modus = "fass";
  const rechnen = () => {
    const g = zahl(wert("f-groesse")), p = zahl(wert("f-preis"));
    const lp = g > 0 && p != null ? (modus === "fass" ? p / g : p) : null;
    $("#f-lp").textContent = lp != null ? fmtEur(lp) + " pro Liter (netto)" : "–";
  };
  ["f-groesse", "f-preis"].forEach((id) => $("#" + id).addEventListener("input", rechnen));
  $("#dialog-innen").querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => { $("#f-groesse").value = b.dataset.g; rechnen(); }));
  $("#dialog-innen").querySelectorAll("[data-modus]").forEach((b) => b.addEventListener("click", () => {
    const g = zahl(wert("f-groesse")), p = zahl(wert("f-preis"));
    if (b.dataset.modus !== modus && g > 0 && p != null) $("#f-preis").value = fmtZahl(Math.round((b.dataset.modus === "liter" ? p / g : p * g) * 100) / 100);
    modus = b.dataset.modus;
    $("#dialog-innen").querySelectorAll("[data-modus]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    rechnen();
  }));
  dlg.dataset.modus = "fass";
  dlg._modus = () => modus;
  rechnen();
}
function fassSpeichern(id, sorteId) {
  const g = zahl(wert("f-groesse")), p = zahl(wert("f-preis"));
  if (!(g > 0) || p == null || p < 0) { toast("Bitte Gebindegröße und Preis eintragen"); return; }
  const preisFass = Math.round((dlg._modus() === "liter" ? p * g : p) * 100) / 100;
  let f = S.daten.faesser.find((x) => x.id === id);
  if (!f) { f = { id: naechsteId(S.daten.faesser), sorteId }; S.daten.faesser.push(f); }
  Object.assign(f, { lagerplatz: wert("f-platz"), gebindeL: g, preisFass, lieferdatum: wert("f-datum"), notiz: wert("f-notiz") });
  const vorher = id === 0 ? S.daten.historie.filter((h) => h.sorteId === f.sorteId && h.quelle === "EINKAUF").sort((a, b) => b.zeitpunkt - a.zeitpunkt)[0] : null;
  preisMerken(f.sorteId, "EINKAUF", preisFass, g);
  dlg.close(); geaendert();
  const plus = vorher && vorher.literpreis > 0 ? (preisFass / g / vorher.literpreis - 1) * 100 : 0;
  toast(plus >= 10 ? `Achtung: ${Math.round(plus)} % teurer als die letzte Lieferung (${fmtEur(vorher.literpreis)} → ${fmtEur(preisFass / g)} je Liter netto)` : "Fass gespeichert");
}

function angebotDialog(sorteId, quelle) {
  const so = S.daten.sorten.find((x) => x.id === sorteId);
  const q = QUELLEN.find((x) => x.code === quelle);
  const a = S.daten.angebote.find((x) => x.sorteId === sorteId && x.quelle === quelle);
  const k = KATEGORIEN[so?.kategorie || "OEL"];
  dialog(q.name, `<div class="neben">${esc(anzeigename(so))} ${esc(so.viskositaet || "")}</div>
    ${feld("a-artnr", "Artikelnummer bei " + q.name, a?.artikelnummer || "")}
    ${feld("a-gebinde", "Gebindegröße (L)", a?.gebindeL != null ? fmtZahl(a.gebindeL) : String(k.groessen.includes(208) ? 208 : 20), "text", `inputmode="decimal"`)}
    ${feld("a-preis", "Gebindepreis netto (€)", a?.preisGebinde != null ? fmtZahl(a.preisGebinde) : "", "text", `inputmode="decimal"`)}
    ${feld("a-url", "Link zum Artikel (optional)", a?.url || "")}`,
    `${a ? `<button class="knopf gefahr" data-a="angebot-loeschen" data-v="${sorteId}|${quelle}">Entfernen</button>` : ""}
     <button class="knopf" data-a="schliessen">Abbrechen</button><button class="knopf haupt" data-a="angebot-speichern" data-v="${sorteId}|${quelle}">Speichern</button>`);
}
function angebotSpeichern(sorteId, quelle) {
  const g = zahl(wert("a-gebinde")), p = zahl(wert("a-preis")), artnr = wert("a-artnr");
  if (p == null && !artnr) { toast("Bitte Preis oder Artikelnummer eintragen"); return; }
  S.daten.angebote = S.daten.angebote.filter((x) => !(x.sorteId === sorteId && x.quelle === quelle));
  S.daten.angebote.push({ sorteId, quelle, artikelnummer: artnr, preisGebinde: p, gebindeL: p != null ? g : null,
    stand: jetztText(), herkunft: "manuell", url: wert("a-url"), hinweis: "" });
  if (p != null && g > 0) preisMerken(sorteId, quelle, p, g);
  dlg.close(); geaendert(); toast("Preis gespeichert");
}

function lieferantDialog(l) {
  const neu = !l;
  l = l || { id: 0, name: "", ansprechpartner: "", telefon: "", email: "", notiz: "" };
  dialog(neu ? "Neuer Lieferant" : "Lieferant ändern",
    `${feld("li-name", "Firmenname", l.name)}${feld("li-ap", "Ansprechpartner", l.ansprechpartner)}${feld("li-tel", "Telefon", l.telefon, "text", `inputmode="tel"`)}
     ${feld("li-mail", "E-Mail", l.email, "email")}<label class="feld"><span>Notiz</span><textarea id="li-notiz" rows="2">${esc(l.notiz)}</textarea></label>`,
    `${neu ? "" : `<button class="knopf gefahr" data-a="lieferant-loeschen" data-v="${l.id}">Löschen</button>`}
     <button class="knopf" data-a="schliessen">Abbrechen</button><button class="knopf haupt" data-a="lieferant-speichern" data-v="${neu ? 0 : l.id}">Speichern</button>`);
}
function freigabeDialog(f) {
  const neu = !f;
  f = f || { id: 0, hersteller: "", bezeichnung: "", kategorie: S.kat };
  dialog(neu ? "Neue Freigabe" : "Freigabe ändern",
    `${feld("fr-h", "Fahrzeughersteller", f.hersteller, "text", `placeholder="z. B. VW"`)}${feld("fr-b", "Freigabe / Norm", f.bezeichnung, "text", `placeholder="z. B. VW 504 00"`)}
     <label class="feld"><span>Gilt für</span><select id="fr-k"><option value="OEL" ${f.kategorie === "OEL" ? "selected" : ""}>Motoröl</option>
       <option value="KUEHL" ${f.kategorie === "KUEHL" ? "selected" : ""}>Kühlmittel</option><option value="" ${!f.kategorie ? "selected" : ""}>Beides</option></select></label>`,
    `${neu ? "" : `<button class="knopf gefahr" data-a="freigabe-loeschen" data-v="${f.id}">Löschen</button>`}
     <button class="knopf" data-a="schliessen">Abbrechen</button><button class="knopf haupt" data-a="freigabe-speichern" data-v="${neu ? 0 : f.id}">Speichern</button>`);
}

// ---------- Ereignisse ----------
document.addEventListener("click", async (e) => {
  const chip = e.target.closest("#r-standorte .chip, #quell-lieferanten .chip");
  if (chip) { chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") === "true" ? "false" : "true"); return; }
  const el = e.target.closest("[data-a]");
  if (S.menueOffen && (!el || el.dataset.a !== "menue")) { S.menueOffen = false; kopfZeichnen(); }
  if (!el || el.matches('input[type="checkbox"]')) return;
  const a = el.dataset.a, v = el.dataset.v;
  const nr = Number(v);
  if (S.ansicht === "app" && !darfAendern() && (/-(speichern|loeschen)$/.test(a) || ["sorte-neu", "fass-neu", "fass-leer", "fass-aktiv"].includes(a) || v === "neu")) {
    toast("Nur Leserechte an diesem Standort"); return;
  }
  switch (a) {
    case "tab": S.tab = v; S.suche = ""; zeichnen(); window.scrollTo(0, 0); break;
    case "kat": S.kat = v; S.offen = null; zeichnen(); break;
    case "gruppe": S.offen = istBreit() ? v : (S.offen === v ? null : v); zeichnen(); break;
    case "brutto": {
      S.preisModus = { netto: "brutto", brutto: "kunde", kunde: "netto" }[S.preisModus] || "netto";
      localStorage.setItem("oel_preis", S.preisModus); zeichnen();
      toast({ netto: "Einkaufspreise netto", brutto: "Einkaufspreise brutto", kunde: `Kundenpreise (+${fmtZahl(aufschlag())} % Aufschlag, inkl. MwSt.)` }[S.preisModus]);
      break;
    }
    case "protokoll-neu": S.protokollFuer = null; zeichnen(); break;
    case "zu-registrieren": S.ansicht = "registrieren"; S.meldung = ""; await standorteLaden(); zeichnen(); break;
    case "abmelden-still": sitzungSpeichern(null); S.ansicht = "anmelden"; S.meldung = ""; zeichnen(); break;
    case "zu-anmelden": S.ansicht = "anmelden"; S.meldung = ""; zeichnen(); break;
    case "zu-vergessen": S.formEmail = $("#l-email")?.value.trim() || S.formEmail; S.ansicht = "vergessen"; S.meldung = ""; zeichnen(); break;
    case "freigabe-pruefen": S.meldung = ""; try { await nachAnmeldung(null); } catch (err) { S.meldung = err.message; } zeichnen(); break;
    case "standort-oeffnen": dlg.close(); S.meldung = ""; try { await standortOeffnen(nr); } catch (err) { S.meldung = err.message; S.ansicht = "standortwahl"; } zeichnen(); break;
    case "standort-wechseln":
      if (S.ungespeichert) await speichern();
      S.meldung = ""; await verwaltungLaden().catch(() => {}); S.ansicht = "standortwahl"; zeichnen(); break;
    case "entwickler": S.entwicklerOffen = false; pinDialog(); break;
    case "pin-ok": pinPruefen(); break;
    case "standort-anlegen": {
      const name = wert("neuer-standort"); if (!name) { toast("Bitte einen Namen eingeben"); return; }
      const quelle = Number(S.quelle) || null;
      const ids = new Set([...document.querySelectorAll('#quell-lieferanten .chip[aria-pressed="true"]')].map((b) => Number(b.dataset.lid)));
      await verwalten(async () => {
        const neu = await rest("POST", "/rest/v1/oellager_standort?select=id", { name }, { Prefer: "return=representation" });
        if (quelle && ids.size) {
          const lief = S.quellLieferanten.filter((l) => ids.has(l.id));
          await rest("POST", "/rest/v1/rpc/oellager_speichern", { p_standort: neu[0].id, p_geraet: "Web-App", p_version: null,
            p_daten: { ...leererStand(), lieferanten: lief } });
        }
        S.neuerName = ""; S.quelle = ""; S.quellLieferanten = [];
      }, `Standort „${name}“ angelegt` + (quelle && ids.size ? ` (${ids.size} Lieferanten übernommen)` : ""));
      break;
    }
    case "standort-umbenennen": {
      const alt = S.standorte.find((x) => x.id === nr); const name = prompt("Neuer Name", alt?.name || "");
      if (name && name.trim()) await verwalten(() => rest("POST", "/rest/v1/rpc/oellager_standort_umbenennen", { p_id: nr, p_name: name.trim() }), "Umbenannt");
      break;
    }
    case "standort-entfernen": {
      if (nr === S.standort && S.ansicht === "app") { toast("Der geöffnete Standort kann nicht gelöscht werden"); return; }
      const x = S.standorte.find((y) => y.id === nr);
      if (confirm(`„${x?.name}“ mit dem kompletten Lager für alle Nutzer löschen?`)) {
        await verwalten(() => rest("DELETE", `/rest/v1/oellager_standort?id=eq.${nr}`), "Standort gelöscht");
      }
      break;
    }
    case "fahrzeug": fahrzeugDialog(); break;
    case "ob-setzen":
      S.daten.einstellungen = { ...(S.daten.einstellungen || {}), oberflaeche: v }; geaendert(); verwaltungDialog();
      toast("Oberfläche „" + OBERFLAECHEN.find((x) => x[0] === v)[1] + "“ für alle am Standort gespeichert"); break;
    case "menue": S.menueOffen = !S.menueOffen; kopfZeichnen(); break;
    case "zwei-faktor": zweiFaktorDialog(); break;
    case "zf-einrichten": zweiFaktorEinrichten(); break;
    case "zf-bestaetigen": zweiFaktorBestaetigen(); break;
    case "zf-aus": zweiFaktorAus(); break;
    case "sprache": spracheStarten(); break;
    case "blatt-oeffnen": {
      e.preventDefault();
      const fenster = window.open("", "_blank");
      try {
        const r = await speicher("GET", `/storage/v1/object/authenticated/datenblaetter/${S.standort}/${S.blattSorte}/${encodeURIComponent(v)}`);
        const url = URL.createObjectURL(await r.blob());
        if (fenster) fenster.location = url; else location.href = url;
      } catch (err) { fenster?.close(); toast(err.message); }
      break;
    }
    case "blatt-loeschen":
      if (confirm("Datei für alle löschen?")) {
        try { await speicher("DELETE", `/storage/v1/object/datenblaetter/${S.standort}/${S.blattSorte}/${encodeURIComponent(v)}`); } catch (err) { toast(err.message); }
        blaetterLaden(S.blattSorte);
      }
      break;
    case "aufschlag-speichern": {
      const p = zahl(wert("aufschlag"));
      if (p == null || p < 0 || p > 1000) { toast("Bitte einen Aufschlag zwischen 0 und 1000 % eingeben"); return; }
      S.daten.einstellungen = { ...(S.daten.einstellungen || {}), aufschlagProzent: p }; geaendert(); toast("Aufschlag gespeichert"); break;
    }
    case "fz-marke": S.fz = { marke: v, idx: null }; fahrzeugDialog(); break;
    case "fz-motor": S.fz.idx = nr; fahrzeugDialog(); break;
    case "fahrzeug-sorte": dlg.close(); sorteDialog(S.daten.sorten.find((x) => x.id === nr)); break;
    case "export-bestand": bestandCsv(); break;
    case "export-preise": preiseCsv(); break;
    case "export-druck": bestandDrucken(); break;
    case "vergleich": {
      try {
        const rows = await rest("GET", "/rest/v1/oellager_bestand?select=standort_id,daten");
        vergleichDialog(rows);
      } catch (err) { toast(err.message); }
      break;
    }
    case "sicherungen": {
      try { S.sicherungen = await rest("GET", "/rest/v1/oellager_sicherung?select=id,standort_id,erstellt,art,version&order=erstellt.desc&limit=200"); sicherungenDialog(); }
      catch (err) { toast(err.message); }
      break;
    }
    case "jetzt-sichern":
      try { const n = await rest("POST", "/rest/v1/rpc/oellager_jetzt_sichern", {}); toast(`${n} Standort(e) gesichert`);
        S.sicherungen = await rest("GET", "/rest/v1/oellager_sicherung?select=id,standort_id,erstellt,art,version&order=erstellt.desc&limit=200"); sicherungenDialog(); }
      catch (err) { toast(err.message); }
      break;
    case "sicherung-zurueck": {
      const x = S.sicherungen.find((y) => y.id === nr); if (!x) return;
      const name = S.standorte.find((y) => y.id === x.standort_id)?.name || "Standort " + x.standort_id;
      if (!confirm(`Lager „${name}“ für alle Nutzer auf den Stand vom ${new Date(x.erstellt).toLocaleString("de-DE")} zurücksetzen?\nDer jetzige Stand wird vorher gesichert.`)) return;
      try {
        await rest("POST", "/rest/v1/rpc/oellager_wiederherstellen", { p_sicherung: nr });
        toast("Sicherung wiederhergestellt");
        if (x.standort_id === S.standort && S.ansicht === "app") { S.ungespeichert = false; await laden(); zeichnen(); }
        S.sicherungen = await rest("GET", "/rest/v1/oellager_sicherung?select=id,standort_id,erstellt,art,version&order=erstellt.desc&limit=200"); sicherungenDialog();
      } catch (err) { toast(err.message); }
      break;
    }
    case "vergleich-kat": S.vergleichKat = v; vergleichDialog(S.vergleichRows); break;
    case "zurueck-entwickler": verwaltungDialog(); break;
    case "recht": {
      const [uid, sid, stufe] = v.split("|");
      await verwalten(() => rest("POST", "/rest/v1/rpc/oellager_recht_setzen",
        { p_user: uid, p_standort: Number(sid), p_zugeordnet: stufe !== "kein", p_darf_aendern: stufe === "aendern" }), "Gespeichert");
      break;
    }
    case "nutzer-frei": case "nutzer-admin": {
      const n = S.nutzer.find((x) => x.user_id === v);
      const frei = a === "nutzer-frei" ? !n.freigegeben : n.freigegeben || n.rolle !== "admin";
      const rolle = a === "nutzer-admin" ? (n.rolle === "admin" ? "nutzer" : "admin") : n.rolle;
      await verwalten(() => rest("POST", "/rest/v1/rpc/oellager_nutzer_setzen", { p_user: v, p_freigegeben: frei, p_rolle: rolle }), "Gespeichert");
      break;
    }
    case "konto-entfernen": {
      const n = S.nutzer.find((x) => x.user_id === v);
      if (confirm(`Konto von ${n?.name || n?.email} endgültig löschen? Anmeldung und Rechte werden entfernt, die Lagerdaten bleiben.`)) {
        await verwalten(() => rest("POST", "/rest/v1/rpc/oellager_nutzer_loeschen", { p_user: v }), "Konto gelöscht");
      }
      break;
    }
    case "anmeldungen":
      try { protokollDialog("Anmelde-Protokoll", await rest("POST", "/rest/v1/rpc/oellager_anmeldungen", {}), (o) =>
        [`<b>${esc(o.name || o.email)}</b>${o.zwei_faktor ? ` <span class="pille">mit Code</span>` : ""}`,
         [`zuletzt ${zeitKurz(o.zuletzt)}`, `seit ${zeitKurz(o.beginn)}`, geraetKurz(o.geraet), o.ip].filter(Boolean).map(esc).join(" · ")]); }
      catch (err) { toast(err.message); }
      break;
    case "fehlerberichte":
      try { protokollDialog("Fehlerberichte", await rest("GET", "/rest/v1/oellager_fehler?select=zeit,quelle,version,geraet,text&order=zeit.desc&limit=100"), (o) =>
        [`<details><summary>${esc((o.text.split("\n").find((z) => /Error|Exception/.test(z)) || o.text).slice(0, 140))}</summary><pre style="white-space:pre-wrap;font-size:11px">${esc(o.text)}</pre></details>`,
         [zeitKurz(o.zeit), o.quelle, o.version, o.geraet].filter(Boolean).map(esc).join(" · ")]); }
      catch (err) { toast(err.message); }
      break;
    case "nutzer-entfernen":
      if (confirm("Zugang dieses Nutzers entfernen? Er müsste sich neu registrieren.")) {
        await verwalten(() => rest("DELETE", `/rest/v1/oellager_nutzer?user_id=eq.${v}`), "Zugang entfernt");
      }
      break;
    case "thema-setzen": {
      const r = document.documentElement;
      if (v === "system") { delete r.dataset.theme; localStorage.removeItem("oel_thema"); } else { r.dataset.theme = v; localStorage.setItem("oel_thema", v); }
      verwaltungDialog(); break;
    }
    case "thema": {
      const r = document.documentElement;
      const dunkel = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      r.dataset.theme = dunkel ? "light" : "dark"; localStorage.setItem("oel_thema", r.dataset.theme); break;
    }
    case "neu-laden": try { if (S.offline) await verwaltungLaden(); await laden(); zeichnen(); toast(S.offline ? "Weiterhin offline" : "Aktueller Stand geladen"); } catch (err) { toast(err.message); } break;
    case "abmelden":
      if (confirm("Abmelden?")) {
        if (S.ungespeichert) await speichern();
        sitzungSpeichern(null); S.daten = null; S.ich = null; S.ansicht = "anmelden"; S.meldung = ""; await standorteLaden(); zeichnen();
      } break;
    case "schliessen": dlg.close(); break;
    case "sorte-neu": sorteDialog(null); break;
    case "sorte-bearbeiten": sorteDialog(S.daten.sorten.find((x) => x.id === nr)); break;
    case "sorte-speichern": sorteSpeichern(nr); break;
    case "sorte-loeschen": sorteLoeschen(nr); break;
    case "fass-neu": fassDialog(null, nr); break;
    case "fass-bearbeiten": fassDialog(S.daten.faesser.find((x) => x.id === nr)); break;
    case "fass-speichern": fassSpeichern(nr, Number(el.dataset.s)); break;
    case "fass-leer": {
      const f = S.daten.faesser.find((x) => x.id === nr); if (!f) return;
      f.leerAm = new Date().toISOString().slice(0, 10); dlg.close(); geaendert(); toast("Fass als leer gemeldet – zählt jetzt zum Verbrauch"); break;
    }
    case "fass-aktiv": {
      const f = S.daten.faesser.find((x) => x.id === nr); if (!f) return;
      f.leerAm = null; geaendert(); toast("Fass wieder im Bestand"); break;
    }
    case "fass-loeschen": if (confirm("Fass löschen?")) { S.daten.faesser = S.daten.faesser.filter((x) => x.id !== nr); dlg.close(); geaendert(); } break;
    case "angebot": { const [s, q] = v.split("|"); angebotDialog(Number(s), q); break; }
    case "angebot-speichern": { const [s, q] = v.split("|"); angebotSpeichern(Number(s), q); break; }
    case "angebot-loeschen": { const [s, q] = v.split("|"); S.daten.angebote = S.daten.angebote.filter((x) => !(x.sorteId === Number(s) && x.quelle === q)); dlg.close(); geaendert(); break; }
    case "lieferant": lieferantDialog(v === "neu" ? null : S.daten.lieferanten.find((x) => x.id === nr)); break;
    case "lieferant-speichern": {
      const name = wert("li-name"); if (!name) { toast("Bitte Firmenname eintragen"); return; }
      let l = S.daten.lieferanten.find((x) => x.id === nr);
      if (!l) { l = { id: naechsteId(S.daten.lieferanten) }; S.daten.lieferanten.push(l); }
      Object.assign(l, { name, ansprechpartner: wert("li-ap"), telefon: wert("li-tel"), email: wert("li-mail"), notiz: wert("li-notiz") });
      dlg.close(); geaendert(); break;
    }
    case "lieferant-loeschen":
      if (confirm("Lieferant löschen? Sorten bleiben erhalten.")) {
        S.daten.lieferanten = S.daten.lieferanten.filter((x) => x.id !== nr);
        S.daten.sorten.forEach((s) => { if (s.lieferantId === nr) s.lieferantId = null; });
        dlg.close(); geaendert();
      } break;
    case "freigabe": freigabeDialog(v === "neu" ? null : S.daten.freigaben.find((x) => x.id === nr)); break;
    case "freigabe-speichern": {
      const b = wert("fr-b"), h = wert("fr-h"); if (!b || !h) { toast("Bitte Hersteller und Bezeichnung eintragen"); return; }
      let f = S.daten.freigaben.find((x) => x.id === nr);
      if (!f) { f = { id: naechsteId(S.daten.freigaben) }; S.daten.freigaben.push(f); }
      Object.assign(f, { hersteller: h, bezeichnung: b, kategorie: $("#fr-k").value });
      dlg.close(); geaendert(); break;
    }
    case "freigabe-loeschen":
      if (confirm("Freigabe löschen? Sie wird bei allen Sorten entfernt.")) {
        S.daten.freigaben = S.daten.freigaben.filter((x) => x.id !== nr);
        S.daten.sorten.forEach((s) => { s.freigabeIds = (s.freigabeIds || []).filter((i) => i !== nr); });
        dlg.close(); geaendert();
      } break;
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.dataset.a !== "quelle-waehlen") return;
  S.neuerName = wert("neuer-standort");
  S.quelle = e.target.value; S.quellLieferanten = [];
  if (S.quelle) {
    try {
      const rows = await rest("GET", `/rest/v1/oellager_bestand?select=daten&standort_id=eq.${S.quelle}`);
      S.quellLieferanten = (rows[0]?.daten?.lieferanten || []).map((l) => ({ ...l }));
    } catch (err) { toast(err.message); }
  }
  verwaltungDialog();
});
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener("input", (e) => {
  if (e.target.dataset.a === "suche") {
    S.suche = e.target.value;
    const pos = e.target.selectionStart;
    zeichnen();
    const neu = document.querySelector('[data-a="suche"]');
    if (neu) { neu.focus(); neu.setSelectionRange(pos, pos); }
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (S.laeuft) return;
  S.meldung = "";
  if (e.target.id === "login-form") {
    const email = $("#l-email").value.trim(), pw = $("#l-pw").value;
    const sid = $("#l-standort") ? Number($("#l-standort").value) || null : null;
    S.formEmail = email; if (sid) S.standort = sid;
    if (S.standorte.length && !sid) { S.meldung = "Bitte einen Standort wählen"; zeichnen(); return; }
    S.laeuft = true; zeichnen();
    try {
      const j = await auth("/auth/v1/token?grant_type=password", { email, password: pw });
      sitzungSpeichern(sitzungAus(j)); localStorage.setItem("oel_email", email);
      const faktor = (j.user?.factors || []).find((f) => f.factor_type === "totp" && f.status === "verified");
      if (faktor) { S.codeFaktor = faktor.id; S.codeStandort = sid; S.ansicht = "code"; }
      else await nachAnmeldung(sid);
    } catch (err) { S.meldung = err.message; }
    S.laeuft = false; zeichnen();
  } else if (e.target.id === "code-form") {
    const code = $("#c-code").value.trim();
    S.laeuft = true; zeichnen();
    try { await codePruefenUndAnmelden(S.codeFaktor, code); await nachAnmeldung(S.codeStandort); }
    catch (err) { S.meldung = err.message; }
    S.laeuft = false; zeichnen();
  } else if (e.target.id === "vergessen-form") {
    const email = $("#v-email").value.trim(); S.formEmail = email;
    S.laeuft = true; zeichnen();
    try {
      await auth("/auth/v1/recover?redirect_to=" + encodeURIComponent(location.origin + location.pathname), { email });
      S.ansicht = "anmelden"; S.meldung = "E-Mail verschickt – bitte den Link darin öffnen und ein neues Passwort festlegen.";
    } catch (err) { S.meldung = err.message; }
    S.laeuft = false; zeichnen();
  } else if (e.target.id === "passwort-form") {
    const pw = $("#n-pw").value;
    if (pw !== $("#n-pw2").value) { S.meldung = "Passwörter stimmen nicht überein"; zeichnen(); return; }
    S.laeuft = true; zeichnen();
    try {
      const r = await fetch(SB_URL + "/auth/v1/user", { method: "PUT",
        headers: { apikey: SB_KEY, Authorization: "Bearer " + (await token()), "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(/should be different/i.test(j.msg || "") ? "Bitte ein anderes als das bisherige Passwort wählen" : (j.msg || j.message || "Fehlgeschlagen")); }
      toast("Neues Passwort gespeichert");
      S.meldung = ""; await nachAnmeldung(null);
    } catch (err) { S.meldung = err.message; }
    S.laeuft = false; zeichnen();
  } else if (e.target.id === "registrier-form") {
    const name = $("#r-name").value.trim(), email = $("#r-email").value.trim(), pw = $("#r-pw").value;
    const standorte = [...document.querySelectorAll('#r-standorte .chip[aria-pressed="true"]')].map((b) => Number(b.dataset.sid));
    if (pw !== $("#r-pw2").value) { S.meldung = "Passwörter stimmen nicht überein"; zeichnen(); return; }
    if (S.standorte.length && !standorte.length) { S.meldung = "Bitte mindestens einen Standort wählen"; zeichnen(); return; }
    S.laeuft = true; zeichnen();
    try {
      const j = await auth("/auth/v1/signup", { email, password: pw, data: { name, standorte } });
      localStorage.setItem("oel_email", email);
      if (j.access_token) { sitzungSpeichern(sitzungAus(j)); await nachAnmeldung(standorte.length === 1 ? standorte[0] : null); }
      else { S.ansicht = "anmelden"; S.meldung = "Konto angelegt. Bitte den Bestätigungslink in der E-Mail öffnen und dich dann anmelden."; }
    } catch (err) { S.meldung = err.message; }
    S.laeuft = false; zeichnen();
  }
});
// Beim Zurückkehren in den Tab neuen Stand holen (z. B. nach Änderungen auf dem Handy)
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && S.ansicht === "app" && S.daten && !S.ungespeichert && !dlg.open) {
    try { await laden(); zeichnen(); } catch (e) { /* offline */ }
  }
});
let breitVorher = istBreit();
window.addEventListener("resize", () => { if (istBreit() !== breitVorher) { breitVorher = istBreit(); if (S.ansicht === "app" && !dlg.open) zeichnen(); } });
window.addEventListener("online", async () => {
  if (S.offline && S.ansicht === "app") { try { await verwaltungLaden(); await laden(); zeichnen(); toast("Wieder online"); } catch (e) { /* noch nicht */ } }
});
let letzteBedienung = Date.now();
["pointerdown", "keydown", "scroll", "touchstart"].forEach((t) => window.addEventListener(t, () => { letzteBedienung = Date.now(); }, { passive: true }));
setInterval(async () => {
  if (S.sitzung && Date.now() - letzteBedienung > 30 * 60_000) {
    if (S.ungespeichert && !S.offline) await speichern();
    sitzungSpeichern(null); S.daten = null; S.ich = null; S.ansicht = "anmelden";
    S.meldung = "Aus Sicherheitsgründen abgemeldet (30 Minuten ohne Bedienung)."; dlg.open && dlg.close(); zeichnen();
  }
}, 60_000);
window.addEventListener("beforeunload", (e) => { if (S.ungespeichert) { e.preventDefault(); e.returnValue = ""; } });

// ---------- Fehlerberichte an den Entwickler ----------
let gemeldet = 0;
async function fehlerMelden(text) {
  if (!S.sitzung || gemeldet >= 5) return;
  gemeldet++;
  try {
    await rest("POST", "/rest/v1/oellager_fehler", { quelle: "Web-App", version: "Web", geraet: navigator.userAgent.slice(0, 200), text: String(text).slice(0, 19000) });
  } catch (e) { /* offline – egal */ }
}
window.addEventListener("error", (e) => fehlerMelden(`${e.message}\n${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack || ""}`));
window.addEventListener("unhandledrejection", (e) => { if (!e.reason?.offline) fehlerMelden("Promise: " + (e.reason?.stack || e.reason)); });

// ---------- Start ----------
(async function start() {
  try { const t = localStorage.getItem("oel_thema"); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* */ }
  try { const x = localStorage.getItem("oel_sitzung"); if (x) S.sitzung = JSON.parse(x); } catch (e) { /* */ }
  // Rückkehr aus einem E-Mail-Link (Bestätigung oder „Passwort vergessen“): Anmeldung steht im #-Teil der Adresse
  const h = new URLSearchParams(location.hash.slice(1));
  let wiederherstellen = false;
  if (h.get("access_token")) {
    try {
      const nutz = JSON.parse(atob(h.get("access_token").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      sitzungSpeichern({ access: h.get("access_token"), refresh: h.get("refresh_token"),
        ablauf: Date.now() + (Number(h.get("expires_in")) || 3600) * 1000 - 60000, userId: nutz.sub, email: nutz.email });
      localStorage.setItem("oel_email", nutz.email || "");
      wiederherstellen = h.get("type") === "recovery";
      if (h.get("type") === "signup") toast("E-Mail bestätigt – willkommen!");
    } catch (e) { /* ungültiger Link */ }
  } else if (h.get("error")) {
    S.meldung = /expired|invalid/i.test(h.get("error_description") || "") ? "Der Link ist abgelaufen oder wurde schon benutzt – bitte neu anfordern." : (h.get("error_description") || "Link ungültig");
  }
  if (location.hash) history.replaceState(null, "", location.pathname);
  zeichnen();
  await standorteLaden();
  if (wiederherstellen) { S.ansicht = "neues-passwort"; zeichnen(); }
  else
  // Angemeldet geblieben (gleicher Browser): Standort trotzdem bei jedem Öffnen wählen
  if (S.sitzung) {
    try {
      await verwaltungLaden();
      S.ansicht = S.ich?.freigegeben ? "standortwahl" : "warten";
    }
    catch (err) {
      if (err.offline) { S.ansicht = "anmelden"; S.meldung = "Keine Verbindung und kein gespeicherter Stand vorhanden."; }
      else { sitzungSpeichern(null); S.ansicht = "anmelden"; S.meldung = /abgelaufen|refresh|JWT|token/i.test(err.message) ? "Bitte erneut anmelden" : err.message; }
    }
  }
  zeichnen();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
