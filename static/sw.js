const CACHE_PREFIX = "farokh-matrix-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;

const MATRIX_ASSETS = [
  "/matrix-app.webmanifest",
  "/favicon.svg",
  "/icons/matrix-app-192.png",
  "/icons/matrix-app-512.png",
  "/matrix/",
  "/matrix/index.html",
  "/matrix/fallback.webp",
  "/matrix/assets/matrixcode_msdf.png",
  "/matrix/js/main.js",
  "/matrix/js/config.js",
  "/matrix/js/colorToRGB.js",
  "/matrix/js/regl/main.js",
  "/matrix/js/regl/utils.js",
  "/matrix/js/regl/rainPass.js",
  "/matrix/js/regl/bloomPass.js",
  "/matrix/js/regl/palettePass.js",
  "/matrix/js/regl/stripePass.js",
  "/matrix/js/regl/imagePass.js",
  "/matrix/js/regl/quiltPass.js",
  "/matrix/js/regl/mirrorPass.js",
  "/matrix/js/regl/lkgHelper.js",
  "/matrix/js/camera.js",
  "/matrix/lib/regl.min.js",
  "/matrix/lib/gl-matrix.js",
  "/matrix/shaders/glsl/rainPass.vert.glsl",
  "/matrix/shaders/glsl/rainPass.frag.glsl",
  "/matrix/shaders/glsl/rainPass.intro.frag.glsl",
  "/matrix/shaders/glsl/rainPass.raindrop.frag.glsl",
  "/matrix/shaders/glsl/rainPass.symbol.frag.glsl",
  "/matrix/shaders/glsl/rainPass.effect.frag.glsl",
  "/matrix/shaders/glsl/bloomPass.blur.frag.glsl",
  "/matrix/shaders/glsl/bloomPass.combine.frag.glsl",
  "/matrix/shaders/glsl/bloomPass.highPass.frag.glsl",
  "/matrix/shaders/glsl/palettePass.frag.glsl",
  "/matrix/shaders/glsl/stripePass.frag.glsl",
  "/matrix/shaders/glsl/imagePass.frag.glsl",
  "/matrix/shaders/glsl/quiltPass.frag.glsl",
  "/matrix/shaders/glsl/mirrorPass.frag.glsl",
];

const cacheResponse = async (cache, request) => {
  try {
    const response = await fetch(request, { cache: "reload" });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return undefined;
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        MATRIX_ASSETS.map((asset) => cacheResponse(cache, asset)),
      );

      const home = await cacheResponse(cache, "/");
      if (home?.ok) {
        const html = await home.text();
        const shellAssets = [
          ...html.matchAll(/(?:href|src)=["']([^"']+)["']/g),
        ]
          .map((match) => new URL(match[1], self.location.origin))
          .filter((url) => url.origin === self.location.origin)
          .map((url) => `${url.pathname}${url.search}`);
        await Promise.allSettled(
          [...new Set(shellAssets)].map((asset) =>
            cacheResponse(cache, asset),
          ),
        );
      }

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          return (await caches.match(request)) || (await caches.match("/"));
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
