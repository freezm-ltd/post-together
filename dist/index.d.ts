import { BroadcastChannelMessenger } from "./broadcastchannel";
import { Messenger, MessengerOption } from "./message";
import { MessageHub } from "./broadcastchannel";
export declare class MessengerFactory {
    private constructor();
    static new(option: MessengerOption): Messenger;
}
export declare function initMessageHub(): void;
export declare function workerWithMessageHub(scriptURL: string | URL, options?: WorkerOptions): Worker;
export { BroadcastChannelMessenger, Messenger, MessageHub };
