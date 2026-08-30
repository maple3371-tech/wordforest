/* Word Forest service worker — 오프라인에서도 앱이 열리게 해 줍니다.
   앱 파일을 수정했다면 아래 CACHE 버전 숫자를 올려 주세요 (v1 → v2 …). */
const CACHE = 'word-forest-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Firebase / 구글 로그인 요청은 항상 네트워크로 (캐시하면 인증이 깨집니다)
  if (!url.origin.startsWith(self.location.origin) &&
      !url.hostname.endsWith('gstatic.com') &&
      !url.hostname.endsWith('jsdelivr.net')) return;
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) return;

  // 페이지 이동: 네트워크 우선, 실패하면 캐시된 앱을 보여 줌
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 그 외 정적 파일: 캐시 우선, 없으면 네트워크에서 받아 저장
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type !== 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
