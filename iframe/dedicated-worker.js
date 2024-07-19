import { MessengerFactory } from "./index.js"

const messenger = MessengerFactory.new(new BroadcastChannel("test"))
messenger.response("test", (data, transfer) => {
    return { data: { chat: `Hello, ${data.name}!! I touched your transferbles:`, transferables: data.transferables }, transfer: data.transferables }
})