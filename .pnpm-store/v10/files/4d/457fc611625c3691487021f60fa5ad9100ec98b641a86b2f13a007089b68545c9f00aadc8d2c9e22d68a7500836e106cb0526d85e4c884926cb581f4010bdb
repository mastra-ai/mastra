import { z } from 'zod';
export const LATEST_PROTOCOL_VERSION = '2025-06-18';
export const DEFAULT_NEGOTIATED_PROTOCOL_VERSION = '2025-03-26';
export const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, '2025-03-26', '2024-11-05', '2024-10-07'];
/* JSON-RPC types */
export const JSONRPC_VERSION = '2.0';
/**
 * A progress token, used to associate progress notifications with the original request.
 */
export const ProgressTokenSchema = z.union([z.string(), z.number().int()]);
/**
 * An opaque token used to represent a cursor for pagination.
 */
export const CursorSchema = z.string();
const RequestMetaSchema = z
    .object({
    /**
     * If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.
     */
    progressToken: z.optional(ProgressTokenSchema)
})
    .passthrough();
const BaseRequestParamsSchema = z
    .object({
    _meta: z.optional(RequestMetaSchema)
})
    .passthrough();
export const RequestSchema = z.object({
    method: z.string(),
    params: z.optional(BaseRequestParamsSchema)
});
const BaseNotificationParamsSchema = z
    .object({
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
})
    .passthrough();
export const NotificationSchema = z.object({
    method: z.string(),
    params: z.optional(BaseNotificationParamsSchema)
});
export const ResultSchema = z
    .object({
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
})
    .passthrough();
/**
 * A uniquely identifying ID for a request in JSON-RPC.
 */
export const RequestIdSchema = z.union([z.string(), z.number().int()]);
/**
 * A request that expects a response.
 */
export const JSONRPCRequestSchema = z
    .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: RequestIdSchema
})
    .merge(RequestSchema)
    .strict();
export const isJSONRPCRequest = (value) => JSONRPCRequestSchema.safeParse(value).success;
/**
 * A notification which does not expect a response.
 */
export const JSONRPCNotificationSchema = z
    .object({
    jsonrpc: z.literal(JSONRPC_VERSION)
})
    .merge(NotificationSchema)
    .strict();
export const isJSONRPCNotification = (value) => JSONRPCNotificationSchema.safeParse(value).success;
/**
 * A successful (non-error) response to a request.
 */
export const JSONRPCResponseSchema = z
    .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: RequestIdSchema,
    result: ResultSchema
})
    .strict();
export const isJSONRPCResponse = (value) => JSONRPCResponseSchema.safeParse(value).success;
/**
 * Error codes defined by the JSON-RPC specification.
 */
export var ErrorCode;
(function (ErrorCode) {
    // SDK error codes
    ErrorCode[ErrorCode["ConnectionClosed"] = -32000] = "ConnectionClosed";
    ErrorCode[ErrorCode["RequestTimeout"] = -32001] = "RequestTimeout";
    // Standard JSON-RPC error codes
    ErrorCode[ErrorCode["ParseError"] = -32700] = "ParseError";
    ErrorCode[ErrorCode["InvalidRequest"] = -32600] = "InvalidRequest";
    ErrorCode[ErrorCode["MethodNotFound"] = -32601] = "MethodNotFound";
    ErrorCode[ErrorCode["InvalidParams"] = -32602] = "InvalidParams";
    ErrorCode[ErrorCode["InternalError"] = -32603] = "InternalError";
})(ErrorCode || (ErrorCode = {}));
/**
 * A response to a request that indicates an error occurred.
 */
export const JSONRPCErrorSchema = z
    .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: RequestIdSchema,
    error: z.object({
        /**
         * The error type that occurred.
         */
        code: z.number().int(),
        /**
         * A short description of the error. The message SHOULD be limited to a concise single sentence.
         */
        message: z.string(),
        /**
         * Additional information about the error. The value of this member is defined by the sender (e.g. detailed error information, nested errors etc.).
         */
        data: z.optional(z.unknown())
    })
})
    .strict();
export const isJSONRPCError = (value) => JSONRPCErrorSchema.safeParse(value).success;
export const JSONRPCMessageSchema = z.union([JSONRPCRequestSchema, JSONRPCNotificationSchema, JSONRPCResponseSchema, JSONRPCErrorSchema]);
/* Empty result */
/**
 * A response that indicates success but carries no data.
 */
export const EmptyResultSchema = ResultSchema.strict();
/* Cancellation */
/**
 * This notification can be sent by either side to indicate that it is cancelling a previously-issued request.
 *
 * The request SHOULD still be in-flight, but due to communication latency, it is always possible that this notification MAY arrive after the request has already finished.
 *
 * This notification indicates that the result will be unused, so any associated processing SHOULD cease.
 *
 * A client MUST NOT attempt to cancel its `initialize` request.
 */
