import { BroadcastChannelMessenger } from "./broadcastchannel"
import { MessageListenable, MessageSendable, Messenger, MessengerOption } from "./message"


export class MessengerFactory {
    private constructor() { }

    public static new(option: MessengerOption) {
        let send: MessageSendable | undefined
        let listen: MessageListenable | undefined

        switch (option.constructor) {
            case ServiceWorker: {
                send = option as ServiceWorker
                listen = window.navigator.serviceWorker // listen from ServiceWorkerContainer
                break
            }
            case ServiceWorkerContainer: {
                send = (option as ServiceWorkerContainer).controller!
                listen = option as ServiceWorkerContainer
                break
            }
            case ServiceWorkerGlobalScope: {
                send = undefined // only can response from e.source
                listen = option as ServiceWorkerGlobalScope
                break
            }
            case Worker: {
                send = listen = option as Worker
                break
            }
            case DedicatedWorkerGlobalScope: {
                send = listen = option as DedicatedWorkerGlobalScope
                break
            }
            case Window: {
                send = option as Window // target window
                listen = window // listen window itself
                break
            }
            case Client: {
                send = option as Client
                listen = self as DedicatedWorkerGlobalScope // listen itself
                break
            }
            case BroadcastChannel: {
                send = listen = option as BroadcastChannel
                return new BroadcastChannelMessenger(listen, send)
            }
            case MessagePort: {
                send = listen = option as MessagePort
                break
            }
        }

        if (listen) {
            return new Messenger(listen, send)
        } else {
            throw new Error("MessengerFactoryError: Cannot create Messenger, arguments not supported")
        }
    }
}