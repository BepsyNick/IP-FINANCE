const CACHE_VERSION =
  new URL(self.location.href).searchParams.get("v") || "dev";

const CACHE_NAME = `finance-control-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./categories.js",
  "./app.js",
  "./manifest.json",
  "./icons/favicon-16.png",
  "./icons/favicon-32.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("finance-control-"))
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Не кешируем POST/PUT/DELETE запросы.
  // Это важно для /api/login, /api/expenses и т.д.
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // Не трогаем внешние запросы
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Не кешируем backend API
  if (requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  const networkFirstFiles = [
    "/",
    "/index.html",
    "/config.js",
    "/categories.js",
    "/app.js",
    "/style.css",
    "/service-worker.js",
  ];

  const shouldUseNetworkFirst =
    event.request.mode === "navigate" ||
    networkFirstFiles.includes(requestUrl.pathname);

  if (shouldUseNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });

          return response;
        })
        .catch(() => caches.match(event.request))
    );

    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).then((response) => {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });

          return response;
        })
      );
    })
  );
});