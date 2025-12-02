import { Fetch, FetchOptions } from "./Fetch";
export declare type IKeyFactory = () => string;
export declare type IFetch = typeof fetch;
export declare type IWebSocket = typeof WebSocket;
interface TransportFetchOptions extends TransportOptions, FetchOptions {
}
interface TransportWebSocketOptions extends TransportOptions {
    _nodeOnlyHeaders?: {
        [index: string]: any;
    };
}
declare type TransportUrl = string;
interface TransportOptions {
    url?: TransportUrl;
    proxy?: {
        url: TransportUrl;
    };
}
interface ITransport<C, O> {
    client?: C;
    options?: O;
}
export declare type DefaultNamespaceOptions = {
    key: string;
    fetch: {
        options: {
            url: TransportUrl;
        };
    };
    websocket: {
        options: {
            url: TransportUrl;
        };
    };
} & NamespaceOptions;
export interface NamespaceOptions {
    key?: string;
    fetch?: ITransport<IFetch, TransportFetchOptions>;
    websocket?: ITransport<IWebSocket, TransportWebSocketOptions>;
}
export declare type DefaultClientOptions = {
    global: Partial<DefaultNamespaceOptions>;
} & DeepgramClientOptions;
/**
 * Configures the options for a Deepgram client.
 *
 * The `DeepgramClientOptions` interface defines the configuration options for a Deepgram client. It includes options for various namespaces, such as `global`, `listen`, `manage`, `onprem`, `read`, and `speak`. Each namespace has its own options for configuring the transport, including the URL, proxy, and options for the fetch and WebSocket clients.
 *
 * The `global` namespace is used to configure options that apply globally to the Deepgram client. The other namespaces are used to configure options specific to different Deepgram API endpoints.
 * Support introductory formats:
 * - fetch: FetchOptions;
 * - _experimentalCustomFetch?: Fetch;
 * - restProxy?: {
 *     url: null | string;
 *   };
 */
export interface DeepgramClientOptions {
    key?: string | IKeyFactory;
    global?: NamespaceOptions & {
        url?: string;
        headers?: {
            [index: string]: any;
        };
    };
    listen?: NamespaceOptions;
    manage?: NamespaceOptions;
    onprem?: NamespaceOptions;
    read?: NamespaceOptions;
    speak?: NamespaceOptions;
    agent?: NamespaceOptions;
    /**
     * @deprecated as of 3.4, use a namespace like `global` instead
     */
    fetch?: FetchOptions;
    /**
     * @deprecated as of 3.4, use a namespace like `global` instead
     */
    _experimentalCustomFetch?: Fetch;
    /**
     * @deprecated as of 3.4, use a namespace like `global` instead
     */
    restProxy?: {
        url: null | string;
    };
}
export {};
//# sourceMappingURL=DeepgramClientOptions.d.ts.map