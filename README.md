# Nuestro Universo

Aplicación web para espacios privados de pareja, con React/Vite y Supabase.
Las parejas comparten usuario y contraseña; cada cuenta conserva sus propios
datos en el mismo proyecto Supabase.

## Desarrollo

1. Instala Node.js 20 o posterior.
2. Copia `.env.example` a `.env` y configura `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY` y
   `VITE_VAPID_PUBLIC_KEY`. La clave publicable de Supabase y la clave
   pública VAPID pueden ir al navegador; nunca pongas una `service_role`,
   la clave privada VAPID ni el secreto Turnstile en variables `VITE_*`.
3. Ejecuta `npm ci` y `npm run dev`. Para comprobar el paquete final usa
   `npm run build` y `npm run preview`.

## Preparar el proyecto Supabase existente

Haz primero un respaldo de la base. No borres ni recrees el proyecto.

1. Si aún no se ejecutaron, aplica `supabase_schema.sql` y después
   `supabase_username_logo.sql`. Las filas heredadas quedan sin asignar hasta
   que se asocien expresamente a una pareja; estas migraciones no las borran.
2. Aplica `supabase_production.sql` desde el SQL Editor. Es una migración
   incremental: añade recuperación, historial de notificaciones, tablas de
   push, permisos y funciones. No reemplaza el esquema existente.
   Para mostrar la persona y el cambio en cada aviso, aplica también
   `supabase_activity_details.sql` después de completar los nombres de la pareja.
   En Configuración, cada navegador debe elegir quién lo está usando; esa
   selección identifica los cambios hechos desde ese dispositivo.
3. En Authentication → Providers → Email, conserva Email/Password y desactiva
   **Confirm email**. Esta aplicación no pide ni envía correo.
4. Crea un widget Turnstile en Cloudflare con el modo **Managed** y agrega
   el hostname exacto de publicación (por ejemplo, `OWNER.github.io`; sin
   `https://` ni la ruta del repositorio). Usa la **Sitekey** como
   `VITE_TURNSTILE_SITE_KEY`. En Supabase
   Auth → Bot and Abuse Protection → CAPTCHA, habilita CAPTCHA, selecciona
   Cloudflare Turnstile y pega la **Secret key**. Configura también esa
   Secret key como secreto de función `TURNSTILE_SECRET_KEY` para proteger
   restablecimientos; es un secreto diferente de la sitekey. Añade el
   hostname del sitio a `TURNSTILE_HOSTNAMES` y a los dominios autorizados
   de Supabase. La recuperación de contraseña también presenta y valida
   Turnstile. Nunca pongas la Secret key en el frontend ni en `VITE_*`.
5. Genera un par de claves VAPID en un entorno local confiable. La pública se
   configura también como `VITE_VAPID_PUBLIC_KEY`; la privada solo en
   Supabase. Configura `VAPID_SUBJECT` con un contacto de administración.
6. Configura secretos de funciones en Supabase antes de invocarlas, nunca en
   el bundle web: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
   `PUSH_WEBHOOK_SECRET`, `APP_ORIGINS` y `APP_URL`. Configura también
   `TURNSTILE_SECRET_KEY` y `TURNSTILE_HOSTNAMES`.
   `APP_ORIGINS` es el origen (sin ruta), por ejemplo
   `https://OWNER.github.io`; `APP_URL` es la URL completa del proyecto Pages,
   por ejemplo `https://OWNER.github.io/REPOSITORY/`. Agrega los orígenes
   locales requeridos, como `http://127.0.0.1:5173`, a `APP_ORIGINS`.
   Supabase proporciona `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY` a las funciones; nunca los publiques.
7. Despliega las Edge Functions:

   ```powershell
   supabase link --project-ref TU_PROJECT_REF
   supabase functions deploy login-with-username
   supabase functions deploy issue-recovery-code
   supabase functions deploy reset-password
   supabase functions deploy manage-push-subscription
   supabase functions deploy dispatch-couple-push
   supabase functions deploy send-scheduled-notifications
   ```

8. En Supabase Database → Webhooks, crea un webhook para `INSERT` en
   `public.couple_activity` hacia la función `dispatch-couple-push`. Añade el
   encabezado `x-notification-secret` con el mismo `PUSH_WEBHOOK_SECRET`.
   Configura un cron que haga `POST` a `send-scheduled-notifications` cada 15
   minutos, usando ese mismo encabezado. El cron libera cápsulas vencidas y
   crea avisos de fechas a 7 días, 1 día y el mismo día.
9. Cada pareja crea una cuenta con usuario y contraseña; ambos integrantes
   usan las mismas credenciales. En Configuración se puede cambiar el logo y
   la zona horaria. El logo admite PNG, JPG, WebP o GIF de hasta 5 MB.

Los códigos de recuperación se muestran una sola vez, vencen a los 30 minutos
y bloquean nuevos intentos durante 30 minutos tras cinco códigos incorrectos.
Guárdenlos fuera del dispositivo. Restablecer la contraseña invalida el código.

Las notificaciones push requieren HTTPS, permiso explícito del navegador y
soporte de Web Push en el dispositivo. Cada dispositivo se suscribe por
separado; la app sigue funcionando si el permiso se rechaza.

## GitHub Pages

1. Sube el proyecto a un repositorio GitHub. En Settings → Pages, selecciona
   **GitHub Actions** como origen.
2. En Settings → Secrets and variables → Actions → Variables, configura
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY` y
   `VITE_VAPID_PUBLIC_KEY`.
3. El workflow `.github/workflows/deploy.yml` compila y publica `dist` al
   hacer push a `main`. Si la rama predeterminada tiene otro nombre, actualiza
   el disparador del workflow.
4. Después de conocer la URL pública, agrega su hostname a **ambos**:
   la lista de hostnames del widget Cloudflare y `TURNSTILE_HOSTNAMES`.
   Vuelve a ejecutar el workflow para que se incluya la sitekey en el bundle.

No uses las claves de prueba de Turnstile en el proyecto Supabase real: son
públicas y aceptan respuestas de prueba. Para probar en producción usa las
claves reales en la URL publicada. Cloudflare documenta claves de prueba para
un entorno aislado en
[Test your Turnstile implementation](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Datos heredados

La migración multi-pareja conserva las filas anteriores con `couple_id = NULL`
y RLS impide que cuentas nuevas las lean o modifiquen. Para conservarlas,
asígnalas explícitamente a una pareja después de comprobar el UUID y respaldar
la base. No compartas ese espacio sin confirmar antes que las filas
correspondan a la pareja correcta.
