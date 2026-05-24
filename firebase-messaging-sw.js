// FATFIT - Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCuqjWq74Sn-JaujjAbJ6CA8a0Nyvtys7w",
    authDomain: "fatfit-notificacoes.firebaseapp.com",
    projectId: "fatfit-notificacoes",
    storageBucket: "fatfit-notificacoes.firebasestorage.app",
    messagingSenderId: "842531835544",
    appId: "1:842531835544:web:f5e2d198bf4689c6ac8aed"
});

const messaging = firebase.messaging();

// Notificação em segundo plano
messaging.onBackgroundMessage((payload) => {
    console.log('📩 Notificação em segundo plano:', payload);
    
    const notificationTitle = payload.notification.title || 'FATFIT';
    const notificationOptions = {
        body: payload.notification.body || '',
        icon: '/fatfitapp/logo.png',
        badge: '/fatfitapp/logo.png',
        vibrate: [200, 100, 200],
        data: payload.data
    };
    
    self.registration.showNotification(notificationTitle, notificationOptions);
}); 