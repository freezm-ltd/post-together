import { MessageHub } from "./index.js"

console.log(MessageHub.instance)

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("message", console.log)