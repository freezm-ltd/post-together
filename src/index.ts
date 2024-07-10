import { EventTarget2 } from "../node_modules/@freezm-ltd/event-target-2/dist/index"

type PostMessageable = ServiceWorker | Worker | Client | BroadcastChannel | MessagePort
type Message = { id: string, type: string, data: any }

export function connect(from: PostMessageable, to: PostMessageable) {
    return (msg: any) => {
        
        
    }
}
