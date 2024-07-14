import { IDENTIFIER, Message, MessageCustomEvent, MessageHandler, MessageId, MessagePayload, Messenger, MessageType, MessageSendTarget, MessageListenTarget, MessageSendable, unwrapMessage, MessageListenable, MessengerOption } from "./message";
import { generateId } from "./utils";
import { MessengerFactory } from "src.ts";

const MessageHubCrossOriginIframeURL = ""

const MessageStoreMessageType = `${IDENTIFIER}:__store`
const MessageFetchMessageType = `${IDENTIFIER}:__fetch`

export class BroadcastChannelListenTarget extends MessageListenTarget {
    protected _listener = async (message: Message) => {
        if (!message.payload) { // no payload, fetch payload from MessageHub and inject to message
            const { id, type } = message
            // fetch message
            const fetchResult = await MessageHub.send(MessageFetchMessageType, { data: { id, type } })
            if (fetchResult.data === "error") throw new Error("BroadcastChannelListenTargetListenError: MessagHub returned corrupted or unsuccessful response.");

            message.payload = fetchResult.data.payload
        }
        this.dispatch(message.type, message);
    }
}

export class BroadcastChannelSendTarget extends MessageSendTarget {
    async _send(target: MessageSendable, message: Message, transfer?: Transferable[]) {
        if (transfer) {
            const { payload, ...metadata } = message
            // store message
            const storeResult = await MessageHub.send(MessageStoreMessageType, { data: message, transfer: payload.transfer })
            if (storeResult.data !== "success") throw new Error("BroadcastChannelSendTargetSendError: MessagHub returned corrupted or unsuccessful response.");

            target.postMessage(metadata) // send metadata only (without payload which includes transferables)
        } else {
            target.postMessage(message) // without payload, send normally
        }
    }
}

type MessageBackwardTarget = Worker | Window

export class MessageForwarder {
    // backwardTarget -> request -> forwardTarget -> response -> backwardTarget(ExtendableMessageEvent.source)
    readonly forward: Messenger
    readonly types: Set<MessageType> = new Set()
    private listenerWeakMap: WeakMap<MessageBackwardTarget, EventListener> = new WeakMap()

    constructor(forwardTarget: MessageSendable) {
        this.forward = MessengerFactory.new(forwardTarget)
    }

    protected createListener() {
        return async (e: Event) => {
            const source = (e as ExtendableMessageEvent).source
            const message = unwrapMessage(e)
            if (source && message && this.types.has(message.type)) {
                const { id, type, __identifier } = message
                // forward message and get response
                const responsePayload = await this.forward.send(message.type, message.payload)
                const response = { id, type, payload: responsePayload, __identifier }
                // backward message
                source.postMessage(response, { transfer: response.payload.transfer })
            }
        }
    }

    addListen(backward: MessageBackwardTarget) {
        if (this.listenerWeakMap.has(backward)) return;
        const listener = this.createListener()
        backward.addEventListener("message", listener)
        this.listenerWeakMap.set(backward, listener)
    }

    removeListen(backward: MessageBackwardTarget) {
        if (!this.listenerWeakMap.has(backward)) return;
        backward.removeEventListener("message", this.listenerWeakMap.get(backward)!)
    }
}

// hub of messages, can be in window, dedicated worker, service worker(alternative of shared worker, which not usable in chrome mobile)
// forward messages to MessageHub(not in service worker) or store/fetch messages MessageHub(in service worker)
export class MessageHub {
    private static instance: MessageHub | undefined
    private map: Map<MessageId, Message> = new Map()
    private target?: Messenger
    private forwarder: MessageForwarder | undefined

    // singleton
    private constructor() {
        switch (globalThis.constructor) {
            case ServiceWorkerGlobalScope:
                this._initFromServiceWorker()
                break
            case Window:
                this._initFromWindow()
                break
            case WorkerGlobalScope:
                this._initFromDedicatedWorker()
                break
        }

        if (this.forwarder) { // add forward target types
            this.forwarder.types.add(MessageStoreMessageType)
            this.forwarder.types.add(MessageFetchMessageType)
        }
    }

    // service worker is MessageHub self
    private _initFromServiceWorker() {
        this.target = MessengerFactory.new(globalThis as ServiceWorkerGlobalScope)
        // store message
        this.target.attach(MessageStoreMessageType, (data) => {
            const message = data as Message
            this.map.set(message.id, message)
            return { data: "success" }
        })
        // fetch message
        this.target.attach(MessageFetchMessageType, (data) => {
            const { id } = data
            const message = this.map.get(id)
            if (message) {
                return { data: message, transfer: message.payload.transfer }
            }
            return { data: "error" }
        })
    }

    // worker -> window -> iframe and/or service worker -> window -> worker
    private _initFromWindow() {
        const serviceWorkerContainer = globalThis.navigator.serviceWorker
        if (serviceWorkerContainer.controller) { // window -> service worker(same-origin)
            this.forwarder = new MessageForwarder(serviceWorkerContainer.controller)
        } else { // window -> iframe(cross-origin)
            const iframe = document.createElement("iframe")
            iframe.setAttribute("src", MessageHubCrossOriginIframeURL)
            this.forwarder = new MessageForwarder(iframe.contentWindow!)
        }
        // worker <--> window; inject listener code to prototype, to backward message to worker
        // TODO: Worker prototype injection needed?
    }

    // worker -> parent window
    private _initFromDedicatedWorker() {
        
    }

    public static init() {
        //if (globalThis !== ServiceWorkerGlobalScope.prototype) throw new Error("MessageHubInitError: MessageHub.init() must be called from ServiceWorkerGlobalScope");
        if (!MessageHub.instance) MessageHub.instance = new MessageHub();
    }

    async send() {

    }
}

export function enableMessageHub() {
    //if (globalThis !== ServiceWorkerGlobalScope.prototype) throw new Error("enableMessageHubError: enableMessageHub() must be called from ServiceWorkerGlobalScope");
    MessageHub.init()
}