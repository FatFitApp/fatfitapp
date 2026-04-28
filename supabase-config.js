
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