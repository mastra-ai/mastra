"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const protocol_js_1 = require("../shared/protocol.js");
const types_js_1 = require("../types.js");
const ajv_1 = __importDefault(require("ajv"));
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
class Client extends protocol_js_1.Protocol {
    /**
     * Initializes this client with the given name and version information.
     */
    constructor(_clientInfo, options) {
        var _a;
        super(options);
        this._clientInfo = _clientInfo;
        this._cachedToolOutputValidators = new Map();
        this._capabilities = (_a = options === null || options === void 0 ? void 0 : options.capabilities) !== null && _a !== void 0 ? _a : {};
        this._ajv = new ajv_1.default();
    }
    /**
     * Registers new capabilities. This can only be called before connecting to a transport.
     *
     * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
     */
    registerCapabilities(capabilities) {
        if (this.transport) {
            throw new Error('Cannot register capabilities after connecting to transport');
        }
        this._capabilities = (0, protocol_js_1.mergeCapabilities)(this._capabilities, capabilities);
    }
    assertCapability(capability, method) {
        var _a;
        if (!((_a = this._serverCapabilities) === null || _a === void 0 ? void 0 : _a[capability])) {
            throw new Error(`Server does not support ${capability} (required for ${method})`);
        }
    }
    async connect(transport, options) {
        await super.connect(transport);
        // When transport sessionId is already set this means we are trying to reconnect.
        // In this case we don't need to initialize again.
        if (transport.sessionId !== undefined) {
            return;
        }
        try {
            const result = await this.request({
                method: 'initialize',
                params: {
                    protocolVersion: types_js_1.LATEST_PROTOCOL_VERSION,
                    capabilities: this._capabilities,
                    clientInfo: this._clientInfo
                }
            }, types_js_1.InitializeResultSchema, options);
            if (result === undefined) {
                throw new Error(`Server sent invalid initialize result: ${result}`);
            }
            if (!types_js_1.SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
                throw new Error(`Server's protocol version is not supported: ${result.protocolVersion}`);
            }
            this._serverCapabilities = result.capabilities;
            this._serverVersion = result.serverInfo;
            // HTTP transports must set the protocol version in each header after initialization.
            if (transport.setProtocolVersion) {
                transport.setProtocolVersion(result.protocolVersion);
            }
            this._instructions = result.instructions;
            await this.notification({
                method: 'notifications/initialized'
            });
        }
        catch (error) {
            // Disconnect if initialization fails.
            void this.close();
            throw error;
        }
    }
    /**
     * After initialization has completed, this will be populated with the server's reported capabilities.
     */
    getServerCapabilities() {
        return this._serverCapabilities;
    }
    /**
     * After initialization has completed, this will be populated with information about the server's name and version.
     */
    getServerVersion() {
        return this._serverVersion;
    }
    /**
     * After initialization has completed, this may be populated with information about the server's instructions.
     */
    getInstructions() {
        return this._instructions;
    }
    assertCapabilityForMethod(method) {
        var _a, _b, _c, _d, _e;
        switch (method) {
            case 'logging/setLevel':
                if (!((_a = this._serverCapabilities) === null || _a === void 0 ? void 0 : _a.logging)) {
                    throw new Error(`Server does not support logging (required for ${method})`);
                }
                break;
            case 'prompts/get':
            case 'prompts/list':
                if (!((_b = this._serverCapabilities) === null || _b === void 0 ? void 0 : _b.prompts)) {
                    throw new Error(`Server does not support prompts (required for ${method})`);
                }
                break;
            case 'resources/list':
            case 'resources/templates/list':
            case 'resources/read':
            case 'resources/subscribe':
            case 'resources/unsubscribe':
                if (!((_c = this._serverCapabilities) === null || _c === void 0 ? void 0 : _c.resources)) {
                    throw new Error(`Server does not support resources (required for ${method})`);
                }
                if (method === 'resources/subscribe' && !this._serverCapabilities.resources.subscribe) {
                    throw new Error(`Server does not support resource subscriptions (required for ${method})`);
                }
                break;
            case 'tools/call':
            case 'tools/list':
                if (!((_d = this._serverCapabilities) === null || _d === void 0 ? void 0 : _d.tools)) {
                    throw new Error(`Server does not support tools (required for ${method})`);
                }
                break;
            case 'completion/complete':
                if (!((_e = this._serverCapabilities) === null || _e === void 0 ? void 0 : _e.completions)) {
                    throw new Error(`Server does not support completions (required for ${method})`);
                }
                break;
            case 'initialize':
                // No specific capability required for initialize
                break;
            case 'ping':
                // No specific capability required for ping
                break;
        }
    }
    assertNotificationCapability(method) {
        var _a;
        switch (method) {
            case 'notifications/roots/list_changed':
                if (!((_a = this._capabilities.roots) === null || _a === void 0 ? void 0 : _a.listChanged)) {
                    throw new Error(`Client does not support roots list changed notifications (required for ${method})`);
                }
                break;
            case 'notifications/initialized':
                // No specific capability required for initialized
                break;
            case 'notifications/cancelled':
                // Cancellation notifications are always allowed
                break;
            case 'notifications/progress':
                // Progress notifications are always allowed
                break;
        }
    }
    assertRequestHandlerCapability(method) {
        switch (method) {
            case 'sampling/createMessage':
                if (!this._capabilities.sampling) {
                    throw new Error(`Client does not support sampling capability (required for ${method})`);
                }
                break;
            case 'elicitation/create':
                if (!this._capabilities.elicitation) {
                    throw new Error(`Client does not support elicitation capability (required for ${method})`);
                }
                break;
            case 'roots/list':
                if (!this._capabilities.roots) {
                    throw new Error(`Client does not support roots capability (required for ${method})`);
                }
                break;
            case 'ping':
                // No specific capability required for ping
                break;
        }
    }
    async ping(options) {
        return this.request({ method: 'ping' }, types_js_1.EmptyResultSchema, options);
    }
    async complete(params, options) {
        return this.request({ method: 'completion/complete', params }, types_js_1.CompleteResultSchema, options);
    }
    async setLoggingLevel(level, options) {
        return this.request({ method: 'logging/setLevel', params: { level } }, types_js_1.EmptyResultSchema, options);
    }
    async getPrompt(params, options) {
        return this.request({ method: 'prompts/get', params }, types_js_1.GetPromptResultSchema, options);
    }
    async listPrompts(params, options) {
        return this.request({ method: 'prompts/list', params }, types_js_1.ListPromptsResultSchema, options);
    }
    async listResources(params, options) {
        return this.request({ method: 'resources/list', params }, types_js_1.ListResourcesResultSchema, options);
    }
    async listResourceTemplates(params, options) {
        return this.request({ method: 'resources/templates/list', params }, types_js_1.ListResourceTemplatesResultSchema, options);
    }
    async readResource(params, options) {
        return this.request({ method: 'resources/read', params }, types_js_1.ReadResourceResultSchema, options);
    }
    async subscribeResource(params, options) {
        return this.request({ method: 'resources/subscribe', params }, types_js_1.EmptyResultSchema, options);
    }
    async unsubscribeResource(params, options) {
        return this.request({ method: 'resources/unsubscribe', params }, types_js_1.EmptyResultSchema, options);
    }
    async callTool(params, resultSchema = types_js_1.CallToolResultSchema, options) {
        const result = await this.request({ method: 'tools/call', params }, resultSchema, options);
        // Check if the tool has an outputSchema
        const validator = this.getToolOutputValidator(params.name);
        if (validator) {
            // If tool has outputSchema, it MUST return structuredContent (unless it's an error)
            if (!result.structuredContent && !result.isError) {
                throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, `Tool ${params.name} has an output schema but did not return structured content`);
            }
            // Only validate structured content if present (not when there's an error)
            if (result.structuredContent) {
                try {
                    // Validate the structured content (which is already an object) against the schema
                    const isValid = validator(result.structuredContent);
                    if (!isValid) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Structured content does not match the tool's output schema: ${this._ajv.errorsText(validator.errors)}`);
                    }
                }
                catch (error) {
                    if (error instanceof types_js_1.McpError) {
                        throw error;
                    }
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Failed to validate structured content: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        return result;
    }
    cacheToolOutputSchemas(tools) {
        this._cachedToolOutputValidators.clear();
        for (const tool of tools) {
            // If the tool has an outputSchema, create and cache the Ajv validator
            if (tool.outputSchema) {
                try {
                    const validator = this._ajv.compile(tool.outputSchema);
                    this._cachedToolOutputValidators.set(tool.name, validator);
                }
                catch (_a) {
                    // Ignore schema compilation errors
                }
            }
        }
    }
    getToolOutputValidator(toolName) {
        return this._cachedToolOutputValidators.get(toolName);
    }
    async listTools(params, options) {
        const result = await this.request({ method: 'tools/list', params }, types_js_1.ListToolsResultSchema, options);
        // Cache the tools and their output schemas for future validation
        this.cacheToolOutputSchemas(result.tools);
        return result;
    }
    async sendRootsListChanged() {
        return this.notification({ method: 'notifications/roots/list_changed' });
    }
}
exports.Client = Client;
//# sourceMappingURL=index.js.map