import { MessageListenable, MessageSendable, MessageSendableGenerator, Messenger, MessengerOption } from "./message"


export class MessengerFactory {
    private constructor() { }

    public static new(option: MessengerOption) {
        let send: MessageSendable | MessageSendableGenerator | undefined
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
            case Worker: {
                send = listen = option as Worker
                break
            }
            case WorkerGlobalScope: {
                send = (e) => (e as ExtendableMessageEvent).source! // firet receive window's message and then response to that window (depends on window's message)
                listen = option as WorkerGlobalScope
                break
            }
            case Window: {
                send = option as Window // target window
                listen = window // listen window itself
                break
            }
            case Client: {
                send = option as Client
                listen = self as WorkerGlobalScope // listen workerGlobal itself
                break
            }
            case BroadcastChannel: {
                send = listen = option as BroadcastChannel
                break
            }
            case MessagePort: {
                send = listen = option as MessagePort
                break
            }
        }

        if (send && listen) {
            return new Messenger(send, listen)
        } else {
            throw new Error("MessengerFactoryError: Cannot create Messenger, arguments not supported")
        }
    }
}