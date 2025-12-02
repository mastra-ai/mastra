import { ConnectionMessage } from "./ConnectionMessage.js";
import { IStringDictionary } from "./IDictionary.js";
import { EventType, PlatformEvent } from "./PlatformEvent.js";
export declare class ServiceEvent extends PlatformEvent {
    private privJsonResult;
    constructor(eventName: string, jsonstring: string, eventType?: EventType);
    get jsonString(): string;
}
export declare class ConnectionEvent extends PlatformEvent {
    private privConnectionId;
    constructor(eventName: string, connectionId: string, eventType?: EventType);
    get connectionId(): string;
}
export declare class ConnectionStartEvent extends ConnectionEvent {
    private privUri;
    private privHeaders;
    constructor(connectionId: string, uri: string, headers?: IStringDictionary<string>);
    get uri(): string;
    get headers(): IStringDictionary<string>;
}
export declare class ConnectionEstablishedEvent extends ConnectionEvent {
    constructor(connectionId: string);
}
export declare class ConnectionClosedEvent extends ConnectionEvent {
    private privReason;
    private privStatusCode;
    constructor(connectionId: string, statusCode: number, reason: string);
    get reason(): string;
    get statusCode(): number;
}
export declare class ConnectionErrorEvent extends ConnectionEvent {
    private readonly privMessage;
    private readonly privType;
    constructor(connectionId: string, message: string, type: string);
    get message(): string;
    get type(): string;
}
export declare class ConnectionEstablishErrorEvent extends ConnectionEvent {
    private privStatusCode;
    private privReason;
    constructor(connectionId: string, statuscode: number, reason: string);
    get reason(): string;
    get statusCode(): number;
}
export declare class ConnectionMessageReceivedEvent extends ConnectionEvent {
    private privNetworkReceivedTime;
    private privMessage;
    constructor(connectionId: string, networkReceivedTimeISO: string, message: ConnectionMessage);
    get networkReceivedTime(): string;
    get message(): ConnectionMessage;
}
export declare class ConnectionMessageSentEvent extends ConnectionEvent {
    private privNetworkSentTime;
    private privMessage;
    constructor(connectionId: string, networkSentTimeISO: string, message: ConnectionMessage);
    get networkSentTime(): string;
    get message(): ConnectionMessage;
}
export declare class ConnectionRedirectEvent extends ConnectionEvent {
    private privRedirectUrl;
    private privOriginalUrl?;
    private privContext?;
    constructor(connectionId: string, redirectUrl: string, originalUrl?: string, context?: string);
    get redirectUrl(): string;
    get originalUrl(): string | undefined;
    get context(): string | undefined;
}
