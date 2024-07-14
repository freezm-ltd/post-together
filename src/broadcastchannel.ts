import { IDENTIFIER, Message, MessageHandler, MessageId, Messenger, MessageType, MessageSendable, unwrapMessage, MessageHandlerWrapped, MessagePayload } from "./message";
import { MessengerFactory } from "src.ts";

const MessageHubCrossOriginIframeURL = ""

const MessageStoreMessageType = `${IDENTIFIER}:__store`
const MessageFetchMessageType = `${IDENTIFIER}:__fetch`

export class BroadcastChannelMessenger extends Messenger {
    protected async _send(message: Message): Promise<void> {
        if (message.payload.transfer) {
            const { payload, ...metadata } = message
            // store message
            await MessageHub.store(message)
            // send metadata only (without payload which includes transferables)
            this._getSendTo().postMessage(metadata)
        } else {
            this._getSendTo().postMessage(message) // without payload, send normally
        }
    }

    protected wrapMessageHandler(type: MessageType, handler: MessageHandler): MessageHandlerWrapped {
        return async (e: Event) => {
            const request = unwrapMessage(e)
            if (request && request.type === type && this.activated) { // type and activation check
                if (!request.payload) { // if metadata (no payload)
                    const { id, type } = request
                    // fetch request payload
                    const payload = await MessageHub.fetch(id)
                    // payload inject to message
                    request.payload = payload
                }
                const payload = await handler(request.payload, request.payload.transfer)
                const response = this.createResponse(request, payload)
                await this._send(response)
            }
        }
    }
}

type MessageBackwardTarget = Worker | Window

export class MessageForwarder {
    // backwardTarget -> request -> forwardTarget -> response -> backwardTarget(ExtendableMessageEvent.source)
    readonly types: Set<MessageType> = new Set()
    private listenerWeakMap: WeakMap<MessageBackwardTarget, EventListener> = new WeakMap()

    constructor(
        readonly forwardTo: MessageSendable
    ) { }

    protected _listener() {
        return async (e: Event) => {
            const source = (e as ExtendableMessageEvent).source
            const request = unwrapMessage(e)
            if (source && request && this.types.has(request.type)) {
                // listen for response
                const responseListener = (e: Event) => {
                    const response = unwrapMessage(e)
                    if (response && response.id === request.id && response.type === request.type) {
                        globalThis.removeEventListener("message", responseListener)
                        // backward response
                        // TODO: if e.source is self?
                        source.postMessage(response, { transfer: response.payload.transfer })
                    }
                }
                globalThis.addEventListener("message", responseListener)
                // forward request
                this.forwardTo.postMessage(request, { transfer: request.payload.transfer })
            }
        }
    }

    add(backward: MessageBackwardTarget) {
        if (this.listenerWeakMap.has(backward)) return;
        const listener = this._listener()
        globalThis.addEventListener("message", listener)
        this.listenerWeakMap.set(backward, listener)
    }

    remove(backward: MessageBackwardTarget) {
        if (!this.listenerWeakMap.has(backward)) return;
        globalThis.removeEventListener("message", this.listenerWeakMap.get(backward)!)
    }
}

// hub of messages, can be in window, dedicated worker, service worker(alternative of shared worker, which not usable in chrome mobile)
// forward messages to MessageHub(not in service worker) or store/fetch messages MessageHub(in service worker)
export class MessageHub {
    private static instance: MessageHub | undefined
    private storage: Map<MessageId, Message> = new Map()
    private target?: Messenger
    private forwarder: MessageForwarder | undefined

    static async store(message: Message) {
        throw new Error("MessageHubStoreError: MessagHub returned corrupted or unsuccessful response.");
    }

    static async fetch(id: MessageId): MessagePayload {
        throw new Error("MessageHubFetchError: MessagHub returned corrupted or unsuccessful response.");
    }

    // singleton
    private constructor() {
        switch (globalThis.constructor) {
            case ServiceWorkerGlobalScope:
                this._initFromServiceWorker()
                break
            case Window:
                this._initFromWindow()
                break
            case DedicatedWorkerGlobalScope:
                this._initFromDedicatedWorker()
                break
        }

        if (this.forwarder) { // add forward target types
            this.forwarder.types.add(MessageStoreMessageType)
            this.forwarder.types.add(MessageFetchMessageType)
        }
    }

    // service worker is MessageHub itself
    private _initFromServiceWorker() {
        this.target = MessengerFactory.new(self as ServiceWorkerGlobalScope)
        // store message
        this.target.response(MessageStoreMessageType, (message: Message) => {
            this.storage.set(message.id, message)
            return { data: "success" }
        })
        // fetch message
        this.target.response(MessageFetchMessageType, (id: MessageId) => {
            const message = this.storage.get(id)
            if (message) return { data: message, transfer: message.payload.transfer };
            return { data: "error" }
        })
    }

    // worker -> window -> iframe and/or service worker -> window -> worker
    private _initFromWindow() {
        const serviceWorkerContainer = globalThis.navigator.serviceWorker
        if (serviceWorkerContainer.controller) { // window -> service worker(same-origin)
            this.target = MessengerFactory.new(serviceWorkerContainer)
            this.forwarder = new MessageForwarder(serviceWorkerContainer.controller)
        } else { // window -> iframe(cross-origin)
            const iframe = document.createElement("iframe")
            iframe.setAttribute("src", MessageHubCrossOriginIframeURL)
            iframe.style.display = "none"
            document.appendChild(iframe)
            const iframeWindow = iframe.contentWindow!
            this.target = MessengerFactory.new(iframeWindow)
            this.forwarder = new MessageForwarder(iframeWindow)
        }
        // worker <--> window; inject listener code to prototype, to backward message to worker
        // TODO: Worker prototype injection needed?
    }

    // worker -> parent window
    private _initFromDedicatedWorker() {
        this.target = MessengerFactory.new(self as DedicatedWorkerGlobalScope)
    }

    public static init() {
        //if (globalThis !== ServiceWorkerGlobalScope.prototype) throw new Error("MessageHubInitError: MessageHub.init() must be called from ServiceWorkerGlobalScope");
        if (!MessageHub.instance) MessageHub.instance = new MessageHub();
    }
}

export function enableMessageHub() {
    //if (globalThis !== ServiceWorkerGlobalScope.prototype) throw new Error("enableMessageHubError: enableMessageHub() must be called from ServiceWorkerGlobalScope");
    MessageHub.init()
}