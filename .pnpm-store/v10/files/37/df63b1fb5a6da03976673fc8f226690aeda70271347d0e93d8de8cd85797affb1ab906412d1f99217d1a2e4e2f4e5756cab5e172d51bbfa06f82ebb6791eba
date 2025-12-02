import { Server } from './index.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import { McpError, ErrorCode, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema, ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, CompleteRequestSchema } from '../types.js';
import { Completable } from './completable.js';
import { UriTemplate } from '../shared/uriTemplate.js';
/**
 * High-level MCP server that provides a simpler API for working with resources, tools, and prompts.
 * For advanced usage (like sending notifications or setting custom request handlers), use the underlying
 * Server instance available via the `server` property.
 */
export class McpServer {
    constructor(serverInfo, options) {
        this._registeredResources = {};
        this._registeredResourceTemplates = {};
        this._registeredTools = {};
        this._registeredPrompts = {};
        this._toolHandlersInitialized = false;
        this._completionHandlerInitialized = false;
        this._resourceHandlersInitialized = false;
        this._promptHandlersInitialized = false;
        this.server = new Server(serverInfo, options);
    }
    /**
     * Attaches to the given transport, starts it, and starts listening for messages.
     *
     * The `server` object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
     */
    async connect(transport) {
        return await this.server.connect(transport);
    }
    /**
     * Closes the connection.
     */
    async close() {
        await this.server.close();
    }
    setToolRequestHandlers() {
        if (this._toolHandlersInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(ListToolsRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(CallToolRequestSchema.shape.method.value);
        this.server.registerCapabilities({
            tools: {
                listChanged: true
            }
        });
        this.server.setRequestHandler(ListToolsRequestSchema, () => ({
            tools: Object.entries(this._registeredTools)
                .filter(([, tool]) => tool.enabled)
                .map(([name, tool]) => {
                const toolDefinition = {
                    name,
                    title: tool.title,
                    description: tool.description,
                    inputSchema: tool.inputSchema
                        ? zodToJsonSchema(tool.inputSchema, {
                            strictUnions: true
                        })
                        : EMPTY_OBJECT_JSON_SCHEMA,
                    annotations: tool.annotations,
                    _meta: tool._meta
                };
                if (tool.outputSchema) {
                    toolDefinition.outputSchema = zodToJsonSchema(tool.outputSchema, {
                        strictUnions: true
                    });
                }
                return toolDefinition;
            })
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
            const tool = this._registeredTools[request.params.name];
            if (!tool) {
                throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} not found`);
            }
            if (!tool.enabled) {
                throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} disabled`);
            }
            let result;
            if (tool.inputSchema) {
                const parseResult = await tool.inputSchema.safeParseAsync(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for tool ${request.params.name}: ${parseResult.error.message}`);
                }
                const args = parseResult.data;
                const cb = tool.callback;
                try {
                    result = await Promise.resolve(cb(args, extra));
                }
                catch (error) {
                    result = {
                        content: [
                            {
                                type: 'text',
                                text: error instanceof Error ? error.message : String(error)
                            }
                        ],
                        isError: true
                    };
                }
            }
            else {
                const cb = tool.callback;
                try {
                    result = await Promise.resolve(cb(extra));
                }
                catch (error) {
                    result = {
                        content: [
                            {
                                type: 'text',
                                text: error instanceof Error ? error.message : String(error)
                            }
                        ],
                        isError: true
                    };
                }
            }
            if (tool.outputSchema && !result.isError) {
                if (!result.structuredContent) {
                    throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} has an output schema but no structured content was provided`);
                }
                // if the tool has an output schema, validate structured content
                const parseResult = await tool.outputSchema.safeParseAsync(result.structuredContent);
                if (!parseResult.success) {
                    throw new McpError(ErrorCode.InvalidParams, `Invalid structured content for tool ${request.params.name}: ${parseResult.error.message}`);
                }
            }
            return result;
        });
        this._toolHandlersInitialized = true;
    }
    setCompletionRequestHandler() {
        if (this._completionHandlerInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(CompleteRequestSchema.shape.method.value);
        this.server.registerCapabilities({
            completions: {}
        });
        this.server.setRequestHandler(CompleteRequestSchema, async (request) => {
            switch (request.params.ref.type) {
                case 'ref/prompt':
                    return this.handlePromptCompletion(request, request.params.ref);
                case 'ref/resource':
                    return this.handleResourceCompletion(request, request.params.ref);
                default:
                    throw new McpError(ErrorCode.InvalidParams, `Invalid completion reference: ${request.params.ref}`);
            }
        });
        this._completionHandlerInitialized = true;
    }
    async handlePromptCompletion(request, ref) {
        const prompt = this._registeredPrompts[ref.name];
        if (!prompt) {
            throw new McpError(ErrorCode.InvalidParams, `Prompt ${ref.name} not found`);
        }
        if (!prompt.enabled) {
            throw new McpError(ErrorCode.InvalidParams, `Prompt ${ref.name} disabled`);
        }
        if (!prompt.argsSchema) {
            return EMPTY_COMPLETION_RESULT;
        }
        const field = prompt.argsSchema.shape[request.params.argument.name];
        if (!(field instanceof Completable)) {
            return EMPTY_COMPLETION_RESULT;
        }
        const def = field._def;
        const suggestions = await def.complete(request.params.argument.value, request.params.context);
        return createCompletionResult(suggestions);
    }
    async handleResourceCompletion(request, ref) {
        const template = Object.values(this._registeredResourceTemplates).find(t => t.resourceTemplate.uriTemplate.toString() === ref.uri);
        if (!template) {
            if (this._registeredResources[ref.uri]) {
                // Attempting to autocomplete a fixed resource URI is not an error in the spec (but probably should be).
                return EMPTY_COMPLETION_RESULT;
            }
            throw new McpError(ErrorCode.InvalidParams, `Resource template ${request.params.ref.uri} not found`);
        }
        const completer = template.resourceTemplate.completeCallback(request.params.argument.name);
        if (!completer) {
            return EMPTY_COMPLETION_RESULT;
        }
        const suggestions = await completer(request.params.argument.value, request.params.context);
        return createCompletionResult(suggestions);
    }
    setResourceRequestHandlers() {
        if (this._resourceHandlersInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(ListResourcesRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(ListResourceTemplatesRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(ReadResourceRequestSchema.shape.method.value);
        this.server.registerCapabilities({
            resources: {
                listChanged: true
            }
        });
        this.server.setRequestHandler(ListResourcesRequestSchema, async (request, extra) => {
            const resources = Object.entries(this._registeredResources)
                .filter(([_, resource]) => resource.enabled)
                .map(([uri, resource]) => ({
                uri,
                name: resource.name,
                ...resource.metadata
            }));
            const templateResources = [];
            for (const template of Object.values(this._registeredResourceTemplates)) {
                if (!template.resourceTemplate.listCallback) {
                    continue;
                }
                const result = await template.resourceTemplate.listCallback(extra);
                for (const resource of result.resources) {
                    templateResources.push({
                        ...template.metadata,
                        // the defined resource metadata should override the template metadata if present
                        ...resource
                    });
                }
            }
            return { resources: [...resources, ...templateResources] };
        });
        this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
            const resourceTemplates = Object.entries(this._registeredResourceTemplates).map(([name, template]) => ({
                name,
                uriTemplate: template.resourceTemplate.uriTemplate.toString(),
                ...template.metadata
            }));
            return { resourceTemplates };
        });
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
            const uri = new URL(request.params.uri);
            // First check for exact resource match
            const resource = this._registeredResources[uri.toString()];
            if (resource) {
                if (!resource.enabled) {
                    throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} disabled`);
                }
                return resource.readCallback(uri, extra);
            }
            // Then check templates
            for (const template of Object.values(this._registeredResourceTemplates)) {
                const variables = template.resourceTemplate.uriTemplate.match(uri.toString());
                if (variables) {
                    return template.readCallback(uri, variables, extra);
                }
            }
            throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} not found`);
        });
        this.setCompletionRequestHandler();
        this._resourceHandlersInitialized = true;
    }
    setPromptRequestHandlers() {
        if (this._promptHandlersInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(ListPromptsRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(GetPromptRequestSchema.shape.method.value);
        this.server.registerCapabilities({
            prompts: {
                listChanged: true
            }
        });
        this.server.setRequestHandler(ListPromptsRequestSchema, () => ({
            prompts: Object.entries(this._registeredPrompts)
                .filter(([, prompt]) => prompt.enabled)
                .map(([name, prompt]) => {
                return {
                    name,
                    title: prompt.title,
                    description: prompt.description,
                    arguments: prompt.argsSchema ? promptArgumentsFromSchema(prompt.argsSchema) : undefined
                };
            })
        }));
        this.server.setRequestHandler(GetPromptRequestSchema, async (request, extra) => {
            const prompt = this._registeredPrompts[request.params.name];
            if (!prompt) {
                throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} not found`);
            }
            if (!prompt.enabled) {
                throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} disabled`);
            }
            if (prompt.argsSchema) {
                const parseResult = await prompt.argsSchema.safeParseAsync(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for prompt ${request.params.name}: ${parseResult.error.message}`);
                }
                const args = parseResult.data;
                const cb = prompt.callback;
                return await Promise.resolve(cb(args, extra));
            }
            else {
                const cb = prompt.callback;
                return await Promise.resolve(cb(extra));
            }
        });
        this.setCompletionRequestHandler();
        this._promptHandlersInitialized = true;
    }
    resource(name, uriOrTemplate, ...rest) {
        let metadata;
        if (typeof rest[0] === 'object') {
            metadata = rest.shift();
        }
        const readCallback = rest[0];
        if (typeof uriOrTemplate === 'string') {
            if (this._registeredResources[uriOrTemplate]) {
                throw new Error(`Resource ${uriOrTemplate} is already registered`);
            }
            const registeredResource = this._createRegisteredResource(name, undefined, uriOrTemplate, metadata, readCallback);
            this.setResourceRequestHandlers();
            this.sendResourceListChanged();
            return registeredResource;
        }
        else {
            if (this._registeredResourceTemplates[name]) {
                throw new Error(`Resource template ${name} is already registered`);
            }
            const registeredResourceTemplate = this._createRegisteredResourceTemplate(name, undefined, uriOrTemplate, metadata, readCallback);
            this.setResourceRequestHandlers();
            this.sendResourceListChanged();
            return registeredResourceTemplate;
        }
    }
    registerResource(name, uriOrTemplate, config, readCallback) {
        if (typeof uriOrTemplate === 'string') {
            if (this._registeredResources[uriOrTemplate]) {
                throw new Error(`Resource ${uriOrTemplate} is already registered`);
            }
            const registeredResource = this._createRegisteredResource(name, config.title, uriOrTemplate, config, readCallback);
            this.setResourceRequestHandlers();
            this.sendResourceListChanged();
            return registeredResource;
        }
        else {
            if (this._registeredResourceTemplates[name]) {
                throw new Error(`Resource template ${name} is already registered`);
            }
            const registeredResourceTemplate = this._createRegisteredResourceTemplate(name, config.title, uriOrTemplate, config, readCallback);
            this.setResourceRequestHandlers();
            this.sendResourceListChanged();
            return registeredResourceTemplate;
        }
    }
    _createRegisteredResource(name, title, uri, metadata, readCallback) {
        const registeredResource = {
            name,
            title,
            metadata,
            readCallback,
            enabled: true,
            disable: () => registeredResource.update({ enabled: false }),
            enable: () => registeredResource.update({ enabled: true }),
            remove: () => registeredResource.update({ uri: null }),
            update: updates => {
                if (typeof updates.uri !== 'undefined' && updates.uri !== uri) {
                    delete this._registeredResources[uri];
                    if (updates.uri)
                        this._registeredResources[updates.uri] = registeredResource;
                }
                if (typeof updates.name !== 'undefined')
                    registeredResource.name = updates.name;
                if (typeof updates.title !== 'undefined')
                    registeredResource.title = updates.title;
                if (typeof updates.metadata !== 'undefined')
                    registeredResource.metadata = updates.metadata;
                if (typeof updates.callback !== 'undefined')
                    registeredResource.readCallback = updates.callback;
                if (typeof updates.enabled !== 'undefined')
                    registeredResource.enabled = updates.enabled;
                this.sendResourceListChanged();
            }
        };
        this._registeredResources[uri] = registeredResource;
        return registeredResource;
    }
    _createRegisteredResourceTemplate(name, title, template, metadata, readCallback) {
        const registeredResourceTemplate = {
            resourceTemplate: template,
            title,
            metadata,
            readCallback,
            enabled: true,
            disable: () => registeredResourceTemplate.update({ enabled: false }),
            enable: () => registeredResourceTemplate.update({ enabled: true }),
            remove: () => registeredResourceTemplate.update({ name: null }),
            update: updates => {
                if (typeof updates.name !== 'undefined' && updates.name !== name) {
                    delete this._registeredResourceTemplates[name];
                    if (updates.name)
                        this._registeredResourceTemplates[updates.name] = registeredResourceTemplate;
                }
                if (typeof updates.title !== 'undefined')
                    registeredResourceTemplate.title = updates.title;
                if (typeof updates.template !== 'undefined')
                    registeredResourceTemplate.resourceTemplate = updates.template;
                if (typeof updates.metadata !== 'undefined')
                    registeredResourceTemplate.metadata = updates.metadata;
                if (typeof updates.callback !== 'undefined')
                    registeredResourceTemplate.readCallback = updates.callback;
                if (typeof updates.enabled !== 'undefined')
                    registeredResourceTemplate.enabled = updates.enabled;
                this.sendResourceListChanged();
            }
        };
        this._registeredResourceTemplates[name] = registeredResourceTemplate;
        return registeredResourceTemplate;
    }
    _createRegisteredPrompt(name, title, description, argsSchema, callback) {
        const registeredPrompt = {
            title,
            description,
            argsSchema: argsSchema === undefined ? undefined : z.object(argsSchema),
            callback,
            enabled: true,
            disable: () => registeredPrompt.update({ enabled: false }),
            enable: () => registeredPrompt.update({ enabled: true }),
            remove: () => registeredPrompt.update({ name: null }),
            update: updates => {
                if (typeof updates.name !== 'undefined' && updates.name !== name) {
                    delete this._registeredPrompts[name];
                    if (updates.name)
                        this._registeredPrompts[updates.name] = registeredPrompt;
                }
                if (typeof updates.title !== 'undefined')
                    registeredPrompt.title = updates.title;
                if (typeof updates.description !== 'undefined')
                    registeredPrompt.description = updates.description;
                if (typeof updates.argsSchema !== 'undefined')
                    registeredPrompt.argsSchema = z.object(updates.argsSchema);
                if (typeof updates.callback !== 'undefined')
                    registeredPrompt.callback = updates.callback;
                if (typeof updates.enabled !== 'undefined')
                    registeredPrompt.enabled = updates.enabled;
                this.sendPromptListChanged();
            }
        };
        this._registeredPrompts[name] = registeredPrompt;
        return registeredPrompt;
    }
    _createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations, _meta, callback) {
        const registeredTool = {
            title,
            description,
            inputSchema: inputSchema === undefined ? undefined : z.object(inputSchema),
            outputSchema: outputSchema === undefined ? undefined : z.object(outputSchema),
            annotations,
            _meta,
            callback,
            enabled: true,
            disable: () => registeredTool.update({ enabled: false }),
            enable: () => registeredTool.update({ enabled: true }),
            remove: () => registeredTool.update({ name: null }),
            update: updates => {
                if (typeof updates.name !== 'undefined' && updates.name !== name) {
                    delete this._registeredTools[name];
                    if (updates.name)
                        this._registeredTools[updates.name] = registeredTool;
                }
                if (typeof updates.title !== 'undefined')
                    registeredTool.title = updates.title;
                if (typeof updates.description !== 'undefined')
                    registeredTool.description = updates.description;
                if (typeof updates.paramsSchema !== 'undefined')
                    registeredTool.inputSchema = z.object(updates.paramsSchema);
                if (typeof updates.callback !== 'undefined')
                    registeredTool.callback = updates.callback;
                if (typeof updates.annotations !== 'undefined')
                    registeredTool.annotations = updates.annotations;
                if (typeof updates._meta !== 'undefined')
                    registeredTool._meta = updates._meta;
                if (typeof updates.enabled !== 'undefined')
                    registeredTool.enabled = updates.enabled;
                this.sendToolListChanged();
            }
        };
        this._registeredTools[name] = registeredTool;
        this.setToolRequestHandlers();
        this.sendToolListChanged();
        return registeredTool;
    }
    /**
     * tool() implementation. Parses arguments passed to overrides defined above.
     */
    tool(name, ...rest) {
        if (this._registeredTools[name]) {
            throw new Error(`Tool ${name} is already registered`);
        }
        let description;
        let inputSchema;
        let outputSchema;
        let annotations;
        // Tool properties are passed as separate arguments, with omissions allowed.
        // Support for this style is frozen as of protocol version 2025-03-26. Future additions
        // to tool definition should *NOT* be added.
        if (typeof rest[0] === 'string') {
            description = rest.shift();
        }
        // Handle the different overload combinations
        if (rest.length > 1) {
            // We have at least one more arg before the callback
            const firstArg = rest[0];
            if (isZodRawShape(firstArg)) {
                // We have a params schema as the first arg
                inputSchema = rest.shift();
                // Check if the next arg is potentially annotations
                if (rest.length > 1 && typeof rest[0] === 'object' && rest[0] !== null && !isZodRawShape(rest[0])) {
                    // Case: tool(name, paramsSchema, annotations, cb)
                    // Or: tool(name, description, paramsSchema, annotations, cb)
                    annotations = rest.shift();
                }
            }
            else if (typeof firstArg === 'object' && firstArg !== null) {
                // Not a ZodRawShape, so must be annotations in this position
                // Case: tool(name, annotations, cb)
                // Or: tool(name, description, annotations, cb)
                annotations = rest.shift();
            }
        }
        const callback = rest[0];
        return this._createRegisteredTool(name, undefined, description, inputSchema, outputSchema, annotations, undefined, callback);
    }
    /**
     * Registers a tool with a config object and callback.
     */
    registerTool(name, config, cb) {
        if (this._registeredTools[name]) {
            throw new Error(`Tool ${name} is already registered`);
        }
        const { title, description, inputSchema, outputSchema, annotations, _meta } = config;
        return this._createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations, _meta, cb);
    }
    prompt(name, ...rest) {
        if (this._registeredPrompts[name]) {
            throw new Error(`Prompt ${name} is already registered`);
        }
        let description;
        if (typeof rest[0] === 'string') {
            description = rest.shift();
        }
        let argsSchema;
        if (rest.length > 1) {
            argsSchema = rest.shift();
        }
        const cb = rest[0];
        const registeredPrompt = this._createRegisteredPrompt(name, undefined, description, argsSchema, cb);
        this.setPromptRequestHandlers();
        this.sendPromptListChanged();
        return registeredPrompt;
    }
    /**
     * Registers a prompt with a config object and callback.
     */
    registerPrompt(name, config, cb) {
        if (this._registeredPrompts[name]) {
            throw new Error(`Prompt ${name} is already registered`);
        }
        const { title, description, argsSchema } = config;
        const registeredPrompt = this._createRegisteredPrompt(name, title, description, argsSchema, cb);
        this.setPromptRequestHandlers();
        this.sendPromptListChanged();
        return registeredPrompt;
    }
    /**
     * Checks if the server is connected to a transport.
     * @returns True if the server is connected
     */
    isConnected() {
        return this.server.transport !== undefined;
    }
    /**
     * Sends a logging message to the client, if connected.
     * Note: You only need to send the parameters object, not the entire JSON RPC message
     * @see LoggingMessageNotification
     * @param params
     * @param sessionId optional for stateless and backward compatibility
     */
    async sendLoggingMessage(params, sessionId) {
        return this.server.sendLoggingMessage(params, sessionId);
    }
    /**
     * Sends a resource list changed event to the client, if connected.
     */
    sendResourceListChanged() {
        if (this.isConnected()) {
            this.server.sendResourceListChanged();
        }
    }
    /**
     * Sends a tool list changed event to the client, if connected.
     */
    sendToolListChanged() {
        if (this.isConnected()) {
            this.server.sendToolListChanged();
        }
    }
    /**
     * Sends a prompt list changed event to the client, if connected.
     */
    sendPromptListChanged() {
        if (this.isConnected()) {
            this.server.sendPromptListChanged();
        }
    }
}
/**
 * A resource template combines a URI pattern with optional functionality to enumerate
 * all resources matching that pattern.
 */
export class ResourceTemplate {
    constructor(uriTemplate, _callbacks) {
        this._callbacks = _callbacks;
        this._uriTemplate = typeof uriTemplate === 'string' ? new UriTemplate(uriTemplate) : uriTemplate;
    }
    /**
     * Gets the URI template pattern.
     */
    get uriTemplate() {
        return this._uriTemplate;
    }
    /**
     * Gets the list callback, if one was provided.
     */
    get listCallback() {
        return this._callbacks.list;
    }
    /**
     * Gets the callback for completing a specific URI template variable, if one was provided.
     */
    completeCallback(variable) {
        var _a;
        return (_a = this._callbacks.complete) === null || _a === void 0 ? void 0 : _a[variable];
    }
}
const EMPTY_OBJECT_JSON_SCHEMA = {
    type: 'object',
    properties: {}
};
// Helper to check if an object is a Zod schema (ZodRawShape)
function isZodRawShape(obj) {
    if (typeof obj !== 'object' || obj === null)
        return false;
    const isEmptyObject = Object.keys(obj).length === 0;
    // Check if object is empty or at least one property is a ZodType instance
    // Note: use heuristic check to avoid instanceof failure across different Zod versions
    return isEmptyObject || Object.values(obj).some(isZodTypeLike);
}
function isZodTypeLike(value) {
    return (value !== null &&
        typeof value === 'object' &&
        'parse' in value &&
        typeof value.parse === 'function' &&
        'safeParse' in value &&
        typeof value.safeParse === 'function');
}
function promptArgumentsFromSchema(schema) {
    return Object.entries(schema.shape).map(([name, field]) => ({
        name,
        description: field.description,
        required: !field.isOptional()
    }));
}
function createCompletionResult(suggestions) {
    return {
        completion: {
            values: suggestions.slice(0, 100),
            total: suggestions.length,
            hasMore: suggestions.length > 100
        }
    };
}
const EMPTY_COMPLETION_RESULT = {
    completion: {
        values: [],
        hasMore: false
    }
};
//# sourceMappingURL=mcp.js.map