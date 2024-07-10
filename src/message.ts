import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { generateId } from "./utils"

// message types
export type Message = { id: MessageId, type: MessageType, payload: MessagePayload }
export type MessageEvent = CustomEvent<Message>
export type MessageType = string
export type MessageId = string // unique identifier for multiple messages
export type MessagePayload = any
function isMessageEvent(e: Event): e is MessageEvent {
    if ("data" in e) {
        const data = e.data as Message
        if (data.id && data.type && data.payload) return true
    }
    return false
}

// message handler type
export type MessageHandler = (payload: MessagePayload) => PromiseLike<MessagePayload> | MessagePayload
export type MessageHandlerWrapper = (e: MessageEvent) => void

// message target types
export type MessagePostable = ServiceWorker | Worker | Client | BroadcastChannel | MessagePort
export type MessageListenable = ServiceWorkerContainer | Worker | BroadcastChannel | MessagePort
export type SupportsTransferable = ServiceWorker | ServiceWorkerContainer | Worker | Client | MessagePort
function isMessagePostable(target: any): target is MessagePostable {
    return "postMessage" in target
}
function isMessageListenable(target: any): target is MessageListenable {
    return "addEventListener" in target
}

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

export class MessageTarget {
    private readonly poster: MessagePoster
    private readonly listener: MessageListener
    constructor(
        target: MessagePostable & MessageListenable,
    )
    constructor(
        post: MessagePostable,
        listen: MessageListenable,
    )
    constructor(
        postOrTarget: MessagePostable | MessagePostable & MessageListenable,
        listen?: MessageListenable,
    ) {
        this.poster = new MessagePoster(postOrTarget)
        if (listen) {
            this.listener = new MessageListener(listen)
        } else if (isMessageListenable(postOrTarget)) {
            this.listener = new MessageListener(postOrTarget)
        } else {
            throw new Error("Cannot initialize MessageTarget: listener not found or not supported")
        }
    }

    // give message and get response
    async send(type: MessageType, payload: MessagePayload, id = generateId()): Promise<MessagePayload> {
        return new Promise(resolve => {
            const message = { id, type, payload }
            this.listener.listenOnceOnly(type, (e: MessageEvent) => {
                resolve(e.detail.payload)
            }, (e: MessageEvent) => {
                return e.detail.id === id && e.detail.type === type
            })
            this.poster.target.postMessage(message)
        })
    }

    private listenerWeakMap: WeakMap<MessageHandler, MessageHandlerWrapper> = new WeakMap()
    // get message and give response
    attach(type: MessageType, handler: MessageHandler) {
        const wrapper = (e: MessageEvent) => {
            
        }
        this.listenerWeakMap.set(handler, wrapper)
        this.listener.listen(type, wrapper)
    }

    // remove listener
    detach(type: MessageType, handler: MessageHandler) {
        const wrapper = this.listenerWeakMap.get(handler)
        if (wrapper) this.listener.remove(type, wrapper);
    }
}