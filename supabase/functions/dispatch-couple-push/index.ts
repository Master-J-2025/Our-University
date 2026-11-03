import { sendActivityPush } from '../_shared/push.ts';
import { handleOptions, hasWebhookSecret, jsonResponse, originIsAllowed } from '../_shared/http.ts';

Deno.serve(async request => {
    if (request.method === 'OPTIONS') return handleOptions(request);
    if (!originIsAllowed(request)) return jsonResponse(request, { error: 'Origen no permitido.' }, 403);
    if (request.method !== 'POST') return jsonResponse(request, { error: 'Método no permitido.' }, 405);
    if (!hasWebhookSecret(request)) return jsonResponse(request, { error: 'No autorizado.' }, 401);

    try {
        const payload = await request.json();
        const activity = payload.record;
        if (!activity?.id || !activity?.couple_id
            || !['shared_change', 'date_reminder', 'capsule_revealed'].includes(activity.event_type)) {
            return jsonResponse(request, { error: 'Evento de actividad inválido.' }, 400);
        }
        const result = await sendActivityPush(activity);
        return jsonResponse(request, { ok: true, ...result });
    } catch (error) {
        console.error('[Push] No se pudo procesar el webhook:', error);
        return jsonResponse(request, { error: error instanceof Error ? error.message : 'Error interno.' }, 500);
    }
});
