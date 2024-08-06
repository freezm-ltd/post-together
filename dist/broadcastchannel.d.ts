import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { Message, MessageId, Messenger, MessengerOption } from "./message";
export declare const MessageHubCrossOriginIframeURL = "https://freezm-ltd.github.io/post-together/iframe/";
export declare function isIframe(origin?: string): boolean;
type MessageMetadata<T> = Message<T> & {
    metadata: true;
};
type MessageStoreResponse = {
    ok: true;
} | {
    ok: false;
    error: unknown;
};
type MessageFetchResponse<T> = {
    ok: true;
    message: Message<T>;
} | {
    ok: false;
    error: unknown;
};
export declare class BroadcastChannelMessenger extends Messenger {
    protected _inject<T>(message: Message<T> | MessageMetadata<T>): Promise<void>;
    protected _send<T>(message: Message<T>): Promise<void>;
}
export declare abstract class AbstractMessageHub extends EventTarget2 {
    protected target: Messenger | undefined;
    state: "off" | "initializing" | "on";
    constructor(option?: MessageHubInitOption);
    private init;
    protected _init(): Promise<void>;
    store<T = any>(message: Message<T>): Promise<MessageStoreResponse>;
    fetch<T = any>(id: MessageId): Promise<MessageFetchResponse<T>>;
    protected listenFroms: Set<MessengerOption>;
    addListen(listenFrom: MessengerOption): Promise<void>;
}
export type MessageHubInitOption = {
    iframe: boolean;
};
export declare class MessageHub {
    private static _instance;
    private hub?;
    private constructor();
    changeHub(option?: MessageHubInitOption): void;
    static init(option?: MessageHubInitOption): void;
    static get instance(): MessageHub;
    static store<T>(message: Message<T>): Promise<MessageStoreResponse>;
    static fetch<T>(id: MessageId): Promise<MessageFetchResponse<T>>;
    static addListen(listenFrom: MessengerOption): Promise<void>;
}
export {};
