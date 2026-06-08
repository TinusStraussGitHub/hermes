// Service Worker for Personal Insights Hub PWA
const CACHE_NAME = 'personal-insights-hub-v3';
// Only cache local resources (no external CDNs to avoid CORS issues)
const urlsToCache = [
  './',
  './index.html',
  './preview-youtube.html',
  './preview-operator-flow.html',
  './preview-fleet-dashboard.html',
  './preview-rustenberg-server.html',
  './preview-block-history.html',
  './script.js',
  './style.css',
  './marked.min.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './data/standup.enc.json',
  './data/ai-news.enc.json',
  './data/bible-verse.enc.json',
  './preview-uploadtest.html',
  './preview-uploadtest2.html',
  './preview-starship-launch12.html',
  './preview-drilling-analytics.html',
  './preview-blastmap-marketing.html',
  './data/blastmap-marketing-preview.mp4',
  './preview-xplolog.html'
];

  // Data files that should always be fetched from network first
  const DATA_FILES = [
    'schedule.enc.json',
    'weather.enc.json',
    'insights.enc.json',
    'standup.enc.json',
    'ai-news.enc.json',
    'bible-verse.enc.json',
    'knowledge.enc.json'
  ];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        // Use individual cache.add calls to handle failures gracefully
        const cachePromises = urlsToCache.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`Service Worker: Failed to cache ${url}:`, err);
          });
        });
        return Promise.all(cachePromises);
      })
      .then(() => self.skipWaiting())
  );
});

// Fetch event - network-first for data files, cache-first for static assets
self.addEventListener('fetch', event => {
  // Skip cross-origin requests (like external APIs)
  // EXCEPT for OpenStreetMap which we allow for the map iframe
  const isOSM = event.request.url.includes('openstreetmap.org');
  if (!event.request.url.startsWith(self.location.origin) && !isOSM) {
    return;
  }

  const isDataFile = DATA_FILES.some(df => event.request.url.endsWith(df));

  if (isDataFile) {
    // NETWORK FIRST for data files — always get fresh data
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // Update cache with fresh data
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          // Network failed — fall back to cache
          return caches.match(event.request);
        })
    );
  } else {
    // CACHE FIRST for static assets (HTML, CSS, JS, images)
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          const fetchRequest = event.request.clone();
          return fetch(fetchRequest).then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }).catch(() => {
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
          });
        })
    );
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for skip waiting message (from page)
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
