import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { generateId } from "./utils"

// message types
export type Message = { id: MessageId, type: MessageType, payload: MessagePayload }
export type MessageEvent = CustomEvent<Message>
export type MessageType = string
export type MessageId = string // unique identifier for multiple messages
export type MessagePayload = { data: MessagePayloadData, transfer?: MessagePayloadTransferable }
export type MessagePayloadData = any
export type MessagePayloadTransferable = Transferable[]
function isMessageEvent(e: Event): e is MessageEvent {
    if ("data" in e) {
        const data = e.data as Message
        if (data.id && data.type && data.payload) return true
    }
    return false
}

// message handler type
export type MessageHandler = (data: MessagePayloadData, transfer?: MessagePayloadTransferable) => PromiseLike<MessagePayload> | MessagePayload
export type MessageHandlerWrapped = (e: MessageEvent) => void

// message target types
export type MessageTargetOption = ServiceWorker | ServiceWorkerContainer | Worker | WorkerGlobalScope | Window | Client | BroadcastChannel | MessagePort
export type MessageSendable = ServiceWorker | Worker | Window | Client | BroadcastChannel | MessagePort // includes MessageEventSource
export type MessageSendableLike = (e: Event) => MessageSendable
export type MessageListenable = ServiceWorkerContainer | Worker | WorkerGlobalScope | Window | BroadcastChannel | MessagePort
export function isMessageSendable(target: any): target is MessageSendable {
    return "postMessage" in target
}
export function isMessageSendableLike(target: any): target is MessageSendableLike {
    return typeof target === "function"
}
export function isMessageListenable(target: any): target is MessageListenable {
    return "addEventListener" in target
}

// wrap message listener and dispatch custom message event as message type
export class MessageListener extends EventTarget2 {
    private wrapper
    private activated = true
    constructor(
        readonly target: MessageListenable
    ) {
        super()
        this.wrapper = (e: Event) => {
            if (isMessageEvent(e)) this.dispatch(e.type, e);
        }
        this.activate()
    }

    activate() {
        if (this.activated) return;
        this.target.addEventListener("message", this.wrapper)
        this.activated = true
    }

    deactivate() {
        if (!this.activated) return;
        this.target.removeEventListener("message", this.wrapper)
        this.activated = false
    }
}

// simply wrap postMessage
export class MessageSender extends EventTarget2 {
    constructor(
        readonly target: MessageSendable | MessageSendableLike
    ) {
        super()
    }

    send(msg: Message, transfer?: Transferable[], event?: Event) {
        let target = this.target
        if (isMessageSendableLike(target)) {
            if (event) {
                target = target(event)
            } else {
                throw new Error("MessageSenderSendError: sender cannot send message without argument 'event'. It depends on parent MessageTarget listener's MessageEvent, which includes MessageEventSource")
            }
        }
        target.postMessage(msg, { transfer })
    }
}

// message target 
export class MessageTarget {
    protected readonly sender: MessageSender
    protected readonly listener: MessageListener
    private activated = true

    constructor(sendTo: MessageSendable | MessageSendableLike, listenFrom: MessageListenable) {
        this.sender = new MessageSender(sendTo)
        this.listener = new MessageListener(listenFrom)
    }

    // give message and get response
    async send(type: MessageType, payload: MessagePayload): Promise<MessagePayload> {
        return new Promise(resolve => {
            const id = generateId()
            const message = { id, type, payload }
            this.listener.listenOnceOnly(type, (e: MessageEvent) => {
                resolve(e.detail.payload)
            }, (e: MessageEvent) => {
                return e.detail.id === id && e.detail.type === type && this.activated
            })
            this.sender.send(message, payload.transfer)
        })
    }

    protected listenerWeakMap: WeakMap<MessageHandler, MessageHandlerWrapped> = new WeakMap()
    protected wrap(handler: MessageHandler) {
        return async (e: MessageEvent) => {
            const { id, type, payload } = e.detail
            const response = await handler(payload.data, payload.transfer)
            const message = { id, type, payload: response }
            this.sender.send(message, response.transfer, e)
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

    // re-activate message handling
    activate() {
        if (this.activated) return;
        this.listener.activate()
        this.activated = true
    }

    // deactivate message handling
    deactivate() {
        if (!this.activated) return;
        this.listener.deactivate()
        this.activated = false
    }
}