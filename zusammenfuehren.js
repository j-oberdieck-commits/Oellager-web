// Führt gleichzeitig geänderte Stände zusammen – gleiche Regeln wie in der Android-App (cloud/Zusammenfuehren.kt).
"use strict";
(function (global) {
  const MIT_ID = ["lieferanten", "freigaben", "sorten", "faesser", "historie", "kommentare"];
  const ALLE = [...MIT_ID, "angebote"];
  const zahl = (v) => (typeof v === "number" ? Math.trunc(v) : typeof v === "string" && v.trim() !== "" && !isNaN(v) ? Math.trunc(Number(v)) : null);
  const schluessel = (k, o) => (k === "angebote" ? `${zahl(o.sorteId)}|${o.quelle}` : String(zahl(o.id)));

  function gleich(a, b) {
    const x = a === "" || a === undefined ? null : a;
    const y = b === "" || b === undefined ? null : b;
    if (x === null || y === null) return x === null && y === null;
    if (typeof x === "number" && typeof y === "number") return x === y;
    if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v, i) => gleich(v, y[i]));
    if (typeof x === "object" && typeof y === "object" && !Array.isArray(x) && !Array.isArray(y)) {
      return [...new Set([...Object.keys(x), ...Object.keys(y)])].every((k) => gleich(x[k], y[k]));
    }
    return x === y;
  }

  function normieren(doc) {
    const r = {};
    for (const k of ALLE) {
      r[k] = ((doc && doc[k]) || []).filter((o) => o && typeof o === "object").map((o) => {
        const c = { ...o };
        if (k === "sorten") {
          c.aktiv = typeof c.aktiv === "boolean" ? c.aktiv : true;
          c.nachbestellen = typeof c.nachbestellen === "boolean" ? c.nachbestellen : false;
          c.freigabeIds = [...new Set((c.freigabeIds || []).map(zahl).filter((v) => v !== null))].sort((p, q) => p - q);
        }
        return c;
      });
    }
    return r;
  }

  function zusammenfuehren(basis, lokal, remote) {
    const b = normieren(basis), l = normieren(lokal), r = normieren(remote);

    const umbenannt = {};
    for (const k of MIT_ID) {
      const basisIds = new Set(b[k].map((o) => zahl(o.id)));
      const remoteNachId = new Map(r[k].map((o) => [zahl(o.id), o]));
      let naechste = Math.max(0, ...[...b[k], ...l[k], ...r[k]].map((o) => zahl(o.id) || 0));
      const map = new Map();
      for (const o of l[k]) {
        const id = zahl(o.id);
        if (id === null || basisIds.has(id)) continue;
        const ro = remoteNachId.get(id);
        if (!ro || gleich(o, ro)) continue;
        naechste += 1;
        map.set(id, naechste);
        o.id = naechste;
      }
      umbenannt[k] = map;
    }
    const neu = (m, v) => { const z = zahl(v); return z === null ? v : (m.has(z) ? m.get(z) : z); };
    const ls = umbenannt.lieferanten, fr = umbenannt.freigaben, so = umbenannt.sorten;
    if (ls.size || fr.size || so.size) {
      for (const o of l.sorten) {
        o.lieferantId = neu(ls, o.lieferantId);
        o.ersetztDurchId = neu(so, o.ersetztDurchId);
        o.freigabeIds = o.freigabeIds.map((f) => neu(fr, f));
      }
      for (const k of ["faesser", "angebote", "historie", "kommentare"]) for (const o of l[k]) o.sorteId = neu(so, o.sorteId);
    }

    const erg = {};
    for (const k of ALLE) {
      const bm = new Map(b[k].map((o) => [schluessel(k, o), o]));
      const lm = new Map(l[k].map((o) => [schluessel(k, o), o]));
      const rm = new Map(r[k].map((o) => [schluessel(k, o), o]));
      const keys = [...new Set([...rm.keys(), ...lm.keys()])];
      erg[k] = keys.map((key) => {
        const bo = bm.get(key) ?? null, lo = lm.get(key) ?? null, ro = rm.get(key) ?? null;
        if (gleich(lo, bo)) return ro;
        if (gleich(ro, bo)) return lo;
        if (lo === null) return ro;
        if (ro === null) return lo;
        return lo;
      }).filter((o) => o !== null);
    }

    const lieferIds = new Set(erg.lieferanten.map((o) => zahl(o.id)));
    const freigIds = new Set(erg.freigaben.map((o) => zahl(o.id)));
    const sortIds = new Set(erg.sorten.map((o) => zahl(o.id)));
    const sorten = erg.sorten.map((o) => ({
      ...o,
      lieferantId: lieferIds.has(zahl(o.lieferantId)) ? o.lieferantId : null,
      ersetztDurchId: sortIds.has(zahl(o.ersetztDurchId)) ? o.ersetztDurchId : null,
      freigabeIds: (o.freigabeIds || []).map(zahl).filter((f) => freigIds.has(f))
    }));
    const aufSorte = (k) => erg[k].filter((o) => sortIds.has(zahl(o.sorteId)));
    const rest = {};
    // Einstellungen, Lagerplan …: nur übernehmen, was hier geändert wurde, sonst gilt der Cloud-Stand
    for (const [k, v] of Object.entries(lokal || {})) {
      if (ALLE.includes(k)) continue;
      if (!gleich(v, basis ? basis[k] : undefined) || !(remote && k in remote)) rest[k] = v;
    }
    return { ...(remote || {}), ...rest, lieferanten: erg.lieferanten, freigaben: erg.freigaben, sorten,
             angebote: aufSorte("angebote"), faesser: aufSorte("faesser"), historie: aufSorte("historie"), kommentare: aufSorte("kommentare") };
  }

  global.Zusammenfuehren = { zusammenfuehren, gleich };
  if (typeof module !== "undefined") module.exports = global.Zusammenfuehren;
})(typeof window !== "undefined" ? window : globalThis);
