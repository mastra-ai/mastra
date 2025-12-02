import { Protocol, ProtocolOptions, RequestOptions } from '../shared/protocol.js';
import { ClientCapabilities, CreateMessageRequest, ElicitRequest, ElicitResult, Implementation, ListRootsRequest, LoggingMessageNotification, Notification, Request, ResourceUpdatedNotification, Result, ServerCapabilities, ServerNotification, ServerRequest, ServerResult } from '../types.js';
export type ServerOptions = ProtocolOptions & {
    /**
     * Capabilities to advertise as being supported by this server.
     */
    capabilities?: ServerCapabilities;
    /**
     * Optional instructions describing how to use the server and its features.
     */
    instructions?: string;
};
/**
 * An MCP server on top of a pluggable transport.
 *
 * This server will automatically respond to the initialization flow as initiated from the client.
 *
 * To use with custom types, extend the base Request/Notification/Result types and pass them as type parameters:
 *
 * ```typescript
 * // Custom schemas
 * const CustomRequestSchema = RequestSchema.extend({...})
 * const CustomNotificationSchema = NotificationSchema.extend({...})
 * const CustomResultSchema = ResultSchema.extend({...})
 *
 * // Type aliases
 * type CustomRequest = z.infer<typeof CustomRequestSchema>
 * type CustomNotification = z.infer<typeof CustomNotificationSchema>
 * type CustomResult = z.infer<typeof CustomResultSchema>
 *
 * // Create typed server
 * const server = new Server<CustomRequest, CustomNotification, CustomResult>({
 *   name: "CustomServer",
 *   version: "1.0.0"
 * })
 * ```
 */
export declare class Server<RequestT extends Request = Request, NotificationT extends Notification = Notification, ResultT extends Result = Result> extends Protocol<ServerRequest | RequestT, ServerNotification | NotificationT, ServerResult | ResultT> {
    private _serverInfo;
    private _clientCapabilities?;
    private _clientVersion?;
    private _capabilities;
    private _instructions?;
    /**
     * Callback for when initialization has fully completed (i.e., the client has sent an `initialized` notification).
     */
    oninitialized?: () => void;
    /**
     * Initializes this server with the given name and version information.
     */
    constructor(_serverInfo: Implementation, options?: ServerOptions);
    private _loggingLevels;
    private readonly LOG_LEVEL_SEVERITY;
    private isMessageIgnored;
    /**
     * Registers new capabilities. This can only be called before connecting to a transport.
     *
     * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
     */
    registerCapabilities(capabilities: ServerCapabilities): void;
    protected assertCapabilityForMethod(method: RequestT['method']): void;
    protected assertNotificationCapability(method: (ServerNotification | NotificationT)['method']): void;
    protected assertRequestHandlerCapability(method: string): void;
    private _oninitialize;
    /**
     * After initialization has completed, this will be populated with the client's reported capabilities.
     */
    getClientCapabilities(): ClientCapabilities | undefined;
    /**
     * After initialization has completed, this will be populated with information about the client's name and version.
     */
    getClientVersion(): Implementation | undefined;
    private getCapabilities;
    ping(): Promise<{
        _meta?: import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough"> | undefined;
    }>;
    createMessage(params: CreateMessageRequest['params'], options?: RequestOptions): Promise<import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, {
        model: import("zod").ZodString;
        stopReason: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodEnum<["endTurn", "stopSequence", "maxTokens"]>, import("zod").ZodString]>>;
        role: import("zod").ZodEnum<["user", "assistant"]>;
        content: import("zod").ZodDiscriminatedUnion<"type", [import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"text">;
            text: import("zod").ZodString;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
            type: import("zod").ZodLiteral<"text">;
            text: import("zod").ZodString;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
            type: import("zod").ZodLiteral<"text">;
            text: import("zod").ZodString;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"image">;
            data: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            mimeType: import("zod").ZodString;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
            type: import("zod").ZodLiteral<"image">;
            data: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            mimeType: import("zod").ZodString;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
            type: import("zod").ZodLiteral<"image">;
            data: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            mimeType: import("zod").ZodString;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"audio">;
            data: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            mimeType: import("zod").ZodString;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
            type: import("zod").ZodLiteral<"audio">;
            data: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            mimeType: import("zod").ZodString;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
            type: import("zod").ZodLiteral<"audio">;
            data: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            mimeType: import("zod").ZodString;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, import("zod").ZodTypeAny, "passthrough">>]>;
    }>, import("zod").ZodTypeAny, "passthrough">>;
    elicitInput(params: ElicitRequest['params'], options?: RequestOptions): Promise<ElicitResult>;
    listRoots(params?: ListRootsRequest['params'], options?: RequestOptions): Promise<import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, {
        roots: import("zod").ZodArray<import("zod").ZodObject<{
            uri: import("zod").ZodString;
            name: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
            uri: import("zod").ZodString;
            name: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
            uri: import("zod").ZodString;
            name: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, import("zod").ZodTypeAny, "passthrough">>, "many">;
    }>, import("zod").ZodTypeAny, "passthrough">>;
    /**
     * Sends a logging message to the client, if connected.
     * Note: You only need to send the parameters object, not the entire JSON RPC message
     * @see LoggingMessageNotification
     * @param params
     * @param sessionId optional for stateless and backward compatibility
     */
    sendLoggingMessage(params: LoggingMessageNotification['params'], sessionId?: string): Promise<void>;
    sendResourceUpdated(params: ResourceUpdatedNotification['params']): Promise<void>;
    sendResourceListChanged(): Promise<void>;
    sendToolListChanged(): Promise<void>;
    sendPromptListChanged(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map