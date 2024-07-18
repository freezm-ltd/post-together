import { MessengerFactory } from "./index.js"

const channel = new BroadcastChannel("test")
channel.onmessage = (e) => console.log("worker:", e)
const messenger = MessengerFactory.new(new BroadcastChannel("test"))
messenger.response("test", (data) => {
    console.log(`request received:`, data)
    return { data: { chat: `Hello, ${data.name}!! I touched your transferbles:`, transferables: data.transferables }, transfer: data.transferables }
})