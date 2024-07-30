export declare const IDENTIFIER = "post-together";
export type Message<T> = {
    id: MessageId;
    type: MessageType;
    payload: T;
    transfer?: Transferable[];
    __type: MessageInternalType;
    __identifier: typeof IDENTIFIER;
};
export declare function isMessage(data: any): any;
export type MessageCustomEvent<T> = MessageEvent<Message<T>>;
export type MessageType = string;
export type MessageInternalType = "request" | "response";
export type MessageId = string;
export declare function isMessageCustomEvent<T>(e: Event): e is MessageCustomEvent<T>;
export declare function unwrapMessage(e: Event): Message<unknown> | undefined;
export type MessageHandlerResult<T> = T | {
    payload: T;
    transfer: Transferable[];
};
export type MessageHandler<T, R> = (payload: T, e?: MessageCustomEvent<T>) => PromiseLike<MessageHandlerResult<R>> | MessageHandlerResult<R>;
export type MessageEventListener<T> = (e: MessageCustomEvent<T>) => any;
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
    protected createRequest<T>(type: MessageType, payload: T, transfer?: Transferable[]): Message<T>;
    protected createResponse<T, R>(request: Message<T>, payload: R, transfer?: Transferable[]): Message<R>;
    protected _inject<T>(message: Message<T>): Promise<void>;
    protected responseCallback<T, R>(request: Message<T>, callback: (payload: R) => void): () => void;
    protected _getSendTo(event?: Event): MessageSendable;
    protected _send<T>(message: Message<T>, event?: Event): Promise<void>;
    request<T, R>(type: MessageType, payload: T, transfer?: Transferable[], timeout?: number): Promise<R>;
    protected listenerWeakMap: WeakMap<MessageHandler<any, any>, MessageHandlerWrapped>;
    protected listenerSet: Set<MessageHandler<any, any>>;
    protected wrapMessageHandler<T, R>(type: MessageType, handler: MessageHandler<T, R>): MessageHandlerWrapped;
    response<T, R>(type: MessageType, handler: MessageHandler<T, R>): void;
    deresponse(handler?: MessageHandler<any, any>): void;
    activate(): void;
    deactivate(): void;
}
