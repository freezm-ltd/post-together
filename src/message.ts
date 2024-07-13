import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { generateId } from "./utils"
import { BroadcastChannelListenTarget, BroadcastChannelSendTarget } from "./broadcastchannel"

export const IDENTIFIER = "post-together"

// message types
export type Message = { id: MessageId, type: MessageType, payload: MessagePayload, __identifier: typeof IDENTIFIER }
export function isMessageFromThisModule(data: any) { // process message only from this module(post-together)
    return data.__identifier === IDENTIFIER
}
export function isMessage(data: any) {
    return isMessagePrecursor(data) && isMessageFromThisModule(data) // check whether message should be processed
}
export type MessagePrecursor = Omit<Message, "__identifier">
export function isMessagePrecursor(data: any) {
    return data.id && data.type && data.payload
}
export type MessageCustomEvent = CustomEvent<Message>
export type MessageType = string
export type MessageId = string // unique identifier for multiple messages
export type MessagePayload = { data: MessagePayloadData, transfer?: MessagePayloadTransferable }
export type MessagePayloadData = any
export type MessagePayloadTransferable = Transferable[]
export function isMessageCustomEvent(e: Event): e is MessageCustomEvent {
    return "detail" in e && isMessage(e.detail)
}
export function unwrapMessage(e: Event) {
    if (isMessageCustomEvent(e)) {
        return e.detail
    }
}

// message handler type
export type MessageHandler = (data: MessagePayloadData, transfer?: MessagePayloadTransferable) => PromiseLike<MessagePayload> | MessagePayload
export type MessageEventListener = (e: MessageCustomEvent) => any
export type MessageHandlerWrapped = (e: MessageCustomEvent) => void

// message target types
export type MessengerOption = ServiceWorker | ServiceWorkerContainer | Worker | WorkerGlobalScope | Window | Client | BroadcastChannel | MessagePort
export type MessageSendable = ServiceWorker | Worker | Window | Client | BroadcastChannel | MessagePort // includes MessageCustomEventSource
export type MessageSendableGenerator = (e: Event) => MessageSendable
export type MessageListenable = ServiceWorkerContainer | Worker | WorkerGlobalScope | Window | BroadcastChannel | MessagePort
export function isMessageSendable(target: any): target is MessageSendable {
    return "postMessage" in target
}
export function isMessageSendableGenerator(target: any): target is MessageSendableGenerator {
    return typeof target === "function"
}
export function isMessageListenable(target: any): target is MessageListenable {
    return "addEventListener" in target
}

// wrap message listenTarget and dispatch custom message event as message type
export class MessageListenTarget extends EventTarget2 {
    protected listener = async (e: Event) => {
        const message = unwrapMessage(e)
        if (message && this.listenTypeMap.has(message.type)) this._listener(message);
    }
    protected _listener = async (message: Message) => {
        this.dispatch(message.type, message);
    }
    private activated = true
    constructor(
        readonly target: MessageListenable
    ) {
        super()
        this.activate()
    }

    protected listenTypeMap: Map<MessageType, number> = new Map()

    // get message and give response
    attach(type: MessageType, handler: MessageEventListener) {
        const count = (this.listenTypeMap.get(type) || 0) + 1
        this.listenTypeMap.set(type, count)
        this.listen(type, handler)
    }

    // remove listener
    detach(type: MessageType, handler: MessageEventListener) {
        const count = (this.listenTypeMap.get(type) || 0) - 1
        // no attached handler
        if (count < 0) throw new Error("MessageListenTargetDetachError: Cannot detach handler, attach counter is 0");

        if (count === 0) this.listenTypeMap.delete(type);
        else this.listenTypeMap.set(type, count - 1);
        this.remove(type, handler)
    }

    activate() {
        if (this.activated) return;
        this.target.addEventListener("message", this.listener)
        this.activated = true
    }

    deactivate() {
        if (!this.activated) return;
        this.target.removeEventListener("message", this.listener)
        this.activated = false
    }
}

// simply wrap postMessage
export class MessageSendTarget extends EventTarget2 {
    constructor(
        readonly target: MessageSendable | MessageSendableGenerator
    ) {
        super()
    }

    async send(messagePrecursor: MessagePrecursor, transfer?: Transferable[], event?: Event) {
        let target = this.target
        if (isMessageSendableGenerator(target)) {
            if (event) {
                target = target(event)
            } else {
                throw new Error("MessageSendTargetSendError: sendTarget cannot send message without argument 'event'. It depends on parent Messenger listenTarget's MessageEvent, which includes MessageEventSource")
            }
        }
        Object.assign(messagePrecursor, { __identifier: IDENTIFIER })
        await this._send(target, messagePrecursor as Message, transfer)
    }

    async _send(target: MessageSendable, message: Message, transfer?: Transferable[]) {
        target.postMessage(message, { transfer })
    }
}

// message send and listen 
export class Messenger {
    protected readonly sendTarget: MessageSendTarget
    protected readonly listenTarget: MessageListenTarget
    protected activated = true

    constructor(sendTo: MessageSendable | MessageSendableGenerator, listenFrom: MessageListenable) {
        if (sendTo === BroadcastChannel.prototype) {
            this.sendTarget = new BroadcastChannelSendTarget(sendTo)
        } else {
            this.sendTarget = new MessageSendTarget(sendTo)
        }

        if (listenFrom === BroadcastChannel.prototype) {
            this.listenTarget = new BroadcastChannelListenTarget(listenFrom)
        } else {
            this.listenTarget = new MessageListenTarget(listenFrom)
        }
    }

    // give message and get response
    async send(type: MessageType, payload: MessagePayload): Promise<MessagePayload> {
        return new Promise(async (resolve) => {
            const id = generateId()
            const messagePrecursor = { id, type, payload }
            this.listenTarget.listenOnceOnly(type, (e: MessageCustomEvent) => {
                resolve(e.detail.payload)
            }, (e: MessageCustomEvent) => {
                return e.detail.id === id && e.detail.type === type && this.activated
            })
            await this.sendTarget.send(messagePrecursor, payload.transfer)
        })
    }

    protected listenTargetWeakMap: WeakMap<MessageHandler, MessageHandlerWrapped> = new WeakMap()
    protected wrap(handler: MessageHandler) {
        return async (e: MessageCustomEvent) => {
            const { id, type, payload } = e.detail
            const response = await handler(payload.data, payload.transfer)
            const messagePrecursor = { id, type, payload: response }
            await this.sendTarget.send(messagePrecursor, response.transfer, e)
        }
    }

    // get message and give response
    attach(type: MessageType, handler: MessageHandler) {
        const wrapped = this.wrap(handler)
        this.listenTargetWeakMap.set(handler, wrapped)
        this.listenTarget.attach(type, wrapped)
    }

    // remove listenTarget
    detach(type: MessageType, handler: MessageHandler) {
        const wrapped = this.listenTargetWeakMap.get(handler)
        if (wrapped) {
            this.listenTarget.detach(type, wrapped)
        }
    }

    // re-activate message handling
    activate() {
        if (this.activated) return;
        this.listenTarget.activate()
        this.activated = true
    }

    // deactivate message handling
    deactivate() {
        if (!this.activated) return;
        this.listenTarget.deactivate()
        this.activated = false
    }
}