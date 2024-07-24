import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { IDENTIFIER, Message, MessageHandlerResult, MessageId, Messenger, MessengerOption } from "./message";
import { MessengerFactory } from "src.ts";
import { CrossOriginWindowMessenger } from "./crossoriginwindow";

export const MessageHubCrossOriginIframeURL = "https://freezm-ltd.github.io/post-together/iframe/"
const MessageHubCrossOriginIframeOrigin = (new URL(MessageHubCrossOriginIframeURL)).origin
export function isIframe(origin?: string) {
    return true
    if (globalThis.constructor === globalThis.Window) {
        if (!origin) origin = window.origin;
        return origin === MessageHubCrossOriginIframeOrigin
    }
    return false
}

const MessageStoreMessageType = `${IDENTIFIER}:__store`
const MessageFetchMessageType = `${IDENTIFIER}:__fetch`

type MessageStoreRequest<T> = Message<T>
type MessageStoreResponse = { ok: true } | { ok: false, error: unknown }
type MessageFetchRequest = MessageId
type MessageFetchResponse<T> = { ok: true, message: Message<T> } | { ok: false, error: unknown }

export class BroadcastChannelMessenger extends Messenger {
    protected async _inject<T>(message: Message<T>) { // inject payload to message(metadata only)
        if (message.payload) return; // inject not required
        const { id } = message
        // fetch message payload
        const response = await MessageHub.fetch<T>(id)
        if (!response.ok) throw new Error("BroadcastChannelMessengerFetchPayloadError: MessageHub fetch failed.");
        // payload inject to message
        message.payload = response.message.payload
        message.transfer = response.message.transfer
    }

    protected async _send<T>(message: Message<T>): Promise<void> {
        if (message.transfer) {
            const { payload, transfer, ...metadata } = message
            // store message
            const result = await MessageHub.store(message)
            if (!result.ok) throw new Error("BroadcastChannelMessengerSendError: MessageHub store failed.");
            // send metadata only (without payload which includes transferables)
            this._getSendTo().postMessage(metadata)
        } else {
            this._getSendTo().postMessage(message) // without payload, send normally
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

    async store<T = any>(message: Message<T>): Promise<MessageStoreResponse> {
        await this.init()
        return await this.target!.request<MessageStoreRequest<T>, MessageStoreResponse>(MessageStoreMessageType, message, message.transfer)
    }

    async fetch<T = any>(id: MessageId): Promise<MessageFetchResponse<T>> {
        await this.init()
        return await this.target!.request<MessageFetchRequest, MessageFetchResponse<T>>(MessageFetchMessageType, id)
    }

    protected listenFroms: Set<MessengerOption> = new Set()
    // listen request
    async addListen(listenFrom: MessengerOption) {
        await this.init()
        if (this.listenFroms.has(listenFrom)) return;
        const listenTarget = MessengerFactory.new(listenFrom)
        this.listenFroms.add(listenFrom)
        // store message
        listenTarget.response(MessageStoreMessageType, async (message: Message<any>) => {
            return await this.store(message)
        })
        // fetch message
        listenTarget.response(MessageFetchMessageType, async (id: MessageId) => {
            const result = await this.fetch(id)
            if (result.ok) {
                return { payload: result, transfer: result.message.transfer } as MessageHandlerResult<MessageFetchResponse<any>>
            }
            return result
        })
    }
}

class ServiceWorkerMessageHub extends AbstractMessageHub {
    protected storage: Map<MessageId, Message<any>> = new Map()

    // add listen; requests from windows -> serviceworker
    async _init() {
        this.addListen(self as ServiceWorkerGlobalScope)
    }

    // service worker is MessageHub storage itself
    async store<T = any>(message: Message<T>) {
        try {
            this.storage.set(message.id, message)
            return { ok: true } as { ok: true }
        } catch (e) {
            return { ok: false, error: e }
        }
    }

    async fetch<T>(id: MessageId) {
        let message = this.storage.get(id)
        if (!message) return { ok: false, error: "Not Found" } as { ok: false, error: unknown };
        this.storage.delete(id)
        return { ok: true, message } as { ok: true, message: Message<T> }
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
        if (!globalThis.navigator.serviceWorker.controller) { // servie worker doesn't have control of this page
            setTimeout(() => { // throttle to block rapid and massive reloading loop
                window.location.assign(window.location.href)
            }, 1000);
            await new Promise(() => { }) // wait forever
        } else { // can access service worker -> can use MessageHub
            this.target = MessengerFactory.new(globalThis.navigator.serviceWorker)
            window.parent.postMessage("loadend", { targetOrigin: "*" }) // loadend -> parent MessageHub initializing end
        }
    }

    async _initCrossOrigin() {
        let iframeload = false
        const iframe = document.createElement("iframe")

        const listener = (e: ExtendableMessageEvent) => {
            if (isIframe(e.origin) && e.data === "loadend") {
                iframeload = true
                this.dispatch("iframeloadend")
                window.removeEventListener("message", listener)
            }
        }
        window.addEventListener("message", listener)
        iframe.setAttribute("src", MessageHubCrossOriginIframeURL)
        iframe.style.display = "none"
        document.body.appendChild(iframe)

        if (!iframeload) await this.waitFor("iframeloadend");
        this.target = new CrossOriginWindowMessenger(window, iframe.contentWindow!, MessageHubCrossOriginIframeOrigin);
    }

    // worker/window -> window -> iframe/serviceworker -> window -> worker/window
    async _init() {
        // window -> service worker(same-origin)
        // block same-origin MessageHub just for now, for stableness
        if (isIframe()) await this._initSameOrigin();
        // window -> iframe(cross-origin) (-> service worker(cross-origin))
        else await this._initCrossOrigin()
        // add forward requests from other window -> this window
        this.addListen(window)
        // worker <--> window; inject listener code to prototype, to backward message to worker
        // TODO: Worker prototype injection needed?
        // ex)
        // const worker = new Worker(...)
        // this.addListen(worker)
    }
}

// singleton
export class MessageHub {
    private static _instance: MessageHub
    private hub?: AbstractMessageHub

    private constructor() {
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

    static async store<T>(message: Message<T>): Promise<MessageStoreResponse> {
        return this.instance.hub!.store(message)
    }

    static async fetch<T>(id: MessageId): Promise<MessageFetchResponse<T>> {
        return this.instance.hub!.fetch(id)
    }

    static async addListen(listenFrom: MessengerOption) {
        return this.instance.hub!.addListen(listenFrom)
    }
}