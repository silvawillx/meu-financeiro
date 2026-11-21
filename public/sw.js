const CACHE_NAME = "meu-financeiro-v4";
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

// Estratégia: tenta a rede primeiro (pra sempre pegar a versão mais nova),
// e cai pro cache quando estiver offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Só guarda em cache arquivos do próprio app. Chamadas ao Supabase (seus dados
  // financeiros e o login) nunca passam pelo cache do navegador.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return resposta;
      })
      .catch(() => caches.match(event.request).then((r) => r || (event.request.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
