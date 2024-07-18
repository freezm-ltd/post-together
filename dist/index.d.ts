import { BroadcastChannelMessenger } from "./broadcastchannel";
import { Messenger, MessengerOption } from "./message";
import { MessageHub } from "./broadcastchannel";
export declare class MessengerFactory {
    private constructor();
    static new(option: MessengerOption): Messenger;
}
export { BroadcastChannelMessenger, Messenger, MessageHub };
