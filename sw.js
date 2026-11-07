// Nur die App-Hülle zwischenspeichern; Daten kommen immer frisch aus der Cloud.
const CACHE = "oellager-web-v11";
const DATEIEN = ["./", "index.html", "app.js", "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-192.png", "zusammenfuehren.js", "fahrzeuge.js"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const k = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, k)); return r; })
    .catch(() => caches.match(e.request)));
});

// Push-Meldungen (z. B. neuer Nutzer wartet auf Freigabe)
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titel: "Öllager", text: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titel || "Öllager", { body: d.text || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag || "oellager" }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((l) => (l.length ? l[0].focus() : self.clients.openWindow("./"))));
});
