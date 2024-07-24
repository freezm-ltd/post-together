import { isIframe } from "./broadcastchannel"
import { generateId } from "./utils"

export const IDENTIFIER = "post-together"

// message types
export type Message<T> = { id: MessageId, type: MessageType, payload: T, transfer?: Transferable[], __type: MessageInternalType, __identifier: typeof IDENTIFIER }
export function isMessage(data: any) {
    return data.id && data.type && data.__identifier === IDENTIFIER // check whether message should be processed
}
export type MessageCustomEvent<T> = MessageEvent<Message<T>>
export type MessageType = string
export type MessageInternalType = "request" | "response"
export type MessageId = string // unique identifier for multiple messages
export function isMessageCustomEvent<T>(e: Event): e is MessageCustomEvent<T> {
    return "data" in e && isMessage(e.data)
}
export function unwrapMessage(e: Event) {
    if (isMessageCustomEvent(e)) {
        return e.data
    }
}

// message handler type
export type MessageHandlerResult<T> = T | { payload: T, transfer: Transferable[] }
export type MessageHandler<T, R> = (payload: T) => PromiseLike<MessageHandlerResult<R>> | MessageHandlerResult<R>
export type MessageEventListener<T> = (e: MessageCustomEvent<T>) => any
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
    protected createRequest<T>(type: MessageType, payload: T, transfer?: Transferable[]): Message<T> {
        const id = generateId()
        return { id, type, payload, transfer, __type: "request", __identifier: IDENTIFIER }
    }

    // create response message from request message and payload
    protected createResponse<T, R>(request: Message<T>, payload: R, transfer?: Transferable[]): Message<R> {
        const { id, type, __identifier } = request
        return { id, type, payload, __type: "response", __identifier }
    }

    // inject informations to message
    protected async _inject<T>(message: Message<T>) {
        // nothing
    }

    // listen for response
    protected responseCallback<T, R>(request: Message<T>, callback: (payload: R) => void): () => void {
        const listener = async (e: Event) => {
            const response = unwrapMessage(e) // unwrap and check response
            if (response && response.id === request.id && response.type === request.type && response.__type === "response") {
                await this._inject(response); // inject if need
                this.listenFrom.removeEventListener("message", listener)
                callback(response.payload as R)
            }
        }
        this.listenFrom.addEventListener("message", listener)
        return () => this.listenFrom.removeEventListener("message", listener) // for early reject, remove listener only
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
    protected async _send<T>(message: Message<T>, event?: Event) {
        const option = { transfer: message.transfer }
        if (isIframe()) Object.assign(option, { targetOrigin: "*" });
        this._getSendTo(event).postMessage(message, option) // send request
    }

    // send message and get response
    request<T, R>(type: MessageType, payload: T, transfer?: Transferable[], timeout: number = 5000): Promise<R> {
        return new Promise(async (resolve, reject) => {
            const message = this.createRequest<T>(type, payload, transfer)
            const rejector = this.responseCallback<T, R>(message, resolve) // listen for response
            await this._send(message) // send request
            setTimeout(() => {
                rejector() // remove event listener
                reject(`MessengerRequestTimeoutError: request timeout reached: ${timeout}ms`)
            }, timeout); // set timeout
        })
    }

    // wrap message handler (request -> response)
    protected listenerWeakMap: WeakMap<MessageHandler<any, any>, MessageHandlerWrapped> = new WeakMap()
    protected listenerSet: Set<MessageHandler<any, any>> = new Set()
    protected wrapMessageHandler<T, R>(type: MessageType, handler: MessageHandler<T, R>): MessageHandlerWrapped {
        return async (e: Event) => {
            const request = unwrapMessage(e)
            if (request && request.type === type && request.__type === "request" && this.activated) { // type and activation check
                await this._inject(request); // inject if need
                const result = await handler(request.payload as T) as MessageHandlerResult<R>
                let response: Message<R>
                if (result instanceof Object && "payload" in result && "transfer" in result) {
                    const { payload, transfer } = result // parse if transfer exists
                    response = this.createResponse(request, payload, transfer)
                } else {
                    response = this.createResponse(request, result)
                }
                await this._send(response, e)
            }
        }
    }

    // get request and give response
    response<T, R>(type: MessageType, handler: MessageHandler<T, R>) {
        if (this.listenerSet.has(handler)) throw new Error("MessengerAddEventListenerError: this message handler already attached");
        const wrapped = this.wrapMessageHandler(type, handler)
        this.listenerWeakMap.set(handler, wrapped)
        this.listenerSet.add(handler)
        this.listenFrom.addEventListener("message", wrapped)
    }

    // remove response handler
    deresponse(handler?: MessageHandler<any, any>) {
        const iterator = handler ? [handler] : this.listenerSet
        for (let handler of iterator) {
            const wrapped = this.listenerWeakMap.get(handler)
            if (wrapped) {
                this.listenFrom.removeEventListener("message", wrapped);
                this.listenerWeakMap.delete(handler)
            }
            this.listenerSet.delete(handler)
        }
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