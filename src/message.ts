import { generateId } from "./utils"

export const IDENTIFIER = "post-together"

// message types
export type Message = { id: MessageId, type: MessageType, payload: MessagePayload, __type: MessageInternalType, __identifier: typeof IDENTIFIER }
export function isMessage(data: any) {
    return data.id && data.type && data.payload && data.__identifier === IDENTIFIER // check whether message should be processed
}
export type MessageCustomEvent = MessageEvent<Message>
export type MessageType = string
export type MessageInternalType = "request" | "response"
export type MessageId = string // unique identifier for multiple messages
export type MessagePayload = { data: MessagePayloadData, transfer?: MessagePayloadTransferable }
export type MessagePayloadData = any
export type MessagePayloadTransferable = Transferable[]
export function isMessageCustomEvent(e: Event): e is MessageCustomEvent {
    return "data" in e && isMessage(e.data)
}
export function unwrapMessage(e: Event) {
    if (isMessageCustomEvent(e)) {
        return e.data
    }
}

// message handler type
export type MessageHandler = (data: MessagePayloadData, transfer?: MessagePayloadTransferable) => PromiseLike<MessagePayload> | MessagePayload
export type MessageEventListener = (e: MessageCustomEvent) => any
export type MessageHandlerWrapped = (e: Event) => void

// message target types
export type MessengerOption = ServiceWorker | ServiceWorkerContainer | ServiceWorkerGlobalScope | Worker | DedicatedWorkerGlobalScope | Window | Client | BroadcastChannel | MessagePort
export type MessageSendable = ServiceWorker | Worker | DedicatedWorkerGlobalScope | Window | Client | BroadcastChannel | MessagePort
export type MessageListenable = ServiceWorkerContainer | ServiceWorkerGlobalScope | Worker | DedicatedWorkerGlobalScope | Window | BroadcastChannel | MessagePort
export function isMessageSendable(target: any): target is MessageSendable {
    return "postMessage" in target
}
export function isMessageListenable(target: any): target is MessageListenable {
    return "addEventListener" in target
}

// message send and listen 
export class Messenger {
    //protected readonly sendTarget: MessageSendTarget
    //protected readonly listenTarget: MessageListenTarget
    protected activated = true

    constructor(
        readonly listenFrom: MessageListenable,
        readonly sendTo?: MessageSendable, // if not specified, independent request is blocked, can do only responsing
    ) { }

    // create request message from type and payload
    protected createRequest(type: MessageType, payload: MessagePayload): Message {
        const id = generateId()
        return { id, type, payload, __type: "request", __identifier: IDENTIFIER }
    }

    // create response message from request message and payload
    protected createResponse(request: Message, payload: MessagePayload): Message {
        const { id, type, __identifier } = request
        return { id, type, payload, __type: "response", __identifier }
    }

    // listen for response
    protected responseCallback(request: Message, callback: (responsePayload: MessagePayload) => any) {
        const listener = (e: Event) => {
            const response = unwrapMessage(e)
            if (response && response.id === request.id && response.type === request.type && response.__type === "response") {
                this.listenFrom.removeEventListener("message", listener)
                callback(response.payload)
            }
        }
        this.listenFrom.addEventListener("message", listener)
    }

    protected _getSendTo(event?: Event): MessageSendable {
        let sendTo = this.sendTo
        if (event) {
            const source = (event as ExtendableMessageEvent).source
            if (source) sendTo = source
        }
        return sendTo!
    }

    // send message
    protected async _send(message: Message, event?: Event) {
        this._getSendTo(event).postMessage(message, { transfer: message.payload.transfer }) // send request
    }

    // send message and get response
    request(type: MessageType, payload: MessagePayload): Promise<MessagePayload> {
        return new Promise(async (resolve) => {
            const message = this.createRequest(type, payload)
            this.responseCallback(message, resolve) // listen for response
            await this._send(message) // send request
        })
    }

    // wrap message handler (request -> response)
    protected listenTargetWeakMap: WeakMap<MessageHandler, MessageHandlerWrapped> = new WeakMap()
    protected wrapMessageHandler(type: MessageType, handler: MessageHandler): MessageHandlerWrapped {
        return async (e: Event) => {
            const request = unwrapMessage(e)
            if (request && request.type === type && request.__type === "request" && this.activated) { // type and activation check
                const payload = await handler(request.payload, request.payload.transfer)
                const response = this.createResponse(request, payload)
                await this._send(response, e)
            }
        }
    }

    // get request and give response
    response(type: MessageType, handler: MessageHandler) {
        const wrapped = this.wrapMessageHandler(type, handler)
        this.listenTargetWeakMap.set(handler, wrapped)
        this.listenFrom.addEventListener("message", wrapped)
    }

    // remove response handler
    deresponse(handler: MessageHandler) {
        const wrapped = this.listenTargetWeakMap.get(handler)
        if (wrapped) this.listenFrom.removeEventListener("message", wrapped);
    }

    // re-activate message handling
    activate() {
        if (this.activated) return;
        this.activated = true
    }

    // deactivate message handling
    deactivate() {
        if (!this.activated) return;
        this.activated = false
    }
}