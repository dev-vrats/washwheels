// public/firebase-messaging-sw.js
// Background push handler — must be at the root of the site

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase config injected at SW install time via a message from the page
let messaging = null;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    if (!firebase.apps.length) {
      firebase.initializeApp(event.data.config);
    }
    messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const { title, body, icon } = payload.notification || {};
      self.registration.showNotification(title || 'Washwheels', {
        body: body || 'New update',
        icon: icon || '/icon-192.png',
        badge: '/icon-192.png',
        data: payload.data,
        vibrate: [200, 100, 200],
        tag: 'washwheels-' + (payload.data?.bookingId || 'default'),
        renotify: true,
      });
    });
  }
});

// Fallback: try to init from SW registration scope if config already loaded
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const bookingId = event.notification.data?.bookingId;
  const url = bookingId ? `/?booking=${bookingId}` : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
