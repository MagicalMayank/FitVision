const CACHE_NAME = 'fitvision-v1';
const ASSETS = [
  'index.html',
  'workout.html',
  'css/styles.css',
  'js/app.js',
  'js/camera.js',
  'js/skeleton.js',
  'js/repCounter.js',
  'js/feedback.js',
  'manifest.json',
  'kinetic_oracle_logo_1776607521030.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
