import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, originIsAllowed } from '../_shared/http.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error('Faltan secretos requeridos para el inicio de sesión.');
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});
const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

Deno.serve(async request => {
    if (request.method === 'OPTIONS') return handleOptions(request);
    if (!originIsAllowed(request)) return jsonResponse(request, { error: 'Origen no permitido.' }, 403);
    if (request.method !== 'POST') return jsonResponse(request, { error: 'Método no permitido.' }, 405);

    try {
        const body = await request.json();
        const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken : undefined;
        if (!/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(username) || !password || password.length > 128) {
            return jsonResponse(request, { error: 'Usuario o contraseña incorrectos.' }, 401);
        }

        const { data: usernameRecord, error: usernameError } = await adminClient
            .from('couple_usernames')
            .select('user_id')
            .eq('username', username)
            .maybeSingle();
        if (usernameError) throw new Error(`No se pudo consultar el usuario: ${usernameError.message}`);
        if (!usernameRecord) return jsonResponse(request, { error: 'Usuario o contraseña incorrectos.' }, 401);

        const { data: userResult, error: userError } = await adminClient.auth.admin.getUserById(usernameRecord.user_id);
        if (userError || !userResult.user?.email) {
            throw new Error(`No se pudo obtener la cuenta: ${userError?.message || 'sin correo interno'}`);
        }

        const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
            email: userResult.user.email,
            password,
            options: { captchaToken }
        });
        if (signInError || !sessionData.session) {
            return jsonResponse(request, { error: 'Usuario o contraseña incorrectos.' }, 401);
        }
        return jsonResponse(request, {
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token
        });
    } catch (error) {
        console.error('[Auth] Error al iniciar sesión con usuario:', error);
        return jsonResponse(request, { error: 'No se pudo completar el inicio de sesión.' }, 500);
    }
});