export const CancelledNotificationSchema = NotificationSchema.extend({
    method: z.literal('notifications/cancelled'),
    params: BaseNotificationParamsSchema.extend({
        /**
         * The ID of the request to cancel.
         *
         * This MUST correspond to the ID of a request previously issued in the same direction.
         */
        requestId: RequestIdSchema,
        /**
         * An optional string describing the reason for the cancellation. This MAY be logged or presented to the user.
         */
        reason: z.string().optional()
    })
});
/* Base Metadata */
/**
 * Icon schema for use in tools, prompts, resources, and implementations.
 */
export const IconSchema = z
    .object({
    /**
     * URL or data URI for the icon.
     */
    src: z.string(),
    /**
     * Optional MIME type for the icon.
     */
    mimeType: z.optional(z.string()),
    /**
     * Optional array of strings that specify sizes at which the icon can be used.
     * Each string should be in WxH format (e.g., `"48x48"`, `"96x96"`) or `"any"` for scalable formats like SVG.
     *
     * If not provided, the client should assume that the icon can be used at any size.
     */
    sizes: z.optional(z.array(z.string()))
})
    .passthrough();
/**
 * Base schema to add `icons` property.
 *
 */
export const IconsSchema = z
    .object({
    /**
     * Optional set of sized icons that the client can display in a user interface.
     *
     * Clients that support rendering icons MUST support at least the following MIME types:
     * - `image/png` - PNG images (safe, universal compatibility)
     * - `image/jpeg` (and `image/jpg`) - JPEG images (safe, universal compatibility)
     *
     * Clients that support rendering icons SHOULD also support:
     * - `image/svg+xml` - SVG images (scalable but requires security precautions)
     * - `image/webp` - WebP images (modern, efficient format)
     */
    icons: z.array(IconSchema).optional()
})
    .passthrough();
/**
 * Base metadata interface for common properties across resources, tools, prompts, and implementations.
 */
export const BaseMetadataSchema = z
    .object({
    /** Intended for programmatic or logical use, but used as a display name in past specs or fallback */
    name: z.string(),
    /**
     * Intended for UI and end-user contexts — optimized to be human-readable and easily understood,
     * even by those unfamiliar with domain-specific terminology.
     *
     * If not provided, the name should be used for display (except for Tool,
     * where `annotations.title` should be given precedence over using `name`,
     * if present).
     */
    title: z.optional(z.string())
})
    .passthrough();
/* Initialization */
/**
 * Describes the name and version of an MCP implementation.
 */
export const ImplementationSchema = BaseMetadataSchema.extend({
    version: z.string(),
    /**
     * An optional URL of the website for this implementation.
     */
    websiteUrl: z.optional(z.string())
}).merge(IconsSchema);
/**
 * Capabilities a client may support. Known capabilities are defined here, in this schema, but this is not a closed set: any client can define its own, additional capabilities.
 */
export const ClientCapabilitiesSchema = z
    .object({
    /**
     * Experimental, non-standard capabilities that the client supports.
     */
    experimental: z.optional(z.object({}).passthrough()),
    /**
     * Present if the client supports sampling from an LLM.
     */
    sampling: z.optional(z.object({}).passthrough()),
    /**
     * Present if the client supports eliciting user input.
     */
    elicitation: z.optional(z.object({}).passthrough()),
    /**
     * Present if the client supports listing roots.
     */
    roots: z.optional(z
        .object({
        /**
         * Whether the client supports issuing notifications for changes to the roots list.
         */
        listChanged: z.optional(z.boolean())
    })
        .passthrough())
})
    .passthrough();
/**
 * This request is sent from the client to the server when it first connects, asking it to begin initialization.
 */
export const InitializeRequestSchema = RequestSchema.extend({
    method: z.literal('initialize'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The latest version of the Model Context Protocol that the client supports. The client MAY decide to support older versions as well.
         */
        protocolVersion: z.string(),
        capabilities: ClientCapabilitiesSchema,
        clientInfo: ImplementationSchema
    })
});
export const isInitializeRequest = (value) => InitializeRequestSchema.safeParse(value).success;
/**
 * Capabilities that a server may support. Known capabilities are defined here, in this schema, but this is not a closed set: any server can define its own, additional capabilities.
 */
