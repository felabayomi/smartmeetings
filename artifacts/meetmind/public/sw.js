self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "MeetMind", body: event.data.text() }; }

  const { title = "MeetMind Reminder", body = "", tag = "meetmind", data: extra = {} } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
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

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
