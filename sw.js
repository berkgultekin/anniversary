/* 365 Sebep — service worker */
const CACHE = '365sebep-v17';
const CORE = [
  '.',
  'index.html',
  'style.css',
  'app.js',
  'notes.enc.js',
  'firebase-config.js',
  'sync.js',
  'cycle.js',
  'market.js',
  'routines.js',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// Kurulumda dosyalari sunucudan taze cek (tarayici HTTP onbellegini atla)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Ag oncelikli, ag yoksa onbellek.
// Kendi dosyalarimizi 'no-cache' ile isteriz: GitHub Pages'in 10 dakikalik
// tarayici onbellegi yuzunden eski surum gosterilmesin.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Firestore canli baglantisina karisma (SW araya girerse senkron bozulur)
  if (url.hostname.endsWith('googleapis.com')) return;

  const sameOrigin = url.origin === self.location.origin;
  const netReq = sameOrigin ? new Request(req, { cache: 'no-cache' }) : req;

  e.respondWith(
    fetch(netReq)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
