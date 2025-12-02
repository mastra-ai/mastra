import { ConnectionEvent, ConnectionMessage, ConnectionOpenResponse, ConnectionState, EventSource, IWebsocketMessageFormatter } from "../common/Exports.js";
import { ProxyInfo } from "./ProxyInfo.js";
export declare class WebsocketMessageAdapter {
    private privConnectionState;
    private privMessageFormatter;
    private privWebsocketClient;
    private privSendMessageQueue;
    private privReceivingMessageQueue;
    private privConnectionEstablishDeferral;
    private privCertificateValidatedDeferral;
    private privDisconnectDeferral;
    private privConnectionEvents;
    private privConnectionId;
    private privUri;
    private proxyInfo;
    private privHeaders;
    private privLastErrorReceived;
    private privEnableCompression;
    static forceNpmWebSocket: boolean;
    constructor(uri: string, connectionId: string, messageFormatter: IWebsocketMessageFormatter, proxyInfo: ProxyInfo, headers: {
        [key: string]: string;
    }, enableCompression: boolean);
    get state(): ConnectionState;
    open(): Promise<ConnectionOpenResponse>;
    send(message: ConnectionMessage): Promise<void>;
    read(): Promise<ConnectionMessage>;
    close(reason?: string): Promise<void>;
    get events(): EventSource<ConnectionEvent>;
    private sendRawMessage;
    private onClose;
    private processSendQueue;
    private onEvent;
    private getAgent;
    private static GetProxyAgent;
    private createConnection;
    private get isWebsocketOpen();
}
