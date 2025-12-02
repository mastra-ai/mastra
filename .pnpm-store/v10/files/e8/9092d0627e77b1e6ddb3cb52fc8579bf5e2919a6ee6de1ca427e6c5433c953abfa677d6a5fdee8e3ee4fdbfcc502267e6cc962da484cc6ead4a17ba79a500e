import { Protocol, ProtocolOptions, RequestOptions } from '../shared/protocol.js';
import { Transport } from '../shared/transport.js';
import { CallToolRequest, CallToolResultSchema, ClientCapabilities, ClientNotification, ClientRequest, ClientResult, CompatibilityCallToolResultSchema, CompleteRequest, GetPromptRequest, Implementation, ListPromptsRequest, ListResourcesRequest, ListResourceTemplatesRequest, ListToolsRequest, LoggingLevel, Notification, ReadResourceRequest, Request, Result, ServerCapabilities, SubscribeRequest, UnsubscribeRequest } from '../types.js';
export type ClientOptions = ProtocolOptions & {
    /**
     * Capabilities to advertise as being supported by this client.
     */
    capabilities?: ClientCapabilities;
};
/**
 * An MCP client on top of a pluggable transport.
 *
 * The client will automatically begin the initialization flow with the server when connect() is called.
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
 * // Create typed client
 * const client = new Client<CustomRequest, CustomNotification, CustomResult>({
 *   name: "CustomClient",
 *   version: "1.0.0"
 * })
 * ```
 */
