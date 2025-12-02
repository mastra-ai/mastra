"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const protocol_js_1 = require("../shared/protocol.js");
const types_js_1 = require("../types.js");
const ajv_1 = __importDefault(require("ajv"));
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
class Server extends protocol_js_1.Protocol {
    /**
     * Initializes this server with the given name and version information.
     */
    constructor(_serverInfo, options) {
        var _a;
        super(options);
        this._serverInfo = _serverInfo;
        // Map log levels by session id
        this._loggingLevels = new Map();
        // Map LogLevelSchema to severity index
        this.LOG_LEVEL_SEVERITY = new Map(types_js_1.LoggingLevelSchema.options.map((level, index) => [level, index]));
        // Is a message with the given level ignored in the log level set for the given session id?
        this.isMessageIgnored = (level, sessionId) => {
            const currentLevel = this._loggingLevels.get(sessionId);
            return currentLevel ? this.LOG_LEVEL_SEVERITY.get(level) < this.LOG_LEVEL_SEVERITY.get(currentLevel) : false;
        };
        this._capabilities = (_a = options === null || options === void 0 ? void 0 : options.capabilities) !== null && _a !== void 0 ? _a : {};
        this._instructions = options === null || options === void 0 ? void 0 : options.instructions;
        this.setRequestHandler(types_js_1.InitializeRequestSchema, request => this._oninitialize(request));
        this.setNotificationHandler(types_js_1.InitializedNotificationSchema, () => { var _a; return (_a = this.oninitialized) === null || _a === void 0 ? void 0 : _a.call(this); });
        if (this._capabilities.logging) {
            this.setRequestHandler(types_js_1.SetLevelRequestSchema, async (request, extra) => {
                var _a;
                const transportSessionId = extra.sessionId || ((_a = extra.requestInfo) === null || _a === void 0 ? void 0 : _a.headers['mcp-session-id']) || undefined;
                const { level } = request.params;
                const parseResult = types_js_1.LoggingLevelSchema.safeParse(level);
                if (parseResult.success) {
                    this._loggingLevels.set(transportSessionId, parseResult.data);
                }
                return {};
            });
        }
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
    assertCapabilityForMethod(method) {
        var _a, _b, _c;
        switch (method) {
            case 'sampling/createMessage':
                if (!((_a = this._clientCapabilities) === null || _a === void 0 ? void 0 : _a.sampling)) {
                    throw new Error(`Client does not support sampling (required for ${method})`);
                }
                break;
            case 'elicitation/create':
                if (!((_b = this._clientCapabilities) === null || _b === void 0 ? void 0 : _b.elicitation)) {
                    throw new Error(`Client does not support elicitation (required for ${method})`);
                }
                break;
            case 'roots/list':
                if (!((_c = this._clientCapabilities) === null || _c === void 0 ? void 0 : _c.roots)) {
                    throw new Error(`Client does not support listing roots (required for ${method})`);
                }
                break;
            case 'ping':
                // No specific capability required for ping
                break;
        }
    }
    assertNotificationCapability(method) {
        switch (method) {
            case 'notifications/message':
                if (!this._capabilities.logging) {
                    throw new Error(`Server does not support logging (required for ${method})`);
                }
                break;
            case 'notifications/resources/updated':
            case 'notifications/resources/list_changed':
                if (!this._capabilities.resources) {
                    throw new Error(`Server does not support notifying about resources (required for ${method})`);
                }
                break;
            case 'notifications/tools/list_changed':
                if (!this._capabilities.tools) {
                    throw new Error(`Server does not support notifying of tool list changes (required for ${method})`);
                }
                break;
            case 'notifications/prompts/list_changed':
                if (!this._capabilities.prompts) {
                    throw new Error(`Server does not support notifying of prompt list changes (required for ${method})`);
                }
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
                    throw new Error(`Server does not support sampling (required for ${method})`);
                }
                break;
            case 'logging/setLevel':
                if (!this._capabilities.logging) {
                    throw new Error(`Server does not support logging (required for ${method})`);
                }
                break;
            case 'prompts/get':
            case 'prompts/list':
                if (!this._capabilities.prompts) {
                    throw new Error(`Server does not support prompts (required for ${method})`);
                }
                break;
            case 'resources/list':
            case 'resources/templates/list':
            case 'resources/read':
                if (!this._capabilities.resources) {
                    throw new Error(`Server does not support resources (required for ${method})`);
                }
                break;
            case 'tools/call':
            case 'tools/list':
                if (!this._capabilities.tools) {
                    throw new Error(`Server does not support tools (required for ${method})`);
                }
                break;
            case 'ping':
            case 'initialize':
                // No specific capability required for these methods
                break;
        }
    }
    async _oninitialize(request) {
        const requestedVersion = request.params.protocolVersion;
        this._clientCapabilities = request.params.capabilities;
        this._clientVersion = request.params.clientInfo;
        const protocolVersion = types_js_1.SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion) ? requestedVersion : types_js_1.LATEST_PROTOCOL_VERSION;
        return {
            protocolVersion,
            capabilities: this.getCapabilities(),
            serverInfo: this._serverInfo,
            ...(this._instructions && { instructions: this._instructions })
        };
    }
    /**
     * After initialization has completed, this will be populated with the client's reported capabilities.
     */
    getClientCapabilities() {
        return this._clientCapabilities;
    }
    /**
     * After initialization has completed, this will be populated with information about the client's name and version.
     */
    getClientVersion() {
        return this._clientVersion;
    }
    getCapabilities() {
        return this._capabilities;
    }
    async ping() {
        return this.request({ method: 'ping' }, types_js_1.EmptyResultSchema);
    }
    async createMessage(params, options) {
        return this.request({ method: 'sampling/createMessage', params }, types_js_1.CreateMessageResultSchema, options);
    }
    async elicitInput(params, options) {
        const result = await this.request({ method: 'elicitation/create', params }, types_js_1.ElicitResultSchema, options);
        // Validate the response content against the requested schema if action is "accept"
        if (result.action === 'accept' && result.content) {
            try {
                const ajv = new ajv_1.default();
                const validate = ajv.compile(params.requestedSchema);
                const isValid = validate(result.content);
                if (!isValid) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Elicitation response content does not match requested schema: ${ajv.errorsText(validate.errors)}`);
                }
            }
            catch (error) {
                if (error instanceof types_js_1.McpError) {
                    throw error;
                }
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Error validating elicitation response: ${error}`);
            }
        }
        return result;
    }
    async listRoots(params, options) {
        return this.request({ method: 'roots/list', params }, types_js_1.ListRootsResultSchema, options);
    }
    /**
     * Sends a logging message to the client, if connected.
     * Note: You only need to send the parameters object, not the entire JSON RPC message
     * @see LoggingMessageNotification
     * @param params
     * @param sessionId optional for stateless and backward compatibility
     */
    async sendLoggingMessage(params, sessionId) {
        if (this._capabilities.logging) {
            if (!this.isMessageIgnored(params.level, sessionId)) {
                return this.notification({ method: 'notifications/message', params });
            }
        }
    }
    async sendResourceUpdated(params) {
        return this.notification({
            method: 'notifications/resources/updated',
            params
        });
    }
    async sendResourceListChanged() {
        return this.notification({
            method: 'notifications/resources/list_changed'
        });
    }
    async sendToolListChanged() {
        return this.notification({ method: 'notifications/tools/list_changed' });
    }
    async sendPromptListChanged() {
        return this.notification({ method: 'notifications/prompts/list_changed' });
    }
}
exports.Server = Server;
//# sourceMappingURL=index.js.map