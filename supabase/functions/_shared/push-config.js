export const requiredPushSecrets = [
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT',
    'APP_URL'
];

export class MissingPushConfigError extends Error {
    constructor(missingSecrets) {
        super(`Faltan secretos de notificaciones push en Supabase: ${missingSecrets.join(', ')}.`);
        this.name = 'MissingPushConfigError';
        this.missingSecrets = missingSecrets;
    }
}

export const getMissingPushSecrets = getSecret =>
    requiredPushSecrets.filter(name => !getSecret(name)?.trim());

export const assertPushConfiguration = getSecret => {
    const missingSecrets = getMissingPushSecrets(getSecret);
    if (missingSecrets.length) throw new MissingPushConfigError(missingSecrets);
};
