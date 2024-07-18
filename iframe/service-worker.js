import { MessageHub } from "./index.js"

MessageHub.init()

self.addEventListener("install", () => {
    self.skipWaiting();
  });