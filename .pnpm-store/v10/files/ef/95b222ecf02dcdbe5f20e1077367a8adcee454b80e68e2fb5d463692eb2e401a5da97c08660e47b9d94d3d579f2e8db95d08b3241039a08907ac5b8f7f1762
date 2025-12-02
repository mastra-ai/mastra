import { ZodLiteral, ZodObject, ZodType, z } from 'zod';
import { ClientCapabilities, JSONRPCRequest, Notification, Progress, Request, RequestId, Result, ServerCapabilities, RequestMeta, RequestInfo } from '../types.js';
import { Transport, TransportSendOptions } from './transport.js';
import { AuthInfo } from '../server/auth/types.js';
/**
 * Callback for progress notifications.
 */
export type ProgressCallback = (progress: Progress) => void;
/**
 * Additional initialization options.
 */
export type ProtocolOptions = {
    /**
     * Whether to restrict emitted requests to only those that the remote side has indicated that they can handle, through their advertised capabilities.
     *
     * Note that this DOES NOT affect checking of _local_ side capabilities, as it is considered a logic error to mis-specify those.
     *
     * Currently this defaults to false, for backwards compatibility with SDK versions that did not advertise capabilities correctly. In future, this will default to true.
     */
    enforceStrictCapabilities?: boolean;
    /**
     * An array of notification method names that should be automatically debounced.
     * Any notifications with a method in this list will be coalesced if they
     * occur in the same tick of the event loop.
     * e.g., ['notifications/tools/list_changed']
     */
    debouncedNotificationMethods?: string[];
};
/**
 * The default request timeout, in miliseconds.
 */
export declare const DEFAULT_REQUEST_TIMEOUT_MSEC = 60000;
/**
 * Options that can be given per request.
 */
export type RequestOptions = {
    /**
     * If set, requests progress notifications from the remote end (if supported). When progress notifications are received, this callback will be invoked.
     */
    onprogress?: ProgressCallback;
    /**
     * Can be used to cancel an in-flight request. This will cause an AbortError to be raised from request().
     */
    signal?: AbortSignal;
    /**
     * A timeout (in milliseconds) for this request. If exceeded, an McpError with code `RequestTimeout` will be raised from request().
     *
     * If not specified, `DEFAULT_REQUEST_TIMEOUT_MSEC` will be used as the timeout.
     */
    timeout?: number;
    /**
     * If true, receiving a progress notification will reset the request timeout.
     * This is useful for long-running operations that send periodic progress updates.
     * Default: false
     */
    resetTimeoutOnProgress?: boolean;
    /**
     * Maximum total time (in milliseconds) to wait for a response.
     * If exceeded, an McpError with code `RequestTimeout` will be raised, regardless of progress notifications.
     * If not specified, there is no maximum total timeout.
     */
    maxTotalTimeout?: number;
} & TransportSendOptions;
/**
 * Options that can be given per notification.
 */
export type NotificationOptions = {
    /**
     * May be used to indicate to the transport which incoming request to associate this outgoing notification with.
     */
    relatedRequestId?: RequestId;
};
/**
 * Extra data given to request handlers.
 */
export type RequestHandlerExtra<SendRequestT extends Request, SendNotificationT extends Notification> = {
    /**
     * An abort signal used to communicate if the request was cancelled from the sender's side.
     */
    signal: AbortSignal;
    /**
     * Information about a validated access token, provided to request handlers.
     */
    authInfo?: AuthInfo;
    /**
     * The session ID from the transport, if available.
     */
    sessionId?: string;
    /**
     * Metadata from the original request.
     */
    _meta?: RequestMeta;
    /**
     * The JSON-RPC ID of the request being handled.
     * This can be useful for tracking or logging purposes.
     */
    requestId: RequestId;
    /**
     * The original HTTP request.
     */
    requestInfo?: RequestInfo;
    /**
     * Sends a notification that relates to the current request being handled.
     *
     * This is used by certain transports to correctly associate related messages.
     */
    sendNotification: (notification: SendNotificationT) => Promise<void>;
    /**
     * Sends a request that relates to the current request being handled.
     *
     * This is used by certain transports to correctly associate related messages.
     */
    sendRequest: <U extends ZodType<object>>(request: SendRequestT, resultSchema: U, options?: RequestOptions) => Promise<z.infer<U>>;
};
/**
 * Implements MCP protocol framing on top of a pluggable transport, including
 * features like request/response linking, notifications, and progress.
 */
