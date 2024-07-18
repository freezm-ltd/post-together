import "./index.js"

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("message", console.log)