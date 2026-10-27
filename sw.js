// Nets offline support and daily reminders. Bump CACHE when you upload a new version.
const CACHE = "nets-v2";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "nets-data").map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", cp)); return r; }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return r;
  })));
});

// Builds tonight's reminder from what the app last saved on this phone. No names ever leave the phone.
function list(names) { return names.length <= 1 ? names.join("") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1]; }
function buildMessage(d) {
  const now = Date.now();
  if (!d) return { title: "Nets", body: "Someone would love to hear from you. Open Nets to see who." };
  const due = (d.due || []).concat((d.later || []).filter(x => x.at <= now)).map(x => x);
  const seen = new Set(); const people = due.filter(x => !seen.has(x.n) && seen.add(x.n));
  if (people.length) {
    const p = people[0], more = people.length - 1;
    const how = p.goal === "meet up" ? "Maybe set up a time to meet up?" : p.goal === "call" ? "A quick call would mean a lot." : "A quick \"hey, how have you been?\" is enough.";
    return { title: `Time to reach out to ${p.n}`, body: more ? `${p.n} and ${more} other${more > 1 ? "s" : ""} are due this week. ${how}` : `${p.n} is due this week. ${how}` };
  }
  const weekOver = d.weekEnd && now >= d.weekEnd;
  if (!weekOver && d.picks && d.picks.length && d.reached < d.perWeek) return { title: "Your picks this week", body: `${list(d.picks.slice(0, 3))} would love to hear from you.` };
  if (weekOver) return { title: "A new week in Nets", body: "Fresh picks are waiting. Open Nets to see who's up." };
  return { title: "You're all caught up", body: "You hit your goal this week. Nice work keeping your people close." };
}
self.addEventListener("push", e => {
  e.waitUntil((async () => {
    let d = null;
    try { const c = await caches.open("nets-data"); const r = await c.match("reminder"); if (r) d = await r.json(); } catch (_) {}
    const m = buildMessage(d);
    try { if (self.navigator && self.navigator.setAppBadge && d && d.due) await self.navigator.setAppBadge(d.due.length); } catch (_) {}
    await self.registration.showNotification(m.title, { body: m.body, icon: "icon-192.png", badge: "icon-192.png", tag: "nets-daily", data: { url: "./" } });
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow("./");
  }));
});
