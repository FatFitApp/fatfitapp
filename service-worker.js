// FATFIT - Service Worker
const CACHE_NAME = 'fatfit-v3';

// Arquivos para cache offline
const CACHE_FILES = [
    '/fatfitapp/',
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
    '/fatfitapp/perfil_padrao.png',
    '/fatfitapp/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js'
];

// Instala - faz cache dos arquivos e força ativação
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_FILES))
            .catch(err => console.log('Cache parcial:', err))
    );
});

// Ativa - limpa caches antigos e assume controle
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