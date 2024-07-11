import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { generateId } from "./utils"

// message types
export type Message = { id: MessageId, type: MessageType, payload: MessagePayload }
export type MessageEvent = CustomEvent<Message>
export type MessageType = string
export type MessageId = string // unique identifier for multiple messages
export type MessagePayload = any
export type MessagePayloadTranferable = [MessagePayload, Transferable[]] | [MessagePayload]
function isMessageEvent(e: Event): e is MessageEvent {
    if ("data" in e) {
        const data = e.data as Message
        if (data.id && data.type && data.payload) return true
    }
    return false
}

// message handler type
export type MessageHandler = (payload: MessagePayload) => PromiseLike<MessagePayload> | MessagePayload
export type MessageHandlerTransferable = (payload: MessagePayload) => PromiseLike<MessagePayloadTranferable> | MessagePayloadTranferable
export type MessageHandlerWrapped = (e: MessageEvent) => void

// message target types
export type MessagePostable = ServiceWorker | Worker | Client | BroadcastChannel | MessagePort
export type MessageListenable = ServiceWorkerContainer | Worker | BroadcastChannel | MessagePort
export type SupportsTransferable = ServiceWorker | ServiceWorkerContainer | Worker | Client | MessagePort
export function isMessagePostable(target: any): target is MessagePostable {
    return "postMessage" in target
}
export function isMessageListenable(target: any): target is MessageListenable {
    return "addEventListener" in target
}

// wrap message listener and dispatch custom message event as message type
export class MessageListener extends EventTarget2 {
    constructor(
        readonly target: MessageListenable
    ) {
        super()
        this.target.addEventListener("message", (e) => {
            if (isMessageEvent(e)) this.dispatch(e.type, e);
        })
    }
}

// simply wrap postMessage, without transferable
export class MessagePoster extends EventTarget2 {
    constructor(
        readonly target: MessagePostable
    ) {
        super()
    }

    send(msg: Message) {
        this.target.postMessage(msg)
    }
}

// simply wrap postMessage, with transferable
export class MessagePosterTransferable extends MessagePoster {
    constructor(
        readonly target: MessagePostable & SupportsTransferable
    ) {
        super(target)
    }

    send(msg: Message, transfer?: Transferable[]) {
        this.target.postMessage(msg, { transfer })
    }
}

// message target pair type
export type MessageTargetPrecursorPair = { post: MessagePostable, listen: MessageListenable }
export function isPrecursorPairEqual(pair1: MessageTargetPrecursorPair, pair2: MessageTargetPrecursorPair) {
    return pair1.listen === pair2.listen && pair1.post && pair2.post
}

// message target without transferable
export class MessageTarget {
    constructor(
        protected readonly poster: MessagePoster,
        protected readonly listener: MessageListener
    ) { }

    // give message and get response
    async send(type: MessageType, payload: MessagePayload): Promise<MessagePayload> {
        return new Promise(resolve => {
            const id = generateId()
            const message = { id, type, payload }
            this.listener.listenOnceOnly(type, (e: MessageEvent) => {
                resolve(e.detail.payload)
            }, (e: MessageEvent) => {
                return e.detail.id === id && e.detail.type === type
            })
            this.poster.send(message)
        })
    }

    protected listenerWeakMap: WeakMap<MessageHandler, MessageHandlerWrapped> = new WeakMap()
    protected wrap(handler: MessageHandler) {
        return async (e: MessageEvent) => {
            const { id, type, payload } = e.detail
            const message = { id, type, payload: await handler(payload) }
            this.poster.send(message)
        }
    }

    // get message and give response
    attach(type: MessageType, handler: MessageHandler) {
        const wrapped = this.wrap(handler)
        this.listenerWeakMap.set(handler, wrapped)
        this.listener.listen(type, wrapped)
    }

    // remove listener
    detach(type: MessageType, handler: MessageHandler) {
        const wrapped = this.listenerWeakMap.get(handler)
        if (wrapped) {
            this.listener.remove(type, wrapped)
            this.listenerWeakMap.delete(handler)
        }
    }
}

// message target with transferable; use when poster must send message with transferable
export class MessageTargetTransferable extends MessageTarget {
    constructor(
        protected readonly poster: MessagePosterTransferable,
        protected readonly listener: MessageListener
    ) {
        super(poster, listener)
    }

    async send(type: MessageType, payload: MessagePayloadTranferable): Promise<MessagePayload> {
        return new Promise(resolve => {
            const id = generateId()
            const message = { id, type, payload: payload[0] }
            this.listener.listenOnceOnly(type, (e: MessageEvent) => {
                resolve(e.detail.payload)
            }, (e: MessageEvent) => {
                return e.detail.id === id && e.detail.type === type
            })
            this.poster.send(message, payload[1])
        })
    }

    protected wrap(handler: MessageHandlerTransferable) {
        return async (e: MessageEvent) => {
            const { id, type, payload } = e.detail
            const [responsePayload, responseTranferable] = await handler(payload)
            const message = { id, type, payload: responsePayload }
            this.poster.send(message, responseTranferable)
        }
    }
}