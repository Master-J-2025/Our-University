const SUPABASE_URL = 'https://jtyuqsitdzfsyuhjxrio.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a5NTAcU7oj683EWc5pz7og__9BJi_9D';

if (window.location.protocol === 'file:') {
  console.warn('[Supabase] Estás abriendo la página como file://. La conexión no se establece bien en local. Usa GitHub Pages o un servidor HTTP/HTTPS.');
}

const initializeSupabase = () => {
  if (!window.supabase || !window.supabase.createClient) {
    console.warn('[Supabase] SDK no cargado. Revisa que el script de @supabase/supabase-js esté antes de supabase.js.');
    return null;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('[Supabase] Conectado correctamente con la URL:', SUPABASE_URL);
  return client;
};

const supabaseClient = initializeSupabase();

window.supabaseClient = supabaseClient;
window.supabase = window.supabase || {};
window.supabase.client = supabaseClient;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { supabase: supabaseClient };
}
