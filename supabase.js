import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jtyuqsitdzfsyuhjxrio.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_a5NTAcU7oj683EWc5pz7og__9BJi_9D';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para conectar la aplicación.');
}

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
