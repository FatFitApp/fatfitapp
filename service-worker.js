// ============================================
// FATFIT - Service Worker
// ============================================

const CACHE_NAME = 'fatfit-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/home.html',
    '/profile.html',
    '/activity.html',
    '/bet.html',
    '/buy.html',
    '/body.html',
    '/cup.html',
    '/style.css',
    '/app.js',
    '/supabase-config.js',
    '/logo.png',
    '/perfil_padrao.png',
    '/manifest.json'
];

// ============================================
// INSTALAÇÃO
// ============================================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// ============================================
// ATIVAÇÃO
// ============================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================
// FETCH (Cache First)
// ============================================
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response;
                return fetch(event.request)
                    .then(response => {
                        if (!response || response.status !== 200) return response;
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(event.request, responseToCache));
                        return response;
                    });
            })
    );
});

// ============================================
// 🔔 PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', event => {
    console.log('🔔 Push recebido:', event);
    
    let data = {};
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = {
                title: 'FATFIT',
                body: event.data.text(),
                icon: '/logo.png',
                badge: '/logo.png'
            };
        }
    }
    
    const options = {
        body: data.body || 'Nova notificação do FATFIT!',
        icon: data.icon || '/logo.png',
        badge: data.badge || '/logo.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/home.html',
            groupId: data.groupId || null,
            activityId: data.activityId || null
        },
        actions: [
            {
                action: 'open',
                title: '📱 Abrir'
            },
            {
                action: 'dismiss',
                title: '❌ Fechar'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'FATFIT', options)
    );
});

// ============================================
// CLIQUE NA NOTIFICAÇÃO
// ============================================
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    const url = event.notification.data?.url || '/home.html';
    const groupId = event.notification.data?.groupId || null;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Se já tem uma janela aberta, foca nela
                for (let client of windowClients) {
                    if (client.url.includes(url) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Se não, abre uma nova
                if (clients.openWindow) {
                    let finalUrl = url;
                    if (groupId) {
                        finalUrl += `?openChat=${groupId}`;
                    }
                    return clients.openWindow(finalUrl);
                }
            })
    );
});