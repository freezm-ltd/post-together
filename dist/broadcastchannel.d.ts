import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { Message, MessageId, Messenger, MessagePayload, MessengerOption } from "./message";
export declare const MessageHubCrossOriginIframeURL = "https://freezm-ltd.github.io/post-together/iframe/";
export declare function isIframe(origin?: string): boolean;
export declare class BroadcastChannelMessenger extends Messenger {
    protected _inject(message: Message): Promise<void>;
    protected _send(message: Message): Promise<void>;
}
export declare abstract class AbstractMessageHub extends EventTarget2 {
    protected target: Messenger | undefined;
    state: "off" | "initializing" | "on";
    constructor();
    private init;
    protected _init(): Promise<void>;
    store(message: Message): Promise<MessagePayload>;
    fetch(id: MessageId): Promise<MessagePayload>;
    protected listenFroms: Set<MessengerOption>;
    addListen(listenFrom: MessengerOption): Promise<void>;
}
export declare class MessageHub {
    private static _instance;
    private hub?;
    private constructor();
    changeHub(): void;
    static init(): void;
    static get instance(): MessageHub;
    static store(message: Message): Promise<MessagePayload>;
    static fetch(id: MessageId): Promise<MessagePayload>;
    static addListen(listenFrom: MessengerOption): Promise<void>;
}
