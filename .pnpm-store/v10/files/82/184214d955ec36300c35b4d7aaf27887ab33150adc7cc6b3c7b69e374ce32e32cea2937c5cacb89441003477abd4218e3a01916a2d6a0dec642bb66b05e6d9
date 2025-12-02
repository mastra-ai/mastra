"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceListChangedNotificationSchema = exports.ReadResourceResultSchema = exports.ReadResourceRequestSchema = exports.ListResourceTemplatesResultSchema = exports.ListResourceTemplatesRequestSchema = exports.ListResourcesResultSchema = exports.ListResourcesRequestSchema = exports.ResourceTemplateSchema = exports.ResourceSchema = exports.BlobResourceContentsSchema = exports.TextResourceContentsSchema = exports.ResourceContentsSchema = exports.PaginatedResultSchema = exports.PaginatedRequestSchema = exports.ProgressNotificationSchema = exports.ProgressSchema = exports.PingRequestSchema = exports.isInitializedNotification = exports.InitializedNotificationSchema = exports.InitializeResultSchema = exports.ServerCapabilitiesSchema = exports.isInitializeRequest = exports.InitializeRequestSchema = exports.ClientCapabilitiesSchema = exports.ImplementationSchema = exports.BaseMetadataSchema = exports.IconsSchema = exports.IconSchema = exports.CancelledNotificationSchema = exports.EmptyResultSchema = exports.JSONRPCMessageSchema = exports.isJSONRPCError = exports.JSONRPCErrorSchema = exports.ErrorCode = exports.isJSONRPCResponse = exports.JSONRPCResponseSchema = exports.isJSONRPCNotification = exports.JSONRPCNotificationSchema = exports.isJSONRPCRequest = exports.JSONRPCRequestSchema = exports.RequestIdSchema = exports.ResultSchema = exports.NotificationSchema = exports.RequestSchema = exports.CursorSchema = exports.ProgressTokenSchema = exports.JSONRPC_VERSION = exports.SUPPORTED_PROTOCOL_VERSIONS = exports.DEFAULT_NEGOTIATED_PROTOCOL_VERSION = exports.LATEST_PROTOCOL_VERSION = void 0;
exports.ClientRequestSchema = exports.RootsListChangedNotificationSchema = exports.ListRootsResultSchema = exports.ListRootsRequestSchema = exports.RootSchema = exports.CompleteResultSchema = exports.CompleteRequestSchema = exports.PromptReferenceSchema = exports.ResourceReferenceSchema = exports.ResourceTemplateReferenceSchema = exports.ElicitResultSchema = exports.ElicitRequestSchema = exports.PrimitiveSchemaDefinitionSchema = exports.EnumSchemaSchema = exports.NumberSchemaSchema = exports.StringSchemaSchema = exports.BooleanSchemaSchema = exports.CreateMessageResultSchema = exports.CreateMessageRequestSchema = exports.SamplingMessageSchema = exports.ModelPreferencesSchema = exports.ModelHintSchema = exports.LoggingMessageNotificationSchema = exports.SetLevelRequestSchema = exports.LoggingLevelSchema = exports.ToolListChangedNotificationSchema = exports.CallToolRequestSchema = exports.CompatibilityCallToolResultSchema = exports.CallToolResultSchema = exports.ListToolsResultSchema = exports.ListToolsRequestSchema = exports.ToolSchema = exports.ToolAnnotationsSchema = exports.PromptListChangedNotificationSchema = exports.GetPromptResultSchema = exports.PromptMessageSchema = exports.ContentBlockSchema = exports.ResourceLinkSchema = exports.EmbeddedResourceSchema = exports.AudioContentSchema = exports.ImageContentSchema = exports.TextContentSchema = exports.GetPromptRequestSchema = exports.ListPromptsResultSchema = exports.ListPromptsRequestSchema = exports.PromptSchema = exports.PromptArgumentSchema = exports.ResourceUpdatedNotificationSchema = exports.UnsubscribeRequestSchema = exports.SubscribeRequestSchema = void 0;
exports.McpError = exports.ServerResultSchema = exports.ServerNotificationSchema = exports.ServerRequestSchema = exports.ClientResultSchema = exports.ClientNotificationSchema = void 0;
const zod_1 = require("zod");
exports.LATEST_PROTOCOL_VERSION = '2025-06-18';
exports.DEFAULT_NEGOTIATED_PROTOCOL_VERSION = '2025-03-26';
exports.SUPPORTED_PROTOCOL_VERSIONS = [exports.LATEST_PROTOCOL_VERSION, '2025-03-26', '2024-11-05', '2024-10-07'];
/* JSON-RPC types */
exports.JSONRPC_VERSION = '2.0';
/**
 * A progress token, used to associate progress notifications with the original request.
 */
exports.ProgressTokenSchema = zod_1.z.union([zod_1.z.string(), zod_1.z.number().int()]);
/**
 * An opaque token used to represent a cursor for pagination.
 */
exports.CursorSchema = zod_1.z.string();
const RequestMetaSchema = zod_1.z
    .object({
    /**
     * If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.
     */
    progressToken: zod_1.z.optional(exports.ProgressTokenSchema)
})
    .passthrough();
const BaseRequestParamsSchema = zod_1.z
    .object({
    _meta: zod_1.z.optional(RequestMetaSchema)
})
    .passthrough();
exports.RequestSchema = zod_1.z.object({
    method: zod_1.z.string(),
    params: zod_1.z.optional(BaseRequestParamsSchema)
});
const BaseNotificationParamsSchema = zod_1.z
    .object({
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
})
    .passthrough();
