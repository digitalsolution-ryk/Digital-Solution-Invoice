/* Digital Solutions Invoicing — Service Worker
   Caches the app shell (including the real icon files under /icons)
   so the invoice builder keeps working offline and Android/Chrome can
   fetch the icons needed to install the app (WebAPK). PDF/print
   libraries are loaded from a CDN and require a connection the first
   time; after that they're cached too. */

const CACHE_NAME = "ds-invoice-v5";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./firebase-config.js",
  "./sync.js",
  "./manifest.json",
  "./offline.html",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-icon.png",
];
const NETWORK_FIRST = ["index.html", "script.js", "sync.js", "firebase-config.js"];

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

  const isAppCode = NETWORK_FIRST.some((f) => req.url.endsWith(f)) || req.mode === "navigate";

  if (isAppCode) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && req.url.startsWith(self.location.origin)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || (req.mode === "navigate" ? caches.match("./offline.html") : undefined))
        )
    );
    return;
  }

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
        .catch(() => cached);
      return cached || network;
    })
  );
});
