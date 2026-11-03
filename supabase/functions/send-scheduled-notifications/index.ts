import { adminClient, sendActivityPush } from '../_shared/push.ts';
import { handleOptions, hasWebhookSecret, jsonResponse, originIsAllowed } from '../_shared/http.ts';
import { getDateOccurrence, getDaysUntilDate, getTodayInTimezone } from '../_shared/calendar.js';

const insertActivity = async (
    coupleId: string,
    eventType: 'date_reminder' | 'capsule_revealed',
    eventKey: string,
    message: string,
    daysBefore?: number
) => {
    const details = daysBefore === undefined ? { message } : { message, days_before: daysBefore };
    const { data, error } = await adminClient.from('couple_activity').upsert({
        couple_id: coupleId,
        event_type: eventType,
        event_key: eventKey,
        details
    }, { onConflict: 'event_key', ignoreDuplicates: true }).select('id, couple_id, event_type, details').maybeSingle();
    if (error) throw new Error(`No se pudo guardar un recordatorio: ${error.message}`);
    if (data) await sendActivityPush(data);
};

Deno.serve(async request => {
    if (request.method === 'OPTIONS') return handleOptions(request);
    if (!originIsAllowed(request)) return jsonResponse(request, { error: 'Origen no permitido.' }, 403);
    if (request.method !== 'POST') return jsonResponse(request, { error: 'Método no permitido.' }, 405);
    if (!hasWebhookSecret(request)) return jsonResponse(request, { error: 'No autorizado.' }, 401);

    try {
        const { data: couples, error: couplesError } = await adminClient
            .from('couples')
            .select('id, couple_settings(timezone)');
        if (couplesError) throw new Error(`No se pudieron cargar las parejas: ${couplesError.message}`);

        let created = 0;
        for (const couple of couples || []) {
            const settings = Array.isArray(couple.couple_settings) ? couple.couple_settings[0] : couple.couple_settings;
            const today = getTodayInTimezone(new Date(), settings?.timezone || 'UTC');
            const { data: dates, error: datesError } = await adminClient
                .from('dates')
                .select('id, name, title, date, recurring, emoji')
                .eq('couple_id', couple.id);
            if (datesError) throw new Error(`No se pudieron cargar fechas: ${datesError.message}`);

            for (const specialDate of dates || []) {
                const targetDate = getDateOccurrence(specialDate.date, today, specialDate.recurring);
                if (!targetDate) continue;
                const daysBefore = getDaysUntilDate(today, targetDate);
                if (![0, 1, 7].includes(daysBefore)) continue;
                const year = targetDate.slice(0, 4);
                const name = specialDate.name || specialDate.title || 'una fecha especial';
                const message = daysBefore === 0
                    ? `Hoy es ${name}${specialDate.emoji ? ` ${specialDate.emoji}` : ''}.`
                    : `Faltan ${daysBefore} días para ${name}${specialDate.emoji ? ` ${specialDate.emoji}` : ''}.`;
                await insertActivity(
                    couple.id,
                    'date_reminder',
                    `date:${couple.id}:${specialDate.id}:${year}:${daysBefore}`,
                    message,
                    daysBefore
                );
                created += 1;
            }

            const { data: capsules, error: capsulesError } = await adminClient
                .from('capsules')
                .select('id, title, reveal_date')
                .eq('couple_id', couple.id)
                .eq('revealed', false)
                .lte('reveal_date', today);
            if (capsulesError) throw new Error(`No se pudieron cargar cápsulas: ${capsulesError.message}`);
            for (const capsule of capsules || []) {
                const { error: revealError } = await adminClient.from('capsules')
                    .update({ revealed: true })
                    .eq('id', capsule.id)
                    .eq('couple_id', couple.id)
                    .eq('revealed', false);
                if (revealError) throw new Error(`No se pudo revelar una cápsula: ${revealError.message}`);
                await insertActivity(
                    couple.id,
                    'capsule_revealed',
                    `capsule:${couple.id}:${capsule.id}`,
                    `La cápsula "${capsule.title || 'sin título'}" ya está disponible.`
                );
                created += 1;
            }
        }
        return jsonResponse(request, { ok: true, processed: created });
    } catch (error) {
        console.error('[Notifications] Error al procesar recordatorios:', error);
        return jsonResponse(request, { error: error instanceof Error ? error.message : 'Error interno.' }, 500);
    }
});
