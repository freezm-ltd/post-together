import { MessageHub } from "./index.js"

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

self.onfetch = (e) => {
  if (e.request.url.endsWith("dbg")) {
    try {
      MessageHub.init()
    } catch (error) {
      return new Response(`${error}`)
    }
  }
}