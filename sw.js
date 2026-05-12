// ドローンクイズ PWA - Service Worker
// キャッシュ名（バージョンを上げると古いキャッシュが自動削除される）
const CACHE_NAME = 'drone-quiz-v1';

// オフラインでも動作させたいファイル一覧
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Google Fonts（オプション：ネットワークが必要な場合はキャッシュに任せる）
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=Space+Mono:wght@400;700&display=swap'
];

// ── インストール：必要ファイルを事前キャッシュ ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Google Fonts など外部リソースは失敗してもインストールを止めない
      return cache.addAll(
        ASSETS.filter(url => !url.startsWith('https://fonts.googleapis.com'))
      ).then(() => {
        // Fonts は個別に試みる（失敗しても続行）
        return Promise.allSettled(
          ASSETS
            .filter(url => url.startsWith('https://fonts.googleapis.com'))
            .map(url => cache.add(url).catch(() => {}))
        );
      });
    })
  );
  self.skipWaiting();
});

// ── アクティベート：古いキャッシュを削除 ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── フェッチ：Cache First 戦略 ───────────────────────────────────
// 1. キャッシュにあればそこから返す（オフライン対応）
// 2. なければネットワークから取得してキャッシュに保存
self.addEventListener('fetch', event => {
  // POST や chrome-extension など対象外のリクエストはスキップ
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // 正常なレスポンスだけキャッシュに保存
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // オフラインかつキャッシュにもない場合はメインHTMLを返す（SPA的挙動）
          if (event.request.destination === 'document') {
            return caches.match('./drone_quiz.html');
          }
        });
    })
  );
});
