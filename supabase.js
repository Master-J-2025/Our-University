import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jtyuqsitdzfsyuhjxrio.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_a5NTAcU7oj683EWc5pz7og__9BJi_9D';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para conectar la aplicación.');
}

const fetchWithMemberName = (input, init) => {
  const requestUrl = input instanceof Request ? input.url : String(input);
  if (!requestUrl.startsWith(`${SUPABASE_URL}/rest/v1/`)) return fetch(input, init);

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
  const coupleId = localStorage.getItem('nuestro_universo_active_couple_id');
  const memberName = coupleId
    ? localStorage.getItem(`nuestro_universo_active_member_${coupleId}`)
    : '';
  if (memberName) {
    const encodedName = btoa(Array.from(new TextEncoder().encode(memberName), byte =>
      String.fromCharCode(byte)).join(''));
    headers.set('x-couple-member-name', encodedName);
  } else {
    headers.delete('x-couple-member-name');
  }
  return fetch(input, { ...init, headers });
};

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: fetchWithMemberName },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
