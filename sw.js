const NOMBRE_CACHE = "countryball-revelion-v1";
const ARCHIVOS_PARA_GUARDAR = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.json",
  "./icono-192.png",
  "./icono-512.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then((cache) => cache.addAll(ARCHIVOS_PARA_GUARDAR))
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres.filter((nombre) => nombre !== NOMBRE_CACHE).map((nombre) => caches.delete(nombre))
      )
    )
  );
});

self.addEventListener("fetch", (evento) => {
  evento.respondWith(
    caches.match(evento.request).then((respuestaGuardada) => respuestaGuardada || fetch(evento.request))
  );
});
