// Service Worker for igraem.kz Web Push Notifications
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {
      title: 'IGRAEM.KZ ⚽',
      body: event.data ? event.data.text() : 'Новый входящий запрос!'
    };
  }

  const options = {
    body: payload.body || 'Новый входящий запрос!',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/badge-72x72.png',
    vibrate: payload.vibrate || [300, 100, 300, 100, 300], // ощутимый вибро-шаблон
    silent: false,
    requireInteraction: true, // не гасить пока пользователь не увидит
    data: payload.data || { url: payload.url || '/requests' },
    actions: [
      { action: 'open', title: 'Открыть запрос' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Новый запрос на игру! ⚽', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/requests';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
