
// Configuração do Supabase para FATFIT
const SUPABASE_URL = 'https://wrxgwfllndphyshzdmqu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bDNhWmTp0a0z5jZ-0aZ-Pg_OVxj7tII';

// Inicializa o cliente
const { createClient } = supabase;
window.db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

console.log('FATFIT - Supabase inicializado');


// ============================================
// FIREBASE - Configuração de Notificações
// ============================================

// Inicializa Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCuqjWq74Sn-JaujjAbJ6CA8a0Nyvtys7w",
    authDomain: "fatfit-notificacoes.firebaseapp.com",
    projectId: "fatfit-notificacoes",
    storageBucket: "fatfit-notificacoes.firebasestorage.app",
    messagingSenderId: "842531835544",
    appId: "1:842531835544:web:f5e2d198bf4689c6ac8aed"
};

// Importa Firebase (carregado via CDN no index.html)
let firebaseMessaging = null;

async function initFirebaseMessaging() {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    try {
        firebaseMessaging = firebase.messaging();
        
        // Solicita permissão
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await firebaseMessaging.getToken({
                vapidKey: 'BGVh1FnGAVjARr2FeZYbWqtMBcwV0m2DTmvnHc2ZLvbEVHGtyVNbwU_Jsoac3Vvr7IMwNhQFyxV_LmbQOuvKJ-4'
            });
            console.log('🔔 Token FCM:', token);
            
            // Salva o token no perfil
            const user = await getCurrentUser();
            if (user) {
                await db.from('profiles').update({ fcm_token: token }).eq('id', user.id);
            }
            return token;
        }
    } catch (e) {
        console.error('Erro Firebase:', e);
    }
    return null;
}