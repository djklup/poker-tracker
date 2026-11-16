self.addEventListener("install", (event) => {
    self.skipWaiting();
  });
  
  self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
  });
  
  self.addEventListener("push", (event) => {
    let data = {
      title: "Poker Break 🚨",
      body: "Time for a break!",
    };
  
    if (event.data) {
      try {
        data = { ...data, ...event.data.json() };
      } catch (err) {
        data.body = event.data.text();
      }
    }
  
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        tag: "poker-break-reminder",
        renotify: true,
        data: { url: "./" },
      })
    );
  });
  
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || "./";
  
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
    );
  });