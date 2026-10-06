// Caches only the app shell so it opens instantly. Messages and media are never cached:
// they live encrypted on the server and are decrypted only in memory.
const CACHE = 'nido-shell-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});

// Push: the server only knows "there is something new"; the text never travels in the notification.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appleish = /iPhone|iPad|Macintosh/.test(self.navigator.userAgent);
    // App already open in front: no banner (Apple requires one for every push, so it still gets it).
    if (!appleish && wins.some(w => w.visibilityState === 'visible' && w.focused)) return;
    try { await self.navigator.setAppBadge?.(); } catch {}
    await self.registration.showNotification(d.title || 'Nido', {
      body: d.body || 'Hai un nuovo messaggio', icon: 'icon-192.png', badge: 'icon-192.png',
      tag: 'nido-msg', renotify: true, data: { url: d.url || './#chat' },
    });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { w.postMessage({ go: 'chat' }); if ('focus' in w) return w.focus(); }
    return self.clients.openWindow(e.notification.data?.url || './#chat');
  })());
});