export const ServerCapabilitiesSchema = z
    .object({
    /**
     * Experimental, non-standard capabilities that the server supports.
     */
    experimental: z.optional(z.object({}).passthrough()),
    /**
     * Present if the server supports sending log messages to the client.
     */
    logging: z.optional(z.object({}).passthrough()),
    /**
     * Present if the server supports sending completions to the client.
     */
    completions: z.optional(z.object({}).passthrough()),
    /**
     * Present if the server offers any prompt templates.
     */
    prompts: z.optional(z
        .object({
        /**
         * Whether this server supports issuing notifications for changes to the prompt list.
         */
        listChanged: z.optional(z.boolean())
    })
        .passthrough()),
    /**
     * Present if the server offers any resources to read.
     */
    resources: z.optional(z
        .object({
        /**
         * Whether this server supports clients subscribing to resource updates.
         */
        subscribe: z.optional(z.boolean()),
        /**
         * Whether this server supports issuing notifications for changes to the resource list.
         */
        listChanged: z.optional(z.boolean())
    })
        .passthrough()),
    /**
     * Present if the server offers any tools to call.
     */
    tools: z.optional(z
        .object({
        /**
         * Whether this server supports issuing notifications for changes to the tool list.
         */
        listChanged: z.optional(z.boolean())
    })
        .passthrough())
})
    .passthrough();
/**
 * After receiving an initialize request from the client, the server sends this response.
 */
export const InitializeResultSchema = ResultSchema.extend({
    /**
     * The version of the Model Context Protocol that the server wants to use. This may not match the version that the client requested. If the client cannot support this version, it MUST disconnect.
     */
    protocolVersion: z.string(),
    capabilities: ServerCapabilitiesSchema,
    serverInfo: ImplementationSchema,
    /**
     * Instructions describing how to use the server and its features.
     *
     * This can be used by clients to improve the LLM's understanding of available tools, resources, etc. It can be thought of like a "hint" to the model. For example, this information MAY be added to the system prompt.
     */
    instructions: z.optional(z.string())
});
/**
 * This notification is sent from the client to the server after initialization has finished.
 */
export const InitializedNotificationSchema = NotificationSchema.extend({
    method: z.literal('notifications/initialized')
});
export const isInitializedNotification = (value) => InitializedNotificationSchema.safeParse(value).success;
/* Ping */
/**
 * A ping, issued by either the server or the client, to check that the other party is still alive. The receiver must promptly respond, or else may be disconnected.
 */
export const PingRequestSchema = RequestSchema.extend({
    method: z.literal('ping')
});
/* Progress notifications */
export const ProgressSchema = z
    .object({
    /**
     * The progress thus far. This should increase every time progress is made, even if the total is unknown.
     */
    progress: z.number(),
    /**
     * Total number of items to process (or total progress required), if known.
     */
    total: z.optional(z.number()),
    /**
     * An optional message describing the current progress.
     */
    message: z.optional(z.string())
})
    .passthrough();
/**
 * An out-of-band notification used to inform the receiver of a progress update for a long-running request.
 */
export const ProgressNotificationSchema = NotificationSchema.extend({
    method: z.literal('notifications/progress'),
    params: BaseNotificationParamsSchema.merge(ProgressSchema).extend({
        /**
         * The progress token which was given in the initial request, used to associate this notification with the request that is proceeding.
         */
        progressToken: ProgressTokenSchema
    })
});
/* Pagination */
export const PaginatedRequestSchema = RequestSchema.extend({
    params: BaseRequestParamsSchema.extend({
        /**
         * An opaque token representing the current pagination position.
         * If provided, the server should return results starting after this cursor.
         */
        cursor: z.optional(CursorSchema)
    }).optional()
});
export const PaginatedResultSchema = ResultSchema.extend({
    /**
     * An opaque token representing the pagination position after the last returned result.
     * If present, there may be more results available.
     */
    nextCursor: z.optional(CursorSchema)
});
/* Resources */
/**
 * The contents of a specific resource or sub-resource.
 */
