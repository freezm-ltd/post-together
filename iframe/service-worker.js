import { initMessageHub } from "./index.js"

initMessageHub()

self.addEventListener("install", () => {
    self.skipWaiting();
  });