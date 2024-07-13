import { IDENTIFIER, Message, MessageCustomEvent, MessageHandler, MessageId, MessagePayload, Messenger, MessageType, MessageSendTarget, MessageListenTarget, MessageSendable, unwrapMessage, MessageListenable, MessengerOption } from "./message";
import { generateId } from "./utils";
import { MessengerFactory } from "src.ts";

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

export class MessageForwarder {
    // backwardTarget -> request -> forwardTarget -> response -> backwardTarget(ExtendableMessageEvent.source)
    // not working on dedicated worker; must attach event listener to target worker
    private messageSourceTable: Map<MessageId, ServiceWorker | Client | MessagePort> = new Map()
    constructor(
        readonly type: MessageType,
        readonly forward: MessengerOption,
        readonly backward: EventTarget = globalThis as (Window | ServiceWorkerGlobalScope | WorkerGlobalScope)
    ) {
        const forwardTarget = MessengerFactory.new(forward)
        const backwardTarget = backward

        backwardTarget.addEventListener("message", (e: Event) => {
            
        })
    }
}

// hub of messages, can be in window, dedicated worker, service worker(alternative of shared worker, which not usable in chrome mobile)
// forward messages to MessageHub(not in service worker) or store/fetch messages MessageHub(in service worker)
export class MessageHub {
    private static instance: MessageHub | undefined
    private map: Map<MessageId, Message> = new Map()
    private target?: Messenger
    private constructor() {
        switch (globalThis.constructor) {
            case ServiceWorkerGlobalScope: { // service worker is MessageHub self
                this.target = MessengerFactory.new(globalThis as ServiceWorkerGlobalScope)
                this.target.attach(MessageStoreMessageType, (data) => {
                    const message = data as Message
                    this.map.set(message.id, message)
                    return { data: "success" }
                })
                this.target.attach(MessageFetchMessageType, (data) => {
                    const { id } = data
                    const message = this.map.get(id)
                    if (message) {
                        return { data: message, transfer: message.payload.transfer }
                    }
                    return { data: "error" }
                })
                break
            }

            case Window: { // 
                const serviceWorkerContainer = globalThis.navigator.serviceWorker
                if (serviceWorkerContainer.controller) { // window -> service worker(same-origin)
                    send = serviceWorkerContainer.controller
                    listen = serviceWorkerContainer
                } else { // window -> iframe(cross-origin)

                }
                break
            }

            case WorkerGlobalScope: { // worker -> parent window


                break
            }
        }
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