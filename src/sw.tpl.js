// Caches only the app shell so it opens instantly. Messages and media are never cached:
// they live encrypted on the server and are decrypted only in memory.
const CACHE = 'nido-shell-v4';
const SB_URL = '__SB_URL__', SB_KEY = '__SB_KEY__';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png'];
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).then(() => c.add(LIB).catch(() => {})))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request; const u = new URL(req.url);
  if (req.method !== 'GET') return;
  if (u.href === LIB) { // the database library: serve the saved copy, refresh it in the background
    e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(req); const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit); return hit || net; }));
    return;
  }
  if (u.origin !== location.origin) return;
  // App files: always ask GitHub first (bypassing its 10-minute cache) so updates arrive on the next open.
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })
    .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});

// Push: the server only knows "there is something new"; the text never travels in the notification.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil((async () => {
    // Tell the server this phone really received it (used by the notification health check).
    const ack = (async () => {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) await fetch(`${SB_URL}/rest/v1/rpc/push_ack`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_endpoint: sub.endpoint }) });
    })().catch(() => {});
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appleish = /iPhone|iPad|Macintosh/.test(self.navigator.userAgent);
    // App already open in front: no banner (Apple requires one for every push, so it still gets it).
    if (!appleish && wins.some(w => w.visibilityState === 'visible' && w.focused)) return ack;
    try { await self.navigator.setAppBadge?.(); } catch {}
    await self.registration.showNotification(d.title || 'Nido', {
      body: d.body || 'Hai un nuovo messaggio', icon: 'icon-192.png', badge: 'icon-192.png',
      tag: 'nido-msg', renotify: true, data: { url: d.url || './#chat' },
    });
    await ack;
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    // Tell the server this phone really received it (used by the notification health check).
    const ack = (async () => {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) await fetch(`${SB_URL}/rest/v1/rpc/push_ack`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_endpoint: sub.endpoint }) });
    })().catch(() => {});
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { w.postMessage({ go: 'chat' }); if ('focus' in w) return w.focus(); }
    return self.clients.openWindow(e.notification.data?.url || './#chat');
  })());
});
