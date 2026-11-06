        import React, { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
        import { createRoot } from 'react-dom/client';
        import { supabaseClient } from './supabase.js';
        import { getActivityMessage } from './supabase/functions/_shared/activity-message.js';
        import './styles.css';

        window.supabaseClient = supabaseClient;
        const appIconUrl = new URL('./dating.gif', import.meta.url).href;

        // ==================== COUPLE DATA ====================
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        let syncQueue = Promise.resolve();

        const getStableUuid = (table, id, coupleId) => {
            if (uuidPattern.test(String(id || ''))) return id;
            const key = `nuestro_universo_uuid_${coupleId}_${table}_${id}`;
            const stored = localStorage.getItem(key);
            if (stored) return stored;
            const uuid = crypto.randomUUID();
            localStorage.setItem(key, uuid);
            return uuid;
        };

        const withCoupleId = (row, table, coupleId) => ({
            ...row,
            id: getStableUuid(table, row.id, coupleId),
            couple_id: coupleId
        });

        const createCoupleForCurrentUser = async () => {
            const { data, error } = await window.supabaseClient.rpc('create_couple_for_current_user');
            if (error) throw new Error(`No se pudo preparar la cuenta de pareja: ${error.message}`);
            if (!data) throw new Error('La base de datos no devolvió la cuenta de pareja.');
            const { error: settingsError } = await window.supabaseClient
                .from('couple_settings')
                .upsert({
                    couple_id: data,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
                }, { onConflict: 'couple_id', ignoreDuplicates: true });
            if (settingsError) {
                throw new Error(`No se pudo preparar la configuración de pareja: ${settingsError.message}`);
            }
            return data;
        };

        const syncSectionsToSupabase = (data, previousData, coupleId) => {
            syncQueue = syncQueue.catch(() => {}).then(async () => {
                if (!window.supabaseClient || !coupleId || !previousData) return;

                const currentTables = [
                    { table: 'memories', rows: (data.memories || []).map(m => withCoupleId({
                        id: m.id,
                        title: m.title,
                        date: m.date,
                        description: m.description,
                        content: m.description || m.title || '',
                        emoji: m.emoji,
                        photos: Array.isArray(m.photos) ? m.photos : []
                    }, 'memories', coupleId)) },
                    { table: 'photos', rows: (data.photos || []).map(p => withCoupleId({
                        id: p.id,
                        title: p.title,
                        date: p.date,
                        description: p.description,
                        image_url: p.storagePath ? null : (p.imageUrl || p.image_url || null),
                        storage_path: p.storagePath || p.storage_path || null
                    }, 'photos', coupleId)) },
                    { table: 'letters', rows: (data.letters || []).map(l => withCoupleId({
                        id: l.id,
                        category: l.category,
                        title: l.title,
                        content: l.content,
                        created_at: l.createdAt || l.created_at || null
                    }, 'letters', coupleId)) },
                    { table: 'songs', rows: (data.songs || []).map(s => withCoupleId({
                        id: s.id,
                        name: s.name,
                        title: s.name,
                        artist: s.artist,
                        reason: s.reason,
                        spotify: s.spotify,
                        youtube: s.youtube,
                        audio_url: s.storagePath ? null : (s.audioUrl || s.audio_url || null),
                        storage_path: s.storagePath || s.storage_path || null
                    }, 'songs', coupleId)) },
                    { table: 'dreams', rows: (data.dreams || []).map(d => withCoupleId({
                        id: d.id,
                        text: d.text,
                        completed: !!d.completed
                    }, 'dreams', coupleId)) },
                    { table: 'capsules', rows: (data.timeCapsules || []).map(c => withCoupleId({
                        id: c.id,
                        title: c.title,
                        message: c.message,
                        content: c.message,
                        reveal_date: c.revealDate,
                        revealed: !!c.revealed
                    }, 'capsules', coupleId)) },
                    { table: 'messages', rows: (data.dailyMessages || []).map(message =>
                        withCoupleId({ id: message.id, content: message.content }, 'messages', coupleId)) },
                    { table: 'dates', rows: (data.specialDates || []).map(sd => withCoupleId({
                        id: sd.id,
                        name: sd.name,
                        title: sd.name,
                        date: sd.date,
                        emoji: sd.emoji,
                        recurring: !!sd.recurring
                    }, 'dates', coupleId)) },
                    { table: 'moments', rows: (data.anniversaryMoments || []).map(m => withCoupleId({
                        id: m.id,
                        title: m.title,
                        description: m.description,
                        image_url: m.imageUrl || null,
                        anniversary_date: m.anniversaryDate
                    }, 'moments', coupleId)) }
                ];

                const previousTables = [
                    { table: 'memories', rows: (previousData.memories || []).map(m => withCoupleId({
                        id: m.id, title: m.title, date: m.date, description: m.description,
                        content: m.description || m.title || '', emoji: m.emoji,
                        photos: Array.isArray(m.photos) ? m.photos : []
                    }, 'memories', coupleId)) },
                    { table: 'photos', rows: (previousData.photos || []).map(p => withCoupleId({
                        id: p.id, title: p.title, date: p.date, description: p.description,
                        image_url: p.storagePath ? null : (p.imageUrl || p.image_url || null),
                        storage_path: p.storagePath || p.storage_path || null
                    }, 'photos', coupleId)) },
                    { table: 'letters', rows: (previousData.letters || []).map(l => withCoupleId({
                        id: l.id, category: l.category, title: l.title, content: l.content,
                        created_at: l.createdAt || l.created_at || null
                    }, 'letters', coupleId)) },
                    { table: 'songs', rows: (previousData.songs || []).map(s => withCoupleId({
                        id: s.id, name: s.name, title: s.name, artist: s.artist, reason: s.reason,
                        spotify: s.spotify, youtube: s.youtube,
                        audio_url: s.storagePath ? null : (s.audioUrl || s.audio_url || null),
                        storage_path: s.storagePath || s.storage_path || null
                    }, 'songs', coupleId)) },
                    { table: 'dreams', rows: (previousData.dreams || []).map(d => withCoupleId({
                        id: d.id, text: d.text, completed: !!d.completed
                    }, 'dreams', coupleId)) },
                    { table: 'capsules', rows: (previousData.timeCapsules || []).map(c => withCoupleId({
                        id: c.id, title: c.title, message: c.message, content: c.message,
                        reveal_date: c.revealDate, revealed: !!c.revealed
                    }, 'capsules', coupleId)) },
                    { table: 'messages', rows: (previousData.dailyMessages || []).map(message =>
                        withCoupleId({ id: message.id, content: message.content }, 'messages', coupleId)) },
                    { table: 'dates', rows: (previousData.specialDates || []).map(sd => withCoupleId({
                        id: sd.id, name: sd.name, title: sd.name, date: sd.date,
                        emoji: sd.emoji, recurring: !!sd.recurring
                    }, 'dates', coupleId)) },
                    { table: 'moments', rows: (previousData.anniversaryMoments || []).map(m => withCoupleId({
                        id: m.id, title: m.title, description: m.description,
                        image_url: m.imageUrl || null, anniversary_date: m.anniversaryDate
                    }, 'moments', coupleId)) }
                ];

                for (const item of currentTables) {
                    const previousItem = previousTables.find(previous => previous.table === item.table);
                    const previousById = new Map((previousItem?.rows || []).map(row => [row.id, row]));
                    const currentById = new Map(item.rows.map(row => [row.id, row]));
                    const changedRows = item.rows.filter(row =>
                        JSON.stringify(row) !== JSON.stringify(previousById.get(row.id))
                    );
                    const removedIds = [...previousById.keys()].filter(id => !currentById.has(id));

                    if (changedRows.length) {
                        const { error } = await window.supabaseClient
                            .from(item.table)
                            .upsert(changedRows, { onConflict: 'id' });
                        if (error) throw new Error(`No se pudo guardar ${item.table}: ${error.message}`);
                    }

                    if (removedIds.length) {
                        const { error } = await window.supabaseClient
                            .from(item.table)
                            .delete()
                            .eq('couple_id', coupleId)
                            .in('id', removedIds);
                        if (error) throw new Error(`No se pudieron eliminar elementos de ${item.table}: ${error.message}`);
                    }
                }

                const settings = {
                    couple_id: coupleId,
                    couple_name_1: data.coupleName1 || '',
                    couple_name_2: data.coupleName2 || '',
                    start_date: data.startDate || '',
                    main_quote: data.mainQuote || '',
                    logo_path: data.logoPath || null,
                    timezone: data.timezone || 'UTC'
                };
                const previousSettings = {
                    couple_id: coupleId,
                    couple_name_1: previousData.coupleName1 || '',
                    couple_name_2: previousData.coupleName2 || '',
                    start_date: previousData.startDate || '',
                    main_quote: previousData.mainQuote || '',
                    logo_path: previousData.logoPath || null,
                    timezone: previousData.timezone || 'UTC'
                };
                if (JSON.stringify(settings) === JSON.stringify(previousSettings)) return;
                const { error } = await window.supabaseClient
                    .from('couple_settings')
                    .upsert(settings, { onConflict: 'couple_id' });
                if (error) throw new Error(`No se pudo guardar la configuración: ${error.message}`);
            });
            return syncQueue;
        };

        const loadSectionsFromSupabase = async (coupleId) => {
            if (!window.supabaseClient || !coupleId) {
                throw new Error('No hay una sesión válida o el cliente de Supabase no está disponible.');
            }

            const tableNames = [
                'memories', 'photos', 'letters', 'songs', 'dreams',
                'capsules', 'messages', 'dates', 'moments'
            ];
            const loaded = await Promise.all(tableNames.map(async table => {
                const { data, error } = await window.supabaseClient
                    .from(table)
                    .select('*')
                    .eq('couple_id', coupleId);
                if (error) throw new Error(`No se pudieron cargar ${table}: ${error.message}`);
                return [table, data || []];
            }));
            const records = Object.fromEntries(loaded);
            const settingsResult = await window.supabaseClient
                .from('couple_settings')
                .select('*')
                .eq('couple_id', coupleId)
                .limit(1);
            if (settingsResult.error) {
                throw new Error(`No se pudo cargar la configuración: ${settingsResult.error.message}`);
            }
            let activityQuery = window.supabaseClient
                .from('couple_activity')
                .select('id, event_type, details, created_at')
                .eq('couple_id', coupleId)
                .order('created_at', { ascending: false })
                .limit(100);
            const clearedAt = localStorage.getItem(`nuestro_universo_notifications_cleared_${coupleId}`);
            if (clearedAt && !Number.isNaN(Date.parse(clearedAt))) {
                activityQuery = activityQuery.gt('created_at', clearedAt);
            }
            const activityResult = await activityQuery;
            if (activityResult.error) {
                throw new Error(`No se pudo cargar el historial de notificaciones: ${activityResult.error.message}`);
            }

            const settings = settingsResult.data?.[0];
            const notifications = (activityResult.data || []).map(activity => ({
                id: activity.id,
                eventType: activity.event_type,
                daysBefore: activity.details?.days_before,
                sentDate: new Date(activity.created_at).toLocaleString(),
                message: getActivityMessage(activity)
            }));
            let logoUrl = '';
            if (settings?.logo_path) {
                const { data, error } = await window.supabaseClient.storage
                    .from('couple-logos')
                    .createSignedUrl(settings.logo_path, 604800);
                if (error) throw new Error(`No se pudo cargar el logo de la pareja: ${error.message}`);
                logoUrl = data.signedUrl;
            }

            const photos = await Promise.all(records.photos.map(async photo => {
                let imageUrl = photo.image_url || '';
                if (photo.storage_path) {
                    const { data, error } = await window.supabaseClient.storage
                        .from('couple-photos')
                        .createSignedUrl(photo.storage_path, 604800);
                    if (error) throw new Error(`No se pudo abrir una foto: ${error.message}`);
                    imageUrl = data.signedUrl;
                }
                return { ...photo, imageUrl, storagePath: photo.storage_path || null };
            }));
            const songs = await Promise.all(records.songs.map(async song => {
                let audioUrl = song.audio_url || null;
                if (song.storage_path) {
                    const { data, error } = await window.supabaseClient.storage
                        .from('couple-songs')
                        .createSignedUrl(song.storage_path, 604800);
                    if (error) throw new Error(`No se pudo abrir una canción: ${error.message}`);
                    audioUrl = data.signedUrl;
                }
                return { ...song, name: song.name || song.title, audioUrl, storagePath: song.storage_path || null };
            }));

            const defaults = getInitialData();
            return {
                ...defaults,
                memories: records.memories.map(m => ({ ...m, photos: Array.isArray(m.photos) ? m.photos : [] })),
                photos,
                letters: records.letters,
                songs,
                dreams: records.dreams.map(d => ({ ...d, text: d.text || d.title, completed: !!d.completed })),
                timeCapsules: records.capsules.map(c => ({
                    id: c.id,
                    title: c.title,
                    message: c.message || c.content,
                    revealDate: c.reveal_date || c.revealDate,
                    revealed: !!c.revealed
                })),
                dailyMessages: records.messages.map(m => ({ id: m.id, content: m.content })),
                notifications,
                specialDates: records.dates.map(date => ({
                    id: date.id,
                    name: date.name || date.title,
                    date: date.date,
                    emoji: date.emoji,
                    recurring: !!date.recurring
                })),
                anniversaryMoments: records.moments.map(moment => ({
                    id: moment.id,
                    title: moment.title,
                    description: moment.description,
                    anniversaryNumber: moment.anniversary_number,
                    anniversaryDate: moment.anniversary_date,
                    imageUrl: moment.image_url || ''
                })),
                coupleName1: settings?.couple_name_1 || '',
                coupleName2: settings?.couple_name_2 || '',
                startDate: settings?.start_date || '',
                mainQuote: settings?.main_quote || '',
                timezone: settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                logoPath: settings?.logo_path || null,
                logoUrl
            };
        };

        // ==================== HELPER FUNCTIONS ====================
        const getInitialData = () => {
            return {
                startDate: '',
                coupleName1: '',
                coupleName2: '',
                mainQuote: '',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                logoPath: null,
                logoUrl: '',
                memories: [],
                photos: [],
                letters: [],
                songs: [],
                dreams: [],
                timeCapsules: [],
                dailyMessages: [],
                specialDates: [],
                notifications: [],
                anniversaryMoments: []
            };
        };

        const formatDate = (dateStr) => {
            const d = new Date(dateStr + 'T00:00:00');
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre',
                'Octubre', 'Noviembre', 'Diciembre'
            ];
            return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
        };

        const getDaysBetween = (start, end) => {
            const s = new Date(start + 'T00:00:00');
            const e = end ? new Date(end + 'T00:00:00') : new Date();
            return Math.floor((e - s) / (1000 * 60 * 60 * 24));
        };

        const getNextAnniversary = (startDate) => {
            const start = new Date(startDate + 'T00:00:00');
            const now = new Date();
            const currentYear = now.getFullYear();
            let anniversary = new Date(currentYear, start.getMonth(), start.getDate());
            if (anniversary < now) {
                anniversary = new Date(currentYear + 1, start.getMonth(), start.getDate());
            }
            return anniversary;
        };

        const getCountdown = (targetDate) => {
            const now = new Date();
            const target = new Date(targetDate + 'T00:00:00');
            const diff = target - now;
            if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true };
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            return { days, hours, minutes, seconds, passed: false };
        };

        const generateId = () => crypto.randomUUID();

        const decodeVapidKey = value => {
            const padding = '='.repeat((4 - value.length % 4) % 4);
            const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
            return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
        };

        const enablePushNotifications = async () => {
            const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) throw new Error('Las notificaciones push todavía no están configuradas.');
            if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
                throw new Error('Este navegador no es compatible con notificaciones push.');
            }
            const permission = Notification.permission === 'default'
                ? await Notification.requestPermission()
                : Notification.permission;
            if (permission !== 'granted') throw new Error('Permite las notificaciones en la configuración del navegador.');

            const registration = await navigator.serviceWorker.register(
                new URL(`${import.meta.env.BASE_URL}sw.js`, window.location.href).href
            );
            const existing = await registration.pushManager.getSubscription();
            const subscription = existing || await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: decodeVapidKey(vapidPublicKey)
            });
            const { error } = await window.supabaseClient.functions.invoke('manage-push-subscription', {
                body: { action: 'subscribe', subscription: subscription.toJSON() }
            });
            if (error) {
                if (!existing) await subscription.unsubscribe();
                throw new Error(`No se pudo registrar este dispositivo: ${error.message}`);
            }
            return subscription;
        };

        const disablePushNotifications = async () => {
            if (!('serviceWorker' in navigator)) return;
            const registration = await navigator.serviceWorker.getRegistration(
                new URL(import.meta.env.BASE_URL, window.location.href).href
            );
            const subscription = await registration?.pushManager.getSubscription();
            if (!subscription) return;
            const { error } = await window.supabaseClient.functions.invoke('manage-push-subscription', {
                body: { action: 'unsubscribe', endpoint: subscription.endpoint }
            });
            if (error) throw new Error(`No se pudo desactivar este dispositivo: ${error.message}`);
            if (!await subscription.unsubscribe()) throw new Error('El navegador no pudo cancelar la suscripción push.');
        };

        // ==================== STARS BACKGROUND COMPONENT ====================
        const StarsBackground = () => {
            const stars = useMemo(() => {
                return Array.from({ length: 120 }, (_, i) => ({
                    id: i,
                    left: Math.random() * 100 + '%',
                    top: Math.random() * 100 + '%',
                    size: Math.random() * 2.5 + 0.8,
                    duration: Math.random() * 4 + 2,
                    delay: Math.random() * 4,
                }));
            }, []);
            return (
                <div className="star-bg">
                    {stars.map(s => (
                        <div key={s.id} className="star" style={{
                            left: s.left,
                            top: s.top,
                            width: s.size + 'px',
                            height: s.size + 'px',
                            '--duration': s.duration + 's',
                            '--delay': s.delay + 's',
                        }} />
                    ))}
                </div>
            );
        };

        // ==================== TOAST COMPONENT ====================
        const ToastContext = React.createContext(null);
        const ToastProvider = ({ children }) => {
            const [toasts, setToasts] = useState([]);
            const addToast = useCallback((message, type = 'info') => {
                const id = Date.now();
                setToasts(prev => [...prev, { id, message, type }]);
                setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
            }, []);
            return (
                <ToastContext.Provider value={addToast}>
                    {children}
                    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 200, display: 'flex',
                            flexDirection: 'column', gap: '0.5rem' }}>
                        {toasts.map(t => (
                            <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
                        ))}
                    </div>
                </ToastContext.Provider>
            );
        };
        const useToast = () => React.useContext(ToastContext);

        // ==================== LOGIN SCREEN ====================
        const LoginScreen = ({ supabaseAvailable, onSignupStart, onSignupFinish }) => {
            const [username, setUsername] = useState('');
            const [password, setPassword] = useState('');
            const [recoveryCode, setRecoveryCode] = useState('');
            const [recoveryInput, setRecoveryInput] = useState('');
            const [newPassword, setNewPassword] = useState('');
            const [signupSession, setSignupSession] = useState(null);
            const [mode, setMode] = useState('login');
            const [error, setError] = useState('');
            const [loading, setLoading] = useState(false);
            const [captchaToken, setCaptchaToken] = useState('');
            const captchaContainer = useRef(null);
            const captchaWidget = useRef(null);
            const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

            useEffect(() => {
                if (!['signup', 'login', 'forgot'].includes(mode) || !siteKey || !captchaContainer.current) return undefined;
                let active = true;
                const renderCaptcha = () => {
                    if (!active || !window.turnstile || captchaWidget.current !== null) return;
                    captchaWidget.current = window.turnstile.render(captchaContainer.current, {
                        sitekey: siteKey,
                        callback: token => {
                            setCaptchaToken(token);
                            setError('');
                        },
                        'expired-callback': () => {
                            setCaptchaToken('');
                            setError('La verificación venció. Complétala nuevamente.');
                        },
                        'error-callback': () => {
                            setCaptchaToken('');
                            setError('Turnstile no pudo cargar. Recarga la página o intenta desde otra red.');
                            return true;
                        }
                    });
                };
                const existingScript = document.querySelector('script[data-turnstile]');
                if (window.turnstile) {
                    renderCaptcha();
                } else if (existingScript) {
                    existingScript.addEventListener('load', renderCaptcha, { once: true });
                } else {
                    const script = document.createElement('script');
                    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                    script.async = true;
                    script.defer = true;
                    script.dataset.turnstile = 'true';
                    script.addEventListener('load', renderCaptcha, { once: true });
                    document.head.appendChild(script);
                }
                return () => {
                    active = false;
                    if (captchaWidget.current !== null && window.turnstile) {
                        window.turnstile.remove(captchaWidget.current);
                        captchaWidget.current = null;
                    }
                    setCaptchaToken('');
                };
            }, [mode, siteKey]);

            const handleSubmit = async (e) => {
                e.preventDefault();
                setLoading(true);
                setError('');
                let registeredSession = null;
                try {
                    if (!supabaseAvailable) {
                        throw new Error('No se pudo conectar con Supabase. Revisa la configuración del proyecto.');
                    }
                    if (['signup', 'login', 'forgot'].includes(mode) && import.meta.env.PROD && !siteKey) {
                        throw new Error('Falta configurar Turnstile para proteger el acceso y la recuperación.');
                    }
                    if (['signup', 'login', 'forgot'].includes(mode) && siteKey && !captchaToken) {
                        throw new Error('Completa la verificación de seguridad antes de continuar.');
                    }
                    if (mode === 'signup') {
                        const normalizedUsername = username.trim().toLowerCase();
                        if (!/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(normalizedUsername)) {
                            throw new Error('El usuario debe tener 3–30 caracteres: letras sin acentos, números, punto, guion o guion bajo.');
                        }
                        onSignupStart();
                        const { data: signupData, error: authError } = await window.supabaseClient.auth.signUp({
                            email: `${normalizedUsername}@accounts.nuestro-universo.invalid`,
                            password,
                            options: {
                                data: { username: normalizedUsername },
                                captchaToken: captchaToken || undefined
                            }
                        });
                        if (authError) {
                            onSignupFinish(null);
                            if (/confirmation email|sending confirmation email|email not confirmed/i.test(authError.message || '')) {
                                throw new Error('Supabase todavía exige enviar un correo de confirmación. En el proyecto abre Authentication → Providers → Email y desactiva “Confirm email”; después vuelve a intentar. Esta app no necesita enviar correos.');
                            }
                            throw authError;
                        }
                        if (!signupData.session) {
                            onSignupFinish(null);
                            setError('Supabase aún exige confirmación por correo. En Authentication → Providers, desactiva Confirm email para permitir el acceso solo con usuario y contraseña.');
                            return;
                        }
                        registeredSession = signupData.session;
                        setSignupSession(signupData.session);
                        const { data: recoveryResult, error: recoveryError } = await window.supabaseClient.functions
                            .invoke('issue-recovery-code');
                        if (recoveryError) {
                            console.error('No se pudo emitir el código de recuperación:', recoveryError);
                            setError('La cuenta se creó, pero no se pudo generar el código de recuperación. Al entrar, genéralo desde Configuración antes de continuar.');
                        } else {
                            setRecoveryCode(recoveryResult.recoveryCode);
                        }
                    } else {
                        if (mode === 'forgot') {
                            const { error: recoveryError } = await window.supabaseClient.functions.invoke(
                                'reset-password',
                                { body: {
                                    username: username.trim(),
                                    code: recoveryInput.trim(),
                                    newPassword,
                                    captchaToken
                                } }
                            );
                            if (recoveryError) {
                                console.error('No se pudo restablecer la contraseña:', recoveryError);
                                throw new Error('No se pudo restablecer la contraseña. Completa Turnstile nuevamente y verifica usuario y código; después de cinco intentos fallidos, espera 30 minutos.');
                            }
                            setMode('login');
                            setPassword('');
                            setRecoveryInput('');
                            setNewPassword('');
                            setError('Contraseña restablecida. Inicia sesión y genera un nuevo código de recuperación desde Configuración.');
                            return;
                        }
                        if (username.trim().includes('@')) {
                            const { error: authError } = await window.supabaseClient.auth.signInWithPassword({
                                email: username.trim(),
                                password,
                                options: { captchaToken: captchaToken || undefined }
                            });
                            if (authError) throw authError;
                        } else {
                            const { data: loginResult, error: loginError } = await window.supabaseClient.functions
                                .invoke('login-with-username', {
                                    body: {
                                        username: username.trim().toLowerCase(),
                                        password,
                                        captchaToken: captchaToken || undefined
                                    }
                                });
                            if (loginError || !loginResult?.access_token || !loginResult?.refresh_token) {
                                throw new Error('Usuario o contraseña incorrectos.');
                            }
                            const { error: sessionError } = await window.supabaseClient.auth.setSession({
                                access_token: loginResult.access_token,
                                refresh_token: loginResult.refresh_token
                            });
                            if (sessionError) throw sessionError;
                        }
                    }
                } catch (authError) {
                    if (mode === 'signup') onSignupFinish(registeredSession);
                    setError(authError.message || 'No se pudo completar el acceso.');
                    if (captchaWidget.current !== null && window.turnstile) {
                        window.turnstile.reset(captchaWidget.current);
                        setCaptchaToken('');
                    }
                } finally {
                    setLoading(false);
                }
            };

            if (signupSession) {
                return (
                    <div className="min-h-screen flex items-center justify-center relative z-10 px-4">
                        <StarsBackground />
                        <div className="glass-card p-8 max-w-lg w-full text-center">
                            <img src={appIconUrl} alt="Nuestro Universo" className="w-24 h-24 mx-auto mb-4 rounded-2xl object-cover" />
                            <h1 className="font-display text-2xl font-bold mb-4">Guarda tu código de recuperación</h1>
                            {recoveryCode ? (
                                <>
                                    <p className="text-gray-300 text-sm mb-4">Se muestra una sola vez y vence en 30 minutos. Si pierdes tu contraseña, este código te permitirá crear una nueva.</p>
                                    <code className="block bg-black/40 rounded-xl p-4 text-amber-200 text-lg break-all select-all">{recoveryCode}</code>
                                    <button className="btn-ghost mt-3" onClick={() => navigator.clipboard.writeText(recoveryCode)}>Copiar código</button>
                                </>
                            ) : (
                                <p className="text-amber-200 text-sm mb-4">{error || 'No se pudo generar el código. Entra y vuelve a intentarlo en Configuración.'}</p>
                            )}
                            <p className="text-gray-500 text-xs mt-4 mb-5">El servidor guarda únicamente una huella segura; no podremos volver a mostrar este código.</p>
                            <button className="btn-primary w-full" onClick={() => onSignupFinish(signupSession)}>
                                {recoveryCode ? 'Ya lo guardé, continuar' : 'Continuar a mi espacio'}
                            </button>
                        </div>
                    </div>
                );
            }

            return (
                <div className="min-h-screen flex items-center justify-center relative z-10 px-4">
                    <StarsBackground />
                    <div className="glass-card p-8 md:p-12 max-w-md w-full text-center animate-slideUp"
                        style={{ animationDelay: '0.2s' }}>
                        <img
                            src={appIconUrl}
                            alt="Nuestro Universo"
                            className="w-24 h-24 mx-auto mb-4 rounded-2xl object-cover"
                        />
                        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                            Nuestro Universo
                        </h1>
                        <p className="text-gray-400 mb-8 text-sm">
                            {mode === 'signup' ? 'Crea el espacio privado de su pareja' : mode === 'forgot' ? 'Restablece el acceso con tu código' : 'Un espacio privado para ustedes dos'}
                        </p>
                        <form onSubmit={handleSubmit}>
                            <input
                                type="text"
                                placeholder={mode === 'forgot' ? 'Usuario de la cuenta' : 'Usuario'}
                                value={username}
                                onChange={event => { setUsername(event.target.value); setError(''); }}
                                className="mb-4"
                                autoComplete="username"
                                required
                            />
                            {mode === 'forgot' ? (
                                <>
                                    <input type="text" placeholder="Código de recuperación" value={recoveryInput}
                                        onChange={event => setRecoveryInput(event.target.value)} className="mb-4"
                                        autoComplete="one-time-code" required />
                                    <input type="password" placeholder="Nueva contraseña (mínimo 12 caracteres)"
                                        value={newPassword} onChange={event => setNewPassword(event.target.value)}
                                        className="mb-4" autoComplete="new-password" minLength="12" required />
                                </>
                            ) : (
                                <input
                                    type="password"
                                    placeholder="Contraseña (mínimo 8 caracteres)"
                                    value={password}
                                    onChange={event => { setPassword(event.target.value); setError(''); }}
                                    className="mb-4"
                                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                    minLength="8"
                                    required
                                />
                            )}
                            {mode === 'signup' && (
                                <p className="text-gray-500 text-xs mb-4">
                                    Usuario único, de 3 a 30 caracteres. No se requiere correo.
                                </p>
                            )}
                            {['signup', 'login', 'forgot'].includes(mode) && siteKey && <div ref={captchaContainer} className="flex justify-center mb-4" />}
                            {['signup', 'login', 'forgot'].includes(mode) && import.meta.env.PROD && !siteKey && (
                                <p className="text-red-300 text-xs mb-4">El acceso y la recuperación requieren configurar Turnstile.</p>
                            )}
                            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                            <button type="submit" className="btn-primary w-full" disabled={loading}>
                                {loading ? 'Procesando...' : mode === 'signup' ? 'Crear cuenta de pareja' : 'Iniciar sesión'}
                            </button>
                        </form>
                        <button
                            type="button"
                            onClick={() => {
                                const nextMode = mode === 'login' ? 'signup' : 'login';
                                setMode(nextMode);
                                setError('');
                                setRecoveryCode('');
                            }}
                            className="text-cyan-300 text-sm mt-5 hover:text-white"
                        >
                            {mode === 'signup' ? '¿Ya tienen cuenta? Iniciar sesión' : mode === 'forgot' ? 'Volver a iniciar sesión' : 'Crear una cuenta nueva'}
                        </button>
                        {mode === 'login' && (
                            <button type="button" className="block mx-auto text-gray-400 text-xs mt-3 hover:text-white"
                                onClick={() => { setMode('forgot'); setError(''); }}>
                                Olvidé mi contraseña
                            </button>
                        )}
                        <p className="text-gray-500 text-xs mt-5">
                            Ambos pueden usar el mismo usuario y contraseña para compartir su espacio.
                        </p>
                        {mode === 'login' && (
                            <p className="text-gray-500 text-xs mt-2">
                                Si tu cuenta es anterior, también puedes iniciar sesión con su correo.
                            </p>
                        )}
                    </div>
                </div>
            );
        };

        // ==================== MAIN APP ====================
        const App = () => {
            const [session, setSession] = useState(null);
            const [coupleId, setCoupleId] = useState(null);
            const [accountUsername, setAccountUsername] = useState('');
            const [activeMemberName, setActiveMemberName] = useState('');
            const [dataUserId, setDataUserId] = useState(null);
            const [data, setData] = useState(getInitialData);
            const dataRef = useRef(data);
            dataRef.current = data;
            const syncedDataRef = useRef(null);
            const [currentSection, setCurrentSection] = useState('home');
            const [guideTourOpen, setGuideTourOpen] = useState(false);
            const [guideTourStep, setGuideTourStep] = useState(0);
            const guideTourStartedForRef = useRef(null);
            const [modalContent, setModalContent] = useState(null);
            const [pushEnabled, setPushEnabled] = useState(false);
            const [accountLoading, setAccountLoading] = useState(true);
            const [dataReady, setDataReady] = useState(false);
            const [appError, setAppError] = useState('');
            const [syncError, setSyncError] = useState('');
            const authTransitionRef = useRef(false);
            const queuedAuthSessionRef = useRef(null);
            const addToast = useToast();
            const handleSignOut = async () => {
                const { error } = await window.supabaseClient.auth.signOut();
                if (error) setSyncError(`No se pudo cerrar sesión: ${error.message}`);
            };

            useEffect(() => {
                if (!window.supabaseClient) {
                    setAccountLoading(false);
                    return undefined;
                }
                const { data: { subscription } } = window.supabaseClient.auth.onAuthStateChange(
                    (_event, currentSession) => {
                        if (authTransitionRef.current) {
                            queuedAuthSessionRef.current = currentSession;
                        } else {
                            setSession(currentSession);
                        }
                    }
                );
                window.supabaseClient.auth.getSession().then(({ data, error }) => {
                    if (error) {
                        setAppError(`No se pudo validar la sesión: ${error.message}`);
                    } else {
                        setSession(data.session);
                    }
                    setAccountLoading(false);
                }).catch(error => {
                    setAppError(`No se pudo validar la sesión: ${error.message}`);
                    setAccountLoading(false);
                });
                return () => subscription.unsubscribe();
            }, []);

            useEffect(() => {
                let active = true;
                if (!session?.user?.id) {
                    setCoupleId(null);
                    setAccountUsername('');
                    setActiveMemberName('');
                    setGuideTourOpen(false);
                    guideTourStartedForRef.current = null;
                    localStorage.removeItem('nuestro_universo_active_couple_id');
                    setDataUserId(null);
                    setData(getInitialData());
                    syncedDataRef.current = null;
                    setDataReady(false);
                    setSyncError('');
                    setAccountLoading(false);
                    return () => { active = false; };
                }

                setAccountLoading(true);
                setAppError('');
                setCoupleId(null);
                setAccountUsername('');
                setDataUserId(null);
                setDataReady(false);
                const prepareAccount = async () => {
                    try {
                        const currentCoupleId = await createCoupleForCurrentUser();
                        const remoteData = await loadSectionsFromSupabase(currentCoupleId);
                        const { data: usernameRecord, error: usernameError } = await window.supabaseClient
                            .from('couple_usernames')
                            .select('username')
                            .eq('user_id', session.user.id)
                            .maybeSingle();
                        if (usernameError) {
                            throw new Error(`No se pudo cargar el usuario de la cuenta: ${usernameError.message}`);
                        }
                        if (!active) return;
                        const activeMemberStorageKey = `nuestro_universo_active_member_${currentCoupleId}`;
                        const savedMemberName = localStorage.getItem(activeMemberStorageKey) || '';
                        const coupleNames = [remoteData.coupleName1, remoteData.coupleName2]
                            .map(name => name.trim())
                            .filter(Boolean);
                        setActiveMemberName(coupleNames.includes(savedMemberName) ? savedMemberName : '');
                        localStorage.setItem('nuestro_universo_active_couple_id', currentCoupleId);
                        setData(remoteData);
                        setCoupleId(currentCoupleId);
                        setAccountUsername(usernameRecord?.username || '');
                        setDataUserId(session.user.id);
                        setDataReady(true);
                    } catch (error) {
                        if (active) setAppError(error.message || 'No se pudieron cargar los datos de la pareja.');
                    } finally {
                        if (active) setAccountLoading(false);
                    }
                };
                prepareAccount();
                return () => { active = false; };
            }, [session?.user?.id]);

            useEffect(() => {
                if (!dataReady || !coupleId || dataUserId !== session?.user?.id
                    || guideTourStartedForRef.current === coupleId) return;
                guideTourStartedForRef.current = coupleId;
                const tourKey = `nuestro_universo_guide_completed_${coupleId}`;
                try {
                    if (localStorage.getItem(tourKey) === 'true') return;
                } catch (error) {
                    console.error('No se pudo consultar si ya se mostró la guía:', error);
                    addToast('No se pudo guardar el avance de la guía en este navegador.', 'error');
                }
                setGuideTourStep(0);
                setGuideTourOpen(true);
            }, [dataReady, coupleId, dataUserId, session?.user?.id, addToast]);

            useEffect(() => {
                if (guideTourOpen) {
                    setCurrentSection(GUIDE_TOUR_STEPS[guideTourStep].section);
                }
            }, [guideTourOpen, guideTourStep]);

            const closeGuideTour = () => {
                setGuideTourOpen(false);
                if (!coupleId) return;
                try {
                    localStorage.setItem(`nuestro_universo_guide_completed_${coupleId}`, 'true');
                } catch (error) {
                    console.error('No se pudo guardar que la guía ya se mostró:', error);
                    addToast('No se pudo guardar el avance de la guía; podría volver a mostrarse al entrar.', 'error');
                }
            };

            const handleActiveMemberChange = memberName => {
                const normalizedName = memberName.trim();
                const coupleNames = [data.coupleName1, data.coupleName2]
                    .map(name => name.trim())
                    .filter(Boolean);
                if (!coupleId || !coupleNames.includes(normalizedName)) {
                    setSyncError('Elige uno de los nombres configurados para la pareja.');
                    return;
                }
                localStorage.setItem(`nuestro_universo_active_member_${coupleId}`, normalizedName);
                localStorage.setItem('nuestro_universo_active_couple_id', coupleId);
                setActiveMemberName(normalizedName);
                setSyncError('');
                addToast(`Los avisos de este dispositivo aparecerán como ${normalizedName}.`, 'success');
            };

            useEffect(() => {
                if (!dataReady || !coupleId || dataUserId !== session?.user?.id || !window.supabaseClient) return;
                const previousData = syncedDataRef.current;
                syncedDataRef.current = data;
                if (!previousData) return;
                syncSectionsToSupabase(data, previousData, coupleId)
                    .then(() => setSyncError(''))
                    .catch(error => {
                        console.error('[Supabase] Error al guardar los datos:', error);
                        setSyncError(error.message || 'No se pudieron guardar los cambios.');
                    });
            }, [data, coupleId, dataReady, dataUserId, session?.user?.id]);

            useEffect(() => {
                if (!dataReady || !coupleId || !window.supabaseClient) return undefined;
                const channel = window.supabaseClient.channel(`couple-data-${coupleId}`);
                ['memories', 'photos', 'letters', 'songs', 'dreams', 'capsules', 'messages', 'dates', 'moments', 'couple_settings', 'couple_activity']
                    .forEach(table => {
                        channel.on('postgres_changes', {
                            event: '*',
                            schema: 'public',
                            table,
                            filter: `couple_id=eq.${coupleId}`
                        }, payload => {
                            if (table === 'couple_activity' && payload.eventType === 'INSERT'
                                && payload.new?.id && 'Notification' in window
                                && Notification.permission === 'granted') {
                                const notification = {
                                    body: getActivityMessage(payload.new),
                                    icon: appIconUrl,
                                    tag: `activity:${payload.new.id}`,
                                    renotify: true,
                                    vibrate: [200, 100, 200]
                                };
                                const serviceWorkerScope = new URL(import.meta.env.BASE_URL, window.location.href).href;
                                navigator.serviceWorker.getRegistration(serviceWorkerScope)
                                    .then(registration => registration
                                        ? registration.showNotification('Nuestro Universo', notification)
                                        : new Notification('Nuestro Universo', notification))
                                    .catch(error => {
                                        console.error('[Notifications] No se pudo mostrar el aviso:', error);
                                    });
                            }
                            loadSectionsFromSupabase(coupleId)
                                .then(setData)
                                .catch(error => {
                                    console.error('[Supabase] No se pudo actualizar en tiempo real:', error);
                                    setSyncError(`No se pudo actualizar desde el otro dispositivo: ${error.message}`);
                                });
                        });
                    });
                channel.subscribe(status => {
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        setSyncError('Se perdió la conexión en tiempo real. Recarga la página para ver los cambios más recientes.');
                    }
                });
                return () => { window.supabaseClient.removeChannel(channel); };
            }, [dataReady, coupleId]);

            useEffect(() => {
                if (!dataReady || !coupleId || !window.supabaseClient) return undefined;
                let active = true;
                let timer;
                const scheduleRenewal = delay => {
                    timer = window.setTimeout(async () => {
                        try {
                            const source = dataRef.current;
                            const [logoResult, photoResults, songResults] = await Promise.all([
                                source.logoPath
                                    ? window.supabaseClient.storage.from('couple-logos').createSignedUrl(source.logoPath, 604800)
                                    : Promise.resolve({ data: null, error: null }),
                                Promise.all(source.photos.filter(photo => photo.storagePath).map(async photo => ({
                                    id: photo.id,
                                    storagePath: photo.storagePath,
                                    result: await window.supabaseClient.storage.from('couple-photos')
                                        .createSignedUrl(photo.storagePath, 604800)
                                }))),
                                Promise.all(source.songs.filter(song => song.storagePath).map(async song => ({
                                    id: song.id,
                                    storagePath: song.storagePath,
                                    result: await window.supabaseClient.storage.from('couple-songs')
                                        .createSignedUrl(song.storagePath, 604800)
                                })))
                            ]);
                            if (logoResult.error) throw new Error(`Logo: ${logoResult.error.message}`);
                            const failedPhoto = photoResults.find(item => item.result.error);
                            if (failedPhoto) throw new Error(`Foto: ${failedPhoto.result.error.message}`);
                            const failedSong = songResults.find(item => item.result.error);
                            if (failedSong) throw new Error(`Canción: ${failedSong.result.error.message}`);
                            if (!active) return;

                            const photoUrls = new Map(photoResults.map(item => [item.id, {
                                storagePath: item.storagePath,
                                url: item.result.data.signedUrl
                            }]));
                            const songUrls = new Map(songResults.map(item => [item.id, {
                                storagePath: item.storagePath,
                                url: item.result.data.signedUrl
                            }]));
                            setData(current => ({
                                ...current,
                                logoUrl: current.logoPath === source.logoPath
                                    ? logoResult.data?.signedUrl || ''
                                    : current.logoUrl,
                                photos: current.photos.map(photo => {
                                    const fresh = photoUrls.get(photo.id);
                                    return fresh && fresh.storagePath === photo.storagePath
                                        ? { ...photo, imageUrl: fresh.url }
                                        : photo;
                                }),
                                songs: current.songs.map(song => {
                                    const fresh = songUrls.get(song.id);
                                    return fresh && fresh.storagePath === song.storagePath
                                        ? { ...song, audioUrl: fresh.url }
                                        : song;
                                })
                            }));
                            scheduleRenewal(5 * 24 * 60 * 60 * 1000);
                        } catch (error) {
                            console.error('[Storage] No se pudieron renovar las URLs privadas:', error);
                            setSyncError(`No se pudieron renovar las imágenes o canciones privadas: ${error.message}`);
                            if (active) scheduleRenewal(30 * 60 * 1000);
                        }
                    }, delay);
                };
                scheduleRenewal(5 * 24 * 60 * 60 * 1000);
                return () => {
                    active = false;
                    window.clearTimeout(timer);
                };
            }, [dataReady, coupleId]);

            useEffect(() => {
                if (!coupleId || !('serviceWorker' in navigator)) {
                    setPushEnabled(false);
                    return undefined;
                }
                let active = true;
                navigator.serviceWorker.getRegistration(new URL(import.meta.env.BASE_URL, window.location.href).href)
                    .then(registration => registration?.pushManager.getSubscription())
                    .then(subscription => {
                        if (active) setPushEnabled(Boolean(subscription));
                    })
                    .catch(error => {
                        console.error('[Push] No se pudo consultar la suscripción:', error);
                    });
                return () => { active = false; };
            }, [coupleId]);

            const finishSignup = signupSession => {
                authTransitionRef.current = false;
                setSession(signupSession || queuedAuthSessionRef.current);
                queuedAuthSessionRef.current = null;
            };

            if (!window.supabaseClient) {
                return <LoginScreen supabaseAvailable={false} />;
            }
            if (accountLoading) {
                return <div className="min-h-screen flex items-center justify-center text-cyan-200">Preparando su espacio privado...</div>;
            }
            if (!session) {
                return (
                    <LoginScreen
                        supabaseAvailable
                        onSignupStart={() => {
                            authTransitionRef.current = true;
                            queuedAuthSessionRef.current = null;
                        }}
                        onSignupFinish={finishSignup}
                    />
                );
            }
            if (dataUserId !== session.user.id) {
                return <div className="min-h-screen flex items-center justify-center text-cyan-200">Preparando su espacio privado...</div>;
            }
            if (appError) {
                return (
                    <div className="min-h-screen flex items-center justify-center px-4">
                        <div className="glass-card p-8 max-w-lg text-center">
                            <h1 className="font-display text-2xl font-bold mb-3">No se pudo abrir su espacio</h1>
                            <p className="text-red-300 mb-6">{appError}</p>
                            <button className="btn-primary" onClick={handleSignOut}>
                                Cerrar sesión
                            </button>
                        </div>
                    </div>
                );
            }

            return (
                <div className="min-h-screen relative">
                    <StarsBackground />
                    <div className="relative z-10">
                            <Navigation
                                currentSection={currentSection}
                                onNavigate={setCurrentSection}
                                data={data}
                                username={accountUsername}
                                email={session.user.email}
                                onSignOut={handleSignOut}
                            />
                            {syncError && (
                                <div className="max-w-6xl mx-auto mt-20 px-4 text-sm text-red-300" role="alert">
                                    {syncError}
                                </div>
                            )}
                            <main className="pt-16 pb-8 px-4 md:px-6 max-w-6xl mx-auto">
                                {currentSection === 'home' && <HomeSection data={data} setData={setData}
                                    onNavigate={setCurrentSection} />}
                                {currentSection === 'memories' && <MemoriesSection data={data} setData={setData}
                                    setModal={setModalContent} />}
                                {currentSection === 'photos' && <PhotosSection data={data} setData={setData}
                                    coupleId={coupleId}
                                    setModal={setModalContent} />}
                                {currentSection === 'letters' && <LettersSection data={data} setData={setData}
                                    setModal={setModalContent} />}
                                {currentSection === 'songs' && <SongsSection data={data} setData={setData}
                                    coupleId={coupleId}
                                    setModal={setModalContent} />}
                                {currentSection === 'dreams' && <DreamsSection data={data} setData={setData} />}
                                {currentSection === 'timecapsule' && <TimeCapsuleSection data={data} setData={setData}
                                    setModal={setModalContent} />}
                                {currentSection === 'dailymessage' && <DailyMessageSection data={data}
                                    setData={setData} />}
                                {currentSection === 'settings' && <SettingsSection data={data} setData={setData}
                                    coupleId={coupleId} username={accountUsername}
                                    activeMemberName={activeMemberName}
                                    onActiveMemberChange={handleActiveMemberChange}
                                    onUsernameChange={async newUsername => {
                                        const { data: savedUsername, error } = await window.supabaseClient
                                            .rpc('set_couple_username', { requested_username: newUsername.trim().toLowerCase() });
                                        if (error) throw new Error(error.message);
                                        setAccountUsername(savedUsername);
                                    }}
                                    setModal={setModalContent} />}
                                {currentSection === 'anniversaries' && <AnniversarySection data={data}
                                    setData={setData} />}
                                {currentSection === 'notifications' && <NotificationsSection data={data}
                                    setData={setData} coupleId={coupleId} pushEnabled={pushEnabled}
                                    onEnablePush={async () => {
                                        const subscription = await enablePushNotifications();
                                        setPushEnabled(Boolean(subscription));
                                    }}
                                    onDisablePush={async () => {
                                        await disablePushNotifications();
                                        setPushEnabled(false);
                                    }} />}
                                {currentSection === 'guide' && <GuideSection onNavigate={setCurrentSection}
                                    onStartTour={() => {
                                        setGuideTourStep(0);
                                        setGuideTourOpen(true);
                                    }} />}
                            </main>
                    </div>
                    {modalContent && <Modal content={modalContent} onClose={() => setModalContent(null)}
                        data={data} setData={setData} />}
                    {guideTourOpen && <GuideTour stepIndex={guideTourStep}
                        onPrevious={() => setGuideTourStep(index => Math.max(0, index - 1))}
                        onNext={() => {
                            if (guideTourStep === GUIDE_TOUR_STEPS.length - 1) closeGuideTour();
                            else setGuideTourStep(index => index + 1);
                        }}
                        onClose={closeGuideTour} />}
                </div>
            );
        };

        // ==================== NAVIGATION ====================
        const Navigation = ({ currentSection, onNavigate, data, username, email, onSignOut }) => {
            const [mobileOpen, setMobileOpen] = useState(false);
            const activeStartDate = data.startDate || new Date().toISOString().split('T')[0];
            const daysTogether = getDaysBetween(activeStartDate);
            const sections = [
                { id: 'home', icon: '🏠', label: 'Inicio' },
                { id: 'memories', icon: '⭐', label: 'Recuerdos' },
                { id: 'photos', icon: '📸', label: 'Fotos' },
                { id: 'letters', icon: '💌', label: 'Cartas' },
                { id: 'songs', icon: '🎵', label: 'Música' },
                { id: 'dreams', icon: '🌙', label: 'Sueños' },
                { id: 'timecapsule', icon: '📦', label: 'Cápsula' },
                { id: 'dailymessage', icon: '💭', label: 'Mensaje' },
                { id: 'anniversaries', icon: '🎊', label: 'Momentos' },
                { id: 'notifications', icon: '🔔', label: 'Avisos' },
                { id: 'settings', icon: '⚙️', label: 'Configuración' },
                { id: 'guide', icon: '📖', label: 'Guía' },
            ];
            return (
                <nav className="fixed top-0 left-0 right-0 z-50 glass-card rounded-none border-t-0 border-x-0"
                    style={{ background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(20px)' }}>
                    <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-2.5">
                        <button onClick={() => onNavigate('home')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            {data.logoUrl
                                ? <img src={data.logoUrl} alt="Logo de la pareja" className="w-9 h-9 rounded-lg object-cover" />
                                : <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500/30 to-cyan-400/20 text-xl" aria-label="Logo">✨</span>}
                            <span className="font-display font-semibold text-sm md:text-base hidden sm:inline bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                                Nuestro Universo
                            </span>
                        </button>
                        <div className="hidden md:flex items-center gap-1 flex-wrap justify-center">
                            {sections.map(s => (
                                <button key={s.id} data-guide-target={`nav-${s.id}`}
                                    onClick={() => onNavigate(s.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                                        currentSection === s.id
                                            ? 'bg-gradient-to-r from-blue-500/40 to-cyan-500/40 text-white border border-cyan-400/40'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}>
                                    {s.icon} <span className="ml-1">{s.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 hidden lg:inline">{username || (email && !email.endsWith('@accounts.nuestro-universo.invalid') ? email : '')}</span>
                            <span className="text-xs text-gray-400 hidden sm:inline">💕 {daysTogether} días</span>
                            <button onClick={onSignOut} className="text-xs text-gray-400 hover:text-white" title="Cerrar sesión">
                                Salir
                            </button>
                            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-2xl p-1">
                                {mobileOpen ? '✕' : '☰'}
                            </button>
                        </div>
                    </div>
                    {mobileOpen && (
                        <div className="md:hidden px-4 pb-3 flex flex-wrap gap-1.5">
                            {sections.map(s => (
                                <button key={s.id} data-guide-target={`nav-${s.id}`}
                                    onClick={() => { onNavigate(s.id);
                                        setMobileOpen(false); }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                        currentSection === s.id
                                            ? 'bg-gradient-to-r from-blue-500/40 to-cyan-500/40 text-white'
                                            : 'text-gray-400 hover:text-white bg-white/5'
                                    }`}>
                                    {s.icon} {s.label}
                                </button>
                            ))}
                        </div>
                    )}
                </nav>
            );
        };

        // ==================== USER GUIDE ====================
        const GUIDE_TOUR_STEPS = [
            {
                section: 'home',
                target: 'tour-home',
                icon: '✨',
                title: 'Bienvenidos a su espacio',
                description: 'Este es el inicio de su universo. Aquí verán sus nombres, los días juntos, el próximo aniversario y el mensaje del día. El recorrido no cambia ni borra sus datos.'
            },
            {
                section: 'memories',
                target: 'tour-memories',
                icon: '⭐',
                title: 'Guarden sus recuerdos',
                description: 'Cada recuerdo puede tener un emoji, un título, una fecha y su historia. Si ven contenido de ejemplo, pueden abrirlo para editarlo o usar la papelera para eliminarlo.'
            },
            {
                section: 'photos',
                target: 'tour-photos',
                icon: '📸',
                title: 'Construyan su galería',
                description: 'Suban una foto desde el dispositivo o peguen un enlace. Añadan título, fecha y descripción para volver a encontrar cada momento.'
            },
            {
                section: 'letters',
                target: 'tour-letters',
                icon: '💌',
                title: 'Escriban cartas',
                description: 'Clasifiquen sus cartas por ocasión, ábranlas para leerlas y eliminen las que ya no quieran conservar.'
            },
            {
                section: 'songs',
                target: 'tour-songs',
                icon: '🎵',
                title: 'Compartan su música',
                description: 'Añadan canciones con artista y motivo, y opcionalmente enlaces de Spotify o YouTube o un archivo de audio.'
            },
            {
                section: 'dreams',
                target: 'tour-dreams',
                icon: '🌙',
                title: 'Planeen sueños juntos',
                description: 'Escriban metas compartidas. Cuando las cumplan, márquenlas como realizadas; también pueden devolverlas a pendientes.'
            },
            {
                section: 'timecapsule',
                target: 'tour-timecapsule',
                icon: '📦',
                title: 'Escriban al futuro',
                description: 'Creen una cápsula con mensaje y fecha de revelación. El mensaje queda oculto hasta la fecha elegida.'
            },
            {
                section: 'dailymessage',
                target: 'tour-dailymessage',
                icon: '💭',
                title: 'Elijan el mensaje del día',
                description: 'Añadan frases personales; la portada escogerá una al azar cada vez que la visiten.'
            },
            {
                section: 'anniversaries',
                target: 'tour-anniversaries',
                icon: '🎊',
                title: 'Conserven cada aniversario',
                description: 'La galería se calcula usando la fecha de inicio. En cada aniversario pueden guardar un momento destacado y notas.'
            },
            {
                section: 'notifications',
                target: 'tour-notifications',
                icon: '🔔',
                title: 'Configuren sus avisos',
                description: 'Activen Push en cada dispositivo si desean recibir avisos fuera de la app. El navegador debe admitirlos y tener el permiso concedido.'
            },
            {
                section: 'settings',
                target: 'tour-settings',
                icon: '⚙️',
                title: 'Personalicen la cuenta',
                description: 'Reemplacen los nombres, la fecha, la frase y la zona horaria por sus datos reales. Elijan quién usa este navegador para atribuir los cambios. También pueden administrar fechas, usuario y código de recuperación.'
            },
            {
                section: 'settings',
                target: 'tour-settings',
                icon: '📖',
                title: '¡Listos para empezar!',
                description: 'El recorrido no modificó ningún dato. Vuelvan a iniciarlo cuando quieran desde Guía; en Configuración pueden editar o borrar los elementos de ejemplo y agregar los suyos.'
            }
        ];

        const GuideTour = ({ stepIndex, onPrevious, onNext, onClose }) => {
            const [targetRect, setTargetRect] = useState(null);
            const step = GUIDE_TOUR_STEPS[stepIndex];

            useEffect(() => {
                let observer;
                let animationFrame;
                let scrollTimer;
                let attempts = 0;
                let target;
                const updatePosition = () => {
                    if (!target) return;
                    const rect = target.getBoundingClientRect();
                    if (rect.width && rect.height) {
                        setTargetRect({
                            top: Math.max(8, rect.top - 8),
                            left: Math.max(8, rect.left - 8),
                            right: Math.min(window.innerWidth - 8, rect.right + 8),
                            bottom: Math.min(window.innerHeight - 8, rect.bottom + 8)
                        });
                    }
                };
                const locateTarget = () => {
                    target = document.querySelector(`[data-guide-target="${step.target}"]`)
                        || document.querySelector(`[data-guide-target="nav-${step.section}"]`);
                    if (!target && attempts < 12) {
                        attempts += 1;
                        animationFrame = requestAnimationFrame(locateTarget);
                        return;
                    }
                    if (!target) {
                        setTargetRect(null);
                        return;
                    }
                    const rect = target.getBoundingClientRect();
                    if (rect.top < 72 || rect.bottom > window.innerHeight - 210) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    updatePosition();
                    scrollTimer = window.setTimeout(updatePosition, 350);
                    observer = new ResizeObserver(updatePosition);
                    observer.observe(target);
                    window.addEventListener('scroll', updatePosition, true);
                    window.addEventListener('resize', updatePosition);
                };
                setTargetRect(null);
                animationFrame = requestAnimationFrame(locateTarget);
                return () => {
                    cancelAnimationFrame(animationFrame);
                    window.clearTimeout(scrollTimer);
                    observer?.disconnect();
                    window.removeEventListener('scroll', updatePosition, true);
                    window.removeEventListener('resize', updatePosition);
                };
            }, [step.target, step.section]);

            useEffect(() => {
                const handleKeyDown = event => {
                    if (event.key === 'Escape') onClose();
                    if (event.key === 'ArrowRight') onNext();
                    if (event.key === 'ArrowLeft' && stepIndex > 0) onPrevious();
                };
                window.addEventListener('keydown', handleKeyDown);
                return () => window.removeEventListener('keydown', handleKeyDown);
            }, [onClose, onNext, onPrevious, stepIndex]);

            const maskStyles = targetRect ? [
                { top: 0, left: 0, right: 0, height: targetRect.top },
                { top: targetRect.top, left: 0, width: targetRect.left, height: targetRect.bottom - targetRect.top },
                { top: targetRect.top, left: targetRect.right, right: 0, height: targetRect.bottom - targetRect.top },
                { top: targetRect.bottom, left: 0, right: 0, bottom: 0 }
            ] : [{ inset: 0 }];

            return (
                <div className="guide-tour" role="presentation">
                    {maskStyles.map((style, index) => (
                        <div key={index} className="guide-tour-mask" style={style} />
                    ))}
                    {targetRect && (
                        <div className="guide-tour-spotlight" style={{
                            top: targetRect.top,
                            left: targetRect.left,
                            width: targetRect.right - targetRect.left,
                            height: targetRect.bottom - targetRect.top
                        }} />
                    )}
                    <section className="guide-tour-card" role="dialog" aria-modal="true"
                        aria-labelledby="guide-tour-title" aria-describedby="guide-tour-description">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs text-cyan-300 mb-1">
                                    Recorrido interactivo · {stepIndex + 1} de {GUIDE_TOUR_STEPS.length}
                                </p>
                                <h2 id="guide-tour-title" className="font-display text-xl md:text-2xl font-bold">
                                    {step.icon} {step.title}
                                </h2>
                            </div>
                            <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar recorrido">
                                ✕
                            </button>
                        </div>
                        <p id="guide-tour-description" className="text-sm text-gray-300 leading-relaxed mt-3">
                            {step.description}
                        </p>
                        <div className="flex items-center justify-between gap-3 mt-5">
                            <button className="text-xs text-gray-400 hover:text-white" onClick={onClose}>
                                Omitir recorrido
                            </button>
                            <div className="flex gap-2">
                                <button className="btn-ghost btn-sm" onClick={onPrevious} disabled={stepIndex === 0}>
                                    Atrás
                                </button>
                                <button className="btn-primary btn-sm" onClick={onNext}>
                                    {stepIndex === GUIDE_TOUR_STEPS.length - 1 ? 'Terminar' : 'Siguiente'}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            );
        };

        const GuideSection = ({ onNavigate, onStartTour }) => {
            const topics = [
                {
                    id: 'home',
                    icon: '🏠',
                    title: 'Inicio',
                    description: 'Es la portada de su espacio: muestra sus nombres y logo, la frase principal, los días juntos, la cuenta regresiva al próximo aniversario y un mensaje del día. Usa las tarjetas para entrar rápidamente a Recuerdos, Cartas, Fotos, Música, Sueños y Cápsulas.'
                },
                {
                    id: 'memories',
                    icon: '⭐',
                    title: 'Recuerdos',
                    description: 'Guarden momentos importantes con un emoji, título, fecha e historia. Pulsa “Nueva Estrella” para crear uno; selecciona una tarjeta para editarla y usa la papelera para borrarla.'
                },
                {
                    id: 'photos',
                    icon: '📸',
                    title: 'Fotos',
                    description: 'Añadan fotos con título y, si quieren, fecha y descripción. Pueden elegir una imagen del dispositivo o pegar un enlace. Cada tarjeta tiene una opción para eliminarla.'
                },
                {
                    id: 'letters',
                    icon: '💌',
                    title: 'Cartas',
                    description: 'Escriban cartas con título y contenido, y guárdenlas en categorías como “Cuando me extrañes”, “Cuando estés triste”, “Cuando estés feliz” o “General/Dedicatorias”. Elijan una categoría para filtrar, pulsen una carta para leerla y ábranla para poder eliminarla.'
                },
                {
                    id: 'songs',
                    icon: '🎵',
                    title: 'Música',
                    description: 'Creen una playlist de canciones especiales con nombre, artista y el motivo por el que la eligieron. De forma opcional, agreguen enlaces de Spotify o YouTube, o suban un archivo de audio para reproducirlo desde la tarjeta.'
                },
                {
                    id: 'dreams',
                    icon: '🌙',
                    title: 'Sueños',
                    description: 'Anoten planes y metas compartidas. Marquen un sueño como cumplido cuando lo logren; pueden devolverlo a pendientes o eliminarlo.'
                },
                {
                    id: 'timecapsule',
                    icon: '📦',
                    title: 'Cápsula del tiempo',
                    description: 'Escriban un título y mensaje, y elijan una fecha de revelación. La cápsula queda sellada hasta esa fecha y después se muestra su mensaje. Una cápsula también se puede eliminar.'
                },
                {
                    id: 'dailymessage',
                    icon: '💭',
                    title: 'Mensajes del día',
                    description: 'Añadan frases cortas a su colección. Al visitar Inicio, la app elige una al azar para mostrarla; pueden quitar frases que ya no quieran conservar.'
                },
                {
                    id: 'anniversaries',
                    icon: '🎊',
                    title: 'Momentos',
                    description: 'Consulta los aniversarios calculados a partir de la fecha de inicio. En cada aniversario, guarda un momento destacado y notas; puedes volver a editar ese recuerdo más adelante.'
                },
                {
                    id: 'notifications',
                    icon: '🔔',
                    title: 'Avisos',
                    description: 'Consulta los avisos disponibles y activa o desactiva las notificaciones push para este dispositivo. Para recibirlas fuera de la app, el navegador debe admitirlas, estar en HTTPS y tener el permiso concedido. “Limpiar todo” limpia la lista local de avisos de este dispositivo.'
                },
                {
                    id: 'settings',
                    icon: '⚙️',
                    title: 'Configuración y fechas',
                    description: 'Personaliza los nombres, la fecha de inicio de la relación, la frase principal, la zona horaria de recordatorios y el logo (imagen de hasta 5 MB). Elige quién usa la app en este navegador para identificar a la persona en las notificaciones. Aquí también puedes añadir, editar o eliminar fechas especiales, guardar un nombre de usuario para iniciar sesión y generar un código de recuperación.'
                }
            ];

            return (
                <div className="space-y-6 animate-fadeIn">
                    <div className="glass-card p-6 md:p-8">
                        <p className="text-sm text-cyan-300 mb-2">📖 Centro de ayuda</p>
                        <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">Guía para usar Nuestro Universo</h2>
                        <p className="text-gray-300 leading-relaxed">
                            Este espacio es compartido: ambos pueden entrar con el mismo usuario y contraseña para ver y actualizar los recuerdos de la pareja. Los cambios se guardan en la cuenta y se sincronizan entre sus dispositivos cuando hay conexión. El recorrido interactivo señala cada sección y no modifica ni elimina sus datos.
                        </p>
                        <button className="btn-primary btn-sm mt-4" onClick={onStartTour}>
                            ▶ Iniciar recorrido interactivo
                        </button>
                    </div>

                    <section className="glass-card p-5 md:p-6 space-y-4">
                        <h3 className="font-semibold text-lg">✨ Primeros pasos</h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                            <li>Inicien sesión o creen la cuenta compartida de la pareja.</li>
                            <li>En Configuración, escriban sus nombres, indiquen la fecha de inicio y elijan la zona horaria correcta.</li>
                            <li>Los campos iniciales están vacíos. Si ven datos de ejemplo o información de una cuenta anterior, edítenlos en su sección; el recorrido nunca los cambiará.</li>
                            <li>Personalicen la frase y el logo, y agreguen sus primeras fechas especiales.</li>
                            <li>En cada dispositivo, elijan quién lo usa en Configuración para atribuir correctamente los cambios compartidos.</li>
                            <li>Exploren las secciones y agreguen fotos, cartas, canciones, metas y recuerdos.</li>
                            <li>Si desean avisos fuera de la app, activen las notificaciones en cada dispositivo y acepten el permiso del navegador.</li>
                        </ol>
                        <button className="btn-primary btn-sm" onClick={() => onNavigate('settings')}>
                            Ir a Configuración
                        </button>
                    </section>

                    <section aria-labelledby="guide-sections-title">
                        <h3 id="guide-sections-title" className="font-semibold text-lg mb-3">📚 Todas las funciones</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {topics.map(topic => (
                                <article key={topic.id} className="glass-card p-5 flex flex-col items-start gap-3">
                                    <h4 className="font-semibold text-cyan-100">{topic.icon} {topic.title}</h4>
                                    <p className="text-sm text-gray-300 leading-relaxed flex-1">{topic.description}</p>
                                    <button className="btn-ghost btn-sm" onClick={() => onNavigate(topic.id)}>
                                        Abrir {topic.title}
                                    </button>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="glass-card p-5 md:p-6 space-y-3">
                        <h3 className="font-semibold text-lg">🔐 Cuenta y recuperación</h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            En Configuración puedes asignar un nombre de usuario a la cuenta y generar un código de recuperación. Guárdalo fuera del dispositivo: se muestra una sola vez, vence a los 30 minutos y solo se puede usar una vez. Al generar uno nuevo, el anterior deja de funcionar.
                        </p>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Compartan las credenciales únicamente entre ustedes. Para proteger sus recuerdos, no creen ni compartan una cuenta con otra pareja.
                        </p>
                        <button className="btn-ghost btn-sm" onClick={() => onNavigate('settings')}>
                            Administrar cuenta
                        </button>
                    </section>
                </div>
            );
        };

        // ==================== HOME SECTION ====================
        const HomeSection = ({ data, setData, onNavigate }) => {
            const activeStartDate = data.startDate || new Date().toISOString().split('T')[0];
            const daysTogether = getDaysBetween(activeStartDate);
            const nextAnniversary = getNextAnniversary(activeStartDate);
            const [countdown, setCountdown] = useState(getCountdown(
                nextAnniversary.toISOString().split('T')[0]
            ));
            const [dailyMsg, setDailyMsg] = useState('');

            useEffect(() => {
                const messages = data.dailyMessages || [];
                setDailyMsg(messages.length
                    ? messages[Math.floor(Math.random() * messages.length)].content
                    : '');
            }, [data.dailyMessages]);

            useEffect(() => {
                const timer = setInterval(() => {
                    setCountdown(getCountdown(nextAnniversary.toISOString().split('T')[0]));
                }, 1000);
                return () => clearInterval(timer);
            }, [nextAnniversary]);

            const quickLinks = [
                { id: 'memories', icon: '⭐', label: 'Recuerdos', desc: 'Mapa estelar', color: 'from-yellow-500/30 to-amber-500/20' },
                { id: 'letters', icon: '💌', label: 'Cartas', desc: 'Biblioteca de amor', color: 'from-pink-500/30 to-rose-500/20' },
                { id: 'photos', icon: '📸', label: 'Fotos', desc: 'Galería premium', color: 'from-purple-500/30 to-violet-500/20' },
                { id: 'songs', icon: '🎵', label: 'Música', desc: 'Nuestra playlist', color: 'from-green-500/30 to-emerald-500/20' },
                { id: 'dreams', icon: '🌙', label: 'Sueños', desc: 'Metas juntos', color: 'from-blue-500/30 to-indigo-500/20' },
                { id: 'timecapsule', icon: '📦', label: 'Cápsula', desc: 'Mensajes futuros', color: 'from-cyan-500/30 to-teal-500/20' },
            ];

            return (
                <div className="space-y-6 animate-fadeIn">
                    {/* Hero */}
                    <div data-guide-target="tour-home"
                        className="glass-card p-6 md:p-10 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-purple-500/10 pointer-events-none"></div>
                        <div className="relative z-10">
<div className="w-24 h-24 md:w-32 md:h-32 mx-auto rounded-full mb-4 border-2 border-white/20 animate-pulse-glow overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500/30 to-cyan-400/20">
    {data.logoUrl
        ? <img src={data.logoUrl} alt="Logo de la pareja" className="w-full h-full object-cover" />
        : <span className="text-5xl md:text-6xl" aria-label="Logo">✨</span>}
</div>
                            <h1 className="font-display text-2xl md:text-4xl font-bold mb-2">
                                <span className="text-blue-300">{data.coupleName1}</span>
                                <span className="mx-2">💕</span>
                                <span className="text-cyan-300">{data.coupleName2}</span>
                            </h1>
                            <p className="font-script text-lg md:text-2xl text-gray-300 italic mb-6">"{data.mainQuote}"</p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-8">
                                <div className="text-center">
                                    <div className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
                                        {daysTogether.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-400">días juntos</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg md:text-xl font-semibold text-cyan-300">
                                        Próximo aniversario
                                    </div>
                                    <div className="flex gap-2 md:gap-3 text-xl md:text-2xl font-mono font-bold text-white mt-1">
                                        <span className="bg-white/10 px-2 py-1 rounded-lg">{String(countdown.days).padStart(2,'0')}</span>
                                        <span className="text-gray-400">:</span>
                                        <span className="bg-white/10 px-2 py-1 rounded-lg">{String(countdown.hours).padStart(2,'0')}</span>
                                        <span className="text-gray-400">:</span>
                                        <span className="bg-white/10 px-2 py-1 rounded-lg">{String(countdown.minutes).padStart(2,'0')}</span>
                                        <span className="text-gray-400">:</span>
                                        <span className="bg-white/10 px-2 py-1 rounded-lg">{String(countdown.seconds).padStart(2,'0')}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">días : hrs : min : seg</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Daily Message */}
                    <div className="glass-card p-5 text-center">
                        <p className="text-xs text-gray-400 mb-1">💭 Mensaje del día</p>
                        <p className="font-script text-xl md:text-2xl italic text-cyan-200">"{dailyMsg}"</p>
                    </div>

                    {/* Quick Links */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        {quickLinks.map(link => (
                            <button key={link.id} onClick={() => onNavigate(link.id)}
                                className={`glass-card p-4 text-center cursor-pointer bg-gradient-to-br ${link.color} hover:scale-105 transition-transform`}>
                                <div className="text-3xl mb-1">{link.icon}</div>
                                <div className="font-semibold text-sm">{link.label}</div>
                                <div className="text-xs text-gray-400">{link.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>
            );
        };

        // ==================== MEMORIES SECTION ====================
        const MemoriesSection = ({ data, setData, setModal }) => {
            const addToast = useToast();
            const [editingMemory, setEditingMemory] = useState(null);

            const handleDelete = (id) => {
                if (confirm('¿Eliminar este recuerdo?')) {
                    setData(prev => ({ ...prev, memories: prev.memories.filter(m => m.id !== id) }));
                    addToast('Recuerdo eliminado', 'info');
                }
            };

            const openEdit = (memory = null) => {
                setEditingMemory(memory || { id: null, title: '', date: '', description: '', emoji: '⭐', photos: [] });
            };

            const saveMemory = () => {
                if (!editingMemory.title || !editingMemory.date) {
                    addToast('Título y fecha son obligatorios', 'error');
                    return;
                }
                if (editingMemory.id) {
                    setData(prev => ({
                        ...prev,
                        memories: prev.memories.map(m => m.id === editingMemory.id ? editingMemory : m)
                    }));
                } else {
                    const newMemory = { ...editingMemory, id: generateId() };
                    setData(prev => ({ ...prev, memories: [...prev.memories, newMemory] }));
                }
                setEditingMemory(null);
                addToast('✨ Recuerdo guardado', 'success');
            };

            return (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display text-2xl md:text-3xl font-bold">⭐ Mapa Estelar de Recuerdos</h2>
                        <button data-guide-target="tour-memories" onClick={() => openEdit()}
                            className="btn-primary btn-sm">+ Nueva Estrella</button>
                    </div>
                    <p className="text-gray-400 text-sm">Cada estrella es un momento especial. Haz clic para ver los detalles.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.memories.map((memory, index) => (
                            <div key={memory.id} className="glass-card p-5 cursor-pointer hover:border-cyan-400/30"
                                style={{ animationDelay: `${index * 0.08}s`, animation: 'slideUp 0.5s cubic-bezier(0.4,0,0.2,1) forwards' }}
                                onClick={() => openEdit(memory)}>
                                <div className="flex items-start justify-between mb-3">
                                    <span className="text-4xl">{memory.emoji}</span>
                                    <div className="flex gap-1">
                                        <button onClick={(e) => { e.stopPropagation();
                                                handleDelete(memory.id); }} className="text-gray-500 hover:text-red-400 text-sm">🗑️</button>
                                    </div>
                                </div>
                                <h3 className="font-semibold text-lg mb-1">{memory.title}</h3>
                                <p className="text-xs text-cyan-400 mb-2">{formatDate(memory.date)}</p>
                                <p className="text-sm text-gray-300 line-clamp-2">{memory.description}</p>
                            </div>
                        ))}
                    </div>

                    {/* Edit Modal */}
                    {editingMemory && (
                        <div className="modal-overlay" onClick={() => setEditingMemory(null)}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <h3 className="font-display text-xl font-bold mb-4">
                                    {editingMemory.id ? '✨ Editar Recuerdo' : '⭐ Nueva Estrella'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Emoji</label>
                                        <input value={editingMemory.emoji} onChange={e => setEditingMemory(prev => ({ ...prev,
                                                emoji: e.target.value }))} maxLength={4} className="text-2xl text-center w-20" />
                                    </div>
                                    <input placeholder="Título del recuerdo" value={editingMemory.title} onChange={e =>
                                            setEditingMemory(prev => ({ ...prev, title: e.target.value }))} />
                                    <input type="date" value={editingMemory.date} onChange={e => setEditingMemory(prev =>
                                        ({ ...prev, date: e.target.value }))} />
                                    <textarea placeholder="Cuenta la historia..." value={editingMemory.description}
                                        onChange={e => setEditingMemory(prev => ({ ...prev, description: e.target
                                                .value }))} rows={4} />
                                    <div className="flex gap-3">
                                        <button onClick={saveMemory} className="btn-primary flex-1">💾 Guardar</button>
                                        <button onClick={() => setEditingMemory(null)}
                                    className="btn-ghost">Cancelar</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        };

        // ==================== PHOTOS SECTION ====================
        const PhotosSection = ({ data, setData, setModal, coupleId }) => {
            const addToast = useToast();
            const [showForm, setShowForm] = useState(false);
const [newPhoto, setNewPhoto] = useState({ 
    title: '', 
    date: '', 
    description: '', 
    imageUrl: '',
    imageFile: null
});
const photoRef = useRef(null);

const handleAdd = async () => {
    if (!newPhoto.title && !newPhoto.imageUrl && !newPhoto.imageFile) {
        addToast('Título e imagen son obligatorios', 'error');
        return;
    }

    let imageUrl = newPhoto.imageUrl;
    let storagePath = null;
    if (newPhoto.imageFile) {
        if (!window.supabaseClient) {
            addToast('No hay conexión con Supabase', 'error');
            return;
        }

        const file = newPhoto.imageFile;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const filePath = `${coupleId}/${crypto.randomUUID()}-${safeName}`;
        storagePath = filePath;
        const { error } = await window.supabaseClient.storage
            .from('couple-photos')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) {
            console.warn('Supabase photo upload error:', error.message);
            addToast('No se pudo subir la foto', 'error');
            return;
        }

        const { data: signedFile, error: signedUrlError } = await window.supabaseClient.storage
            .from('couple-photos')
            .createSignedUrl(filePath, 604800);
        if (signedUrlError) {
            console.error('Supabase photo signed URL error:', signedUrlError.message);
            const { error: cleanupError } = await window.supabaseClient.storage
                .from('couple-photos')
                .remove([filePath]);
            if (cleanupError) console.error('Supabase photo cleanup error:', cleanupError.message);
            addToast('La foto se subió, pero no se pudo abrir. Vuelve a cargarla.', 'error');
            return;
        }
        imageUrl = signedFile.signedUrl;
    }

    const photo = {
        id: crypto.randomUUID(),
        title: newPhoto.title,
        date: newPhoto.date,
        description: newPhoto.description,
        imageUrl,
        storagePath
    };
    setData(prev => ({ ...prev, photos: [...prev.photos, photo] }));
    setNewPhoto({ title: '', date: '', description: '', imageUrl: '', imageFile: null });
    setShowForm(false);
    addToast('📸 Foto añadida', 'success');
};

            const handleDelete = async (photo) => {
                if (window.supabaseClient) {
                    const { error: databaseError } = await window.supabaseClient
                        .from('photos')
                        .delete()
                        .eq('id', photo.id)
                        .eq('couple_id', coupleId);

                    if (databaseError) {
                        console.warn('Supabase photo delete error:', databaseError.message);
                        addToast('No se pudo eliminar la foto de la BD', 'error');
                        return;
                    }

                    if (photo.storagePath) {
                        const { error: storageError } = await window.supabaseClient.storage
                            .from('couple-photos')
                            .remove([photo.storagePath]);
                        if (storageError) {
                            console.warn('Supabase photo file delete error:', storageError.message);
                        }
                    }
                }

                setData(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== photo.id) }));
                addToast('Foto eliminada', 'info');
            };

            return (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display text-2xl md:text-3xl font-bold">📸 Galería de Fotos</h2>
                        <button data-guide-target="tour-photos" onClick={() => setShowForm(!showForm)}
                            className="btn-primary btn-sm">
                            {showForm ? 'Cancelar' : '+ Añadir Foto'}
                        </button>
                    </div>
                    {showForm && (
    <div className="glass-card p-5 space-y-3">
        <input placeholder="Título de la foto" value={newPhoto.title} onChange={e => setNewPhoto(prev =>
            ({ ...prev, title: e.target.value }))} />
        <input type="date" value={newPhoto.date} onChange={e => setNewPhoto(prev =>
            ({ ...prev, date: e.target.value }))} />
        <textarea placeholder="Descripción (opcional)" value={newPhoto.description} onChange={e => setNewPhoto(prev =>
            ({ ...prev, description: e.target.value }))} rows={2} />
        
        {/* NUEVO - INPUT PARA SUBIR ARCHIVO */}
        <div className="space-y-2">
            <label className="text-sm text-cyan-300">📁 Subir foto:</label>
            <input 
                type="file" 
                accept="image/*"
                onChange={e => setNewPhoto(prev => ({ ...prev, imageFile: e.target.files[0] }))}
                className="w-full text-xs"
            />
            {newPhoto.imageFile && <p className="text-xs text-green-400">✓ {newPhoto.imageFile.name}</p>}
        </div>
        
        <input placeholder="O pegar URL de imagen (opcional)" value={newPhoto.imageUrl} onChange={e => setNewPhoto(prev =>
            ({ ...prev, imageUrl: e.target.value }))} />
        
        <button onClick={handleAdd} className="btn-primary">Guardar Foto</button>
    </div>
)}
                    {data.photos.length === 0 && !showForm && (
                        <div className="text-center py-12 text-gray-500">
                            <div className="text-5xl mb-4">📷</div>
                            <p>Aún no hay fotos en la galería.</p>
                            <p className="text-sm">Añade su primera foto juntos.</p>
                        </div>
                    )}
              <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-3">
    {data.photos.map((photo, i) => (
        <div key={photo.id} className="glass-card overflow-hidden group cursor-pointer break-inside-avoid mb-3"
            style={{ animationDelay: `${i*0.1}s`, animation: 'slideUp 0.5s ease forwards' }}>
            <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 flex items-center justify-center overflow-hidden">
                <img src={photo.imageUrl} alt={photo.title}
                    className="w-full h-auto object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                        const target = e.target;
                        if (!target) return;

                        const fallbackContainer = target.parentElement || target.closest('div');
                        target.style.display = 'none';

                        if (fallbackContainer) {
                            fallbackContainer.innerHTML = '<span class="text-4xl p-4">🖼️</span>';
                        }
                    }} />
            </div>
            <div className="p-3">
                <h4 className="font-semibold text-sm">{photo.title}</h4>
                {photo.date && <p className="text-xs text-cyan-400">{formatDate(photo.date)}</p>}
                {photo.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{photo.description}</p>}
                  <button onClick={() => handleDelete(photo)}
                    className="text-xs text-red-400 hover:text-red-300 mt-2">🗑️ Eliminar</button>
            </div>
        </div>
    ))}
</div>
                </div>
            );
        };

        // ==================== LETTERS SECTION ====================
        const LettersSection = ({ data, setData, setModal }) => {
            const addToast = useToast();
            const categories = ['Cuando me extrañes', 'Cuando estés triste', 'Cuando estés feliz', 'Cuando tengas miedo',
                'Cuando necesites una sonrisa', 'General/Dedicatorias'
            ];
            const [selectedCat, setSelectedCat] = useState(categories[0]);
            const [showForm, setShowForm] = useState(false);
            const [newLetter, setNewLetter] = useState({ title: '', content: '', category: categories[0] });
            const [openLetterId, setOpenLetterId] = useState(null);

            const filtered = data.letters.filter(l => l.category === selectedCat);

            const handleAdd = () => {
                if (!newLetter.title || !newLetter.content) {
                    addToast('Título y contenido son obligatorios', 'error');
                    return;
                }
                const letter = { ...newLetter, id: generateId(), createdAt: new Date().toISOString().split('T')[0] };
                setData(prev => ({ ...prev, letters: [...prev.letters, letter] }));
                setNewLetter({ title: '', content: '', category: selectedCat });
                setShowForm(false);
                addToast('💌 Carta guardada', 'success');
            };

            const handleDelete = (id) => {
                setData(prev => ({ ...prev, letters: prev.letters.filter(l => l.id !== id) }));
                addToast('Carta eliminada', 'info');
            };

            return (
                <div className="space-y-6 animate-fadeIn">
                    <h2 className="font-display text-2xl md:text-3xl font-bold">💌 Cartas de Amor</h2>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(cat => (
                            <button key={cat} onClick={() => { setSelectedCat(cat);
                                    setOpenLetterId(null); }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                    selectedCat === cat ? 'bg-rose-500/40 text-white border border-rose-400/40' : 'bg-white/5 text-gray-400 hover:text-white'
                                }`}>
                                {cat}
                            </button>
                        ))}
                    </div>
                    <button data-guide-target="tour-letters" onClick={() => setShowForm(!showForm)}
                        className="btn-primary btn-sm">
                        {showForm ? 'Cancelar' : '+ Nueva Carta'}
                    </button>
                    {showForm && (
                        <div className="glass-card p-5 space-y-3">
                            <select value={newLetter.category} onChange={e => setNewLetter(prev => ({ ...prev,
                                    category: e.target.value }))}>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input placeholder="Título de la carta" value={newLetter.title} onChange={e => setNewLetter(
                                prev => ({ ...prev, title: e.target.value }))} />
                            <textarea placeholder="Escribe desde el corazón..." value={newLetter.content} onChange={e =>
                                    setNewLetter(prev => ({ ...prev, content: e.target.value }))} rows={5} />
                            <button onClick={handleAdd} className="btn-primary">💌 Guardar Carta</button>
                        </div>
                    )}
                    <div className="space-y-3">
                        {filtered.map((letter, i) => (
                            <div key={letter.id} className="glass-card overflow-hidden"
                                style={{ animationDelay: `${i*0.1}s`, animation: 'slideUp 0.5s ease forwards' }}>
                                <div onClick={() => setOpenLetterId(openLetterId === letter.id ? null : letter.id)}
                                    className="p-5 cursor-pointer flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">✉️</span>
                                        <div>
                                            <h4 className="font-semibold">{letter.title}</h4>
                                            <p className="text-xs text-gray-400">{formatDate(letter.createdAt)}</p>
                                        </div>
                                    </div>
                                    <span className="text-gray-400 transition-transform"
                                        style={{ transform: openLetterId === letter.id ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                                </div>
                                {openLetterId === letter.id && (
                                    <div className="px-5 pb-5 pt-0 border-t border-white/5"
                                        style={{ animation: 'slideUp 0.3s ease' }}>
                                        <div className="bg-white/5 rounded-xl p-4 mt-3 font-script text-lg leading-relaxed italic text-gray-200">
                                            {letter.content}
                                        </div>
                                        <button onClick={() => handleDelete(letter.id)}
                                            className="btn-danger btn-sm mt-3">🗑️ Eliminar</button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {filtered.length === 0 && (
                            <p className="text-center text-gray-500 py-8">No hay cartas en esta categoría aún.</p>
                        )}
                    </div>
                </div>
            );
        };

        // ==================== SONGS SECTION ====================
        const SongsSection = ({ data, setData, setModal, coupleId }) => {
            const addToast = useToast();
            const [showForm, setShowForm] = useState(false);
            const [newSong, setNewSong] = useState({ 
    name: '', 
    artist: '', 
    reason: '', 
    spotify: '', 
    youtube: '',
    audioFile: null
});
const [reproduciendoId, setReproduciendoId] = useState(null);
const audioRef = useRef(null);

const handleAdd = async () => {
    if (!newSong.name || !newSong.artist) {
        addToast('Nombre y artista son obligatorios', 'error');
        return;
    }
    
    let audioUrl = null;
    let storagePath = null;
    if (newSong.audioFile) {
        if (!window.supabaseClient) {
            addToast('No hay conexión con Supabase', 'error');
            return;
        }

        const file = newSong.audioFile;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const filePath = `${coupleId}/${crypto.randomUUID()}-${safeName}`;
        storagePath = filePath;
        const { error: uploadError } = await window.supabaseClient.storage
            .from('couple-songs')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
            console.warn('Supabase song upload error:', uploadError.message);
            addToast('No se pudo subir el audio. Revisa la migración de Storage.', 'error');
            return;
        }

        const { data: signedFile, error: signedUrlError } = await window.supabaseClient.storage
            .from('couple-songs')
            .createSignedUrl(filePath, 604800);
        if (signedUrlError) {
            console.error('Supabase song signed URL error:', signedUrlError.message);
            const { error: cleanupError } = await window.supabaseClient.storage
                .from('couple-songs')
                .remove([filePath]);
            if (cleanupError) console.error('Supabase song cleanup error:', cleanupError.message);
            addToast('El audio se subió, pero no se pudo abrir. Vuelve a cargarlo.', 'error');
            return;
        }
        audioUrl = signedFile.signedUrl;
    }
    
    const song = { 
        ...newSong, 
        id: crypto.randomUUID(),
        audioUrl,
        storagePath
    };
    
    setData(prev => ({ ...prev, songs: [...prev.songs, song] }));
    setNewSong({ name: '', artist: '', reason: '', spotify: '', youtube: '', audioFile: null });
    setShowForm(false);
    addToast('🎵 Canción añadida', 'success');
};

            const handleDelete = async (song) => {
                if (window.supabaseClient) {
                    const { error: databaseError } = await window.supabaseClient
                        .from('songs')
                        .delete()
                        .eq('id', song.id)
                        .eq('couple_id', coupleId);

                    if (databaseError) {
                        console.warn('Supabase song delete error:', databaseError.message);
                        addToast('No se pudo eliminar la canción de la BD', 'error');
                        return;
                    }
                }

                if (window.supabaseClient && song.storagePath) {
                    const { error: storageError } = await window.supabaseClient.storage
                        .from('couple-songs')
                        .remove([song.storagePath]);
                    if (storageError) {
                        console.warn('Supabase song file delete error:', storageError.message);
                    }
                }

                setData(prev => ({ ...prev, songs: prev.songs.filter(s => s.id !== song.id) }));
                addToast('Canción eliminada', 'info');
            };

            return (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display text-2xl md:text-3xl font-bold">🎵 Música Especial</h2>
                        <button data-guide-target="tour-songs" onClick={() => setShowForm(!showForm)}
                            className="btn-primary btn-sm">
                            {showForm ? 'Cancelar' : '+ Añadir Canción'}
                        </button>
                    </div>
{showForm && (
    <div className="glass-card p-5 space-y-3">
        <input placeholder="Nombre de la canción" value={newSong.name} onChange={e => setNewSong(prev =>
            ({ ...prev, name: e.target.value }))} />
        <input placeholder="Artista" value={newSong.artist} onChange={e => setNewSong(prev => ({ ...prev,
                artist: e.target.value }))} />
        <textarea placeholder="¿Por qué es especial?" value={newSong.reason} onChange={e => setNewSong(
            prev => ({ ...prev, reason: e.target.value }))} rows={2} />
        <input placeholder="Enlace Spotify (opcional)" value={newSong.spotify} onChange={e => setNewSong(
            prev => ({ ...prev, spotify: e.target.value }))} />
        <input placeholder="Enlace YouTube (opcional)" value={newSong.youtube} onChange={e => setNewSong(
            prev => ({ ...prev, youtube: e.target.value }))} />
        
        <div className="space-y-2">
            <label className="text-sm text-cyan-300">📁 Subir archivo de audio (MP3, WAV):</label>
            <input 
                type="file" 
                accept="audio/*"
                onChange={e => setNewSong(prev => ({ ...prev, audioFile: e.target.files[0] }))}
                className="w-full text-xs"
            />
            {newSong.audioFile && <p className="text-xs text-green-400">✓ {newSong.audioFile.name}</p>}
        </div>
        
        <button onClick={handleAdd} className="btn-primary">Guardar Canción</button>
    </div>
)}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {data.songs.map((song, i) => (
        <div key={song.id} className="glass-card p-5 flex items-start gap-4"
            style={{ animationDelay: `${i*0.1}s`, animation: 'slideUp 0.5s ease forwards' }}>
            <div className="text-4xl flex-shrink-0">🎶</div>
            <div className="flex-1 min-w-0">
                <h4 className="font-semibold">{song.name}</h4>
                <p className="text-sm text-cyan-400">{song.artist}</p>
                {song.reason && <p className="text-xs text-gray-400 mt-1 italic">"{song.reason}"</p>}
                
                {/* NUEVO - REPRODUCTOR DE AUDIO */}
                {song.audioUrl && (
                    <div className="mt-3 bg-black/30 p-2 rounded">
                        <audio 
                            ref={reproduciendoId === song.id ? audioRef : null}
                            src={song.audioUrl}
                            preload="metadata"
                            controls
                            className="w-full h-8"
                            onPlay={() => setReproduciendoId(song.id)}
                            onPause={() => setReproduciendoId(null)}
                            onError={() => {
                                setReproduciendoId(null);
                                addToast('No se puede reproducir este audio. Vuelve a subirlo.', 'error');
                            }}
                        />
                    </div>
                )}
                
                <div className="flex gap-2 mt-2 flex-wrap">
                    {song.spotify && <a href={song.spotify} target="_blank" rel="noopener"
                        className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">🎧 Spotify</a>}
                    {song.youtube && <a href={song.youtube} target="_blank" rel="noopener"
                        className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">▶️ YouTube</a>}
                </div>
                <button onClick={() => handleDelete(song)}
                    className="text-xs text-red-400 hover:text-red-300 mt-2">🗑️</button>
            </div>
        </div>
    ))}
</div>
                </div>
            );
        };

        // ==================== DREAMS SECTION ====================
        const DreamsSection = ({ data, setData }) => {
            const addToast = useToast();
            const [newDream, setNewDream] = useState('');

            const handleAdd = () => {
                if (!newDream.trim()) return;
                const dream = { id: generateId(), text: newDream.trim(), completed: false };
                setData(prev => ({ ...prev, dreams: [...prev.dreams, dream] }));
                setNewDream('');
                addToast('🌙 Sueño añadido', 'success');
            };

            const toggleDream = (id) => {
                setData(prev => ({
                    ...prev,
                    dreams: prev.dreams.map(d => d.id === id ? { ...d, completed: !d.completed } : d)
                }));
            };

            const handleDelete = (id) => {
                setData(prev => ({ ...prev, dreams: prev.dreams.filter(d => d.id !== id) }));
                addToast('Sueño eliminado', 'info');
            };

            const pending = data.dreams.filter(d => !d.completed);
            const completed = data.dreams.filter(d => d.completed);

            return (
                <div className="space-y-6 animate-fadeIn">
                    <h2 className="font-display text-2xl md:text-3xl font-bold">🌙 Sueños Pendientes</h2>
                    <div className="flex gap-2">
                        <input data-guide-target="tour-dreams" placeholder="Nuevo sueño compartido..." value={newDream} onChange={e => setNewDream(e.target
                                .value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()} className="flex-1" />
                        <button onClick={handleAdd} className="btn-primary">Añadir</button>
                    </div>
                    <div className="space-y-3">
                        {pending.map((dream, i) => (
                            <div key={dream.id} className="glass-card p-4 flex items-center gap-3"
                                style={{ animationDelay: `${i*0.1}s`, animation: 'slideUp 0.5s ease forwards' }}>
                                <button onClick={() => toggleDream(dream.id)}
                                    className="w-6 h-6 rounded-full border-2 border-gray-400 hover:border-cyan-400 flex-shrink-0 transition-colors"></button>
                                <span className="flex-1">{dream.text}</span>
                                <button onClick={() => handleDelete(dream.id)}
                            className="text-gray-500 hover:text-red-400">🗑️</button>
                            </div>
                        ))}
                    </div>
                    {completed.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-green-400 mb-3">✅ Cumplidos ({completed.length})</h3>
                            <div className="space-y-2">
                                {completed.map(dream => (
                                    <div key={dream.id} className="glass-card p-4 flex items-center gap-3 opacity-70">
                                        <span className="text-green-400">✅</span>
                                        <span className="flex-1 line-through text-gray-500">{dream.text}</span>
                                        <button onClick={() => toggleDream(dream.id)}
                                    className="text-xs text-gray-500 hover:text-yellow-400">↩️</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        };

        // ==================== TIME CAPSULE SECTION ====================
        const TimeCapsuleSection = ({ data, setData, setModal }) => {
            const addToast = useToast();
            const [showForm, setShowForm] = useState(false);
            const [newCapsule, setNewCapsule] = useState({ title: '', message: '', revealDate: '' });

            const handleAdd = () => {
                if (!newCapsule.title || !newCapsule.message || !newCapsule.revealDate) {
                    addToast('Todos los campos son obligatorios', 'error');
                    return;
                }
                const capsule = { ...newCapsule, id: generateId(), revealed: false };
                setData(prev => ({ ...prev, timeCapsules: [...prev.timeCapsules, capsule] }));
                setNewCapsule({ title: '', message: '', revealDate: '' });
                setShowForm(false);
                addToast('📦 Cápsula del tiempo creada', 'success');
            };

            const handleDelete = (id) => {
                setData(prev => ({ ...prev, timeCapsules: prev.timeCapsules.filter(c => c.id !== id) }));
                addToast('Cápsula eliminada', 'info');
            };

            return (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display text-2xl md:text-3xl font-bold">📦 Cápsula del Tiempo</h2>
                        <button data-guide-target="tour-timecapsule" onClick={() => setShowForm(!showForm)}
                            className="btn-primary btn-sm">
                            {showForm ? 'Cancelar' : '+ Nueva Cápsula'}
                        </button>
                    </div>
                    <p className="text-gray-400 text-sm">Mensajes que solo se revelarán cuando llegue la fecha programada.</p>
                    {showForm && (
                        <div className="glass-card p-5 space-y-3">
                            <input placeholder="Título de la cápsula" value={newCapsule.title} onChange={e => setNewCapsule(
                                prev => ({ ...prev, title: e.target.value }))} />
                            <textarea placeholder="Mensaje secreto..." value={newCapsule.message} onChange={e => setNewCapsule(
                                prev => ({ ...prev, message: e.target.value }))} rows={4} />
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Fecha de revelación</label>
                                <input type="date" value={newCapsule.revealDate} onChange={e => setNewCapsule(prev => ({ ...prev,
                                        revealDate: e.target.value }))} />
                            </div>
                            <button onClick={handleAdd} className="btn-primary">🔒 Sellar Cápsula</button>
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {data.timeCapsules.map((capsule, i) => (
                            <div key={capsule.id} className={`glass-card p-5 ${capsule.revealed ? 'border-green-400/40 bg-green-500/5' : 'border-amber-400/20'}`}
                                style={{ animationDelay: `${i*0.1}s`, animation: 'slideUp 0.5s ease forwards' }}>
                                <div className="text-4xl mb-3">{capsule.revealed ? '📭' : '🔒'}</div>
                                <h4 className="font-semibold">{capsule.title}</h4>
                                <p className="text-xs text-amber-400 mb-2">📅 {formatDate(capsule.revealDate)}</p>
                                {capsule.revealed ? (
                                    <div className="bg-white/5 rounded-xl p-4 mt-2 font-script italic text-lg">
                                        {capsule.message}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">🔐 Sellado hasta la fecha indicada...</p>
                                )}
                                <button onClick={() => handleDelete(capsule.id)}
                                    className="btn-danger btn-sm mt-3">🗑️</button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        };

        // ==================== DAILY MESSAGE SECTION ====================
        const DailyMessageSection = ({ data, setData }) => {
            const addToast = useToast();
            const [newMsg, setNewMsg] = useState('');

            const handleAdd = () => {
                if (!newMsg.trim()) return;
                setData(prev => ({
                    ...prev,
                    dailyMessages: [...prev.dailyMessages, { id: generateId(), content: newMsg.trim() }]
                }));
                setNewMsg('');
                addToast('💭 Mensaje añadido', 'success');
            };

            const handleDelete = (id) => {
                setData(prev => ({
                    ...prev,
                    dailyMessages: prev.dailyMessages.filter(message => message.id !== id)
                }));
                addToast('Mensaje eliminado', 'info');
            };

            return (
                <div className="space-y-6 animate-fadeIn">
                    <h2 className="font-display text-2xl md:text-3xl font-bold">💭 Mensajes del Día</h2>
                    <p className="text-gray-400 text-sm">Frases que aparecerán aleatoriamente al visitar la página.</p>
                    <div className="flex gap-2">
                        <input data-guide-target="tour-dailymessage" placeholder="Nuevo mensaje..." value={newMsg} onChange={e => setNewMsg(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()} className="flex-1" />
                        <button onClick={handleAdd} className="btn-primary">Añadir</button>
                    </div>
                    <div className="space-y-2">
                        {data.dailyMessages.map(message => (
                            <div key={message.id} className="glass-card p-4 flex items-center justify-between">
                                <p className="font-script italic text-gray-200">"{message.content}"</p>
                                <button onClick={() => handleDelete(message.id)}
                            className="text-gray-500 hover:text-red-400 ml-3 flex-shrink-0">🗑️</button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        };

        // ==================== SETTINGS SECTION ====================
        const SettingsSection = ({
            data, setData, setModal, coupleId, username, activeMemberName,
            onActiveMemberChange, onUsernameChange
        }) => {
            const addToast = useToast();
            const [showForm, setShowForm] = useState(false);
            const [editingDate, setEditingDate] = useState(null);
            const [logoSaving, setLogoSaving] = useState(false);
            const [newUsername, setNewUsername] = useState(username || '');
            const [usernameSaving, setUsernameSaving] = useState(false);
            const [recoveryCode, setRecoveryCode] = useState('');
            const [recoveryCodeLoading, setRecoveryCodeLoading] = useState(false);

            useEffect(() => setNewUsername(username || ''), [username]);

            const handleSaveUsername = async () => {
                if (!/^[a-z0-9][a-z0-9_.-]{2,29}$/i.test(newUsername.trim())) {
                    addToast('El usuario debe tener entre 3 y 30 caracteres válidos.', 'error');
                    return;
                }
                setUsernameSaving(true);
                try {
                    await onUsernameChange(newUsername);
                    addToast('Usuario guardado.', 'success');
                } catch (error) {
                    addToast(`No se pudo guardar el usuario: ${error.message}`, 'error');
                } finally {
                    setUsernameSaving(false);
                }
            };

            const handleGenerateRecoveryCode = async () => {
                setRecoveryCodeLoading(true);
                setRecoveryCode('');
                try {
                    const { data: result, error } = await window.supabaseClient.functions
                        .invoke('issue-recovery-code');
                    if (error) throw new Error(error.message);
                    if (!result?.recoveryCode) throw new Error('El servidor no devolvió un código.');
                    setRecoveryCode(result.recoveryCode);
                } catch (error) {
                    console.error('No se pudo generar el código de recuperación:', error);
                    addToast(`No se pudo generar el código: ${error.message}`, 'error');
                } finally {
                    setRecoveryCodeLoading(false);
                }
            };

            const handleLogoUpload = async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                if (!file.type.startsWith('image/')) {
                    addToast('Selecciona un archivo de imagen.', 'error');
                    return;
                }
                if (file.size > 5 * 1024 * 1024) {
                    addToast('El logo debe pesar menos de 5 MB.', 'error');
                    return;
                }

                const extension = file.name.split('.').pop().replace(/[^a-z0-9]/gi, '').toLowerCase() || 'img';
                const path = `${coupleId}/${crypto.randomUUID()}.${extension}`;
                setLogoSaving(true);
                let uploadedPath = null;
                let databaseUpdated = false;
                try {
                    const { error: uploadError } = await window.supabaseClient.storage
                        .from('couple-logos')
                        .upload(path, file, { cacheControl: '3600', upsert: false });
                    if (uploadError) throw uploadError;
                    uploadedPath = path;

                    const { data: signedFile, error: signedError } = await window.supabaseClient.storage
                        .from('couple-logos')
                        .createSignedUrl(path, 604800);
                    if (signedError) throw signedError;

                    const { error: settingsError } = await window.supabaseClient
                        .from('couple_settings')
                        .upsert({ couple_id: coupleId, logo_path: path }, { onConflict: 'couple_id' });
                    if (settingsError) throw settingsError;
                    databaseUpdated = true;

                    const previousPath = data.logoPath;
                    setData(previous => ({ ...previous, logoPath: path, logoUrl: signedFile.signedUrl }));
                    if (previousPath) {
                        const { error: cleanupError } = await window.supabaseClient.storage
                            .from('couple-logos')
                            .remove([previousPath]);
                        if (cleanupError) console.error('No se pudo eliminar el logo anterior:', cleanupError.message);
                    }
                    addToast('Logo de la pareja actualizado.', 'success');
                } catch (error) {
                    console.error('No se pudo actualizar el logo de la pareja:', error);
                    if (uploadedPath && !databaseUpdated) {
                        const { error: cleanupError } = await window.supabaseClient.storage
                            .from('couple-logos')
                            .remove([uploadedPath]);
                        if (cleanupError) console.error('No se pudo limpiar el logo incompleto:', cleanupError.message);
                    }
                    addToast(`No se pudo actualizar el logo: ${error.message}`, 'error');
                } finally {
                    setLogoSaving(false);
                }
            };

            const handleRemoveLogo = async () => {
                if (!data.logoPath) return;
                setLogoSaving(true);
                try {
                    const { error: settingsError } = await window.supabaseClient
                        .from('couple_settings')
                        .update({ logo_path: null })
                        .eq('couple_id', coupleId);
                    if (settingsError) throw settingsError;
                    setData(previous => ({ ...previous, logoPath: null, logoUrl: '' }));
                    const { error: storageError } = await window.supabaseClient.storage
                        .from('couple-logos')
                        .remove([data.logoPath]);
                    if (storageError) {
                        console.error('No se pudo limpiar el archivo del logo:', storageError.message);
                        addToast('Logo quitado, pero no se pudo borrar su archivo anterior.', 'error');
                        return;
                    }
                    addToast('Logo eliminado.', 'info');
                } catch (error) {
                    console.error('No se pudo eliminar el logo de la pareja:', error);
                    addToast(`No se pudo eliminar el logo: ${error.message}`, 'error');
                } finally {
                    setLogoSaving(false);
                }
            };

            const handleSaveDate = () => {
                if (!editingDate.name || !editingDate.date) {
                    addToast('Nombre y fecha son obligatorios', 'error');
                    return;
                }
                if (editingDate.id) {
                    setData(prev => ({
                        ...prev,
                        specialDates: prev.specialDates.map(d => d.id === editingDate.id ? editingDate : d)
                    }));
                } else {
                    setData(prev => ({
                        ...prev,
                        specialDates: [...prev.specialDates, { ...editingDate, id: generateId(),
                            recurring: true }]
                    }));
                }
                setEditingDate(null);
                addToast('📅 Fecha guardada', 'success');
            };

            const handleDeleteDate = (id) => {
                setData(prev => ({ ...prev, specialDates: prev.specialDates.filter(d => d.id !== id) }));
                addToast('Fecha eliminada', 'info');
            };

            const handleUpdateStartDate = (newDate) => {
                setData(prev => ({ ...prev, startDate: newDate }));
                addToast('✨ Fecha de inicio actualizada', 'success');
            };

            const handleUpdateNames = (field, value) => {
                setData(prev => ({ ...prev, [field]: value }));
                addToast('✨ Nombre actualizado', 'success');
            };

            const handleUpdateQuote = (quote) => {
                setData(prev => ({ ...prev, mainQuote: quote }));
                addToast('✨ Frase actualizada', 'success');
            };

            const handleUpdateTimezone = (timezone) => {
                setData(prev => ({ ...prev, timezone }));
                addToast('Zona horaria actualizada.', 'success');
            };

            return (
                <div className="space-y-6 animate-fadeIn">
                    <h2 className="font-display text-2xl md:text-3xl font-bold">⚙️ Configuración</h2>

                    {/* Couple Info */}
                    <div data-guide-target="tour-settings" className="glass-card p-5 space-y-4">
                        <h3 className="font-semibold text-lg">👫 Información de la Pareja</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Nombre 1</label>
                                <input value={data.coupleName1} maxLength={80}
                                    onChange={e => handleUpdateNames('coupleName1', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Nombre 2</label>
                                <input value={data.coupleName2} maxLength={80}
                                    onChange={e => handleUpdateNames('coupleName2', e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Fecha de inicio de la relación</label>
                            <input type="date" value={data.startDate} onChange={e => handleUpdateStartDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Frase romántica principal</label>
                            <input value={data.mainQuote} onChange={e => handleUpdateQuote(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Zona horaria para recordatorios</label>
                            <select value={data.timezone || 'UTC'} onChange={e => handleUpdateTimezone(e.target.value)}>
                                {[...new Set([
                                    data.timezone || 'UTC',
                                    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                                    'UTC',
                                    'America/Mexico_City',
                                    'America/Bogota',
                                    'America/Lima',
                                    'America/Santiago',
                                    'America/Argentina/Buenos_Aires',
                                    'Europe/Madrid'
                                ])].map(timezone => <option key={timezone} value={timezone}>{timezone}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="glass-card p-5 space-y-3">
                        <h3 className="font-semibold text-lg">👤 Quién está usando este dispositivo</h3>
                        <p className="text-sm text-gray-400">
                            Elige tu nombre para que aparezca como autor en los avisos. Esta selección solo se guarda en este navegador; si comparten dispositivo, cámbiala cuando lo use la otra persona.
                        </p>
                        <select
                            value={activeMemberName}
                            onChange={event => onActiveMemberChange(event.target.value)}
                            aria-label="Persona que está usando este dispositivo"
                        >
                            <option value="">Selecciona quién está usando la app</option>
                            {[data.coupleName1, data.coupleName2]
                                .map(name => name.trim())
                                .filter(Boolean)
                                .map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                        </select>
                        {!data.coupleName1.trim() || !data.coupleName2.trim()
                            ? <p className="text-xs text-amber-200">Completa los dos nombres de la pareja para activar la identificación de autor.</p>
                            : null}
                    </div>

                    <div className="glass-card p-5 space-y-4">
                        <h3 className="font-semibold text-lg">🔐 Cuenta y recuperación</h3>
                        <div className="space-y-2">
                            <label className="text-xs text-gray-400 block">Usuario compartido</label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input value={newUsername} onChange={event => setNewUsername(event.target.value)}
                                    placeholder="ej. luna_y_sol" autoComplete="username" maxLength={30} />
                                <button onClick={handleSaveUsername} className="btn-primary whitespace-nowrap" disabled={usernameSaving}>
                                    {usernameSaving ? 'Guardando...' : 'Guardar usuario'}
                                </button>
                            </div>
                            <p className="text-gray-500 text-xs">Si esta cuenta se creó con correo, asigna aquí un usuario para habilitar el acceso sin correo y la recuperación.</p>
                        </div>
                        <div className="border-t border-white/10 pt-4 space-y-3">
                            <p className="text-sm text-gray-300">Genera un código de recuperación y guárdalo fuera de este dispositivo. Vence en 30 minutos; cada código solo se puede usar una vez y el anterior deja de servir.</p>
                            <button onClick={handleGenerateRecoveryCode} className="btn-primary" disabled={recoveryCodeLoading}>
                                {recoveryCodeLoading ? 'Generando...' : recoveryCode ? 'Generar código nuevo' : 'Generar código de recuperación'}
                            </button>
                            {recoveryCode && (
                                <div className="bg-black/40 rounded-xl p-4 space-y-3">
                                    <code className="block text-amber-200 break-all select-all">{recoveryCode}</code>
                                    <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(recoveryCode)}>
                                        Copiar código
                                    </button>
                                    <p className="text-xs text-amber-100">Esta es la única vez que se mostrará.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="glass-card p-5 space-y-4">
                        <h3 className="font-semibold text-lg">🎨 Logo de la pareja</h3>
                        <div className="space-y-3">
                            <label className="text-xs text-gray-400 block">Logo personalizado (PNG, JPG o WebP; máximo 5 MB)</label>
                            {data.logoUrl && (
                                <img src={data.logoUrl} alt="Logo actual de la pareja" className="w-20 h-20 rounded-xl object-cover border border-white/10" />
                            )}
                            <div className="flex flex-wrap gap-2">
                                <label className={`btn-primary cursor-pointer ${logoSaving ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {logoSaving ? 'Guardando...' : data.logoPath ? 'Cambiar logo' : 'Subir logo'}
                                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                                        onChange={handleLogoUpload} disabled={logoSaving} />
                                </label>
                                {data.logoPath && (
                                    <button onClick={handleRemoveLogo} className="btn-ghost" disabled={logoSaving}>Quitar logo</button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Special Dates */}
                    <div className="glass-card p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg">📅 Fechas Especiales</h3>
                            <button onClick={() => setEditingDate({ id: null, name: '', date: '', emoji: '📅',
                                    recurring: true })} className="btn-primary btn-sm">+ Añadir</button>
                        </div>
                        <div className="space-y-2">
                            {data.specialDates.map(sd => (
                                <div key={sd.id} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{sd.emoji}</span>
                                        <div>
                                            <span className="font-medium">{sd.name}</span>
                                            <span className="text-xs text-gray-400 ml-2">{formatDate(sd.date)}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => setEditingDate(sd)}
                                    className="text-xs text-gray-400 hover:text-white">✏️</button>
                                        <button onClick={() => handleDeleteDate(sd.id)}
                                    className="text-xs text-gray-400 hover:text-red-400">🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Edit Date Modal */}
                    {editingDate && (
                        <div className="modal-overlay" onClick={() => setEditingDate(null)}>
                            <div className="modal-content" onClick={e => e.stopPropagation()}>
                                <h3 className="font-display text-xl font-bold mb-4">
                                    {editingDate.id ? '✏️ Editar Fecha' : '📅 Nueva Fecha Especial'}
                                </h3>
                                <div className="space-y-3">
                                    <input placeholder="Emoji" value={editingDate.emoji} onChange={e => setEditingDate(prev =>
                                        ({ ...prev, emoji: e.target.value }))} maxLength={4} className="text-2xl w-20 text-center" />
                                    <input placeholder="Nombre del evento" value={editingDate.name} onChange={e =>
                                            setEditingDate(prev => ({ ...prev, name: e.target.value }))} />
                                    <input type="date" value={editingDate.date} onChange={e => setEditingDate(prev => ({ ...prev,
                                            date: e.target.value }))} />
                                    <div className="flex gap-3">
                                        <button onClick={handleSaveDate}
                                    className="btn-primary flex-1">💾 Guardar</button>
                                        <button onClick={() => setEditingDate(null)}
                                    className="btn-ghost">Cancelar</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        };

        // ==================== ANNIVERSARY SECTION ====================
        const AnniversarySection = ({ data, setData }) => {
            const addToast = useToast();
            const startDate = new Date(data.startDate + 'T00:00:00');
            const now = new Date();
            const anniversaries = [];
            for (let year = startDate.getFullYear(); year <= now.getFullYear(); year++) {
                const annDate = new Date(year, startDate.getMonth(), startDate.getDate());
                if (annDate <= now && annDate >= startDate) {
                    anniversaries.push({
                        year,
                        date: annDate,
                        number: year - startDate.getFullYear(),
                        dateStr: annDate.toISOString().split('T')[0],
                    });
                }
            }

            const existingMoments = data.anniversaryMoments || [];
            const [editingMoment, setEditingMoment] = useState(null);

            const handleSaveMoment = (anniversary) => {
                const existing = existingMoments.find(m => m.anniversaryNumber === anniversary.number);
                if (existing) {
                    setEditingMoment({ ...existing, anniversaryDate: anniversary.dateStr,
                        anniversaryNumber: anniversary.number });
                } else {
                    setEditingMoment({
                        id: null,
                        anniversaryNumber: anniversary.number,
                        anniversaryDate: anniversary.dateStr,
                        note: '',
                        highlight: '',
                    });
                }
            };

            const saveMoment = () => {
                if (editingMoment.id) {
                    setData(prev => ({
                        ...prev,
                        anniversaryMoments: (prev.anniversaryMoments || []).map(m =>
                            m.id === editingMoment.id ? editingMoment : m
                        )
                    }));
                } else {
                    setData(prev => ({
                        ...prev,
                        anniversaryMoments: [...(prev.anniversaryMoments || []), { ...editingMoment,
                            id: generateId() }]
                    }));
                }
                setEditingMoment(null);
                addToast('🎊 Momento guardado', 'success');
            };

            return (
                <div className="space-y-6 animate-fadeIn">
                    <h2 data-guide-target="tour-anniversaries"
                        className="font-display text-2xl md:text-3xl font-bold">🎊 Galería de Momentos Especiales</h2>
                    <p className="text-gray-400 text-sm">Resumen de todos los aniversarios que han compartido.</p>
                    {anniversaries.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">Aún no han celebrado su primer aniversario.</p>
                    ) : (
                        <div className="space-y-4">
                            {anniversaries.reverse().map((ann, i) => {
                                const moment = existingMoments.find(m => m.anniversaryNumber === ann.number);
                                return (
                                    <div key={ann.number} className="glass-card p-5"
                                        style={{ animationDelay: `${i*0.1}s`, animation: 'slideUp 0.5s ease forwards' }}>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-display text-xl font-bold">
                                                    {ann.number === 0 ? '🌟 Inicio de la Relación' : `🎉 ${ann.number}º Aniversario`}
                                                </h3>
                                                <p className="text-sm text-cyan-400">{formatDate(ann.dateStr)}</p>
                                            </div>
                                            <span className="text-3xl">{ann.number === 0 ? '💫' : '🎊'}</span>
                                        </div>
                                        {moment && (
                                            <div className="mt-3 bg-white/5 rounded-xl p-4">
                                                {moment.highlight && <p className="font-semibold text-amber-300">✨ {moment
                                                        .highlight}</p>}
                                                {moment.note && <p className="text-sm text-gray-300 mt-1">{moment.note}</p>}
                                            </div>
                                        )}
                                        <button onClick={() => handleSaveMoment(ann)}
                                            className="btn-ghost btn-sm mt-3">
                                            {moment ? '✏️ Editar momento' : '💝 Añadir recuerdo'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Edit Moment Modal */}
                    {editingMoment && (
                        <div className="modal-overlay" onClick={() => setEditingMoment(null)}>
                            <div className="modal-content" onClick={e => e.stopPropagation()}>
                                <h3 className="font-display text-xl font-bold mb-4">
                                    💝 {editingMoment.anniversaryNumber === 0 ? 'Inicio de la Relación' :
                                        `${editingMoment.anniversaryNumber}º Aniversario`}
                                </h3>
                                <div className="space-y-3">
                                    <input placeholder="Destacado (ej: Mejor regalo, cena especial...)"
                                        value={editingMoment.highlight || ''}
                                        onChange={e => setEditingMoment(prev => ({ ...prev, highlight: e.target.value }))} />
                                    <textarea placeholder="Notas y detalles del momento..."
                                        value={editingMoment.note || ''}
                                        onChange={e => setEditingMoment(prev => ({ ...prev, note: e.target.value }))}
                                        rows={3} />
                                    <div className="flex gap-3">
                                        <button onClick={saveMoment}
                                    className="btn-primary flex-1">💾 Guardar</button>
                                        <button onClick={() => setEditingMoment(null)}
                                    className="btn-ghost">Cancelar</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        };

        // ==================== NOTIFICATIONS SECTION ====================
        const NotificationsSection = ({ data, setData, coupleId, pushEnabled, onEnablePush, onDisablePush }) => {
            const addToast = useToast();
            const [pushLoading, setPushLoading] = useState(false);
            const [pushError, setPushError] = useState('');
            const [notificationPermission, setNotificationPermission] = useState(
                'Notification' in window ? Notification.permission : 'unsupported'
            );
            const handleClear = () => {
                try {
                    localStorage.setItem(`nuestro_universo_notifications_cleared_${coupleId}`, new Date().toISOString());
                    setData(prev => ({ ...prev, notifications: [] }));
                    addToast('Notificaciones limpiadas en este dispositivo.', 'info');
                } catch (error) {
                    addToast(`No se pudieron limpiar las notificaciones: ${error.message}`, 'error');
                }
            };
            const handlePushToggle = async () => {
                setPushLoading(true);
                setPushError('');
                try {
                    if (pushEnabled) await onDisablePush();
                    else await onEnablePush();
                    setNotificationPermission('Notification' in window ? Notification.permission : 'unsupported');
                } catch (error) {
                    setPushError(error.message);
                } finally {
                    setPushLoading(false);
                }
            };
            const handleTestNotification = async () => {
                setPushError('');
                try {
                    if (notificationPermission !== 'granted') {
                        throw new Error('El permiso de notificaciones no está concedido en este navegador.');
                    }
                    const registration = await navigator.serviceWorker.getRegistration(
                        new URL(import.meta.env.BASE_URL, window.location.href).href
                    );
                    if (!registration) throw new Error('No se encontró el service worker. Desactiva y activa Push nuevamente.');
                    await registration.showNotification('Prueba de Nuestro Universo', {
                        body: 'Si ves este aviso, Android y Chrome pueden mostrar notificaciones de este dispositivo.',
                        icon: appIconUrl,
                        tag: `test:${Date.now()}`,
                        renotify: true,
                        vibrate: [200, 100, 200]
                    });
                    addToast('Aviso de prueba enviado al sistema del teléfono.', 'success');
                } catch (error) {
                    console.error('[Notifications] Falló la prueba local:', error);
                    setPushError(error.message || 'No se pudo mostrar el aviso de prueba.');
                }
            };
            return (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display text-2xl md:text-3xl font-bold">🔔 Notificaciones</h2>
                        {data.notifications.length > 0 && (
                            <button onClick={handleClear} className="btn-ghost btn-sm">Limpiar todo</button>
                        )}
                    </div>
                    <div data-guide-target="tour-notifications" className="glass-card p-5 space-y-3">
                        <h3 className="font-semibold">Notificaciones en este dispositivo</h3>
                        <p className="text-sm text-gray-400">
                            Activa las notificaciones para recibir avisos de fechas, cápsulas del tiempo y cambios compartidos, incluso cuando la aplicación esté cerrada.
                        </p>
                        <button className="btn-primary" onClick={handlePushToggle} disabled={pushLoading}>
                            {pushLoading ? 'Actualizando...' : pushEnabled ? 'Desactivar en este dispositivo' : 'Activar notificaciones push'}
                        </button>
                        <div className="text-xs text-gray-400 space-y-1" aria-live="polite">
                            <p>Permiso de Chrome: {notificationPermission === 'granted'
                                ? 'permitido'
                                : notificationPermission === 'denied'
                                    ? 'bloqueado'
                                    : notificationPermission === 'default'
                                        ? 'pendiente'
                                        : 'no compatible'}</p>
                            <p>Suscripción de este navegador: {pushEnabled ? 'activa' : 'no activa'}</p>
                        </div>
                        <button className="btn-ghost btn-sm" onClick={handleTestNotification}
                            disabled={notificationPermission !== 'granted'}>
                            Probar aviso en este teléfono
                        </button>
                        <p className="text-xs text-gray-500">
                            Esta prueba solo comprueba la pantalla de avisos del teléfono; no prueba el envío desde el servidor. El sonido, el modo No molestar y las restricciones de batería dependen de Android y de la configuración de notificaciones de Chrome.
                        </p>
                        {pushError && <p className="text-sm text-red-300" role="alert">{pushError}</p>}
                        {!import.meta.env.VITE_VAPID_PUBLIC_KEY && (
                            <p className="text-xs text-amber-200">Push requiere configuración adicional del servidor.</p>
                        )}
                    </div>
                    {data.notifications.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <div className="text-5xl mb-4">🔔</div>
                            <p>No hay notificaciones.</p>
                            <p className="text-sm">Aparecerán automáticamente cerca de fechas especiales.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {[...data.notifications].reverse().map(notif => (
                                <div key={notif.id} className="glass-card p-4 flex items-start gap-3">
                                    <span className="text-2xl">{notif.daysBefore === 0 ? '🎉' : '⏰'}</span>
                                    <div>
                                        <p className="font-medium">{notif.message}</p>
                                        <p className="text-xs text-gray-500">{notif.sentDate}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        };

        // ==================== MODAL COMPONENT ====================
        const Modal = ({ content, onClose, data, setData }) => {
            return (
                <div className="modal-overlay" onClick={onClose}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        {content}
                        <button onClick={onClose} className="btn-ghost btn-sm mt-4 w-full">Cerrar</button>
                    </div>
                </div>
            );
        };

        // ==================== RENDER ====================
        createRoot(document.getElementById('root')).render(
            <ToastProvider>
                <App />
            </ToastProvider>
        );
    