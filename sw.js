/* Оффлайн-кэш. При выкладке новых рассказов поднимаем VERSION. */
var VERSION = 'read-v4';
var FILES = [
  './', 'index.html', 'app.css', 'app.js', 'content.js',
  'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) {
        fetch(e.request).then(function (res) {
          if (res && res.ok) caches.open(VERSION).then(function (c) { c.put(e.request, res.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return caches.match('index.html'); });
    })
  );
});

/* Свайп вниз в приложении: тянем всё заново с сервера, мимо кэша,
   и отвечаем, какая версия рассказов теперь лежит. */
self.addEventListener('message', function (e) {
  if (!e.data || e.data.type !== 'refresh') return;
  var reply = function (payload) {
    if (e.ports && e.ports[0]) e.ports[0].postMessage(payload);
  };
  caches.open(VERSION).then(function (cache) {
    return Promise.all(FILES.map(function (f) {
      return fetch(f, { cache: 'reload' }).then(function (res) {
        if (res && res.ok) return cache.put(f, res.clone()).then(function () { return res; });
        return null;
      });
    })).then(function () {
      return cache.match('content.js').then(function (res) {
        if (!res) return reply({ ok: false });
        return res.text().then(function (text) {
          var v = text.match(/CONTENT_VERSION\s*=\s*"([^"]+)"/);
          var ids = text.match(/"id":"/g);
          reply({ ok: true, version: v ? v[1] : null, count: ids ? ids.length : 0 });
        });
      });
    });
  }).catch(function () { reply({ ok: false }); });
});