export declare abstract class Protocol<SendRequestT extends Request, SendNotificationT extends Notification, SendResultT extends Result> {
    private _options?;
    private _transport?;
    private _requestMessageId;
    private _requestHandlers;
    private _requestHandlerAbortControllers;
    private _notificationHandlers;
    private _responseHandlers;
    private _progressHandlers;
    private _timeoutInfo;
    private _pendingDebouncedNotifications;
    /**
     * Callback for when the connection is closed for any reason.
     *
     * This is invoked when close() is called as well.
     */
    onclose?: () => void;
    /**
     * Callback for when an error occurs.
     *
     * Note that errors are not necessarily fatal; they are used for reporting any kind of exceptional condition out of band.
     */
    onerror?: (error: Error) => void;
    /**
     * A handler to invoke for any request types that do not have their own handler installed.
     */
    fallbackRequestHandler?: (request: JSONRPCRequest, extra: RequestHandlerExtra<SendRequestT, SendNotificationT>) => Promise<SendResultT>;
    /**
     * A handler to invoke for any notification types that do not have their own handler installed.
     */
    fallbackNotificationHandler?: (notification: Notification) => Promise<void>;
    constructor(_options?: ProtocolOptions | undefined);
    private _setupTimeout;
    private _resetTimeout;
    private _cleanupTimeout;
    /**
     * Attaches to the given transport, starts it, and starts listening for messages.
     *
     * The Protocol object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
     */
    connect(transport: Transport): Promise<void>;
    private _onclose;
    private _onerror;
    private _onnotification;
    private _onrequest;
    private _onprogress;
    private _onresponse;
    get transport(): Transport | undefined;
    /**
     * Closes the connection.
     */
    close(): Promise<void>;
    /**
     * A method to check if a capability is supported by the remote side, for the given method to be called.
     *
     * This should be implemented by subclasses.
     */
    protected abstract assertCapabilityForMethod(method: SendRequestT['method']): void;
    /**
     * A method to check if a notification is supported by the local side, for the given method to be sent.
     *
     * This should be implemented by subclasses.
     */
    protected abstract assertNotificationCapability(method: SendNotificationT['method']): void;
    /**
     * A method to check if a request handler is supported by the local side, for the given method to be handled.
     *
     * This should be implemented by subclasses.
     */
    protected abstract assertRequestHandlerCapability(method: string): void;
    /**
     * Sends a request and wait for a response.
     *
     * Do not use this method to emit notifications! Use notification() instead.
     */
    request<T extends ZodType<object>>(request: SendRequestT, resultSchema: T, options?: RequestOptions): Promise<z.infer<T>>;
    /**
     * Emits a notification, which is a one-way message that does not expect a response.
     */
    notification(notification: SendNotificationT, options?: NotificationOptions): Promise<void>;
    /**
     * Registers a handler to invoke when this protocol object receives a request with the given method.
     *
     * Note that this will replace any previous request handler for the same method.
     */
    setRequestHandler<T extends ZodObject<{
        method: ZodLiteral<string>;
    }>>(requestSchema: T, handler: (request: z.infer<T>, extra: RequestHandlerExtra<SendRequestT, SendNotificationT>) => SendResultT | Promise<SendResultT>): void;
    /**
     * Removes the request handler for the given method.
     */
    removeRequestHandler(method: string): void;
    /**
     * Asserts that a request handler has not already been set for the given method, in preparation for a new one being automatically installed.
     */
    assertCanSetRequestHandler(method: string): void;
    /**
     * Registers a handler to invoke when this protocol object receives a notification with the given method.
     *
     * Note that this will replace any previous notification handler for the same method.
     */
    setNotificationHandler<T extends ZodObject<{
        method: ZodLiteral<string>;
    }>>(notificationSchema: T, handler: (notification: z.infer<T>) => void | Promise<void>): void;
    /**
     * Removes the notification handler for the given method.
     */
    removeNotificationHandler(method: string): void;
}
export declare function mergeCapabilities<T extends ServerCapabilities | ClientCapabilities>(base: T, additional: T): T;
//# sourceMappingURL=protocol.d.ts.map