export const ResourceContentsSchema = z
    .object({
    /**
     * The URI of this resource.
     */
    uri: z.string(),
    /**
     * The MIME type of this resource, if known.
     */
    mimeType: z.optional(z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
})
    .passthrough();
export const TextResourceContentsSchema = ResourceContentsSchema.extend({
    /**
     * The text of the item. This must only be set if the item can actually be represented as text (not binary data).
     */
    text: z.string()
});
/**
 * A Zod schema for validating Base64 strings that is more performant and
 * robust for very large inputs than the default regex-based check. It avoids
 * stack overflows by using the native `atob` function for validation.
 */
const Base64Schema = z.string().refine(val => {
    try {
        // atob throws a DOMException if the string contains characters
        // that are not part of the Base64 character set.
        atob(val);
        return true;
    }
    catch (_a) {
        return false;
    }
}, { message: 'Invalid Base64 string' });
export const BlobResourceContentsSchema = ResourceContentsSchema.extend({
    /**
     * A base64-encoded string representing the binary data of the item.
     */
    blob: Base64Schema
});
/**
 * A known resource that the server is capable of reading.
 */
export const ResourceSchema = BaseMetadataSchema.extend({
    /**
     * The URI of this resource.
     */
    uri: z.string(),
    /**
     * A description of what this resource represents.
     *
     * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
     */
    description: z.optional(z.string()),
    /**
     * The MIME type of this resource, if known.
     */
    mimeType: z.optional(z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
}).merge(IconsSchema);
/**
 * A template description for resources available on the server.
 */
export const ResourceTemplateSchema = BaseMetadataSchema.extend({
    /**
     * A URI template (according to RFC 6570) that can be used to construct resource URIs.
     */
    uriTemplate: z.string(),
    /**
     * A description of what this template is for.
     *
     * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
     */
    description: z.optional(z.string()),
    /**
     * The MIME type for all resources that match this template. This should only be included if all resources matching this template have the same type.
     */
    mimeType: z.optional(z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
}).merge(IconsSchema);
/**
 * Sent from the client to request a list of resources the server has.
 */
export const ListResourcesRequestSchema = PaginatedRequestSchema.extend({
    method: z.literal('resources/list')
});
/**
 * The server's response to a resources/list request from the client.
 */
export const ListResourcesResultSchema = PaginatedResultSchema.extend({
    resources: z.array(ResourceSchema)
});
/**
 * Sent from the client to request a list of resource templates the server has.
 */
export const ListResourceTemplatesRequestSchema = PaginatedRequestSchema.extend({
    method: z.literal('resources/templates/list')
});
/**
 * The server's response to a resources/templates/list request from the client.
 */
export const ListResourceTemplatesResultSchema = PaginatedResultSchema.extend({
    resourceTemplates: z.array(ResourceTemplateSchema)
});
/**
 * Sent from the client to the server, to read a specific resource URI.
 */
export const ReadResourceRequestSchema = RequestSchema.extend({
    method: z.literal('resources/read'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The URI of the resource to read. The URI can use any protocol; it is up to the server how to interpret it.
         */
        uri: z.string()
    })
});
/**
 * The server's response to a resources/read request from the client.
 */
export const ReadResourceResultSchema = ResultSchema.extend({
    contents: z.array(z.union([TextResourceContentsSchema, BlobResourceContentsSchema]))
});
/**
 * An optional notification from the server to the client, informing it that the list of resources it can read from has changed. This may be issued by servers without any previous subscription from the client.
 */
export const ResourceListChangedNotificationSchema = NotificationSchema.extend({
    method: z.literal('notifications/resources/list_changed')
});
/**
 * Sent from the client to request resources/updated notifications from the server whenever a particular resource changes.
 */
export const SubscribeRequestSchema = RequestSchema.extend({
    method: z.literal('resources/subscribe'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The URI of the resource to subscribe to. The URI can use any protocol; it is up to the server how to interpret it.
         */
        uri: z.string()
    })
});
/**
 * Sent from the client to request cancellation of resources/updated notifications from the server. This should follow a previous resources/subscribe request.
 */
export const UnsubscribeRequestSchema = RequestSchema.extend({
    method: z.literal('resources/unsubscribe'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The URI of the resource to unsubscribe from.
         */
        uri: z.string()
    })
});
/**
 * A notification from the server to the client, informing it that a resource has changed and may need to be read again. This should only be sent if the client previously sent a resources/subscribe request.
 */
export const ResourceUpdatedNotificationSchema = NotificationSchema.extend({
    method: z.literal('notifications/resources/updated'),
    params: BaseNotificationParamsSchema.extend({
        /**
         * The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.
         */
        uri: z.string()
    })
});
/* Prompts */
/**
 * Describes an argument that a prompt can accept.
 */
export const PromptArgumentSchema = z
    .object({
    /**
     * The name of the argument.
     */
    name: z.string(),
    /**
     * A human-readable description of the argument.
     */
    description: z.optional(z.string()),
    /**
     * Whether this argument must be provided.
     */
    required: z.optional(z.boolean())
})
    .passthrough();
/**
 * A prompt or prompt template that the server offers.
 */
export const PromptSchema = BaseMetadataSchema.extend({
    /**
     * An optional description of what this prompt provides
     */
    description: z.optional(z.string()),
    /**
     * A list of arguments to use for templating the prompt.
     */
    arguments: z.optional(z.array(PromptArgumentSchema)),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
}).merge(IconsSchema);
/**
 * Sent from the client to request a list of prompts and prompt templates the server has.
 */
export const ListPromptsRequestSchema = PaginatedRequestSchema.extend({
    method: z.literal('prompts/list')
});
/**
 * The server's response to a prompts/list request from the client.
 */
export const ListPromptsResultSchema = PaginatedResultSchema.extend({
    prompts: z.array(PromptSchema)
});
/**
 * Used by the client to get a prompt provided by the server.
 */
