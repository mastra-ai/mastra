import { ConnectionEvent } from "./ConnectionEvents.js";
import { ConnectionMessage } from "./ConnectionMessage.js";
import { ConnectionOpenResponse } from "./ConnectionOpenResponse.js";
import { EventSource } from "./EventSource.js";
export declare enum ConnectionState {
    None = 0,
    Connected = 1,
    Connecting = 2,
    Disconnected = 3
}
export interface IConnection {
    id: string;
    state(): ConnectionState;
    open(): Promise<ConnectionOpenResponse>;
    send(message: ConnectionMessage): Promise<void>;
    read(): Promise<ConnectionMessage>;
    events: EventSource<ConnectionEvent>;
    dispose(disposing?: string): Promise<void>;
}
