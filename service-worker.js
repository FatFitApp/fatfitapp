// FATFIT - Service Worker
const CACHE_NAME = 'fatfit-v1';

// Arquivos para cache offline
const CACHE_FILES = [
    '/',
    '/fatfitapp/index.html',
    '/fatfitapp/home.html',
    '/fatfitapp/profile.html',
    '/fatfitapp/person.html',
    '/fatfitapp/body.html',
    '/fatfitapp/search.html',
    '/fatfitapp/activity.html',
    '/fatfitapp/style.css',
    '/fatfitapp/app.js',
    '/fatfitapp/supabase-config.js',
    '/fatfitapp/logo.png',
    '/fatfitapp/corpo.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js'
];

// Instala - faz cache dos arquivos
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_FILES))
            .then(() => self.skipWaiting())
    );
});

// Ativa - limpa caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - serve do cache, depois atualiza
self.addEventListener('fetch', (event) => {
    // Não faz cache de requisições do Supabase (API)
    if (event.request.url.includes('supabase.co')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                // Atualiza cache em background
                const fetchPromise = fetch(event.request)
                    .then(response => {
                        if (response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(event.request, clone));
                        }
                        return response;
                    })
                    .catch(() => cached);
                
                return cached || fetchPromise;
            })
    );
});