exports.NotificationSchema = zod_1.z.object({
    method: zod_1.z.string(),
    params: zod_1.z.optional(BaseNotificationParamsSchema)
});
exports.ResultSchema = zod_1.z
    .object({
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
})
    .passthrough();
/**
 * A uniquely identifying ID for a request in JSON-RPC.
 */
exports.RequestIdSchema = zod_1.z.union([zod_1.z.string(), zod_1.z.number().int()]);
/**
 * A request that expects a response.
 */
exports.JSONRPCRequestSchema = zod_1.z
    .object({
    jsonrpc: zod_1.z.literal(exports.JSONRPC_VERSION),
    id: exports.RequestIdSchema
})
    .merge(exports.RequestSchema)
    .strict();
const isJSONRPCRequest = (value) => exports.JSONRPCRequestSchema.safeParse(value).success;
exports.isJSONRPCRequest = isJSONRPCRequest;
/**
 * A notification which does not expect a response.
 */
exports.JSONRPCNotificationSchema = zod_1.z
    .object({
    jsonrpc: zod_1.z.literal(exports.JSONRPC_VERSION)
})
    .merge(exports.NotificationSchema)
    .strict();
const isJSONRPCNotification = (value) => exports.JSONRPCNotificationSchema.safeParse(value).success;
exports.isJSONRPCNotification = isJSONRPCNotification;
/**
 * A successful (non-error) response to a request.
 */
exports.JSONRPCResponseSchema = zod_1.z
    .object({
    jsonrpc: zod_1.z.literal(exports.JSONRPC_VERSION),
    id: exports.RequestIdSchema,
    result: exports.ResultSchema
})
    .strict();
const isJSONRPCResponse = (value) => exports.JSONRPCResponseSchema.safeParse(value).success;
exports.isJSONRPCResponse = isJSONRPCResponse;
/**
 * Error codes defined by the JSON-RPC specification.
 */
var ErrorCode;
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
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
/**
 * A response to a request that indicates an error occurred.
 */
exports.JSONRPCErrorSchema = zod_1.z
    .object({
    jsonrpc: zod_1.z.literal(exports.JSONRPC_VERSION),
    id: exports.RequestIdSchema,
    error: zod_1.z.object({
        /**
         * The error type that occurred.
         */
        code: zod_1.z.number().int(),
        /**
         * A short description of the error. The message SHOULD be limited to a concise single sentence.
         */
        message: zod_1.z.string(),
        /**
         * Additional information about the error. The value of this member is defined by the sender (e.g. detailed error information, nested errors etc.).
         */
        data: zod_1.z.optional(zod_1.z.unknown())
    })
})
    .strict();
const isJSONRPCError = (value) => exports.JSONRPCErrorSchema.safeParse(value).success;
exports.isJSONRPCError = isJSONRPCError;
exports.JSONRPCMessageSchema = zod_1.z.union([exports.JSONRPCRequestSchema, exports.JSONRPCNotificationSchema, exports.JSONRPCResponseSchema, exports.JSONRPCErrorSchema]);
/* Empty result */
/**
 * A response that indicates success but carries no data.
 */
exports.EmptyResultSchema = exports.ResultSchema.strict();
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
exports.CancelledNotificationSchema = exports.NotificationSchema.extend({
    method: zod_1.z.literal('notifications/cancelled'),
    params: BaseNotificationParamsSchema.extend({
        /**
         * The ID of the request to cancel.
         *
         * This MUST correspond to the ID of a request previously issued in the same direction.
         */
        requestId: exports.RequestIdSchema,
        /**
         * An optional string describing the reason for the cancellation. This MAY be logged or presented to the user.
         */
        reason: zod_1.z.string().optional()
    })
});
/* Base Metadata */
/**
 * Icon schema for use in tools, prompts, resources, and implementations.
 */
exports.IconSchema = zod_1.z
    .object({
    /**
     * URL or data URI for the icon.
     */
    src: zod_1.z.string(),
    /**
     * Optional MIME type for the icon.
     */
    mimeType: zod_1.z.optional(zod_1.z.string()),
    /**
     * Optional array of strings that specify sizes at which the icon can be used.
     * Each string should be in WxH format (e.g., `"48x48"`, `"96x96"`) or `"any"` for scalable formats like SVG.
     *
     * If not provided, the client should assume that the icon can be used at any size.
     */
    sizes: zod_1.z.optional(zod_1.z.array(zod_1.z.string()))
})
    .passthrough();
/**
 * Base schema to add `icons` property.
 *
 */
exports.IconsSchema = zod_1.z
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
    icons: zod_1.z.array(exports.IconSchema).optional()
})
    .passthrough();
/**
 * Base metadata interface for common properties across resources, tools, prompts, and implementations.
 */
exports.BaseMetadataSchema = zod_1.z
    .object({
    /** Intended for programmatic or logical use, but used as a display name in past specs or fallback */
    name: zod_1.z.string(),
    /**
     * Intended for UI and end-user contexts — optimized to be human-readable and easily understood,
     * even by those unfamiliar with domain-specific terminology.
     *
     * If not provided, the name should be used for display (except for Tool,
     * where `annotations.title` should be given precedence over using `name`,
     * if present).
     */
    title: zod_1.z.optional(zod_1.z.string())
})
    .passthrough();
/* Initialization */
/**
 * Describes the name and version of an MCP implementation.
 */
exports.ImplementationSchema = exports.BaseMetadataSchema.extend({
    version: zod_1.z.string(),
    /**
     * An optional URL of the website for this implementation.
     */
    websiteUrl: zod_1.z.optional(zod_1.z.string())
}).merge(exports.IconsSchema);
/**
 * Capabilities a client may support. Known capabilities are defined here, in this schema, but this is not a closed set: any client can define its own, additional capabilities.
 */
