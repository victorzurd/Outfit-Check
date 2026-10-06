const CACHE_NAME = 'outfit-check-shell-v1'
const APP_SHELL = ['/']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('outfit-check-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)),
  )))
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put('/', response.clone()))
      return response
    }).catch(async () => (await caches.match('/')) || Response.error()))
    return
  }

  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request)
      const fresh = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone())
        return response
      }).catch(() => cached)
      return cached || fresh
    }))
  }
})