export declare class Client<RequestT extends Request = Request, NotificationT extends Notification = Notification, ResultT extends Result = Result> extends Protocol<ClientRequest | RequestT, ClientNotification | NotificationT, ClientResult | ResultT> {
    private _clientInfo;
    private _serverCapabilities?;
    private _serverVersion?;
    private _capabilities;
    private _instructions?;
    private _cachedToolOutputValidators;
    private _ajv;
    /**
     * Initializes this client with the given name and version information.
     */
    constructor(_clientInfo: Implementation, options?: ClientOptions);
    /**
     * Registers new capabilities. This can only be called before connecting to a transport.
     *
     * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
     */
    registerCapabilities(capabilities: ClientCapabilities): void;
    protected assertCapability(capability: keyof ServerCapabilities, method: string): void;
    connect(transport: Transport, options?: RequestOptions): Promise<void>;
    /**
     * After initialization has completed, this will be populated with the server's reported capabilities.
     */
    getServerCapabilities(): ServerCapabilities | undefined;
    /**
     * After initialization has completed, this will be populated with information about the server's name and version.
     */
    getServerVersion(): Implementation | undefined;
    /**
     * After initialization has completed, this may be populated with information about the server's instructions.
     */
    getInstructions(): string | undefined;
    protected assertCapabilityForMethod(method: RequestT['method']): void;
    protected assertNotificationCapability(method: NotificationT['method']): void;
    protected assertRequestHandlerCapability(method: string): void;
    ping(options?: RequestOptions): Promise<{
        _meta?: import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough"> | undefined;
    }>;
    complete(params: CompleteRequest['params'], options?: RequestOptions): Promise<import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, {
        completion: import("zod").ZodObject<{
            values: import("zod").ZodArray<import("zod").ZodString, "many">;
            total: import("zod").ZodOptional<import("zod").ZodNumber>;
            hasMore: import("zod").ZodOptional<import("zod").ZodBoolean>;
        }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
            values: import("zod").ZodArray<import("zod").ZodString, "many">;
            total: import("zod").ZodOptional<import("zod").ZodNumber>;
            hasMore: import("zod").ZodOptional<import("zod").ZodBoolean>;
        }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
            values: import("zod").ZodArray<import("zod").ZodString, "many">;
            total: import("zod").ZodOptional<import("zod").ZodNumber>;
            hasMore: import("zod").ZodOptional<import("zod").ZodBoolean>;
        }, import("zod").ZodTypeAny, "passthrough">>;
    }>, import("zod").ZodTypeAny, "passthrough">>;
    setLoggingLevel(level: LoggingLevel, options?: RequestOptions): Promise<{
        _meta?: import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough"> | undefined;
    }>;
    getPrompt(params: GetPromptRequest['params'], options?: RequestOptions): Promise<import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, {
        description: import("zod").ZodOptional<import("zod").ZodString>;
        messages: import("zod").ZodArray<import("zod").ZodObject<{
            role: import("zod").ZodEnum<["user", "assistant"]>;
            content: import("zod").ZodUnion<[import("zod").ZodObject<{
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
            }, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
                name: import("zod").ZodString;
                title: import("zod").ZodOptional<import("zod").ZodString>;
            }, {
                uri: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }>, {
                icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            }>, {
                type: import("zod").ZodLiteral<"resource_link">;
            }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
                name: import("zod").ZodString;
                title: import("zod").ZodOptional<import("zod").ZodString>;
            }, {
                uri: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }>, {
                icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            }>, {
                type: import("zod").ZodLiteral<"resource_link">;
            }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
                name: import("zod").ZodString;
                title: import("zod").ZodOptional<import("zod").ZodString>;
            }, {
                uri: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }>, {
                icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            }>, {
                type: import("zod").ZodLiteral<"resource_link">;
            }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"resource">;
                resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">>]>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                type: import("zod").ZodLiteral<"resource">;
                resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">>]>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                type: import("zod").ZodLiteral<"resource">;
                resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">>]>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, import("zod").ZodTypeAny, "passthrough">>]>;
        }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
            role: import("zod").ZodEnum<["user", "assistant"]>;
            content: import("zod").ZodUnion<[import("zod").ZodObject<{
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
            }, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
                name: import("zod").ZodString;
                title: import("zod").ZodOptional<import("zod").ZodString>;
            }, {
                uri: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }>, {
                icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            }>, {
                type: import("zod").ZodLiteral<"resource_link">;
            }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
                name: import("zod").ZodString;
                title: import("zod").ZodOptional<import("zod").ZodString>;
            }, {
                uri: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }>, {
                icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            }>, {
                type: import("zod").ZodLiteral<"resource_link">;
            }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
                name: import("zod").ZodString;
                title: import("zod").ZodOptional<import("zod").ZodString>;
            }, {
                uri: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }>, {
                icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            }>, {
                type: import("zod").ZodLiteral<"resource_link">;
            }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"resource">;
                resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">>]>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                type: import("zod").ZodLiteral<"resource">;
                resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">>]>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                type: import("zod").ZodLiteral<"resource">;
                resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">>]>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, import("zod").ZodTypeAny, "passthrough">>]>;
        }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
            role: import("zod").ZodEnum<["user", "assistant"]>;
            content: import("zod").ZodUnion<[import("zod").ZodObject<{
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
            }, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
                name: import("zod").ZodString;
                title: import("zod").ZodOptional<import("zod").ZodString>;
            }, {
                uri: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }>, {
                icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            }>, {
                type: import("zod").ZodLiteral<"resource_link">;
            }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
                name: import("zod").ZodString;
                title: import("zod").ZodOptional<import("zod").ZodString>;
            }, {
                uri: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }>, {
                icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            }>, {
                type: import("zod").ZodLiteral<"resource_link">;
            }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
                name: import("zod").ZodString;
                title: import("zod").ZodOptional<import("zod").ZodString>;
            }, {
                uri: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }>, {
                icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                    src: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
                }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            }>, {
                type: import("zod").ZodLiteral<"resource_link">;
            }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"resource">;
                resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">>]>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                type: import("zod").ZodLiteral<"resource">;
                resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">>]>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                type: import("zod").ZodLiteral<"resource">;
                resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    text: import("zod").ZodString;
                }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                    uri: import("zod").ZodString;
                    mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                }, {
                    blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }>, import("zod").ZodTypeAny, "passthrough">>]>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, import("zod").ZodTypeAny, "passthrough">>]>;
        }, import("zod").ZodTypeAny, "passthrough">>, "many">;
    }>, import("zod").ZodTypeAny, "passthrough">>;
    listPrompts(params?: ListPromptsRequest['params'], options?: RequestOptions): Promise<import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, {
        nextCursor: import("zod").ZodOptional<import("zod").ZodString>;
    }>, {
        prompts: import("zod").ZodArray<import("zod").ZodObject<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            description: import("zod").ZodOptional<import("zod").ZodString>;
            arguments: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                name: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                required: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                name: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                required: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                name: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                required: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            description: import("zod").ZodOptional<import("zod").ZodString>;
            arguments: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                name: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                required: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                name: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                required: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                name: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                required: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            description: import("zod").ZodOptional<import("zod").ZodString>;
            arguments: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                name: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                required: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                name: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                required: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                name: import("zod").ZodString;
                description: import("zod").ZodOptional<import("zod").ZodString>;
                required: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, import("zod").ZodTypeAny, "passthrough">>, "many">;
    }>, import("zod").ZodTypeAny, "passthrough">>;
    listResources(params?: ListResourcesRequest['params'], options?: RequestOptions): Promise<import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, {
        nextCursor: import("zod").ZodOptional<import("zod").ZodString>;
    }>, {
        resources: import("zod").ZodArray<import("zod").ZodObject<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            uri: import("zod").ZodString;
            description: import("zod").ZodOptional<import("zod").ZodString>;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            uri: import("zod").ZodString;
            description: import("zod").ZodOptional<import("zod").ZodString>;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            uri: import("zod").ZodString;
            description: import("zod").ZodOptional<import("zod").ZodString>;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, import("zod").ZodTypeAny, "passthrough">>, "many">;
    }>, import("zod").ZodTypeAny, "passthrough">>;
    listResourceTemplates(params?: ListResourceTemplatesRequest['params'], options?: RequestOptions): Promise<import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, {
        nextCursor: import("zod").ZodOptional<import("zod").ZodString>;
    }>, {
        resourceTemplates: import("zod").ZodArray<import("zod").ZodObject<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            uriTemplate: import("zod").ZodString;
            description: import("zod").ZodOptional<import("zod").ZodString>;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            uriTemplate: import("zod").ZodString;
            description: import("zod").ZodOptional<import("zod").ZodString>;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            uriTemplate: import("zod").ZodString;
            description: import("zod").ZodOptional<import("zod").ZodString>;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, import("zod").ZodTypeAny, "passthrough">>, "many">;
    }>, import("zod").ZodTypeAny, "passthrough">>;
    readResource(params: ReadResourceRequest['params'], options?: RequestOptions): Promise<import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, {
        contents: import("zod").ZodArray<import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
            uri: import("zod").ZodString;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, {
            text: import("zod").ZodString;
        }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
            uri: import("zod").ZodString;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, {
            text: import("zod").ZodString;
        }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
            uri: import("zod").ZodString;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, {
            text: import("zod").ZodString;
        }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
            uri: import("zod").ZodString;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, {
            blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
        }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
            uri: import("zod").ZodString;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, {
            blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
        }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
            uri: import("zod").ZodString;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, {
            blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
        }>, import("zod").ZodTypeAny, "passthrough">>]>, "many">;
    }>, import("zod").ZodTypeAny, "passthrough">>;
    subscribeResource(params: SubscribeRequest['params'], options?: RequestOptions): Promise<{
        _meta?: import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough"> | undefined;
    }>;
    unsubscribeResource(params: UnsubscribeRequest['params'], options?: RequestOptions): Promise<{
        _meta?: import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough"> | undefined;
    }>;
    callTool(params: CallToolRequest['params'], resultSchema?: typeof CallToolResultSchema | typeof CompatibilityCallToolResultSchema, options?: RequestOptions): Promise<import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, {
        content: import("zod").ZodDefault<import("zod").ZodArray<import("zod").ZodUnion<[import("zod").ZodObject<{
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
        }, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            uri: import("zod").ZodString;
            description: import("zod").ZodOptional<import("zod").ZodString>;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, {
            type: import("zod").ZodLiteral<"resource_link">;
        }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            uri: import("zod").ZodString;
            description: import("zod").ZodOptional<import("zod").ZodString>;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, {
            type: import("zod").ZodLiteral<"resource_link">;
        }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            uri: import("zod").ZodString;
            description: import("zod").ZodOptional<import("zod").ZodString>;
            mimeType: import("zod").ZodOptional<import("zod").ZodString>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, {
            type: import("zod").ZodLiteral<"resource_link">;
        }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"resource">;
            resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                text: import("zod").ZodString;
            }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                text: import("zod").ZodString;
            }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                text: import("zod").ZodString;
            }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }>, import("zod").ZodTypeAny, "passthrough">>]>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
            type: import("zod").ZodLiteral<"resource">;
            resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                text: import("zod").ZodString;
            }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                text: import("zod").ZodString;
            }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                text: import("zod").ZodString;
            }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }>, import("zod").ZodTypeAny, "passthrough">>]>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
            type: import("zod").ZodLiteral<"resource">;
            resource: import("zod").ZodUnion<[import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                text: import("zod").ZodString;
            }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                text: import("zod").ZodString;
            }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                text: import("zod").ZodString;
            }>, import("zod").ZodTypeAny, "passthrough">>, import("zod").ZodObject<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<{
                uri: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
            }, {
                blob: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }>, import("zod").ZodTypeAny, "passthrough">>]>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }, import("zod").ZodTypeAny, "passthrough">>]>, "many">>;
        structuredContent: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        isError: import("zod").ZodOptional<import("zod").ZodBoolean>;
    }>, import("zod").ZodTypeAny, "passthrough"> | import("zod").objectOutputType<import("zod").objectUtil.extendShape<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, {
        toolResult: import("zod").ZodUnknown;
    }>, import("zod").ZodTypeAny, "passthrough">>;
    private cacheToolOutputSchemas;
    private getToolOutputValidator;
    listTools(params?: ListToolsRequest['params'], options?: RequestOptions): Promise<import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, {
        nextCursor: import("zod").ZodOptional<import("zod").ZodString>;
    }>, {
        tools: import("zod").ZodArray<import("zod").ZodObject<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            description: import("zod").ZodOptional<import("zod").ZodString>;
            inputSchema: import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>;
            outputSchema: import("zod").ZodOptional<import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>>;
            annotations: import("zod").ZodOptional<import("zod").ZodObject<{
                title: import("zod").ZodOptional<import("zod").ZodString>;
                readOnlyHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                destructiveHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                idempotentHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                openWorldHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                title: import("zod").ZodOptional<import("zod").ZodString>;
                readOnlyHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                destructiveHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                idempotentHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                openWorldHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                title: import("zod").ZodOptional<import("zod").ZodString>;
                readOnlyHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                destructiveHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                idempotentHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                openWorldHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">>>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            description: import("zod").ZodOptional<import("zod").ZodString>;
            inputSchema: import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>;
            outputSchema: import("zod").ZodOptional<import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>>;
            annotations: import("zod").ZodOptional<import("zod").ZodObject<{
                title: import("zod").ZodOptional<import("zod").ZodString>;
                readOnlyHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                destructiveHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                idempotentHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                openWorldHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                title: import("zod").ZodOptional<import("zod").ZodString>;
                readOnlyHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                destructiveHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                idempotentHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                openWorldHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                title: import("zod").ZodOptional<import("zod").ZodString>;
                readOnlyHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                destructiveHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                idempotentHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                openWorldHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">>>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<import("zod").objectUtil.extendShape<import("zod").objectUtil.extendShape<{
            name: import("zod").ZodString;
            title: import("zod").ZodOptional<import("zod").ZodString>;
        }, {
            description: import("zod").ZodOptional<import("zod").ZodString>;
            inputSchema: import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>;
            outputSchema: import("zod").ZodOptional<import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                type: import("zod").ZodLiteral<"object">;
                properties: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
                required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>>;
            annotations: import("zod").ZodOptional<import("zod").ZodObject<{
                title: import("zod").ZodOptional<import("zod").ZodString>;
                readOnlyHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                destructiveHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                idempotentHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                openWorldHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                title: import("zod").ZodOptional<import("zod").ZodString>;
                readOnlyHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                destructiveHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                idempotentHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                openWorldHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                title: import("zod").ZodOptional<import("zod").ZodString>;
                readOnlyHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                destructiveHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                idempotentHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
                openWorldHint: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod").ZodTypeAny, "passthrough">>>;
            _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
        }>, {
            icons: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
                src: import("zod").ZodString;
                mimeType: import("zod").ZodOptional<import("zod").ZodString>;
                sizes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            }, import("zod").ZodTypeAny, "passthrough">>, "many">>;
        }>, import("zod").ZodTypeAny, "passthrough">>, "many">;
    }>, import("zod").ZodTypeAny, "passthrough">>;
    sendRootsListChanged(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map