exports.ClientCapabilitiesSchema = zod_1.z
    .object({
    /**
     * Experimental, non-standard capabilities that the client supports.
     */
    experimental: zod_1.z.optional(zod_1.z.object({}).passthrough()),
    /**
     * Present if the client supports sampling from an LLM.
     */
    sampling: zod_1.z.optional(zod_1.z.object({}).passthrough()),
    /**
     * Present if the client supports eliciting user input.
     */
    elicitation: zod_1.z.optional(zod_1.z.object({}).passthrough()),
    /**
     * Present if the client supports listing roots.
     */
    roots: zod_1.z.optional(zod_1.z
        .object({
        /**
         * Whether the client supports issuing notifications for changes to the roots list.
         */
        listChanged: zod_1.z.optional(zod_1.z.boolean())
    })
        .passthrough())
})
    .passthrough();
/**
 * This request is sent from the client to the server when it first connects, asking it to begin initialization.
 */
exports.InitializeRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('initialize'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The latest version of the Model Context Protocol that the client supports. The client MAY decide to support older versions as well.
         */
        protocolVersion: zod_1.z.string(),
        capabilities: exports.ClientCapabilitiesSchema,
        clientInfo: exports.ImplementationSchema
    })
});
const isInitializeRequest = (value) => exports.InitializeRequestSchema.safeParse(value).success;
exports.isInitializeRequest = isInitializeRequest;
/**
 * Capabilities that a server may support. Known capabilities are defined here, in this schema, but this is not a closed set: any server can define its own, additional capabilities.
 */
exports.ServerCapabilitiesSchema = zod_1.z
    .object({
    /**
     * Experimental, non-standard capabilities that the server supports.
     */
    experimental: zod_1.z.optional(zod_1.z.object({}).passthrough()),
    /**
     * Present if the server supports sending log messages to the client.
     */
    logging: zod_1.z.optional(zod_1.z.object({}).passthrough()),
    /**
     * Present if the server supports sending completions to the client.
     */
    completions: zod_1.z.optional(zod_1.z.object({}).passthrough()),
    /**
     * Present if the server offers any prompt templates.
     */
    prompts: zod_1.z.optional(zod_1.z
        .object({
        /**
         * Whether this server supports issuing notifications for changes to the prompt list.
         */
        listChanged: zod_1.z.optional(zod_1.z.boolean())
    })
        .passthrough()),
    /**
     * Present if the server offers any resources to read.
     */
    resources: zod_1.z.optional(zod_1.z
        .object({
        /**
         * Whether this server supports clients subscribing to resource updates.
         */
        subscribe: zod_1.z.optional(zod_1.z.boolean()),
        /**
         * Whether this server supports issuing notifications for changes to the resource list.
         */
        listChanged: zod_1.z.optional(zod_1.z.boolean())
    })
        .passthrough()),
    /**
     * Present if the server offers any tools to call.
     */
    tools: zod_1.z.optional(zod_1.z
        .object({
        /**
         * Whether this server supports issuing notifications for changes to the tool list.
         */
        listChanged: zod_1.z.optional(zod_1.z.boolean())
    })
        .passthrough())
})
    .passthrough();
/**
 * After receiving an initialize request from the client, the server sends this response.
 */
exports.InitializeResultSchema = exports.ResultSchema.extend({
    /**
     * The version of the Model Context Protocol that the server wants to use. This may not match the version that the client requested. If the client cannot support this version, it MUST disconnect.
     */
    protocolVersion: zod_1.z.string(),
    capabilities: exports.ServerCapabilitiesSchema,
    serverInfo: exports.ImplementationSchema,
    /**
     * Instructions describing how to use the server and its features.
     *
     * This can be used by clients to improve the LLM's understanding of available tools, resources, etc. It can be thought of like a "hint" to the model. For example, this information MAY be added to the system prompt.
     */
    instructions: zod_1.z.optional(zod_1.z.string())
});
/**
 * This notification is sent from the client to the server after initialization has finished.
 */
exports.InitializedNotificationSchema = exports.NotificationSchema.extend({
    method: zod_1.z.literal('notifications/initialized')
});
const isInitializedNotification = (value) => exports.InitializedNotificationSchema.safeParse(value).success;
exports.isInitializedNotification = isInitializedNotification;
/* Ping */
/**
 * A ping, issued by either the server or the client, to check that the other party is still alive. The receiver must promptly respond, or else may be disconnected.
 */
exports.PingRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('ping')
});
/* Progress notifications */
exports.ProgressSchema = zod_1.z
    .object({
    /**
     * The progress thus far. This should increase every time progress is made, even if the total is unknown.
     */
    progress: zod_1.z.number(),
    /**
     * Total number of items to process (or total progress required), if known.
     */
    total: zod_1.z.optional(zod_1.z.number()),
    /**
     * An optional message describing the current progress.
     */
    message: zod_1.z.optional(zod_1.z.string())
})
    .passthrough();
/**
 * An out-of-band notification used to inform the receiver of a progress update for a long-running request.
 */
