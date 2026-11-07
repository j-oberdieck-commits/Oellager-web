// Häufige Herstellervorgaben je Fahrzeugmarke – gleiche Tabelle wie in der Android-App (data/Fahrzeuge.kt).
// Ohne Gewähr: maßgeblich ist die Betriebsanleitung des konkreten Fahrzeugs.
"use strict";
(function (global) {
  const LISTE = [
 {
  "hersteller": "VW · Audi · Seat · Škoda",
  "titel": "Benziner mit LongLife (ca. 2004–2019)",
  "viskositaet": "5W-30",
  "normen": [
   [
    "VW 504 00",
    "VW 504.00"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "VW · Audi · Seat · Škoda",
  "titel": "Diesel mit LongLife / Partikelfilter (ca. 2004–2019)",
  "viskositaet": "5W-30",
  "normen": [
   [
    "VW 507 00",
    "VW 507.00"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "VW · Audi · Seat · Škoda",
  "titel": "Benziner mit 0W-20 (ab ca. 2019)",
  "viskositaet": "0W-20",
  "normen": [
   [
    "VW 508 00",
    "VW 508.00"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "VW · Audi · Seat · Škoda",
  "titel": "Diesel mit 0W-20 (ab ca. 2019)",
  "viskositaet": "0W-20",
  "normen": [
   [
    "VW 509 00",
    "VW 509.00"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "VW · Audi · Seat · Škoda",
  "titel": "Benziner ohne LongLife (Festintervall)",
  "viskositaet": "5W-40",
  "normen": [
   [
    "VW 502 00",
    "VW 502.00"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "VW · Audi · Seat · Škoda",
  "titel": "Diesel Pumpe-Düse ohne Partikelfilter",
  "viskositaet": "5W-40",
  "normen": [
   [
    "VW 505 01",
    "VW 505.01"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "BMW · Mini",
  "titel": "Benziner & Diesel (ab ca. 2004)",
  "viskositaet": "5W-30",
  "normen": [
   [
    "BMW Longlife-04",
    "BMW LL-04",
    "BMW LL04"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "BMW · Mini",
  "titel": "Neuere Benziner mit 0W-20 (ab ca. 2017)",
  "viskositaet": "0W-20",
  "normen": [
   [
    "BMW Longlife-17 FE+",
    "BMW LL-17 FE+",
    "BMW LL-17FE+"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "BMW · Mini",
  "titel": "Neueste Motoren mit 0W-20",
  "viskositaet": "0W-20",
  "normen": [
   [
    "BMW Longlife-19 FE",
    "BMW LL-19 FE",
    "BMW LL-19FE"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "BMW · Mini",
  "titel": "Ältere Benziner (bis ca. 2004)",
  "viskositaet": "5W-40",
  "normen": [
   [
    "BMW Longlife-01",
    "BMW LL-01",
    "BMW LL01"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Mercedes-Benz",
  "titel": "Benziner allgemein",
  "viskositaet": "5W-40",
  "normen": [
   [
    "MB 229.5",
    "MB-Freigabe 229.5"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Mercedes-Benz",
  "titel": "Diesel mit Partikelfilter / moderne Benziner",
  "viskositaet": "5W-30",
  "normen": [
   [
    "MB 229.51",
    "MB-Freigabe 229.51"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Mercedes-Benz",
  "titel": "Diesel BlueTEC (ab ca. 2014)",
  "viskositaet": "5W-30",
  "normen": [
   [
    "MB 229.52",
    "MB-Freigabe 229.52"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Mercedes-Benz",
  "titel": "Neueste Motoren mit 0W-20 (ab ca. 2019)",
  "viskositaet": "0W-20",
  "normen": [
   [
    "MB 229.71",
    "MB-Freigabe 229.71"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Opel",
  "titel": "Benziner & Diesel mit GM-Motor (ca. 2010–2018)",
  "viskositaet": "5W-30",
  "normen": [
   [
    "GM dexos2",
    "dexos2",
    "dexos 2"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Opel",
  "titel": "Neuere Benziner mit PSA-Motor (ab ca. 2018)",
  "viskositaet": "0W-30",
  "normen": [
   [
    "PSA B71 2312",
    "B71 2312"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Ford",
  "titel": "Benziner & Diesel (5W-30)",
  "viskositaet": "5W-30",
  "normen": [
   [
    "Ford WSS-M2C913-D",
    "WSS-M2C913-D",
    "M2C913-D"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Ford",
  "titel": "EcoBoost / Diesel mit 5W-20",
  "viskositaet": "5W-20",
  "normen": [
   [
    "Ford WSS-M2C948-B",
    "WSS-M2C948-B",
    "M2C948-B"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Ford",
  "titel": "Diesel mit Partikelfilter (Low-SAPS)",
  "viskositaet": "0W-30",
  "normen": [
   [
    "Ford WSS-M2C950-A",
    "WSS-M2C950-A",
    "M2C950-A"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Peugeot · Citroën · DS",
  "titel": "Benziner & Diesel mit Partikelfilter",
  "viskositaet": "5W-30",
  "normen": [
   [
    "PSA B71 2290",
    "B71 2290"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Peugeot · Citroën · DS",
  "titel": "PureTech-Benziner (ab ca. 2017)",
  "viskositaet": "0W-30",
  "normen": [
   [
    "PSA B71 2312",
    "B71 2312"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Renault · Dacia",
  "titel": "Benziner (bis ca. 2018)",
  "viskositaet": "5W-40",
  "normen": [
   [
    "Renault RN0700",
    "RN0700",
    "RN 0700"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Renault · Dacia",
  "titel": "Diesel mit Partikelfilter (bis ca. 2018)",
  "viskositaet": "5W-30",
  "normen": [
   [
    "Renault RN0720",
    "RN0720",
    "RN 0720"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Renault · Dacia",
  "titel": "Neuere Benziner & Diesel (ab ca. 2018)",
  "viskositaet": "5W-30",
  "normen": [
   [
    "Renault RN17",
    "RN17",
    "RN 17"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Porsche",
  "titel": "Benziner",
  "viskositaet": "0W-40",
  "normen": [
   [
    "Porsche A40",
    "A40"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Porsche",
  "titel": "Diesel",
  "viskositaet": "5W-30",
  "normen": [
   [
    "Porsche C30",
    "C30"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "Volvo",
  "titel": "Benziner & Diesel (ab ca. 2016)",
  "viskositaet": "0W-20",
  "normen": [
   [
    "Volvo VCC RBS0-2AE",
    "VCC RBS0-2AE",
    "RBS0-2AE"
   ]
  ],
  "kategorie": "OEL"
 },
 {
  "hersteller": "VW · Audi · Seat · Škoda",
  "titel": "G12evo (ab ca. 2017)",
  "viskositaet": "G12evo",
  "normen": [
   [
    "VW TL 774 L",
    "TL 774-L",
    "TL774L"
   ]
  ],
  "kategorie": "KUEHL"
 },
 {
  "hersteller": "VW · Audi · Seat · Škoda",
  "titel": "G13 (ca. 2012–2017)",
  "viskositaet": "G13",
  "normen": [
   [
    "VW TL 774 J",
    "TL 774-J",
    "TL774J"
   ]
  ],
  "kategorie": "KUEHL"
 },
 {
  "hersteller": "VW · Audi · Seat · Škoda",
  "titel": "G12++ (ca. 2008–2012)",
  "viskositaet": "G12++",
  "normen": [
   [
    "VW TL 774 G",
    "TL 774-G",
    "TL774G"
   ]
  ],
  "kategorie": "KUEHL"
 },
 {
  "hersteller": "VW · Audi · Seat · Škoda",
  "titel": "G12+ (ca. 2005–2008)",
  "viskositaet": "G12+",
  "normen": [
   [
    "VW TL 774 F",
    "TL 774-F",
    "TL774F"
   ]
  ],
  "kategorie": "KUEHL"
 },
 {
  "hersteller": "BMW · Mini",
  "titel": "BMW-Kühlmittel",
  "viskositaet": "",
  "normen": [
   [
    "BMW GS 94000",
    "GS 94000",
    "GS94000"
   ]
  ],
  "kategorie": "KUEHL"
 },
 {
  "hersteller": "Mercedes-Benz",
  "titel": "Ältere Modelle",
  "viskositaet": "",
  "normen": [
   [
    "MB 325.0",
    "MB-Freigabe 325.0"
   ]
  ],
  "kategorie": "KUEHL"
 },
 {
  "hersteller": "Mercedes-Benz",
  "titel": "Neuere Modelle",
  "viskositaet": "",
  "normen": [
   [
    "MB 325.5",
    "MB-Freigabe 325.5"
   ]
  ],
  "kategorie": "KUEHL"
 },
 {
  "hersteller": "Opel",
  "titel": "GM-Motoren",
  "viskositaet": "",
  "normen": [
   [
    "GM 6277M",
    "GM6277M",
    "6277M"
   ]
  ],
  "kategorie": "KUEHL"
 },
 {
  "hersteller": "Ford",
  "titel": "Ford-Kühlmittel",
  "viskositaet": "",
  "normen": [
   [
    "Ford WSS-M97B44-D",
    "WSS-M97B44-D",
    "M97B44-D"
   ]
  ],
  "kategorie": "KUEHL"
 },
 {
  "hersteller": "Peugeot · Citroën · DS",
  "titel": "PSA-Kühlmittel",
  "viskositaet": "",
  "normen": [
   [
    "PSA B71 5110",
    "B71 5110"
   ]
  ],
  "kategorie": "KUEHL"
 },
 {
  "hersteller": "Renault · Dacia",
  "titel": "Renault Type D",
  "viskositaet": "",
  "normen": [
   [
    "Renault 41-01-001",
    "41-01-001"
   ]
  ],
  "kategorie": "KUEHL"
 }
];
  const norm = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9ÄÖÜ+]/g, "");
  function passt(v, freigabenTexte, spezifikation) {
    const texte = [...freigabenTexte, spezifikation || ""].map(norm);
    return v.normen.every((schreibweisen) => schreibweisen.map(norm).some((n) => texte.some((t) => t === n || t.includes(n))));
  }
  global.Fahrzeuge = { liste: LISTE, passt };
  if (typeof module !== "undefined") module.exports = global.Fahrzeuge;
})(typeof window !== "undefined" ? window : globalThis);
