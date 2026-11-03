self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || 'Hay una novedad en su espacio.' };
  }
  const options = {
    body: payload.body || 'Hay una novedad en su espacio.',
    icon: payload.icon || './app-icon-192.png',
    badge: payload.badge || './app-icon-192.png',
    tag: payload.tag || 'nuestro-universo',
    data: { url: payload.url || './' }
  };
  event.waitUntil(self.registration.showNotification(payload.title || 'Nuestro Universo', options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const appClient = clients.find(client => client.url.startsWith(self.registration.scope));
    if (appClient) return appClient.focus();
    return self.clients.openWindow(event.notification.data?.url || self.registration.scope);
  }));
});