exports.ProgressNotificationSchema = exports.NotificationSchema.extend({
    method: zod_1.z.literal('notifications/progress'),
    params: BaseNotificationParamsSchema.merge(exports.ProgressSchema).extend({
        /**
         * The progress token which was given in the initial request, used to associate this notification with the request that is proceeding.
         */
        progressToken: exports.ProgressTokenSchema
    })
});
/* Pagination */
exports.PaginatedRequestSchema = exports.RequestSchema.extend({
    params: BaseRequestParamsSchema.extend({
        /**
         * An opaque token representing the current pagination position.
         * If provided, the server should return results starting after this cursor.
         */
        cursor: zod_1.z.optional(exports.CursorSchema)
    }).optional()
});
exports.PaginatedResultSchema = exports.ResultSchema.extend({
    /**
     * An opaque token representing the pagination position after the last returned result.
     * If present, there may be more results available.
     */
    nextCursor: zod_1.z.optional(exports.CursorSchema)
});
/* Resources */
/**
 * The contents of a specific resource or sub-resource.
 */
exports.ResourceContentsSchema = zod_1.z
    .object({
    /**
     * The URI of this resource.
     */
    uri: zod_1.z.string(),
    /**
     * The MIME type of this resource, if known.
     */
    mimeType: zod_1.z.optional(zod_1.z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
})
    .passthrough();
exports.TextResourceContentsSchema = exports.ResourceContentsSchema.extend({
    /**
     * The text of the item. This must only be set if the item can actually be represented as text (not binary data).
     */
    text: zod_1.z.string()
});
/**
 * A Zod schema for validating Base64 strings that is more performant and
 * robust for very large inputs than the default regex-based check. It avoids
 * stack overflows by using the native `atob` function for validation.
 */
const Base64Schema = zod_1.z.string().refine(val => {
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
exports.BlobResourceContentsSchema = exports.ResourceContentsSchema.extend({
    /**
     * A base64-encoded string representing the binary data of the item.
     */
    blob: Base64Schema
});
/**
 * A known resource that the server is capable of reading.
 */
exports.ResourceSchema = exports.BaseMetadataSchema.extend({
    /**
     * The URI of this resource.
     */
    uri: zod_1.z.string(),
    /**
     * A description of what this resource represents.
     *
     * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
     */
    description: zod_1.z.optional(zod_1.z.string()),
    /**
     * The MIME type of this resource, if known.
     */
    mimeType: zod_1.z.optional(zod_1.z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
}).merge(exports.IconsSchema);
/**
 * A template description for resources available on the server.
 */
exports.ResourceTemplateSchema = exports.BaseMetadataSchema.extend({
    /**
     * A URI template (according to RFC 6570) that can be used to construct resource URIs.
     */
    uriTemplate: zod_1.z.string(),
    /**
     * A description of what this template is for.
     *
     * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
     */
    description: zod_1.z.optional(zod_1.z.string()),
    /**
     * The MIME type for all resources that match this template. This should only be included if all resources matching this template have the same type.
     */
    mimeType: zod_1.z.optional(zod_1.z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
}).merge(exports.IconsSchema);
/**
 * Sent from the client to request a list of resources the server has.
 */
exports.ListResourcesRequestSchema = exports.PaginatedRequestSchema.extend({
    method: zod_1.z.literal('resources/list')
});
/**
 * The server's response to a resources/list request from the client.
 */
exports.ListResourcesResultSchema = exports.PaginatedResultSchema.extend({
    resources: zod_1.z.array(exports.ResourceSchema)
});
/**
 * Sent from the client to request a list of resource templates the server has.
 */
exports.ListResourceTemplatesRequestSchema = exports.PaginatedRequestSchema.extend({
    method: zod_1.z.literal('resources/templates/list')
});
/**
 * The server's response to a resources/templates/list request from the client.
 */
exports.ListResourceTemplatesResultSchema = exports.PaginatedResultSchema.extend({
    resourceTemplates: zod_1.z.array(exports.ResourceTemplateSchema)
});
/**
 * Sent from the client to the server, to read a specific resource URI.
 */
exports.ReadResourceRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('resources/read'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The URI of the resource to read. The URI can use any protocol; it is up to the server how to interpret it.
         */
        uri: zod_1.z.string()
    })
});
/**
 * The server's response to a resources/read request from the client.
 */
exports.ReadResourceResultSchema = exports.ResultSchema.extend({
    contents: zod_1.z.array(zod_1.z.union([exports.TextResourceContentsSchema, exports.BlobResourceContentsSchema]))
});
/**
 * An optional notification from the server to the client, informing it that the list of resources it can read from has changed. This may be issued by servers without any previous subscription from the client.
 */
exports.ResourceListChangedNotificationSchema = exports.NotificationSchema.extend({
    method: zod_1.z.literal('notifications/resources/list_changed')
});
/**
 * Sent from the client to request resources/updated notifications from the server whenever a particular resource changes.
 */
exports.SubscribeRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('resources/subscribe'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The URI of the resource to subscribe to. The URI can use any protocol; it is up to the server how to interpret it.
         */
        uri: zod_1.z.string()
    })
});
/**
 * Sent from the client to request cancellation of resources/updated notifications from the server. This should follow a previous resources/subscribe request.
 */
exports.UnsubscribeRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('resources/unsubscribe'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The URI of the resource to unsubscribe from.
         */
        uri: zod_1.z.string()
    })
});
/**
 * A notification from the server to the client, informing it that a resource has changed and may need to be read again. This should only be sent if the client previously sent a resources/subscribe request.
 */
exports.ResourceUpdatedNotificationSchema = exports.NotificationSchema.extend({
    method: zod_1.z.literal('notifications/resources/updated'),
    params: BaseNotificationParamsSchema.extend({
        /**
         * The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.
         */
        uri: zod_1.z.string()
    })
});
/* Prompts */
/**
 * Describes an argument that a prompt can accept.
 */
