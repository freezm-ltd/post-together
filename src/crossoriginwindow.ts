import { Message, Messenger } from "./message";

export class CrossOriginWindowMessenger extends Messenger {
    readonly sendToOrigin: string
    constructor(
        readonly listenFrom: Window,
        readonly sendTo: Window, // if not specified, independent request is blocked, can do only responsing
    ) {
        super(listenFrom, sendTo)
        this.sendToOrigin = sendTo.origin
    }

    protected async _send(message: Message, event?: Event) {
        this._getSendTo(event).postMessage(message, { transfer: message.payload.transfer, targetOrigin: this.sendToOrigin }) // send request
    }
}