export const GetPromptRequestSchema = RequestSchema.extend({
    method: z.literal('prompts/get'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The name of the prompt or prompt template.
         */
        name: z.string(),
        /**
         * Arguments to use for templating the prompt.
         */
        arguments: z.optional(z.record(z.string()))
    })
});
/**
 * Text provided to or from an LLM.
 */
export const TextContentSchema = z
    .object({
    type: z.literal('text'),
    /**
     * The text content of the message.
     */
    text: z.string(),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
})
    .passthrough();
/**
 * An image provided to or from an LLM.
 */
export const ImageContentSchema = z
    .object({
    type: z.literal('image'),
    /**
     * The base64-encoded image data.
     */
    data: Base64Schema,
    /**
     * The MIME type of the image. Different providers may support different image types.
     */
    mimeType: z.string(),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
})
    .passthrough();
/**
 * An Audio provided to or from an LLM.
 */
export const AudioContentSchema = z
    .object({
    type: z.literal('audio'),
    /**
     * The base64-encoded audio data.
     */
    data: Base64Schema,
    /**
     * The MIME type of the audio. Different providers may support different audio types.
     */
    mimeType: z.string(),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
})
    .passthrough();
/**
 * The contents of a resource, embedded into a prompt or tool call result.
 */
export const EmbeddedResourceSchema = z
    .object({
    type: z.literal('resource'),
    resource: z.union([TextResourceContentsSchema, BlobResourceContentsSchema]),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
})
    .passthrough();
/**
 * A resource that the server is capable of reading, included in a prompt or tool call result.
 *
 * Note: resource links returned by tools are not guaranteed to appear in the results of `resources/list` requests.
 */
export const ResourceLinkSchema = ResourceSchema.extend({
    type: z.literal('resource_link')
});
/**
 * A content block that can be used in prompts and tool results.
 */
export const ContentBlockSchema = z.union([
    TextContentSchema,
    ImageContentSchema,
    AudioContentSchema,
    ResourceLinkSchema,
    EmbeddedResourceSchema
]);
/**
 * Describes a message returned as part of a prompt.
 */
export const PromptMessageSchema = z
    .object({
    role: z.enum(['user', 'assistant']),
    content: ContentBlockSchema
})
    .passthrough();
/**
 * The server's response to a prompts/get request from the client.
 */
export const GetPromptResultSchema = ResultSchema.extend({
    /**
     * An optional description for the prompt.
     */
    description: z.optional(z.string()),
    messages: z.array(PromptMessageSchema)
});
/**
 * An optional notification from the server to the client, informing it that the list of prompts it offers has changed. This may be issued by servers without any previous subscription from the client.
 */
export const PromptListChangedNotificationSchema = NotificationSchema.extend({
    method: z.literal('notifications/prompts/list_changed')
});
/* Tools */
/**
 * Additional properties describing a Tool to clients.
 *
 * NOTE: all properties in ToolAnnotations are **hints**.
 * They are not guaranteed to provide a faithful description of
 * tool behavior (including descriptive properties like `title`).
 *
 * Clients should never make tool use decisions based on ToolAnnotations
 * received from untrusted servers.
 */
export const ToolAnnotationsSchema = z
    .object({
    /**
     * A human-readable title for the tool.
     */
    title: z.optional(z.string()),
    /**
     * If true, the tool does not modify its environment.
     *
     * Default: false
     */
    readOnlyHint: z.optional(z.boolean()),
    /**
     * If true, the tool may perform destructive updates to its environment.
     * If false, the tool performs only additive updates.
     *
     * (This property is meaningful only when `readOnlyHint == false`)
     *
     * Default: true
     */
    destructiveHint: z.optional(z.boolean()),
    /**
     * If true, calling the tool repeatedly with the same arguments
     * will have no additional effect on the its environment.
     *
     * (This property is meaningful only when `readOnlyHint == false`)
     *
     * Default: false
     */
    idempotentHint: z.optional(z.boolean()),
    /**
     * If true, this tool may interact with an "open world" of external
     * entities. If false, the tool's domain of interaction is closed.
     * For example, the world of a web search tool is open, whereas that
     * of a memory tool is not.
     *
     * Default: true
     */
    openWorldHint: z.optional(z.boolean())
})
    .passthrough();
/**
 * Definition for a tool the client can call.
 */
export const ToolSchema = BaseMetadataSchema.extend({
    /**
     * A human-readable description of the tool.
     */
    description: z.optional(z.string()),
    /**
     * A JSON Schema object defining the expected parameters for the tool.
     */
    inputSchema: z
        .object({
        type: z.literal('object'),
        properties: z.optional(z.object({}).passthrough()),
        required: z.optional(z.array(z.string()))
    })
        .passthrough(),
    /**
     * An optional JSON Schema object defining the structure of the tool's output returned in
     * the structuredContent field of a CallToolResult.
     */
    outputSchema: z.optional(z
        .object({
        type: z.literal('object'),
        properties: z.optional(z.object({}).passthrough()),
        required: z.optional(z.array(z.string()))
    })
        .passthrough()),
    /**
     * Optional additional tool information.
     */
    annotations: z.optional(ToolAnnotationsSchema),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
}).merge(IconsSchema);
/**
 * Sent from the client to request a list of tools the server has.
 */
