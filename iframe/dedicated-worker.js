import { MessageHub, MessengerFactory } from "./index.js"

console.log(MessageHub.instance)

const channel = new BroadcastChannel("test")
channel.onmessage = (e) => console.log("worker:", e)
MessengerFactory.new(channel).response("test", (data) => {
    console.log(`request received:`, data)
    return { data: { chat: `Hello, ${data.name}!! I touched your transferbles:`, transferables: data.transferables }, transfer: data.transferables }
})