import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { Message, MessageHandler, MessageId, Messenger, MessageType, MessageHandlerWrapped, MessagePayload, MessengerOption } from "./message";
export declare const MessageHubCrossOriginIframeURL = "https://freezm-ltd.github.io/post-together/iframe/";
export declare class BroadcastChannelMessenger extends Messenger {
    protected _injectPayload(metadata: Message): Promise<void>;
    protected _send(message: Message): Promise<void>;
    protected responseCallback(request: Message, callback: (responsePayload: MessagePayload) => any): void;
    protected wrapMessageHandler(type: MessageType, handler: MessageHandler): MessageHandlerWrapped;
}
export declare abstract class AbstractMessageHub extends EventTarget2 {
    protected target: Messenger | undefined;
    state: "off" | "initializing" | "on";
    constructor();
    private init;
    protected _init(): Promise<void>;
    store(message: Message): Promise<MessagePayload>;
    fetch(id: MessageId): Promise<MessagePayload>;
    addListen(listenFrom: MessengerOption): Promise<void>;
}
export declare class MessageHub extends AbstractMessageHub {
    private static _instance;
    hub?: AbstractMessageHub;
    private constructor();
    changeHub(): void;
    static init(): void;
    static get instance(): MessageHub;
    store(message: Message): Promise<MessagePayload>;
    fetch(id: MessageId): Promise<MessagePayload>;
}
