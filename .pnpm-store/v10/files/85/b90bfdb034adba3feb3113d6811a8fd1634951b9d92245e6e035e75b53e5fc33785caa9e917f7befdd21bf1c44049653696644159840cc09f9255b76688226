import { ConnectionEvent, ConnectionMessage, ConnectionOpenResponse, ConnectionState, EventSource, IConnection, IStringDictionary, IWebsocketMessageFormatter } from "../common/Exports.js";
import { ProxyInfo } from "./ProxyInfo.js";
export declare class WebsocketConnection implements IConnection {
    private privUri;
    private privMessageFormatter;
    private privConnectionMessageAdapter;
    private privId;
    private privIsDisposed;
    constructor(uri: string, queryParameters: IStringDictionary<string>, headers: IStringDictionary<string>, messageFormatter: IWebsocketMessageFormatter, proxyInfo: ProxyInfo, enableCompression?: boolean, connectionId?: string);
    dispose(): Promise<void>;
    isDisposed(): boolean;
    get id(): string;
    get uri(): string;
    state(): ConnectionState;
    open(): Promise<ConnectionOpenResponse>;
    send(message: ConnectionMessage): Promise<void>;
    read(): Promise<ConnectionMessage>;
    get events(): EventSource<ConnectionEvent>;
}