exports.PromptArgumentSchema = zod_1.z
    .object({
    /**
     * The name of the argument.
     */
    name: zod_1.z.string(),
    /**
     * A human-readable description of the argument.
     */
    description: zod_1.z.optional(zod_1.z.string()),
    /**
     * Whether this argument must be provided.
     */
    required: zod_1.z.optional(zod_1.z.boolean())
})
    .passthrough();
/**
 * A prompt or prompt template that the server offers.
 */
exports.PromptSchema = exports.BaseMetadataSchema.extend({
    /**
     * An optional description of what this prompt provides
     */
    description: zod_1.z.optional(zod_1.z.string()),
    /**
     * A list of arguments to use for templating the prompt.
     */
    arguments: zod_1.z.optional(zod_1.z.array(exports.PromptArgumentSchema)),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
}).merge(exports.IconsSchema);
/**
 * Sent from the client to request a list of prompts and prompt templates the server has.
 */
exports.ListPromptsRequestSchema = exports.PaginatedRequestSchema.extend({
    method: zod_1.z.literal('prompts/list')
});
/**
 * The server's response to a prompts/list request from the client.
 */
exports.ListPromptsResultSchema = exports.PaginatedResultSchema.extend({
    prompts: zod_1.z.array(exports.PromptSchema)
});
/**
 * Used by the client to get a prompt provided by the server.
 */
exports.GetPromptRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('prompts/get'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The name of the prompt or prompt template.
         */
        name: zod_1.z.string(),
        /**
         * Arguments to use for templating the prompt.
         */
        arguments: zod_1.z.optional(zod_1.z.record(zod_1.z.string()))
    })
});
/**
 * Text provided to or from an LLM.
 */
exports.TextContentSchema = zod_1.z
    .object({
    type: zod_1.z.literal('text'),
    /**
     * The text content of the message.
     */
    text: zod_1.z.string(),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
})
    .passthrough();
/**
 * An image provided to or from an LLM.
 */
exports.ImageContentSchema = zod_1.z
    .object({
    type: zod_1.z.literal('image'),
    /**
     * The base64-encoded image data.
     */
    data: Base64Schema,
    /**
     * The MIME type of the image. Different providers may support different image types.
     */
    mimeType: zod_1.z.string(),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
})
    .passthrough();
/**
 * An Audio provided to or from an LLM.
 */
exports.AudioContentSchema = zod_1.z
    .object({
    type: zod_1.z.literal('audio'),
    /**
     * The base64-encoded audio data.
     */
    data: Base64Schema,
    /**
     * The MIME type of the audio. Different providers may support different audio types.
     */
    mimeType: zod_1.z.string(),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
})
    .passthrough();
/**
 * The contents of a resource, embedded into a prompt or tool call result.
 */
exports.EmbeddedResourceSchema = zod_1.z
    .object({
    type: zod_1.z.literal('resource'),
    resource: zod_1.z.union([exports.TextResourceContentsSchema, exports.BlobResourceContentsSchema]),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
})
    .passthrough();
/**
 * A resource that the server is capable of reading, included in a prompt or tool call result.
 *
 * Note: resource links returned by tools are not guaranteed to appear in the results of `resources/list` requests.
 */
exports.ResourceLinkSchema = exports.ResourceSchema.extend({
    type: zod_1.z.literal('resource_link')
});
/**
 * A content block that can be used in prompts and tool results.
 */
exports.ContentBlockSchema = zod_1.z.union([
    exports.TextContentSchema,
    exports.ImageContentSchema,
    exports.AudioContentSchema,
    exports.ResourceLinkSchema,
    exports.EmbeddedResourceSchema
]);
/**
 * Describes a message returned as part of a prompt.
 */
exports.PromptMessageSchema = zod_1.z
    .object({
    role: zod_1.z.enum(['user', 'assistant']),
    content: exports.ContentBlockSchema
})
    .passthrough();
/**
 * The server's response to a prompts/get request from the client.
 */
exports.GetPromptResultSchema = exports.ResultSchema.extend({
    /**
     * An optional description for the prompt.
     */
    description: zod_1.z.optional(zod_1.z.string()),
    messages: zod_1.z.array(exports.PromptMessageSchema)
});
/**
 * An optional notification from the server to the client, informing it that the list of prompts it offers has changed. This may be issued by servers without any previous subscription from the client.
 */
