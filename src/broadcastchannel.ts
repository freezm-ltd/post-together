import { IDENTIFIER, Message, MessageCustomEvent, MessageHandler, MessageId, MessagePayload, MessageTarget, MessageType } from "./message";
import { generateId } from "./utils";
import { MessageTargetFactory } from "src.ts";

const MessageStoreMessageType = `${IDENTIFIER}:__store`
const MessageFetchMessageType = `${IDENTIFIER}:__fetch`

export class BroadcastTransferableChannel extends MessageTarget {
    private static hub: MessageTarget

    constructor(
        readonly channel: BroadcastChannel
    ) {
        super(channel, channel)
    }

    // broadcast message, no response
    async send(type: MessageType, payload: MessagePayload): Promise<MessagePayload> {
        const id = generateId()
        const message = { id, type, payload }
        // store message
        const storeResult = await BroadcastTransferableChannel.hub.send(MessageStoreMessageType, { data: message, transfer: payload.transfer })
        if (storeResult.data !== "success") throw new Error("BroadcastTransferableChannelSendError: MessagHub returned corrupted or unsuccessful response.");

        return { data: "broadcasting success" }
    }

    protected wrap(handler: MessageHandler) {
        return async (e: MessageCustomEvent) => {
            const { id, type } = e.detail
            // fetch message
            const fetchResult = await BroadcastTransferableChannel.hub.send(MessageFetchMessageType, { data: { id, type } })
            if (fetchResult.data === "error") throw new Error("BroadcastTransferableChannelListenError: MessagHub returned corrupted or unsuccessful response.");

            const { payload } = fetchResult.data as Message
            const response = await handler(payload.data, payload.transfer)
            const message = { id, type, payload: response }
            this.sender.send(message, response.transfer, e)
        }
    }
}

// hub of messages, must be in service worker(alternative of shared worker, which not usable in chrome mobile)
export class MessageHub {
    private static instance: MessageHub | undefined
    private map: Map<MessageId, Message> = new Map()

    private target: MessageTarget
    private constructor(
        readonly scope: ServiceWorkerGlobalScope
    ) {
        this.target = MessageTargetFactory.new(scope)
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
    }

    public static init() {
        if (globalThis !== ServiceWorkerGlobalScope.prototype) throw new Error("MessageHubInitError: MessageHub.init() must be called from ServiceWorkerGlobalScope");
        if (!MessageHub.instance) MessageHub.instance = new MessageHub(globalThis as ServiceWorkerGlobalScope);
    }
}

export function enableMessageHub() {
    if (globalThis !== ServiceWorkerGlobalScope.prototype) throw new Error("enableMessageHubError: enableMessageHub() must be called from ServiceWorkerGlobalScope");
    MessageHub.init()
}