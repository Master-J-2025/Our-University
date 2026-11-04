import webPush from 'npm:web-push@3.6.7';
import { adminClient } from './admin.ts';
import { assertPushConfiguration } from './push-config.js';

export const sendActivityPush = async (activity: {
    id: string;
    couple_id: string;
    event_type: string;
    details?: Record<string, unknown> | null;
}) => {
    assertPushConfiguration(name => Deno.env.get(name));
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')!;
    const appUrl = Deno.env.get('APP_URL')!;
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const eventKey = `activity:${activity.id}`;
    const { data: claimed, error: claimError } = await adminClient.rpc('claim_notification_delivery', {
        requested_event_key: eventKey,
        requested_couple_id: activity.couple_id,
        requested_activity_id: activity.id
    });
    if (claimError) throw new Error(`No se pudo reservar la notificación: ${claimError.message}`);
    if (!claimed) return { skipped: true, sent: 0 };

    try {
        const { data: subscriptions, error } = await adminClient
            .from('push_subscriptions')
            .select('id, endpoint, p256dh, auth_key')
            .eq('couple_id', activity.couple_id);
        if (error) throw new Error(`No se pudieron cargar las suscripciones: ${error.message}`);

        const details = activity.details || {};
        const title = activity.event_type === 'date_reminder'
            ? 'Recordatorio especial'
            : activity.event_type === 'capsule_revealed'
                ? 'Una cápsula está disponible'
                : 'Novedad compartida';
        const body = typeof details.message === 'string'
            ? details.message
            : activity.event_type === 'date_reminder'
                ? 'Se acerca una fecha especial.'
                : activity.event_type === 'capsule_revealed'
                    ? 'Una cápsula del tiempo ya está disponible.'
                    : 'Hubo un cambio compartido en su espacio.';
        const payload = JSON.stringify({
            title,
            body,
            url: appUrl
        });

        let sent = 0;
        const failures: string[] = [];
        for (const subscription of subscriptions || []) {
            try {
                await webPush.sendNotification({
                    endpoint: subscription.endpoint,
                    keys: { p256dh: subscription.p256dh, auth: subscription.auth_key }
                }, payload);
                sent += 1;
            } catch (error) {
                const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
                if (statusCode === 404 || statusCode === 410) {
                    const { error: deleteError } = await adminClient
                        .from('push_subscriptions')
                        .delete()
                        .eq('id', subscription.id);
                    if (deleteError) failures.push(`No se pudo limpiar una suscripción vencida: ${deleteError.message}`);
                } else {
                    failures.push(error instanceof Error ? error.message : 'Error desconocido al enviar push.');
                }
            }
        }

        if (failures.length) throw new Error(failures.join('; '));
        const { error: finishError } = await adminClient.rpc('finish_notification_delivery', {
            requested_event_key: eventKey,
            was_delivered: true,
            error_message: null
        });
        if (finishError) throw new Error(`No se pudo guardar el resultado push: ${finishError.message}`);
        return { skipped: false, sent };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido al enviar push.';
        const { error: finishError } = await adminClient.rpc('finish_notification_delivery', {
            requested_event_key: eventKey,
            was_delivered: false,
            error_message: message
        });
        if (finishError) console.error('[Push] No se pudo marcar el envío fallido:', finishError.message);
        throw error;
    }
};
