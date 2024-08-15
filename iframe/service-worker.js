import { MessageHub } from "./index.js"

try {
  self.addEventListener("install", () => {
    self.skipWaiting();
  });
  MessageHub.init()
} catch (e) {
  console.log(e)
}