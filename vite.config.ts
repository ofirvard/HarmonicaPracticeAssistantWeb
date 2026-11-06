import { defineConfig, type Plugin } from 'vitest/config';

// Emits sw.js listing every built file, so the whole app is cached on first visit and works
// offline. The cache name is a hash of that list, so each deploy replaces the old cache.
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = [
        './',
        ...Object.keys(bundle).filter((name) => !name.endsWith('.map')),
        'hop-processor.js',
        'manifest.webmanifest',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png',
      ];
      // Built file names carry content hashes, so a hash of the names changes whenever the app does.
      let hash = 0;
      for (const char of JSON.stringify(Object.keys(bundle).sort())) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      const version = hash.toString(36);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const CACHE = 'harmonica-${version}';
const FILES = ${JSON.stringify([...new Set(files)])};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // Network first for the page, so a new deploy shows up when online.
    event.respondWith(fetch(request).catch(() => caches.match('./', { cacheName: CACHE })));
    return;
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request)));
});
`,
      });
    },
  };
}

export default defineConfig({
  // Relative paths so the build works from any folder, such as GitHub Pages' /<repo>/.
  base: './',
  plugins: [serviceWorker()],
  server: {
    // This repo lives on /mnt/c under WSL, where file-change events from Windows editors often
    // never reach Linux, so hot reload has to poll instead.
    watch: { usePolling: true, interval: 300 },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
