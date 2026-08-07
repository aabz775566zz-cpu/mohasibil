// Service worker: required by Chrome to install this app to the home screen
// as a real standalone app (no address bar). Uses a "network-first" strategy
// with cache-busting so any update you upload to the site is shown
// immediately the next time the app is opened while online. If there's no
// internet connection, it falls back to the last successfully cached
// version so the app still opens instead of showing an error.
const CACHE_NAME = 'mohasibi-alawal-v13';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const SHARE_CACHE = 'share-target-cache-v1';

self.addEventListener('install', function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL).catch(function(){ /* ignore individual failures */ });
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME && k !== SHARE_CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// ===== Web Share Target: receive a screenshot shared from Android's own
// share sheet (e.g. right after taking a screenshot) and hand it to the app
// for batch AI extraction, without the user opening the app and uploading
// it manually first. See manifest.json's "share_target" key and the
// maybeHandleSharedImage() function in index.html. =====
self.addEventListener('fetch', function(event){
  const url = new URL(event.request.url);

  if(event.request.method === 'POST' && url.pathname.indexOf('share-target') > -1){
    event.respondWith(handleShareTarget(event));
    return;
  }

  if(event.request.method !== 'GET') return;
  const isSameOrigin = event.request.url.indexOf(self.location.origin) === 0;
  if(!isSameOrigin) return; // let cross-origin requests (fonts, Chart.js) go straight to network

  event.respondWith(
    // cache:'no-store' makes sure we bypass the browser's normal HTTP cache
    // as well, not just the Service Worker's own Cache Storage, so updates
    // uploaded to the site are never held back by stale cached responses.
    fetch(event.request, {cache: 'no-store'}).then(function(response){
      if(response && response.ok){
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
      }
      return response;
    }).catch(function(){
      return caches.match(event.request);
    })
  );
});

async function handleShareTarget(event){
  const formData = await event.request.formData();
  const file = formData.get('images'); // must match manifest.json's params.files[0].name

  if(file){
    const cache = await caches.open(SHARE_CACHE);
    await cache.put('/share-target/last-image', new Response(file, {headers: {'Content-Type': file.type || 'image/jpeg'}}));
  }

  // Web Share Target requires a redirect response to a page the user sees.
  // index.html reads the "shared=1" flag and pulls the image back out of
  // SHARE_CACHE via maybeHandleSharedImage().
  return Response.redirect('./index.html?shared=1', 303);
}
