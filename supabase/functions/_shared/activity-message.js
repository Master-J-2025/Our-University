const tableLabels = {
    memories: 'el recuerdo',
    photos: 'la foto',
    letters: 'la carta',
    songs: 'la canción',
    dreams: 'el sueño',
    capsules: 'la cápsula del tiempo',
    messages: 'el mensaje del día',
    dates: 'la fecha especial',
    moments: 'el momento especial',
    couple_settings: 'la configuración de pareja'
};

const operationVerbs = {
    INSERT: 'agregó',
    UPDATE: 'actualizó',
    DELETE: 'eliminó'
};

export const getActivityMessage = activity => {
    const details = activity?.details || {};
    if (typeof details.message === 'string' && details.message.trim()) return details.message;
    if (activity?.event_type === 'date_reminder') return 'Se acerca una fecha especial.';
    if (activity?.event_type === 'capsule_revealed') return 'Una cápsula del tiempo ya está disponible.';
    if (activity?.event_type !== 'shared_change') return 'Hay una novedad en su espacio.';

    const actor = typeof details.actor_name === 'string' && details.actor_name.trim()
        ? details.actor_name.trim()
        : 'Alguien';
    const verb = operationVerbs[String(details.operation || '').toUpperCase()];
    const label = tableLabels[details.table];
    if (!verb || !label) return `${actor} hizo un cambio en el espacio compartido.`;

    const item = typeof details.item_name === 'string' && details.item_name.trim()
        ? ` «${details.item_name.trim()}»`
        : '';
    return `${actor} ${verb} ${label}${item}.`;
};
