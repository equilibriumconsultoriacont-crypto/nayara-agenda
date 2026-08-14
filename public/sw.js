self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Agenda Nayara', {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [200, 100, 200],
    })
  );
});
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
