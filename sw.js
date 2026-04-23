// ===== ONESIGNAL (debe ir primero) =====
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// ===== CACHE PWA =====
const CACHE_NAME = "daily-love-v2";

const urlsToCache = [
  "/",
  "/app.html",
  "/registro.html",
  "/js/app.js",
  "/js/firebase.js",
  "/js/registro.js",
  "/js/registroFirebase.js",
  "/js/toast.js",
  "/Daily L.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request)
      .then(res => res || fetch(e.request))
  );
});