export const ListToolsRequestSchema = PaginatedRequestSchema.extend({
    method: z.literal('tools/list')
});
/**
 * The server's response to a tools/list request from the client.
 */
export const ListToolsResultSchema = PaginatedResultSchema.extend({
    tools: z.array(ToolSchema)
});
/**
 * The server's response to a tool call.
 */
export const CallToolResultSchema = ResultSchema.extend({
    /**
     * A list of content objects that represent the result of the tool call.
     *
     * If the Tool does not define an outputSchema, this field MUST be present in the result.
     * For backwards compatibility, this field is always present, but it may be empty.
     */
    content: z.array(ContentBlockSchema).default([]),
    /**
     * An object containing structured tool output.
     *
     * If the Tool defines an outputSchema, this field MUST be present in the result, and contain a JSON object that matches the schema.
     */
    structuredContent: z.object({}).passthrough().optional(),
    /**
     * Whether the tool call ended in an error.
     *
     * If not set, this is assumed to be false (the call was successful).
     *
     * Any errors that originate from the tool SHOULD be reported inside the result
     * object, with `isError` set to true, _not_ as an MCP protocol-level error
     * response. Otherwise, the LLM would not be able to see that an error occurred
     * and self-correct.
     *
     * However, any errors in _finding_ the tool, an error indicating that the
     * server does not support tool calls, or any other exceptional conditions,
     * should be reported as an MCP error response.
     */
    isError: z.optional(z.boolean())
});
/**
 * CallToolResultSchema extended with backwards compatibility to protocol version 2024-10-07.
 */
export const CompatibilityCallToolResultSchema = CallToolResultSchema.or(ResultSchema.extend({
    toolResult: z.unknown()
}));
/**
 * Used by the client to invoke a tool provided by the server.
 */
export const CallToolRequestSchema = RequestSchema.extend({
    method: z.literal('tools/call'),
    params: BaseRequestParamsSchema.extend({
        name: z.string(),
        arguments: z.optional(z.record(z.unknown()))
    })
});
/**
 * An optional notification from the server to the client, informing it that the list of tools it offers has changed. This may be issued by servers without any previous subscription from the client.
 */
export const ToolListChangedNotificationSchema = NotificationSchema.extend({
    method: z.literal('notifications/tools/list_changed')
});
/* Logging */
/**
 * The severity of a log message.
 */
export const LoggingLevelSchema = z.enum(['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency']);
/**
 * A request from the client to the server, to enable or adjust logging.
 */
export const SetLevelRequestSchema = RequestSchema.extend({
    method: z.literal('logging/setLevel'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The level of logging that the client wants to receive from the server. The server should send all logs at this level and higher (i.e., more severe) to the client as notifications/logging/message.
         */
        level: LoggingLevelSchema
    })
});
/**
 * Notification of a log message passed from server to client. If no logging/setLevel request has been sent from the client, the server MAY decide which messages to send automatically.
 */
export const LoggingMessageNotificationSchema = NotificationSchema.extend({
    method: z.literal('notifications/message'),
    params: BaseNotificationParamsSchema.extend({
        /**
         * The severity of this log message.
         */
        level: LoggingLevelSchema,
        /**
         * An optional name of the logger issuing this message.
         */
        logger: z.optional(z.string()),
        /**
         * The data to be logged, such as a string message or an object. Any JSON serializable type is allowed here.
         */
        data: z.unknown()
    })
});
/* Sampling */
/**
 * Hints to use for model selection.
 */
export const ModelHintSchema = z
    .object({
    /**
     * A hint for a model name.
     */
    name: z.string().optional()
})
    .passthrough();
/**
 * The server's preferences for model selection, requested of the client during sampling.
 */
export const ModelPreferencesSchema = z
    .object({
    /**
     * Optional hints to use for model selection.
     */
    hints: z.optional(z.array(ModelHintSchema)),
    /**
     * How much to prioritize cost when selecting a model.
     */
    costPriority: z.optional(z.number().min(0).max(1)),
    /**
     * How much to prioritize sampling speed (latency) when selecting a model.
     */
    speedPriority: z.optional(z.number().min(0).max(1)),
    /**
     * How much to prioritize intelligence and capabilities when selecting a model.
     */
    intelligencePriority: z.optional(z.number().min(0).max(1))
})
    .passthrough();
/**
 * Describes a message issued to or received from an LLM API.
 */
