const SUPABASE_URL = 'https://jtyuqsitdzfsyuhjxrio.supabase.com';
const SUPABASE_KEY = 'sb_publishable_a5NTAcU7oj683EWc5pz7og__9BJi_9D';

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

if (!supabaseClient) {
  console.warn(
    "Supabase no está cargado. Asegúrate de cargar el SDK antes de este archivo: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
  );
}

window.supabaseClient = supabaseClient;
window.supabase = supabaseClient || window.supabase;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { supabase: supabaseClient };
}

const supabase = supabaseClient;

if (typeof globalThis !== 'undefined') {
  globalThis.supabase = supabase;
}

window.supabaseClient = supabase;
