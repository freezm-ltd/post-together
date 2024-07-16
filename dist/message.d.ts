export declare const IDENTIFIER = "post-together";
export type Message = {
    id: MessageId;
    type: MessageType;
    payload: MessagePayload;
    __type: MessageInternalType;
    __identifier: typeof IDENTIFIER;
};
export declare function isMessage(data: any): any;
export type MessageCustomEvent = MessageEvent<Message>;
export type MessageType = string;
export type MessageInternalType = "request" | "response";
export type MessageId = string;
export type MessagePayload = {
    data: MessagePayloadData;
    transfer?: MessagePayloadTransferable;
};
export type MessagePayloadData = any;
export type MessagePayloadTransferable = Transferable[];
export declare function isMessageCustomEvent(e: Event): e is MessageCustomEvent;
export declare function unwrapMessage(e: Event): Message | undefined;
export type MessageHandler = (data: MessagePayloadData, transfer?: MessagePayloadTransferable) => PromiseLike<MessagePayload> | MessagePayload;
export type MessageEventListener = (e: MessageCustomEvent) => any;
export type MessageHandlerWrapped = (e: Event) => void;
export type MessengerOption = ServiceWorker | ServiceWorkerContainer | ServiceWorkerGlobalScope | Worker | DedicatedWorkerGlobalScope | Window | Client | BroadcastChannel | MessagePort;
export type MessageSendable = ServiceWorker | Worker | DedicatedWorkerGlobalScope | Window | Client | BroadcastChannel | MessagePort;
export type MessageListenable = ServiceWorkerContainer | ServiceWorkerGlobalScope | Worker | DedicatedWorkerGlobalScope | Window | BroadcastChannel | MessagePort;
export declare function isMessageSendable(target: any): target is MessageSendable;
export declare function isMessageListenable(target: any): target is MessageListenable;
export declare class Messenger {
    readonly listenFrom: MessageListenable;
    readonly sendTo?: MessageSendable | undefined;
    protected activated: boolean;
    constructor(listenFrom: MessageListenable, sendTo?: MessageSendable | undefined);
    protected createRequest(type: MessageType, payload: MessagePayload): Message;
    protected createResponse(request: Message, payload: MessagePayload): Message;
    protected responseCallback(request: Message, callback: (responsePayload: MessagePayload) => any): void;
    protected _getSendTo(event?: Event): MessageSendable;
    protected _send(message: Message, event?: Event): Promise<void>;
    request(type: MessageType, payload: MessagePayload): Promise<MessagePayload>;
    protected listenTargetWeakMap: WeakMap<MessageHandler, MessageHandlerWrapped>;
    protected wrapMessageHandler(type: MessageType, handler: MessageHandler): MessageHandlerWrapped;
    response(type: MessageType, handler: MessageHandler): void;
    deresponse(handler: MessageHandler): void;
    activate(): void;
    deactivate(): void;
}
