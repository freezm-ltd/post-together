import { BroadcastChannelMessenger } from "./broadcastchannel"
import { MessageListenable, MessageSendable, Messenger, MessengerOption } from "./message"
import { MessageHub } from "./broadcastchannel"

export class MessengerFactory {
    private constructor() { }

    public static new(option: MessengerOption) {
        if (!option) throw new Error("MessengerFactoryNoOptionError: Cannot create Messenger, argument 'option' is not provided");

        let send: MessageSendable | undefined
        let listen: MessageListenable | undefined

        switch (option.constructor) {
            case globalThis.ServiceWorker: {
                send = option as ServiceWorker
                listen = window.navigator.serviceWorker // listen from ServiceWorkerContainer
                break
            }
            case globalThis.ServiceWorkerContainer: {
                send = (option as ServiceWorkerContainer).controller!
                listen = option as ServiceWorkerContainer
                break
            }
            case globalThis.ServiceWorkerGlobalScope: {
                send = undefined // only can response from e.source
                listen = option as ServiceWorkerGlobalScope
                break
            }
            case globalThis.Worker: {
                send = listen = option as Worker
                break
            }
            case globalThis.DedicatedWorkerGlobalScope: {
                send = listen = option as DedicatedWorkerGlobalScope
                break
            }
            case globalThis.Window: {
                send = option as Window // target window
                listen = window // listen window itself
                break
            }
            case globalThis.Client: {
                send = option as Client
                listen = self as DedicatedWorkerGlobalScope // listen itself
                break
            }
            case globalThis.BroadcastChannel: {
                const name = (option as BroadcastChannel).name // newly create BroadcastChannel, to bypass blocking of self-posted message listening
                return new BroadcastChannelMessenger(new BroadcastChannel(name), new BroadcastChannel(name))
            }
            case globalThis.MessagePort: {
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

export function initMessageHub() {
    MessageHub.init()
}

// connect (child) worker to parent
export function workerWithMessageHub(scriptURL: string | URL, options?: WorkerOptions) {
    const worker = new Worker(scriptURL, options)
    MessageHub.instance.addListen(worker)
    return worker
}