// =====================================================================
//  Service Worker(オフライン対応)
//  ・questions.json … ネットワーク優先 → 失敗したらキャッシュ
//  ・それ以外        … キャッシュ優先 → なければネットワーク
//
//  ★ index.html や画像を書きかえたら、CACHE_NAME の数字を1つ上げてください。
//    (例: geo-quiz-v1 → geo-quiz-v2)古いキャッシュは自動で消えます。
//    questions.json の更新だけなら、上げなくても反映されます。
// =====================================================================
const CACHE_NAME = 'geo-quiz-v3';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './questions.json',
  './images/icons/icon.svg',
  './images/icons/icon-192.png',
  './images/icons/icon-512.png',
  './images/icons/icon-maskable-512.png',
  './images/icons/apple-touch-icon.png',
  './fonts/geo-jp-500.woff2',
  './fonts/geo-jp-800.woff2',
  './fonts/geo-latin-600.woff2',
  './fonts/geo-latin-700.woff2',
  './images/chars/hokkaido_tohoku_1.svg',
  './images/chars/hokkaido_tohoku_2.svg',
  './images/chars/hokkaido_tohoku_3.svg',
  './images/chars/hokkaido_tohoku_4.svg',
  './images/chars/hokkaido_tohoku_5.svg',
  './images/chars/kanto_1.svg',
  './images/chars/kanto_2.svg',
  './images/chars/kanto_3.svg',
  './images/chars/kanto_4.svg',
  './images/chars/kanto_5.svg',
  './images/chars/chubu_1.svg',
  './images/chars/chubu_2.svg',
  './images/chars/chubu_3.svg',
  './images/chars/chubu_4.svg',
  './images/chars/chubu_5.svg',
  './images/chars/kinki_1.svg',
  './images/chars/kinki_2.svg',
  './images/chars/kinki_3.svg',
  './images/chars/kinki_4.svg',
  './images/chars/kinki_5.svg',
  './images/chars/chugoku_shikoku_1.svg',
  './images/chars/chugoku_shikoku_2.svg',
  './images/chars/chugoku_shikoku_3.svg',
  './images/chars/chugoku_shikoku_4.svg',
  './images/chars/chugoku_shikoku_5.svg',
  './images/chars/kyushu_1.svg',
  './images/chars/kyushu_2.svg',
  './images/chars/kyushu_3.svg',
  './images/chars/kyushu_4.svg',
  './images/chars/kyushu_5.svg',
  './images/chars/world_1.svg',
  './images/chars/world_2.svg',
  './images/chars/world_3.svg',
  './images/chars/world_4.svg',
  './images/chars/world_5.svg',
  './images/chars/industry_1.svg',
  './images/chars/industry_2.svg',
  './images/chars/industry_3.svg',
  './images/chars/industry_4.svg',
  './images/chars/industry_5.svg',
  './images/chars/secret_a.svg',
  './images/chars/secret_b.svg',
  './images/chars/secret_c.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 1ファイル失敗しても全体が止まらないよう、1つずつ追加する
    await Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/questions.json')) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res && res.ok) cache.put('./questions.json', res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match('./questions.json');
    if (cached) return cached;
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch (e) {
    // オフラインでページを開いたときはアプリ本体を返す
    if (req.mode === 'navigate') {
      const page = await cache.match('./index.html');
      if (page) return page;
    }
    return new Response('オフラインのため読み込めませんでした', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
