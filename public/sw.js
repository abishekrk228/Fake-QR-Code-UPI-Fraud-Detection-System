self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Dummy fetch handler is required by Chrome to pass the PWA installability check
});