exports.PromptListChangedNotificationSchema = exports.NotificationSchema.extend({
    method: zod_1.z.literal('notifications/prompts/list_changed')
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
exports.ToolAnnotationsSchema = zod_1.z
    .object({
    /**
     * A human-readable title for the tool.
     */
    title: zod_1.z.optional(zod_1.z.string()),
    /**
     * If true, the tool does not modify its environment.
     *
     * Default: false
     */
    readOnlyHint: zod_1.z.optional(zod_1.z.boolean()),
    /**
     * If true, the tool may perform destructive updates to its environment.
     * If false, the tool performs only additive updates.
     *
     * (This property is meaningful only when `readOnlyHint == false`)
     *
     * Default: true
     */
    destructiveHint: zod_1.z.optional(zod_1.z.boolean()),
    /**
     * If true, calling the tool repeatedly with the same arguments
     * will have no additional effect on the its environment.
     *
     * (This property is meaningful only when `readOnlyHint == false`)
     *
     * Default: false
     */
    idempotentHint: zod_1.z.optional(zod_1.z.boolean()),
    /**
     * If true, this tool may interact with an "open world" of external
     * entities. If false, the tool's domain of interaction is closed.
     * For example, the world of a web search tool is open, whereas that
     * of a memory tool is not.
     *
     * Default: true
     */
    openWorldHint: zod_1.z.optional(zod_1.z.boolean())
})
    .passthrough();
/**
 * Definition for a tool the client can call.
 */
exports.ToolSchema = exports.BaseMetadataSchema.extend({
    /**
     * A human-readable description of the tool.
     */
    description: zod_1.z.optional(zod_1.z.string()),
    /**
     * A JSON Schema object defining the expected parameters for the tool.
     */
    inputSchema: zod_1.z
        .object({
        type: zod_1.z.literal('object'),
        properties: zod_1.z.optional(zod_1.z.object({}).passthrough()),
        required: zod_1.z.optional(zod_1.z.array(zod_1.z.string()))
    })
        .passthrough(),
    /**
     * An optional JSON Schema object defining the structure of the tool's output returned in
     * the structuredContent field of a CallToolResult.
     */
    outputSchema: zod_1.z.optional(zod_1.z
        .object({
        type: zod_1.z.literal('object'),
        properties: zod_1.z.optional(zod_1.z.object({}).passthrough()),
        required: zod_1.z.optional(zod_1.z.array(zod_1.z.string()))
    })
        .passthrough()),
    /**
     * Optional additional tool information.
     */
    annotations: zod_1.z.optional(exports.ToolAnnotationsSchema),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
}).merge(exports.IconsSchema);
/**
 * Sent from the client to request a list of tools the server has.
 */
exports.ListToolsRequestSchema = exports.PaginatedRequestSchema.extend({
    method: zod_1.z.literal('tools/list')
});
/**
 * The server's response to a tools/list request from the client.
 */
exports.ListToolsResultSchema = exports.PaginatedResultSchema.extend({
    tools: zod_1.z.array(exports.ToolSchema)
});
/**
 * The server's response to a tool call.
 */
exports.CallToolResultSchema = exports.ResultSchema.extend({
    /**
     * A list of content objects that represent the result of the tool call.
     *
     * If the Tool does not define an outputSchema, this field MUST be present in the result.
     * For backwards compatibility, this field is always present, but it may be empty.
     */
    content: zod_1.z.array(exports.ContentBlockSchema).default([]),
    /**
     * An object containing structured tool output.
     *
     * If the Tool defines an outputSchema, this field MUST be present in the result, and contain a JSON object that matches the schema.
     */
    structuredContent: zod_1.z.object({}).passthrough().optional(),
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
    isError: zod_1.z.optional(zod_1.z.boolean())
});
/**
 * CallToolResultSchema extended with backwards compatibility to protocol version 2024-10-07.
 */
exports.CompatibilityCallToolResultSchema = exports.CallToolResultSchema.or(exports.ResultSchema.extend({
    toolResult: zod_1.z.unknown()
}));
/**
 * Used by the client to invoke a tool provided by the server.
 */
exports.CallToolRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('tools/call'),
    params: BaseRequestParamsSchema.extend({
        name: zod_1.z.string(),
        arguments: zod_1.z.optional(zod_1.z.record(zod_1.z.unknown()))
    })
});
/**
 * An optional notification from the server to the client, informing it that the list of tools it offers has changed. This may be issued by servers without any previous subscription from the client.
 */
exports.ToolListChangedNotificationSchema = exports.NotificationSchema.extend({
    method: zod_1.z.literal('notifications/tools/list_changed')
});
/* Logging */
/**
 * The severity of a log message.
 */
exports.LoggingLevelSchema = zod_1.z.enum(['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency']);
/**
 * A request from the client to the server, to enable or adjust logging.
 */
exports.SetLevelRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('logging/setLevel'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The level of logging that the client wants to receive from the server. The server should send all logs at this level and higher (i.e., more severe) to the client as notifications/logging/message.
         */
        level: exports.LoggingLevelSchema
    })
});
/**
 * Notification of a log message passed from server to client. If no logging/setLevel request has been sent from the client, the server MAY decide which messages to send automatically.
 */
exports.LoggingMessageNotificationSchema = exports.NotificationSchema.extend({
    method: zod_1.z.literal('notifications/message'),
    params: BaseNotificationParamsSchema.extend({
        /**
         * The severity of this log message.
         */
        level: exports.LoggingLevelSchema,
        /**
         * An optional name of the logger issuing this message.
         */
        logger: zod_1.z.optional(zod_1.z.string()),
        /**
         * The data to be logged, such as a string message or an object. Any JSON serializable type is allowed here.
         */
        data: zod_1.z.unknown()
    })
});
/* Sampling */
/**
 * Hints to use for model selection.
 */
exports.ModelHintSchema = zod_1.z
    .object({
    /**
     * A hint for a model name.
     */
    name: zod_1.z.string().optional()
})
    .passthrough();
/**
 * The server's preferences for model selection, requested of the client during sampling.
 */
exports.ModelPreferencesSchema = zod_1.z
    .object({
    /**
     * Optional hints to use for model selection.
     */
    hints: zod_1.z.optional(zod_1.z.array(exports.ModelHintSchema)),
    /**
     * How much to prioritize cost when selecting a model.
     */
    costPriority: zod_1.z.optional(zod_1.z.number().min(0).max(1)),
    /**
     * How much to prioritize sampling speed (latency) when selecting a model.
     */
    speedPriority: zod_1.z.optional(zod_1.z.number().min(0).max(1)),
    /**
     * How much to prioritize intelligence and capabilities when selecting a model.
     */
    intelligencePriority: zod_1.z.optional(zod_1.z.number().min(0).max(1))
})
    .passthrough();
/**
 * Describes a message issued to or received from an LLM API.
 */
exports.SamplingMessageSchema = zod_1.z
    .object({
    role: zod_1.z.enum(['user', 'assistant']),
    content: zod_1.z.union([exports.TextContentSchema, exports.ImageContentSchema, exports.AudioContentSchema])
})
    .passthrough();
