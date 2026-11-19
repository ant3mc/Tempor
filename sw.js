// sw.js — кладётся в корень репозитория GitHub Pages, рядом с temp.html.
// Контракт с temp.html описан в комментарии в конце temp.html.

const CACHE_NAME = 'articles-v1';   // должно совпадать с temp.html

// Регулярка ищет хвост пути: .../article-<uuid>.html
// На GitHub Pages URL содержит префикс репозитория (/my-repo/...),
// поэтому проверяем только окончание.
const ARTICLE_RE = /\/article-([a-f0-9-]+)\.html$/;

self.addEventListener('install', (event) => {
    // Активируемся сразу, не дожидаясь закрытия старых вкладок.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // На всякий случай чистим устаревшие версии кэша (если вы будете
        // менять CACHE_NAME в будущем).
        const names = await caches.keys();
        await Promise.all(
            names
                .filter((n) => n.startsWith('articles-') && n !== CACHE_NAME)
                .map((n) => caches.delete(n))
        );
        // Забираем управление над уже открытыми страницами scope.
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Нас интересуют только переходы по ссылкам (навигация) нашего origin.
    // Картинки, скрипты, XHR — пропускаем дальше без обработки.
    if (req.method !== 'GET') return;

    let url;
    try {
        url = new URL(req.url);
    } catch {
        return;
    }
    if (url.origin !== self.location.origin) return;

    const m = url.pathname.match(ARTICLE_RE);
    if (!m) return;

    const id = m[1];

    event.respondWith((async () => {
        // Ключ кэша тот же, что использовал temp.html:
        //   <scope>/__article/<uuid>
        const cacheKey = new URL('./__article/' + id, self.registration.scope).href;
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(cacheKey);

        if (cached) {
            // Возвращаем сохранённый HTML. Response уже имеет
            // Content-Type: text/html;charset=utf-8 — тот, что положил temp.html.
            return cached;
        }

        // Статья не найдена (например, кэш очищен или id опечатан).
        return new Response(
            '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">' +
            '<title>Статья не найдена</title></head><body>' +
            '<h2>Статья не найдена</h2>' +
            '<p>Вероятно, кэш браузера был очищен. ' +
            'Вернитесь на исходную вкладку и сформируйте статью заново.</p>' +
            '</body></html>',
            {
                status: 404,
                headers: { 'Content-Type': 'text/html;charset=utf-8' }
            }
        );
    })());
});