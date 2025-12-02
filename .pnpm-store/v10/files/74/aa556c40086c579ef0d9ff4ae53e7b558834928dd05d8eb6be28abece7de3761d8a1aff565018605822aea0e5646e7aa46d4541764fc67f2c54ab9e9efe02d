import { ConnectionMessage } from "./ConnectionMessage.js";
import { RawWebsocketMessage } from "./RawWebsocketMessage.js";
export interface IWebsocketMessageFormatter {
    toConnectionMessage(message: RawWebsocketMessage): Promise<ConnectionMessage>;
    fromConnectionMessage(message: ConnectionMessage): Promise<RawWebsocketMessage>;
}
