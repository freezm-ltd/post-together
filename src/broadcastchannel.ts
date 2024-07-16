import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { IDENTIFIER, Message, MessageHandler, MessageId, Messenger, MessageType, unwrapMessage, MessageHandlerWrapped, MessagePayload, MessengerOption } from "./message";
import { MessengerFactory } from "src.ts";

export const MessageHubCrossOriginIframeURL = "https://freezm-ltd.github.io/post-together/iframe/"

const MessageStoreMessageType = `${IDENTIFIER}:__store`
const MessageFetchMessageType = `${IDENTIFIER}:__fetch`

export class BroadcastChannelMessenger extends Messenger {
    protected async _send(message: Message): Promise<void> {
        if (message.payload.transfer) {
            const { payload, ...metadata } = message
            // store message
            const response = await MessageHub.instance.store(message)
            if (response.data !== "success") throw new Error("BroadcastChannelMessengerSendError: MessageHub store failed.");
            // send metadata only (without payload which includes transferables)
            this._getSendTo().postMessage(metadata)
        } else {
            this._getSendTo().postMessage(message) // without payload, send normally
        }
    }

    protected wrapMessageHandler(type: MessageType, handler: MessageHandler): MessageHandlerWrapped {
        return async (e: Event) => {
            const request = unwrapMessage(e)
            if (request && request.type === type && request.__type === "request" && this.activated) { // type and activation check
                if (!request.payload) { // if metadata (no payload)
                    const { id } = request
                    // fetch request payload
                    const payload = await MessageHub.instance.fetch(id)
                    if (payload.data === "error") throw new Error("BroadcastChannelMessengerListenError: MessageHub fetch failed.");
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

// hub of messages, can be in window, dedicated worker, service worker(alternative of shared worker, which not usable in chrome mobile)
// forward messages to MessageHub(not in service worker) or store/fetch messages MessageHub(in service worker)
export abstract class AbstractMessageHub extends EventTarget2 {
    protected target: Messenger | undefined // message store/fetch request target
    private initNeed = true

    constructor() {
        super()
        this.init()
    }

    private async init() {
        await this._init()
        this.initNeed = false
        this.dispatch("done")
    }

    protected async _init() {

    }

    async store(message: Message): Promise<MessagePayload> {
        if (!this.initNeed) await this.waitFor("done");
        const response = await this.target!.request(MessageStoreMessageType, { data: message, transfer: message.payload.transfer })
        if (response && response.data === "success") {
            return response
        } else {
            throw new Error("MessageHubStoreError: MessagHub returned corrupted or unsuccessful response.");
        }
    }

    async fetch(id: MessageId): Promise<MessagePayload> {
        if (!this.initNeed) await this.waitFor("done");
        const response = await this.target!.request(MessageFetchMessageType, { data: id })
        if (response && response.data !== "error") {
            return response.data
        } else {
            throw new Error("MessageHubFetchError: MessagHub returned corrupted or unsuccessful response.");
        }
    }

    // listen request
    addListen(listenFrom: MessengerOption) {
        const listenTarget = MessengerFactory.new(listenFrom)
        // store message
        listenTarget.response(MessageStoreMessageType, async (message: Message) => {
            return await this.store(message)
        })
        // fetch message
        listenTarget.response(MessageFetchMessageType, async (id: MessageId) => {
            return await this.fetch(id)
        })
    }
}

class ServiceWorkerMessageHub extends AbstractMessageHub {
    protected storage: Map<MessageId, MessagePayload> = new Map()

    // add listen; requests from windows -> serviceworker
    async _init() {
        this.addListen(self as ServiceWorkerGlobalScope)
    }

    // service worker is MessageHub storage itself
    async store(message: Message) {
        this.storage.set(message.id, message.payload)
        return { data: "success" }
    }

    async fetch(id: MessageId) {
        let payload = this.storage.get(id)
        if (!payload) payload = { data: "error" };
        return payload
    }
}

class DedicatedWorkerMessageHub extends AbstractMessageHub {
    // worker -> parent window
    async _init() {
        this.target = MessengerFactory.new(self as DedicatedWorkerGlobalScope)
    }
}

class WindowMessageHub extends AbstractMessageHub {
    // worker/window -> window -> iframe/serviceworker -> window -> worker/window
    async _init() {
        const serviceWorkerContainer = globalThis.navigator.serviceWorker
        // window -> service worker(same-origin)
        if (serviceWorkerContainer.controller) {
            this.target = MessengerFactory.new(serviceWorkerContainer)
        } 
        // window -> iframe(cross-origin) (-> service worker(cross-origin))
        else {
            let iframeload = false
            const _this = this
            const iframe = document.createElement("iframe")
            iframe.onload = () => {
                const iframeWindow = iframe.contentWindow!
                _this.target = MessengerFactory.new(iframeWindow)
                iframeload = true
                _this.dispatch("iframeload")
            }
            iframe.setAttribute("src", MessageHubCrossOriginIframeURL)
            iframe.style.display = "none"
            document.body.appendChild(iframe)
            if (!iframeload) await this.waitFor("iframeload");
        }
        // add forward requests from other window -> this window
        this.addListen(window)
        // worker <--> window; inject listener code to prototype, to backward message to worker
        // TODO: Worker prototype injection needed?
        // ... this.addForward(workers)
    }
}

// singleton
export class MessageHub extends AbstractMessageHub {
    private static _instance: MessageHub
    hub: AbstractMessageHub
    
    private constructor() {
        super()
        switch (globalThis.constructor) {
            case globalThis.ServiceWorkerGlobalScope:
                this.hub = new ServiceWorkerMessageHub()
                break
            case globalThis.Window:
                this.hub = new WindowMessageHub()
                break
            case globalThis.DedicatedWorkerGlobalScope:
                this.hub = new DedicatedWorkerMessageHub()
                break
            default:
                throw new Error("MessageHubConstructError: Cannot create MessageHub instance in this scope.")
        }
    }
    
    static init() {
        if (!MessageHub._instance) MessageHub._instance = new MessageHub();
    }

    static get instance() {
        this.init()
        return MessageHub._instance
    }
    
    async store(message: Message): Promise<MessagePayload> {
        return this.hub.store(message)
    }

    async fetch(id: MessageId): Promise<MessagePayload> {
        return this.hub.fetch(id)
    }
}