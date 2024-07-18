import { BroadcastChannelMessenger } from "./broadcastchannel"
import { MessageListenable, MessageSendable, Messenger, MessengerOption } from "./message"
import { MessageHub } from "./broadcastchannel"
import { CrossOriginWindowMessenger } from "./crossoriginwindow";

export class MessengerFactory {
    private constructor() { }

    public static new(option: MessengerOption) {
        if (!option) throw new Error("MessengerFactoryNoOptionError: Cannot create Messenger, argument 'option' is not provided");

        let send: MessageSendable | undefined
        let listen: MessageListenable | undefined

        switch (option.constructor) {
            case globalThis.ServiceWorker: {
                listen = window.navigator.serviceWorker // listen from ServiceWorkerContainer
                send = option as ServiceWorker
                break
            }
            case globalThis.ServiceWorkerContainer: {
                listen = option as ServiceWorkerContainer
                send = (option as ServiceWorkerContainer).controller!
                break
            }
            case globalThis.ServiceWorkerGlobalScope: {
                listen = option as ServiceWorkerGlobalScope
                send = undefined // only can response from e.source
                break
            }
            case globalThis.Worker: {
                listen = send = option as Worker
                // automatic listen for MessageHub
                MessageHub.instance.addListen(option)
                break
            }
            case globalThis.DedicatedWorkerGlobalScope: {
                listen = send = option as DedicatedWorkerGlobalScope
                break
            }
            case globalThis.Window: {
                const targetWindow = option as Window
                // cannot accessing a cross-origin frame...
                //if (targetWindow.origin !== window.origin) return new CrossOriginWindowMessenger(window, targetWindow);
                listen = window // listen window itself
                send = targetWindow // target window
                break
            }
            case globalThis.Client: {
                listen = self as DedicatedWorkerGlobalScope // listen itself
                send = option as Client
                break
            }
            case globalThis.BroadcastChannel: {
                const name = (option as BroadcastChannel).name // newly create BroadcastChannel, to bypass blocking of self-posted message listening
                return new BroadcastChannelMessenger(new BroadcastChannel(name), new BroadcastChannel(name))
            }
            case globalThis.MessagePort: {
                listen = send = option as MessagePort
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

// automatic init MessageHub
(function initMessageHub() {
    if (globalThis.constructor === globalThis.Window) {
        navigator.serviceWorker.addEventListener("controllerchange", (e) => {
            MessageHub.init()
        })
    }
    MessageHub.init()
})()

export {
    BroadcastChannelMessenger,
    Messenger,
    MessageHub
}