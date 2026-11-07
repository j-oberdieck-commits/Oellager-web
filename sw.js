// Nur die App-Hülle zwischenspeichern; Daten kommen immer frisch aus der Cloud.
const CACHE = "oellager-web-v5";
const DATEIEN = ["./", "index.html", "manifest.webmanifest", "icon.svg", "zusammenfuehren.js"];
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
