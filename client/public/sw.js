// Service Worker for igraem.kz Web Push Notifications
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: 'IGRAEM.KZ ⚽',
      body: event.data ? event.data.text() : 'Новое уведомление от IGRAEM.KZ'
    };
  }

  const targetUrl = (data.data && data.data.url) || data.url || '/requests?tab=incoming';

  const options = {
    body: data.body || 'Новое уведомление от IGRAEM.KZ',
    icon: '/icons/icon-192x192.png', // Яркая цветная иконка приложения
    badge: '/icons/badge-72x72.png', // Монохромный белый силуэт для статус-бара Android
    vibrate: data.vibrate || [200, 100, 200],
    tag: data.tag || 'igraem-general-notification', // Чтобы группировать или обновлять
    renotify: true,
    requireInteraction: true, // Уведомление НЕ исчезает само и висит в шторке/на экране блокировки, пока пользователь не смахнет или не нажмет
    data: {
      url: targetUrl,
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Новый запрос на игру! ⚽', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Если нажато действие "Закрыть", не открываем окно
  if (event.action === 'close') {
    return;
  }

  const notificationData = event.notification.data || {};
  const targetUrl = (notificationData && notificationData.url) ? notificationData.url : '/requests?tab=incoming';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Если вкладка уже открыта — фокусируемся и переходим на нужный URL
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(function(focusedClient) {
            if (focusedClient && 'navigate' in focusedClient) {
              return focusedClient.navigate(targetUrl);
            }
          });
        }
      }
      // Если приложение было полностью закрыто — открываем новую вкладку сразу на странице запросов
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
