export const verifyTurnstileToken = async (token: unknown) => {
    const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!secret) throw new Error('Falta configurar TURNSTILE_SECRET_KEY en Supabase.');
    if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;

    const body = new URLSearchParams({ secret, response: token });
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });
    if (!verification.ok) {
        throw new Error(`Turnstile no pudo validar la solicitud (HTTP ${verification.status}).`);
    }

    const result = await verification.json();
    if (!result.success) return false;

    const allowedHostnames = (Deno.env.get('TURNSTILE_HOSTNAMES') || '')
        .split(',')
        .map(hostname => hostname.trim().toLowerCase())
        .filter(Boolean);
    if (allowedHostnames.length && !allowedHostnames.includes(String(result.hostname || '').toLowerCase())) {
        return false;
    }
    return true;
};
