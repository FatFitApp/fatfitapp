// ============================================
// FATFIT - Configuração Supabase
// ============================================

const SUPABASE_URL = 'https://oimfvbvlffzjctxbaiyt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbWZ2YnZsZmZ6amN0eGJhaXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NzEzMDAsImV4cCI6MjA5NzA0NzMwMH0.qEgVxZjgI2Mg8-HmEgiwh5O-bgrJzslkQUC0NZrhWAM';

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