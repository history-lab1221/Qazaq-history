// Офлайн-режим. При изменении файлов сайта увеличь номер версии (qh-v3 -> qh-v4).
const C = 'qh-v3';
const FILES = ['./', 'index.html', 'style.css', 'extra.css', 'script.js', 'boost.js', 'lang.js', 'kk1.js', 'background.png'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(C).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => clients.claim()));
});

// Сначала сеть (чтобы видеть обновления), без интернета — копия из кэша
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        fetch(e.request).then(r => { const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); return r; })
            .catch(() => caches.match(e.request))
    );
});
