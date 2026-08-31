const CACHE_NAME = "cogsmith-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/cogsmith-icon.svg",
  "./icons/cogsmith-icon-192.png",
  "./icons/cogsmith-icon-512.png"
];

const CDN_ASSETS = [
  "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@4.0.0/dist/jspdf.umd.min.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);

      await Promise.allSettled(
        CDN_ASSETS.map(async asset => {
          const response = await fetch(asset);
          await cache.put(asset, response);
        })
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(name => name.startsWith("cogsmith-") && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(request);

        if (response.ok || response.type === "opaque") {
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        if (request.mode === "navigate") {
          const fallback = await cache.match("./index.html");

          if (fallback) {
            return fallback;
          }
        }

        throw error;
      }
    })()
  );
});
