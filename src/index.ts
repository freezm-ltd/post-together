type PostMessageable = ServiceWorker | Worker | Client | BroadcastChannel
type Message = { id: string, data: any }

export function connect(from: PostMessageable, to: PostMessageable) {
    return (msg: any) => {
        
    }
}