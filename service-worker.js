const CACHE_NAME = "yapon-tili-v1";

const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/app.js",
  "/js/data.js",
  "/manifest.json"
];

// O'rnatish — fayllarni keshga saqlash
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Fayllar keshga saqlandi");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Eski keshni tozalash
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// So'rovlarni ushlash — avval keshdan, keyin internetdan
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => {
        // Internet yo'q va keshda ham yo'q bo'lsa
        return caches.match("/index.html");
      });
    })
  );
});
