import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { IDENTIFIER, Message, MessageHandler, MessageId, Messenger, MessageType, unwrapMessage, MessageHandlerWrapped, MessagePayload, MessengerOption } from "./message";
import { MessengerFactory } from "src.ts";
import { CrossOriginWindowMessenger } from "./crossoriginwindow";

export const MessageHubCrossOriginIframeURL = "https://freezm-ltd.github.io/post-together/iframe/"
const MessageHubSameOriginServiceWorkerBroadcastChannelName = `${IDENTIFIER}:bc:sw.controllerchange`

const MessageStoreMessageType = `${IDENTIFIER}:__store`
const MessageFetchMessageType = `${IDENTIFIER}:__fetch`

export class BroadcastChannelMessenger extends Messenger {
    protected async _injectPayload(metadata: Message) {
        const { id } = metadata
        // fetch message payload
        const payload = await MessageHub.instance.fetch(id)
        if (payload.data === "error") throw new Error("BroadcastChannelMessengerFetchPayloadError: MessageHub fetch failed.");
        // payload inject to message
        metadata.payload = payload
    }

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

    protected responseCallback(request: Message, callback: (responsePayload: MessagePayload) => any) {
        const listener = async (e: Event) => {
            const response = unwrapMessage(e)
            if (response && response.id === request.id && response.type === request.type && response.__type === "response") {
                // if metadata (no payload)
                if (!response.payload) await this._injectPayload(response);
                this.listenFrom.removeEventListener("message", listener)
                callback(response.payload)
            }
        }
        this.listenFrom.addEventListener("message", listener)
    }

    protected wrapMessageHandler(type: MessageType, handler: MessageHandler): MessageHandlerWrapped {
        return async (e: Event) => {
            const request = unwrapMessage(e)
            if (request && request.type === type && request.__type === "request" && this.activated) { // type and activation check
                // if metadata (no payload)
                if (!request.payload) await this._injectPayload(request);
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
    state: "off" | "initializing" | "on" = "off"

    constructor() {
        super()
        this.init()
    }

    private async init() {
        if (this.state === "on") return;
        if (this.state === "initializing") return await this.waitFor("done");
        this.state = "initializing"
        await this._init()
        this.state = "on"
        this.dispatch("done")
    }

    protected async _init() {

    }

    async store(message: Message): Promise<MessagePayload> {
        await this.init()
        const response = await this.target!.request(MessageStoreMessageType, { data: message, transfer: message.payload.transfer })
        if (response && response.data === "success") {
            return response
        } else {
            throw new Error("MessageHubStoreError: MessagHub returned corrupted or unsuccessful response.");
        }
    }

    async fetch(id: MessageId): Promise<MessagePayload> {
        await this.init()
        const response = await this.target!.request(MessageFetchMessageType, { data: id })
        if (response && response.data !== "error" && response.transfer) {
            return response.data
        } else {
            throw new Error("MessageHubFetchError: MessagHub returned corrupted or unsuccessful response.");
        }
    }

    // listen request
    async addListen(listenFrom: MessengerOption) {
        await this.init()
        const listenTarget = MessengerFactory.new(listenFrom)
        // store message
        listenTarget.response(MessageStoreMessageType, async (payload: { data: Message }) => {
            return await this.store(payload.data)
        })
        // fetch message
        listenTarget.response(MessageFetchMessageType, async (payload: { data: string }) => {
            return await this.fetch(payload.data)
        })
    }
}

class ServiceWorkerMessageHub extends AbstractMessageHub {
    protected storage: Map<MessageId, MessagePayload> = new Map()

    // add listen; requests from windows -> serviceworker
    async _init() {
        this.addListen(self as ServiceWorkerGlobalScope)
        
        const channel = new BroadcastChannel(MessageHubSameOriginServiceWorkerBroadcastChannelName)
        channel.postMessage(true)
    }

    // service worker is MessageHub storage itself
    async store(message: Message) {
        this.storage.set(message.id, message.payload)
        return { data: "success" }
    }

    async fetch(id: MessageId) {
        let message = this.storage.get(id)
        if (!message) return { data: "error" };
        return message
    }
}

class DedicatedWorkerMessageHub extends AbstractMessageHub {
    // worker -> parent window
    async _init() {
        this.target = MessengerFactory.new(self as DedicatedWorkerGlobalScope)
    }
}

class WindowMessageHub extends AbstractMessageHub {
    async _initSameOrigin() {
        this.target = MessengerFactory.new(globalThis.navigator.serviceWorker)
    }

    async _initCrossOrigin() {
        let iframeload = false
        const _this = this
        const iframe = document.createElement("iframe")
        iframe.onload = () => {
            const iframeWindow = iframe.contentWindow!
            _this.target = new CrossOriginWindowMessenger(window, iframeWindow, (new URL(MessageHubCrossOriginIframeURL)).origin);
            iframeload = true
            _this.dispatch("iframeload")
        }
        iframe.setAttribute("src", MessageHubCrossOriginIframeURL)
        iframe.style.display = "none"
        document.body.appendChild(iframe)
        if (!iframeload) await this.waitFor("iframeload");
    }

    // worker/window -> window -> iframe/serviceworker -> window -> worker/window
    async _init() {
        // window -> service worker(same-origin)
        if (globalThis.navigator.serviceWorker.controller) await this._initSameOrigin();
        // window -> iframe(cross-origin) (-> service worker(cross-origin))
        else await this._initCrossOrigin()
        // add forward requests from other window -> this window
        this.addListen(window)
        // worker <--> window; inject listener code to prototype, to backward message to worker
        // TODO: Worker prototype injection needed?
        // ex)
        // const worker = new Worker(...)
        // this.addListen(worker)

        // service worker changes -> initSameOrigin
        const channel = new BroadcastChannel(MessageHubSameOriginServiceWorkerBroadcastChannelName)
        channel.onmessage = () => this._initSameOrigin()
    }
}

// singleton
export class MessageHub extends AbstractMessageHub {
    private static _instance: MessageHub
    hub?: AbstractMessageHub

    private constructor() {
        super()
        this.changeHub()
    }

    changeHub() {
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
        return this.hub!.store(message)
    }

    async fetch(id: MessageId): Promise<MessagePayload> {
        return this.hub!.fetch(id)
    }
}