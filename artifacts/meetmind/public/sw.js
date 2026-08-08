self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("meetmind-shell-v2").then((cache) => cache.addAll([
      "/",
      "/manifest.json",
      "/favicon.png",
      "/icon-192.png",
      "/icon-512.png",
      "/apple-touch-icon.png",
      "/logo-transparent.png",
    ])),
  );
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  if (/\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open("meetmind-shell-v2").then((cache) => cache.put(request, copy));
      return response;
    })));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "MeetMind", body: event.data.text() }; }

  const { title = "MeetMind Reminder", body = "", tag = "meetmind", data: extra = {} } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icon-192.png",
      badge: "/favicon.png",
      data: extra,
      requireInteraction: true,
      actions: [{ action: "open", title: "Open MeetMind" }],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("activate", (event) => event.waitUntil(
  Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== "meetmind-shell-v2").map((key) => caches.delete(key)))),
    clients.claim(),
  ]),
));
