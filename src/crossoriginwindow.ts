import { Message, Messenger } from "./message";

export class CrossOriginWindowMessenger extends Messenger {
    constructor(
        readonly listenFrom: Window,
        readonly sendTo: Window, // if not specified, independent request is blocked, can do only responsing
        readonly sendToOrigin: string,
    ) {
        super(listenFrom, sendTo)
    }

    protected async _send<T>(message: Message<T>, event?: Event) {
        this._getSendTo(event).postMessage(message, { transfer: message.transfer, targetOrigin: this.sendToOrigin }) // send request
    }
}