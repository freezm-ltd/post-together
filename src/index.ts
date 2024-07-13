import { BroadcastTransferableChannel } from "./broadcastchannel"
import { MessageListenable, MessageSendable, MessageSendableGenerator, MessageTarget, MessageTargetOption } from "./message"


export class MessageTargetFactory {
    private constructor() { }

    public static new(option: MessageTargetOption) {
        let send: MessageSendable | MessageSendableGenerator | null = null
        let listen: MessageListenable | null = null

        switch (option) {
            case ServiceWorker.prototype: {
                send = option
                listen = window.navigator.serviceWorker // listen from ServiceWorkerContainer
                break
            }
            case ServiceWorkerContainer.prototype: {
                send = option.controller!
                listen = option
                break
            }
            case Worker.prototype: {
                send = listen = option
                break
            }
            case WorkerGlobalScope.prototype: {
                send = (e) => (e as ExtendableMessageEvent).source! // firet receive window's message and then response to that window (depends on window's message)
                listen = option
                break
            }
            case Window.prototype: {
                send = option
                listen = window // listen window itself
                break
            }
            case Client.prototype: {
                send = option
                listen = self as WorkerGlobalScope // listen workerGlobal itself
                break
            }
            case BroadcastChannel.prototype: {
                return new BroadcastTransferableChannel(option as BroadcastChannel) // transferable support wrapper
            }
            case MessagePort.prototype: {
                send = listen = option
                break
            }
        }

        if (send && listen) {
            return new MessageTarget(send, listen)
        } else {
            throw new Error("MessageTargetFactoryError: Cannot create MessageTarget, arguments not supported")
        }
    }
}