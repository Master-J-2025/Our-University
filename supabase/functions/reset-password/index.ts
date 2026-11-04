import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, originIsAllowed } from '../_shared/http.ts';
import { verifyTurnstileToken, MissingTurnstileSecretError } from '../_shared/turnstile.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Faltan secretos requeridos para recuperación.');
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const sha256Hex = async (value: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async request => {
    if (request.method === 'OPTIONS') return handleOptions(request);
    if (!originIsAllowed(request)) return jsonResponse(request, { error: 'Origen no permitido.' }, 403);
    if (request.method !== 'POST') return jsonResponse(request, { error: 'Método no permitido.' }, 405);

    try {
        const body = await request.json();
        const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
        const code = typeof body.code === 'string' ? body.code.replace(/-/g, '').trim().toUpperCase() : '';
        const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
        const captchaValid = await verifyTurnstileToken(body.captchaToken);
        if (!captchaValid) {
            return jsonResponse(request, { error: 'Verificación Turnstile inválida o vencida. Inténtalo de nuevo.' }, 400);
        }
        if (!/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(username)
            || !/^[0-9A-F]{16}$/.test(code)
            || newPassword.length < 12
            || newPassword.length > 128) {
            return jsonResponse(request, { error: 'Usuario, código o contraseña inválidos.' }, 400);
        }

        const { data: usernameRow, error: usernameError } = await adminClient
            .from('couple_usernames')
            .select('user_id')
            .eq('username', username)
            .maybeSingle();
        if (usernameError) throw new Error(`No se pudo validar el usuario: ${usernameError.message}`);
        if (!usernameRow) return jsonResponse(request, { error: 'Usuario o código inválido.' }, 400);

        const { data: recovery, error: recoveryError } = await adminClient
            .from('account_recovery_codes')
            .select('salt')
            .eq('user_id', usernameRow.user_id)
            .maybeSingle();
        if (recoveryError) throw new Error(`No se pudo validar el código: ${recoveryError.message}`);
        if (!recovery) return jsonResponse(request, { error: 'Usuario o código inválido.' }, 400);

        const candidateHash = await sha256Hex(`${recovery.salt}:${code}`);
        const { data: consumedUserId, error: consumeError } = await adminClient.rpc('consume_couple_recovery_code', {
            requested_user_id: usernameRow.user_id,
            candidate_hash: candidateHash
        });
        if (consumeError) throw new Error(`No se pudo verificar el código: ${consumeError.message}`);
        if (!consumedUserId) return jsonResponse(request, { error: 'Usuario o código inválido, vencido o bloqueado temporalmente.' }, 400);

        const { error: updateError } = await adminClient.auth.admin.updateUserById(consumedUserId, {
            password: newPassword
        });
        if (updateError) throw new Error(`No se pudo actualizar la contraseña: ${updateError.message}`);
        return jsonResponse(request, { ok: true });
    } catch (error) {
        console.error('[Recovery] Error al restablecer contraseña:', error);
        if (error instanceof MissingTurnstileSecretError) {
            return jsonResponse(request, { error: error.message }, 503);
        }
        return jsonResponse(request, { error: error instanceof Error ? error.message : 'Error interno.' }, 500);
    }
});
