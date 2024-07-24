import { MessengerFactory } from "./index.js"

const messenger = MessengerFactory.new(new BroadcastChannel("test"))
messenger.response("test", (payload) => {
    return { payload: { chat: `Hello, ${payload.name}!! I touched your transferbles:`, transferables: payload.transferables }, transfer: payload.transferables }
})