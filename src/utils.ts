import { MessageId } from "./message";

export function generateId(): MessageId {
    return crypto.randomUUID()
}