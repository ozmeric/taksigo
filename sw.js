const CACHE = "taksigo-v5";
const SHELL = ["./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];
// app.js and config.js are deliberately NOT in the cache-first shell list —
// app.js is shared across all customers and updated centrally, so it must
// always be fetched fresh (network-first) or customers could be stuck on a
// stale cached copy indefinitely. config.js is tiny and rarely changes, but
// gets the same treatment for consistency.
const NETWORK_FIRST = ["/app.js", "/config.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache API calls — always go to network
  if (e.request.method === "POST" || url.origin !== location.origin) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // app.js / config.js: network-first, cache only as an offline fallback
  if (NETWORK_FIRST.some((p) => url.pathname.endsWith(p))) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for the rest of the app shell
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
