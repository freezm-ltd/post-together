import { isMessageListenable, isPrecursorPairEqual, MessageListenable, MessageListener, MessagePostable, MessagePoster, MessagePosterTransferable, MessageTarget, MessageTargetPrecursorPair, MessageTargetTransferable, SupportsTransferable } from "./message";

export class MessageTargetFactory {
    private constructor() {}

    private static targets: Set<[MessageTargetPrecursorPair, MessageTarget | MessagePosterTransferable]> = new Set()
    private static getExistingMessageTarget(post: MessagePostable, listen: MessageListenable) {
        const newPair = { post, listen }
        for (let [pair, target] of MessageTargetFactory.targets) {
            if (isPrecursorPairEqual(newPair, pair)) {
                return target
            }
        }
    }

    public static new(target: MessagePostable & MessageListenable): MessageTarget
    public static new(post: MessagePostable, listen: MessageListenable): MessageTarget
    public static new(postOrTarget: MessagePostable | MessagePostable & MessageListenable, listen?: MessageListenable) {
        let poster, listener;
        poster = new MessagePoster(postOrTarget)
        if (listen) {
            listener = new MessageListener(listen)
        } else if (isMessageListenable(postOrTarget)) {
            listener = new MessageListener(postOrTarget)
        } else {
            throw new Error("Cannot create MessageTarget: listener not found or not supported")
        }
        const pair = { poster, listener }
        return new MessageTarget(poster, listener)
    }

    public static newTransferable(target: MessagePostable & MessageListenable & SupportsTransferable): MessageTargetTransferable
    public static newTransferable(post: MessagePostable & SupportsTransferable, listen: MessageListenable): MessageTargetTransferable
    public static newTransferable(postOrTarget: (MessagePostable | MessagePostable & MessageListenable) & SupportsTransferable, listen?: MessageListenable) {
        let poster, listener;
        poster = new MessagePosterTransferable(postOrTarget)
        if (listen) {
            listener = new MessageListener(listen)
        } else if (isMessageListenable(postOrTarget)) {
            listener = new MessageListener(postOrTarget)
        } else {
            throw new Error("Cannot create MessageTargetTransferable: listener not found or not supported")
        }
        return new MessageTargetTransferable(poster, listener)
    }
}