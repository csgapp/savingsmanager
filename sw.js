// ================ SAVINGS GROUP MANAGER - SERVICE WORKER ================
const CACHE_NAME = 'savings-group-manager-v1';

// List of all files to cache for offline use
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/setup.html',
  '/admin.html',
  '/members.html',
  '/member-portal.html',
  '/shareout.html',
  '/history.html',
  '/charts.html',
  '/forgot-password.html',
  '/reset-password.html',
  '/app.js',
  '/admin.js',
  '/member-portal.js',
  '/styles.css',
  '/manifest.json'
];

// ================ INSTALL EVENT ================
// This happens when the service worker is first installed
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('🏦 Cache opened - saving app files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ All files cached successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(err => {
        console.error('❌ Cache failed:', err);
      })
  );
});

// ================ FETCH EVENT ================
// This intercepts network requests
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response from cache
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
      .catch(err => {
        console.error('Fetch failed:', err);
        // Optional: Return a fallback offline page here if desired
      })
  );
});

// ================ ACTIVATE EVENT ================
// This cleans up old caches when a new version is deployed
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('🚀 Service Worker activated');
      return self.clients.claim(); // Take control immediately
    })
  );
});
