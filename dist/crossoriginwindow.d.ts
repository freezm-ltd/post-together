import { Message, Messenger } from "./message";
export declare class CrossOriginWindowMessenger extends Messenger {
    readonly listenFrom: Window;
    readonly sendTo: Window;
    readonly sendToOrigin: string;
    constructor(listenFrom: Window, sendTo: Window);
    protected _send(message: Message, event?: Event): Promise<void>;
}
