/* Digital Solutions Invoicing — Service Worker
   Caches the app shell so the invoice builder keeps working offline.
   PDF/print libraries are loaded from a CDN and require a connection
   the first time; after that they're cached too. Logo, payment QR,
   and app icons are embedded directly in script.js/manifest.json —
   no separate image files are needed. */

const CACHE_NAME = "ds-invoice-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && req.url.startsWith(self.location.origin)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === "navigate") return caches.match("./offline.html");
          return cached;
        });
      return cached || network;
    })
  );
});
