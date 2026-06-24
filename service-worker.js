// FATFIT - Service Worker v4
const CACHE_NAME = 'fatfit-v5';

// Detecta o base path (localhost ou GitHub Pages)
const BASE_PATH = self.location.hostname === '127.0.0.1' || self.location.hostname === 'localhost'
    ? '/'
    : '/fatfitapp/';

// Arquivos para cache offline
const CACHE_FILES = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'home.html',
    BASE_PATH + 'profile.html',
    BASE_PATH + 'person.html',
    BASE_PATH + 'body.html',
    BASE_PATH + 'search.html',
    BASE_PATH + 'activity.html',
    BASE_PATH + 'bet.html',
    BASE_PATH + 'style.css',
    BASE_PATH + 'app.js',
    BASE_PATH + 'supabase-config.js',
    BASE_PATH + 'logo.png',
    BASE_PATH + 'corpo.png',
    BASE_PATH + 'perfil_padrao.png',
    BASE_PATH + 'icon-192.png',
    BASE_PATH + 'manifest.json',
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
    // Ignora requisições chrome-extension, supabase e vídeos
    if (event.request.url.includes('supabase.co') || 
        event.request.url.startsWith('chrome-extension://') ||
        (event.request.url.includes('activity-photos') && 
         (event.request.url.endsWith('.webm') || event.request.url.endsWith('.mp4')))) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
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