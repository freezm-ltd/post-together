import { MessageHub } from "./index.js"

self.addEventListener("install", () => {
  self.skipWaiting();
});

MessageHub.init()