/**
 * A request from the server to sample an LLM via the client. The client has full discretion over which model to select. The client should also inform the user before beginning sampling, to allow them to inspect the request (human in the loop) and decide whether to approve it.
 */
exports.CreateMessageRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('sampling/createMessage'),
    params: BaseRequestParamsSchema.extend({
        messages: zod_1.z.array(exports.SamplingMessageSchema),
        /**
         * An optional system prompt the server wants to use for sampling. The client MAY modify or omit this prompt.
         */
        systemPrompt: zod_1.z.optional(zod_1.z.string()),
        /**
         * A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request.
         */
        includeContext: zod_1.z.optional(zod_1.z.enum(['none', 'thisServer', 'allServers'])),
        temperature: zod_1.z.optional(zod_1.z.number()),
        /**
         * The maximum number of tokens to sample, as requested by the server. The client MAY choose to sample fewer tokens than requested.
         */
        maxTokens: zod_1.z.number().int(),
        stopSequences: zod_1.z.optional(zod_1.z.array(zod_1.z.string())),
        /**
         * Optional metadata to pass through to the LLM provider. The format of this metadata is provider-specific.
         */
        metadata: zod_1.z.optional(zod_1.z.object({}).passthrough()),
        /**
         * The server's preferences for which model to select.
         */
        modelPreferences: zod_1.z.optional(exports.ModelPreferencesSchema)
    })
});
/**
 * The client's response to a sampling/create_message request from the server. The client should inform the user before returning the sampled message, to allow them to inspect the response (human in the loop) and decide whether to allow the server to see it.
 */
exports.CreateMessageResultSchema = exports.ResultSchema.extend({
    /**
     * The name of the model that generated the message.
     */
    model: zod_1.z.string(),
    /**
     * The reason why sampling stopped.
     */
    stopReason: zod_1.z.optional(zod_1.z.enum(['endTurn', 'stopSequence', 'maxTokens']).or(zod_1.z.string())),
    role: zod_1.z.enum(['user', 'assistant']),
    content: zod_1.z.discriminatedUnion('type', [exports.TextContentSchema, exports.ImageContentSchema, exports.AudioContentSchema])
});
/* Elicitation */
/**
 * Primitive schema definition for boolean fields.
 */
exports.BooleanSchemaSchema = zod_1.z
    .object({
    type: zod_1.z.literal('boolean'),
    title: zod_1.z.optional(zod_1.z.string()),
    description: zod_1.z.optional(zod_1.z.string()),
    default: zod_1.z.optional(zod_1.z.boolean())
})
    .passthrough();
/**
 * Primitive schema definition for string fields.
 */
exports.StringSchemaSchema = zod_1.z
    .object({
    type: zod_1.z.literal('string'),
    title: zod_1.z.optional(zod_1.z.string()),
    description: zod_1.z.optional(zod_1.z.string()),
    minLength: zod_1.z.optional(zod_1.z.number()),
    maxLength: zod_1.z.optional(zod_1.z.number()),
    format: zod_1.z.optional(zod_1.z.enum(['email', 'uri', 'date', 'date-time']))
})
    .passthrough();
/**
 * Primitive schema definition for number fields.
 */
exports.NumberSchemaSchema = zod_1.z
    .object({
    type: zod_1.z.enum(['number', 'integer']),
    title: zod_1.z.optional(zod_1.z.string()),
    description: zod_1.z.optional(zod_1.z.string()),
    minimum: zod_1.z.optional(zod_1.z.number()),
    maximum: zod_1.z.optional(zod_1.z.number())
})
    .passthrough();
/**
 * Primitive schema definition for enum fields.
 */
exports.EnumSchemaSchema = zod_1.z
    .object({
    type: zod_1.z.literal('string'),
    title: zod_1.z.optional(zod_1.z.string()),
    description: zod_1.z.optional(zod_1.z.string()),
    enum: zod_1.z.array(zod_1.z.string()),
    enumNames: zod_1.z.optional(zod_1.z.array(zod_1.z.string()))
})
    .passthrough();
/**
 * Union of all primitive schema definitions.
 */
exports.PrimitiveSchemaDefinitionSchema = zod_1.z.union([exports.BooleanSchemaSchema, exports.StringSchemaSchema, exports.NumberSchemaSchema, exports.EnumSchemaSchema]);
/**
 * A request from the server to elicit user input via the client.
 * The client should present the message and form fields to the user.
 */
exports.ElicitRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('elicitation/create'),
    params: BaseRequestParamsSchema.extend({
        /**
         * The message to present to the user.
         */
        message: zod_1.z.string(),
        /**
         * The schema for the requested user input.
         */
        requestedSchema: zod_1.z
            .object({
            type: zod_1.z.literal('object'),
            properties: zod_1.z.record(zod_1.z.string(), exports.PrimitiveSchemaDefinitionSchema),
            required: zod_1.z.optional(zod_1.z.array(zod_1.z.string()))
        })
            .passthrough()
    })
});
/**
 * The client's response to an elicitation/create request from the server.
 */
exports.ElicitResultSchema = exports.ResultSchema.extend({
    /**
     * The user's response action.
     */
    action: zod_1.z.enum(['accept', 'decline', 'cancel']),
    /**
     * The collected user input content (only present if action is "accept").
     */
    content: zod_1.z.optional(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()))
});
/* Autocomplete */
/**
 * A reference to a resource or resource template definition.
 */
