const CACHE_NAME = "daily-love-v2";

const urlsToCache = [
  "/DailyLove/",
  "/DailyLove/index.html",
  "/DailyLove/principal.html",
  "/DailyLove/secundario.html",
  "/DailyLove/registro.html",
  "/DailyLove/js/firebase.js",
  "/DailyLove/js/principal.js",
  "/DailyLove/js/secundario.js",
  "/DailyLove/js/registro.js",
  "/DailyLove/js/registroFirebase.js",
  "/DailyLove/js/toast.js",
  "/DailyLove/DailyLoveN.png"
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