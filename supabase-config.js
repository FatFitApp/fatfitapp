// ============================================
// FATFIT - Configuração Supabase
// ============================================

const SUPABASE_URL = 'https://wrxgwfllndphyshzdmqu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyeGd3ZmxsbmRwaHlzaHpkbXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjY0MzAsImV4cCI6MjA5MjgwMjQzMH0.ebqAcoQfoG7gAqaq07b4LlU4dr5jHKXhOuD3xI5bCZQ';

// Inicializa o cliente Supabase
const { createClient } = supabase;
window.db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

console.log('FATFIT - Supabase inicializado');