exports.ResourceTemplateReferenceSchema = zod_1.z
    .object({
    type: zod_1.z.literal('ref/resource'),
    /**
     * The URI or URI template of the resource.
     */
    uri: zod_1.z.string()
})
    .passthrough();
/**
 * @deprecated Use ResourceTemplateReferenceSchema instead
 */
exports.ResourceReferenceSchema = exports.ResourceTemplateReferenceSchema;
/**
 * Identifies a prompt.
 */
exports.PromptReferenceSchema = zod_1.z
    .object({
    type: zod_1.z.literal('ref/prompt'),
    /**
     * The name of the prompt or prompt template
     */
    name: zod_1.z.string()
})
    .passthrough();
/**
 * A request from the client to the server, to ask for completion options.
 */
exports.CompleteRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('completion/complete'),
    params: BaseRequestParamsSchema.extend({
        ref: zod_1.z.union([exports.PromptReferenceSchema, exports.ResourceTemplateReferenceSchema]),
        /**
         * The argument's information
         */
        argument: zod_1.z
            .object({
            /**
             * The name of the argument
             */
            name: zod_1.z.string(),
            /**
             * The value of the argument to use for completion matching.
             */
            value: zod_1.z.string()
        })
            .passthrough(),
        context: zod_1.z.optional(zod_1.z.object({
            /**
             * Previously-resolved variables in a URI template or prompt.
             */
            arguments: zod_1.z.optional(zod_1.z.record(zod_1.z.string(), zod_1.z.string()))
        }))
    })
});
/**
 * The server's response to a completion/complete request
 */
exports.CompleteResultSchema = exports.ResultSchema.extend({
    completion: zod_1.z
        .object({
        /**
         * An array of completion values. Must not exceed 100 items.
         */
        values: zod_1.z.array(zod_1.z.string()).max(100),
        /**
         * The total number of completion options available. This can exceed the number of values actually sent in the response.
         */
        total: zod_1.z.optional(zod_1.z.number().int()),
        /**
         * Indicates whether there are additional completion options beyond those provided in the current response, even if the exact total is unknown.
         */
        hasMore: zod_1.z.optional(zod_1.z.boolean())
    })
        .passthrough()
});
/* Roots */
/**
 * Represents a root directory or file that the server can operate on.
 */
exports.RootSchema = zod_1.z
    .object({
    /**
     * The URI identifying the root. This *must* start with file:// for now.
     */
    uri: zod_1.z.string().startsWith('file://'),
    /**
     * An optional name for the root.
     */
    name: zod_1.z.optional(zod_1.z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: zod_1.z.optional(zod_1.z.object({}).passthrough())
})
    .passthrough();
/**
 * Sent from the server to request a list of root URIs from the client.
 */
exports.ListRootsRequestSchema = exports.RequestSchema.extend({
    method: zod_1.z.literal('roots/list')
});
/**
 * The client's response to a roots/list request from the server.
 */
exports.ListRootsResultSchema = exports.ResultSchema.extend({
    roots: zod_1.z.array(exports.RootSchema)
});
/**
 * A notification from the client to the server, informing it that the list of roots has changed.
 */
exports.RootsListChangedNotificationSchema = exports.NotificationSchema.extend({
    method: zod_1.z.literal('notifications/roots/list_changed')
});
/* Client messages */
exports.ClientRequestSchema = zod_1.z.union([
    exports.PingRequestSchema,
    exports.InitializeRequestSchema,
    exports.CompleteRequestSchema,
    exports.SetLevelRequestSchema,
    exports.GetPromptRequestSchema,
    exports.ListPromptsRequestSchema,
    exports.ListResourcesRequestSchema,
    exports.ListResourceTemplatesRequestSchema,
    exports.ReadResourceRequestSchema,
    exports.SubscribeRequestSchema,
    exports.UnsubscribeRequestSchema,
    exports.CallToolRequestSchema,
    exports.ListToolsRequestSchema
]);
exports.ClientNotificationSchema = zod_1.z.union([
    exports.CancelledNotificationSchema,
    exports.ProgressNotificationSchema,
    exports.InitializedNotificationSchema,
    exports.RootsListChangedNotificationSchema
]);
exports.ClientResultSchema = zod_1.z.union([exports.EmptyResultSchema, exports.CreateMessageResultSchema, exports.ElicitResultSchema, exports.ListRootsResultSchema]);
/* Server messages */
exports.ServerRequestSchema = zod_1.z.union([exports.PingRequestSchema, exports.CreateMessageRequestSchema, exports.ElicitRequestSchema, exports.ListRootsRequestSchema]);
exports.ServerNotificationSchema = zod_1.z.union([
    exports.CancelledNotificationSchema,
    exports.ProgressNotificationSchema,
    exports.LoggingMessageNotificationSchema,
    exports.ResourceUpdatedNotificationSchema,
    exports.ResourceListChangedNotificationSchema,
    exports.ToolListChangedNotificationSchema,
    exports.PromptListChangedNotificationSchema
]);
exports.ServerResultSchema = zod_1.z.union([
    exports.EmptyResultSchema,
    exports.InitializeResultSchema,
    exports.CompleteResultSchema,
    exports.GetPromptResultSchema,
    exports.ListPromptsResultSchema,
    exports.ListResourcesResultSchema,
    exports.ListResourceTemplatesResultSchema,
    exports.ReadResourceResultSchema,
    exports.CallToolResultSchema,
    exports.ListToolsResultSchema
]);
class McpError extends Error {
    constructor(code, message, data) {
        super(`MCP error ${code}: ${message}`);
        this.code = code;
        this.data = data;
        this.name = 'McpError';
    }
}
exports.McpError = McpError;
//# sourceMappingURL=types.js.map