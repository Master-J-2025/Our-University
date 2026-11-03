import { adminClient } from '../_shared/push.ts';
import { handleOptions, jsonResponse, originIsAllowed } from '../_shared/http.ts';

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

        const body = await request.json();
        const { data: couple, error: coupleError } = await adminClient
            .from('couples')
            .select('id')
            .eq('owner_id', authData.user.id)
            .single();
        if (coupleError || !couple) throw new Error(`No se pudo obtener la pareja: ${coupleError?.message || 'sin resultados'}`);

        if (body.action === 'subscribe') {
            const subscription = body.subscription;
            const endpoint = subscription?.endpoint;
            const p256dh = subscription?.keys?.p256dh;
            const authKey = subscription?.keys?.auth;
            if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')
                || endpoint.length > 2048 || typeof p256dh !== 'string' || typeof authKey !== 'string') {
                return jsonResponse(request, { error: 'Suscripción push inválida.' }, 400);
            }
            const { error } = await adminClient.from('push_subscriptions').upsert({
                couple_id: couple.id,
                user_id: authData.user.id,
                endpoint,
                p256dh,
                auth_key: authKey,
                updated_at: new Date().toISOString()
            }, { onConflict: 'endpoint' });
            if (error) throw new Error(`No se pudo guardar la suscripción: ${error.message}`);
            return jsonResponse(request, { ok: true });
        }

        if (body.action === 'unsubscribe') {
            if (typeof body.endpoint !== 'string' || body.endpoint.length > 2048) {
                return jsonResponse(request, { error: 'Endpoint inválido.' }, 400);
            }
            const { error } = await adminClient.from('push_subscriptions')
                .delete()
                .eq('endpoint', body.endpoint)
                .eq('user_id', authData.user.id)
                .eq('couple_id', couple.id);
            if (error) throw new Error(`No se pudo eliminar la suscripción: ${error.message}`);
            return jsonResponse(request, { ok: true });
        }

        return jsonResponse(request, { error: 'Acción desconocida.' }, 400);
    } catch (error) {
        console.error('[Push] Error en manage-push-subscription:', error);
        return jsonResponse(request, { error: error instanceof Error ? error.message : 'Error interno.' }, 500);
    }
});
