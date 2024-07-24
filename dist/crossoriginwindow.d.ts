import { Message, Messenger } from "./message";
export declare class CrossOriginWindowMessenger extends Messenger {
    readonly listenFrom: Window;
    readonly sendTo: Window;
    readonly sendToOrigin: string;
    constructor(listenFrom: Window, sendTo: Window, // if not specified, independent request is blocked, can do only responsing
    sendToOrigin: string);
    protected _send<T>(message: Message<T>, event?: Event): Promise<void>;
}
