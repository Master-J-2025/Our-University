import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, originIsAllowed } from '../_shared/http.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Faltan secretos requeridos para recuperación.');
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const randomHex = (length: number) => {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

const sha256Hex = async (value: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async request => {
    if (request.method === 'OPTIONS') return handleOptions(request);
    if (!originIsAllowed(request)) return jsonResponse(request, { error: 'Origen no permitido.' }, 403);
    if (request.method !== 'POST') return jsonResponse(request, { error: 'Método no permitido.' }, 405);

    try {
        const authorization = request.headers.get('Authorization') || '';
        const token = authorization.replace(/^Bearer\s+/i, '');
        if (!token || token === authorization) return jsonResponse(request, { error: 'Sesión requerida.' }, 401);
        const { data: authData, error: authError } = await adminClient.auth.getUser(token);
        if (authError || !authData.user) return jsonResponse(request, { error: 'Sesión inválida.' }, 401);

        const { data: username, error: usernameError } = await adminClient
            .from('couple_usernames')
            .select('username')
            .eq('user_id', authData.user.id)
            .maybeSingle();
        if (usernameError) throw new Error(`No se pudo validar el usuario de la cuenta: ${usernameError.message}`);
        if (!username) return jsonResponse(request, { error: 'Asigna primero un usuario compartido desde Configuración.' }, 400);

        const rawCode = randomHex(8).toUpperCase();
        const recoveryCode = rawCode.match(/.{1,4}/g)?.join('-') || rawCode;
        const salt = randomHex(16);
        const codeHash = await sha256Hex(`${salt}:${rawCode}`);
        const { error } = await adminClient.from('account_recovery_codes').upsert({
            user_id: authData.user.id,
            salt,
            code_hash: codeHash,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            failed_attempts: 0,
            locked_until: null,
            used_at: null,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        if (error) throw new Error(`No se pudo guardar el código de recuperación: ${error.message}`);
        return jsonResponse(request, { recoveryCode, expiresInMinutes: 30 });
    } catch (error) {
        console.error('[Recovery] Error al emitir el código:', error);
        return jsonResponse(request, { error: error instanceof Error ? error.message : 'Error interno.' }, 500);
    }
});
