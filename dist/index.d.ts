import { BroadcastChannelMessenger } from "./broadcastchannel";
import { Messenger, MessengerOption, MessageHandler, MessageHandlerResult } from "./message";
import { MessageHub } from "./broadcastchannel";
export declare class MessengerFactory {
    private constructor();
    static new(option: MessengerOption): Messenger;
}
export { BroadcastChannelMessenger, Messenger, MessageHub, MessageHandler, MessageHandlerResult };