export const SamplingMessageSchema = z
    .object({
    role: z.enum(['user', 'assistant']),
    content: z.union([TextContentSchema, ImageContentSchema, AudioContentSchema])
})
    .passthrough();
/**
 * A request from the server to sample an LLM via the client. The client has full discretion over which model to select. The client should also inform the user before beginning sampling, to allow them to inspect the request (human in the loop) and decide whether to approve it.
 */
export const CreateMessageRequestSchema = RequestSchema.extend({
    method: z.literal('sampling/createMessage'),
    params: BaseRequestParamsSchema.extend({
        messages: z.array(SamplingMessageSchema),
        /**
         * An optional system prompt the server wants to use for sampling. The client MAY modify or omit this prompt.
         */
        systemPrompt: z.optional(z.string()),
        /**
         * A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request.
         */
        includeContext: z.optional(z.enum(['none', 'thisServer', 'allServers'])),
        temperature: z.optional(z.number()),
        /**
         * The maximum number of tokens to sample, as requested by the server. The client MAY choose to sample fewer tokens than requested.
         */
        maxTokens: z.number().int(),
        stopSequences: z.optional(z.array(z.string())),
        /**
         * Optional metadata to pass through to the LLM provider. The format of this metadata is provider-specific.
         */
        metadata: z.optional(z.object({}).passthrough()),
        /**
         * The server's preferences for which model to select.
         */
        modelPreferences: z.optional(ModelPreferencesSchema)
    })
});
/**
 * The client's response to a sampling/create_message request from the server. The client should inform the user before returning the sampled message, to allow them to inspect the response (human in the loop) and decide whether to allow the server to see it.
 */
export const CreateMessageResultSchema = ResultSchema.extend({
    /**
     * The name of the model that generated the message.
     */
    model: z.string(),
    /**
     * The reason why sampling stopped.
     */
    stopReason: z.optional(z.enum(['endTurn', 'stopSequence', 'maxTokens']).or(z.string())),
    role: z.enum(['user', 'assistant']),
    content: z.discriminatedUnion('type', [TextContentSchema, ImageContentSchema, AudioContentSchema])
});
/* Elicitation */
/**
 * Primitive schema definition for boolean fields.
 */
export const BooleanSchemaSchema = z
    .object({
    type: z.literal('boolean'),
    title: z.optional(z.string()),
    description: z.optional(z.string()),
    default: z.optional(z.boolean())
})
    .passthrough();
/**
 * Primitive schema definition for string fields.
 */
export const StringSchemaSchema = z
    .object({
    type: z.literal('string'),
    title: z.optional(z.string()),
    description: z.optional(z.string()),
    minLength: z.optional(z.number()),
    maxLength: z.optional(z.number()),
    format: z.optional(z.enum(['email', 'uri', 'date', 'date-time']))
})
    .passthrough();
/**
 * Primitive schema definition for number fields.
 */
export const NumberSchemaSchema = z
    .object({
    type: z.enum(['number', 'integer']),
    title: z.optional(z.string()),
    description: z.optional(z.string()),
    minimum: z.optional(z.number()),
    maximum: z.optional(z.number())
})
    .passthrough();
/**
 * Primitive schema definition for enum fields.
 */
export const EnumSchemaSchema = z
    .object({
    type: z.literal('string'),
    title: z.optional(z.string()),
    description: z.optional(z.string()),
    enum: z.array(z.string()),
    enumNames: z.optional(z.array(z.string()))
})
    .passthrough();
/**
 * Union of all primitive schema definitions.
 */
export const PrimitiveSchemaDefinitionSchema = z.union([BooleanSchemaSchema, StringSchemaSchema, NumberSchemaSchema, EnumSchemaSchema]);
/**
 * A request from the server to elicit user input via the client.
 * The client should present the message and form fields to the user.
 */
export const ElicitRequestSchema = RequestSchema.extend({
    method: z.literal('elicitation/create'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The message to present to the user.
         */
        message: z.string(),
        /**
         * The schema for the requested user input.
         */
        requestedSchema: z
            .object({
            type: z.literal('object'),
            properties: z.record(z.string(), PrimitiveSchemaDefinitionSchema),
            required: z.optional(z.array(z.string()))
        })
            .passthrough()
    })
});
/**
 * The client's response to an elicitation/create request from the server.
 */
export const ElicitResultSchema = ResultSchema.extend({
    /**
     * The user's response action.
     */
    action: z.enum(['accept', 'decline', 'cancel']),
    /**
     * The collected user input content (only present if action is "accept").
     */
    content: z.optional(z.record(z.string(), z.unknown()))
});
/* Autocomplete */
/**
 * A reference to a resource or resource template definition.
 */
