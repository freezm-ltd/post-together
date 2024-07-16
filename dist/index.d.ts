import { Messenger, MessengerOption } from "./message";
export declare class MessengerFactory {
    private constructor();
    static new(option: MessengerOption): Messenger;
}
export declare function initMessageHub(): void;
export declare function workerWithMessageHub(scriptURL: string | URL, options?: WorkerOptions): Worker;
