const allowedOrigins = (Deno.env.get('APP_ORIGINS') || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

export const corsHeaders = (request: Request) => {
    const origin = request.headers.get('Origin');
    const originAllowed = !origin || allowedOrigins.includes(origin);
    return {
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        ...(origin && originAllowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {})
    };
};

export const originIsAllowed = (request: Request) => {
    const origin = request.headers.get('Origin');
    return !origin || allowedOrigins.includes(origin);
};

export const jsonResponse = (request: Request, body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json' }
    });

export const handleOptions = (request: Request) =>
    new Response('ok', { headers: corsHeaders(request) });

export const hasWebhookSecret = (request: Request) => {
    const configuredSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    return Boolean(configuredSecret && request.headers.get('x-notification-secret') === configuredSecret);
};