export const ResourceTemplateReferenceSchema = z
    .object({
    type: z.literal('ref/resource'),
    /**
     * The URI or URI template of the resource.
     */
    uri: z.string()
})
    .passthrough();
/**
 * @deprecated Use ResourceTemplateReferenceSchema instead
 */
export const ResourceReferenceSchema = ResourceTemplateReferenceSchema;
/**
 * Identifies a prompt.
 */
export const PromptReferenceSchema = z
    .object({
    type: z.literal('ref/prompt'),
    /**
     * The name of the prompt or prompt template
     */
    name: z.string()
})
    .passthrough();
/**
 * A request from the client to the server, to ask for completion options.
 */
export const CompleteRequestSchema = RequestSchema.extend({
    method: z.literal('completion/complete'),
    params: BaseRequestParamsSchema.extend({
        ref: z.union([PromptReferenceSchema, ResourceTemplateReferenceSchema]),
        /**
         * The argument's information
         */
        argument: z
            .object({
            /**
             * The name of the argument
             */
            name: z.string(),
            /**
             * The value of the argument to use for completion matching.
             */
            value: z.string()
        })
            .passthrough(),
        context: z.optional(z.object({
            /**
             * Previously-resolved variables in a URI template or prompt.
             */
            arguments: z.optional(z.record(z.string(), z.string()))
        }))
    })
});
/**
 * The server's response to a completion/complete request
 */
export const CompleteResultSchema = ResultSchema.extend({
    completion: z
        .object({
        /**
         * An array of completion values. Must not exceed 100 items.
         */
        values: z.array(z.string()).max(100),
        /**
         * The total number of completion options available. This can exceed the number of values actually sent in the response.
         */
        total: z.optional(z.number().int()),
        /**
         * Indicates whether there are additional completion options beyond those provided in the current response, even if the exact total is unknown.
         */
        hasMore: z.optional(z.boolean())
    })
        .passthrough()
});
/* Roots */
/**
 * Represents a root directory or file that the server can operate on.
 */
export const RootSchema = z
    .object({
    /**
     * The URI identifying the root. This *must* start with file:// for now.
     */
    uri: z.string().startsWith('file://'),
    /**
     * An optional name for the root.
     */
    name: z.optional(z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: z.optional(z.object({}).passthrough())
})
    .passthrough();
/**
 * Sent from the server to request a list of root URIs from the client.
 */
export const ListRootsRequestSchema = RequestSchema.extend({
    method: z.literal('roots/list')
});
/**
 * The client's response to a roots/list request from the server.
 */
export const ListRootsResultSchema = ResultSchema.extend({
    roots: z.array(RootSchema)
});
/**
 * A notification from the client to the server, informing it that the list of roots has changed.
 */
export const RootsListChangedNotificationSchema = NotificationSchema.extend({
    method: z.literal('notifications/roots/list_changed')
});
/* Client messages */
export const ClientRequestSchema = z.union([
    PingRequestSchema,
    InitializeRequestSchema,
    CompleteRequestSchema,
    SetLevelRequestSchema,
    GetPromptRequestSchema,
    ListPromptsRequestSchema,
    ListResourcesRequestSchema,
    ListResourceTemplatesRequestSchema,
    ReadResourceRequestSchema,
    SubscribeRequestSchema,
    UnsubscribeRequestSchema,
    CallToolRequestSchema,
    ListToolsRequestSchema
]);
export const ClientNotificationSchema = z.union([
    CancelledNotificationSchema,
    ProgressNotificationSchema,
    InitializedNotificationSchema,
    RootsListChangedNotificationSchema
]);
export const ClientResultSchema = z.union([EmptyResultSchema, CreateMessageResultSchema, ElicitResultSchema, ListRootsResultSchema]);
/* Server messages */
export const ServerRequestSchema = z.union([PingRequestSchema, CreateMessageRequestSchema, ElicitRequestSchema, ListRootsRequestSchema]);
export const ServerNotificationSchema = z.union([
    CancelledNotificationSchema,
    ProgressNotificationSchema,
    LoggingMessageNotificationSchema,
    ResourceUpdatedNotificationSchema,
    ResourceListChangedNotificationSchema,
    ToolListChangedNotificationSchema,
    PromptListChangedNotificationSchema
]);
export const ServerResultSchema = z.union([
    EmptyResultSchema,
    InitializeResultSchema,
    CompleteResultSchema,
    GetPromptResultSchema,
    ListPromptsResultSchema,
    ListResourcesResultSchema,
    ListResourceTemplatesResultSchema,
    ReadResourceResultSchema,
    CallToolResultSchema,
    ListToolsResultSchema
]);
export class McpError extends Error {
    constructor(code, message, data) {
        super(`MCP error ${code}: ${message}`);
        this.code = code;
        this.data = data;
        this.name = 'McpError';
    }
}
//# sourceMappingURL=types.js.map