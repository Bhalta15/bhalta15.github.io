const CACHE_NAME = "daily-love-v1";

const urlsToCache = [
  "/",
  "/inicio.html",
  "/principal.html",
  "/secundario.html",
  "/registro.html",

  // JS
  "/js/firebase.js",
  "/js/inicio.js",
  "/js/principal.js",
  "/js/secundario.js",
  "/js/registro.js",
  "/js/registroFirebase.js",

  // Imágenes
  "/icono-mensajes.jpg",
  "/DailyLove.png"
];

// INSTALAR
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// ACTIVAR
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// FETCH
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request)
      .then(res => res || fetch(e.request))
  );
});