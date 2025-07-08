import { randomUUID } from 'node:crypto';
import type * as http from 'node:http';
import type { InternalCoreTool } from '@mastra/core';
import { createTool, makeCoreTool } from '@mastra/core';
import type { ToolsInput, Agent } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { MCPServerBase } from '@mastra/core/mcp';
import type {
  MCPServerConfig,
  ServerInfo,
  ServerDetailInfo,
  ConvertedTool,
  MCPServerHonoSSEOptions,
  MCPServerSSEOptions,
  MCPToolType,
} from '@mastra/core/mcp';
import { RuntimeContext } from '@mastra/core/runtime-context';
import type { Workflow } from '@mastra/core/workflows';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { StreamableHTTPServerTransportOptions } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  PromptSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  ResourceContents,
  Resource,
  ResourceTemplate,
  ServerCapabilities,
  Prompt,
  CallToolResult,
  ElicitResult,
  ElicitRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type { SSEStreamingApi } from 'hono/streaming';
import { streamSSE } from 'hono/streaming';
import { SSETransport } from 'hono-mcp-server-sse-transport';
import { z } from 'zod';
import { ServerPromptActions } from './promptActions';
import { ServerResourceActions } from './resourceActions';
import type { MCPServerPrompts, MCPServerResources, ElicitationActions, MCPTool } from './types';
export class MCPServer extends MCPServerBase {
  private server: Server;
  private stdioTransport?: StdioServerTransport;
  private sseTransport?: SSEServerTransport;
  private sseHonoTransports: Map<string, SSETransport>;
  private streamableHTTPTransports: Map<string, StreamableHTTPServerTransport> = new Map();
  // Track server instances for each HTTP session
  private httpServerInstances: Map<string, Server> = new Map();

  private definedResources?: Resource[];
  private definedResourceTemplates?: ResourceTemplate[];
  private resourceOptions?: MCPServerResources;
  private definedPrompts?: Prompt[];
  private promptOptions?: MCPServerPrompts;
  private subscriptions: Set<string> = new Set();
  public readonly resources: ServerResourceActions;
  public readonly prompts: ServerPromptActions;
  public readonly elicitation: ElicitationActions;

  /**
   * Get the current stdio transport.
   */
  public getStdioTransport(): StdioServerTransport | undefined {
    return this.stdioTransport;
  }

  /**
   * Get the current SSE transport.
   */
  public getSseTransport(): SSEServerTransport | undefined {
    return this.sseTransport;
  }

  /**
   * Get the current SSE Hono transport.
   */
  public getSseHonoTransport(sessionId: string): SSETransport | undefined {
    return this.sseHonoTransports.get(sessionId);
  }

  /**
   * Get the current server instance.
   */
  public getServer(): Server {
    return this.server;
  }

  /**
   * Construct a new MCPServer instance.
   * @param opts - Configuration options for the server, including registry metadata.
   */
  constructor(opts: MCPServerConfig & { resources?: MCPServerResources; prompts?: MCPServerPrompts }) {
    super(opts);
    this.resourceOptions = opts.resources;
    this.promptOptions = opts.prompts;

    const capabilities: ServerCapabilities = {
      tools: {},
      logging: { enabled: true },
      elicitation: {},
    };

    if (opts.resources) {
      capabilities.resources = { subscribe: true, listChanged: true };
    }

    if (opts.prompts) {
      capabilities.prompts = { listChanged: true };
    }

    this.server = new Server({ name: this.name, version: this.version }, { capabilities });

    this.logger.info(
      `Initialized MCPServer '${this.name}' v${this.version} (ID: ${this.id}) with tools: ${Object.keys(this.convertedTools).join(', ')} and resources. Capabilities: ${JSON.stringify(capabilities)}`,
    );

    this.sseHonoTransports = new Map();

    // Register all handlers on the main server instance
    this.registerHandlersOnServer(this.server);

    this.resources = new ServerResourceActions({
      getSubscriptions: () => this.subscriptions,
      getLogger: () => this.logger,
      getSdkServer: () => this.server,
      clearDefinedResources: () => {
        this.definedResources = undefined;
      },
      clearDefinedResourceTemplates: () => {
        this.definedResourceTemplates = undefined;
      },
    });

    this.prompts = new ServerPromptActions({
      getLogger: () => this.logger,
      getSdkServer: () => this.server,
      clearDefinedPrompts: () => {
        this.definedPrompts = undefined;
      },
    });

    this.elicitation = {
      sendRequest: async request => {
        return this.handleElicitationRequest(request);
      },
    };
  }

  /**
   * Handle an elicitation request by sending it to the connected client.
   * This method sends an elicitation/create request to the client and waits for the response.
   *
   * @param request - The elicitation request containing message and schema
   * @param serverInstance - Optional server instance to use; defaults to main server for backward compatibility
   * @returns Promise that resolves to the client's response
   */
  private async handleElicitationRequest(
    request: ElicitRequest['params'],
    serverInstance?: Server,
  ): Promise<ElicitResult> {
    this.logger.debug(`Sending elicitation request: ${request.message}`);

    const server = serverInstance || this.server;
    const response = await server.elicitInput(request);

    this.logger.debug(`Received elicitation response: ${JSON.stringify(response)}`);

    return response;
  }

  /**
   * Creates a new Server instance configured with all handlers for HTTP sessions.
   * Each HTTP client connection gets its own Server instance to avoid routing conflicts.
   */
  private createServerInstance(): Server {
    const capabilities: ServerCapabilities = {
      tools: {},
      logging: { enabled: true },
      elicitation: {},
    };

    if (this.resourceOptions) {
      capabilities.resources = { subscribe: true, listChanged: true };
    }

    if (this.promptOptions) {
      capabilities.prompts = { listChanged: true };
    }

    const serverInstance = new Server({ name: this.name, version: this.version }, { capabilities });

    // Register all handlers on the new server instance
    this.registerHandlersOnServer(serverInstance);

    return serverInstance;
  }

  /**
   * Registers all MCP handlers on a given server instance.
   * This allows us to create multiple server instances with identical functionality.
   */
  private registerHandlersOnServer(serverInstance: Server) {
    // List tools handler
    serverInstance.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Handling ListTools request');
      return {
        tools: Object.values(this.convertedTools).map(tool => {
          const toolSpec: any = {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.parameters.jsonSchema,
          };
          if (tool.outputSchema) {
            toolSpec.outputSchema = tool.outputSchema.jsonSchema;
          }
          return toolSpec;
        }),
      };
    });

    // Call tool handler
    serverInstance.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const startTime = Date.now();
      try {
        const tool = this.convertedTools[request.params.name] as MCPTool;
        if (!tool) {
          this.logger.warn(`CallTool: Unknown tool '${request.params.name}' requested.`);
          return {
            content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
            isError: true,
          };
        }

        const validation = tool.parameters.validate?.(request.params.arguments ?? {});
        if (validation && !validation.success) {
          this.logger.warn(`CallTool: Invalid tool arguments for '${request.params.name}'`, {
            errors: validation.error,
          });
          return {
            content: [{ type: 'text', text: `Invalid tool arguments: ${JSON.stringify(validation.error)}` }],
            isError: true,
          };
        }
        if (!tool.execute) {
          this.logger.warn(`CallTool: Tool '${request.params.name}' does not have an execute function.`);
          return {
            content: [{ type: 'text', text: `Tool '${request.params.name}' does not have an execute function.` }],
            isError: true,
          };
        }

        // Create session-aware elicitation for this tool execution
        const sessionElicitation = {
          sendRequest: async (request: ElicitRequest['params']) => {
            return this.handleElicitationRequest(request, serverInstance);
          },
        };

        const result = await tool.execute(validation?.value, {
          messages: [],
          toolCallId: '',
          elicitation: sessionElicitation,
          extra,
        });

        this.logger.debug(`CallTool: Tool '${request.params.name}' executed successfully with result:`, result);
        const duration = Date.now() - startTime;
        this.logger.info(`Tool '${request.params.name}' executed successfully in ${duration}ms.`);

        const response: CallToolResult = { isError: false, content: [] };

        if (tool.outputSchema) {
          if (!result.structuredContent) {
            throw new Error(`Tool ${request.params.name} has an output schema but no structured content was provided.`);
          }
          const outputValidation = tool.outputSchema.validate?.(result.structuredContent ?? {});
          if (outputValidation && !outputValidation.success) {
            this.logger.warn(`CallTool: Invalid structured content for '${request.params.name}'`, {
              errors: outputValidation.error,
            });
            throw new Error(
              `Invalid structured content for tool ${request.params.name}: ${JSON.stringify(outputValidation.error)}`,
            );
          }
          response.structuredContent = result.structuredContent;
        }

        if (response.structuredContent) {
          response.content = [{ type: 'text', text: JSON.stringify(response.structuredContent) }];
        } else {
          response.content = [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result),
            },
          ];
        }

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        if (error instanceof z.ZodError) {
          this.logger.warn('Invalid tool arguments', {
            tool: request.params.name,
            errors: error.errors,
            duration: `${duration}ms`,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
              },
            ],
            isError: true,
          };
        }
        this.logger.error(`Tool execution failed: ${request.params.name}`, { error });
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    });

    // Register resource handlers if resources are configured
    if (this.resourceOptions) {
      this.registerResourceHandlersOnServer(serverInstance);
    }

    // Register prompt handlers if prompts are configured
    if (this.promptOptions) {
      this.registerPromptHandlersOnServer(serverInstance);
    }
  }

  /**
   * Registers resource-related handlers on a server instance.
   */
  private registerResourceHandlersOnServer(serverInstance: Server) {
    const capturedResourceOptions = this.resourceOptions;
    if (!capturedResourceOptions) return;

    // List resources handler
    if (capturedResourceOptions.listResources) {
      serverInstance.setRequestHandler(ListResourcesRequestSchema, async () => {
        this.logger.debug('Handling ListResources request');
        if (this.definedResources) {
          return { resources: this.definedResources };
        } else {
          try {
            const resources = await capturedResourceOptions.listResources!();
            this.definedResources = resources;
            this.logger.debug(`Fetched and cached ${this.definedResources.length} resources.`);
            return { resources: this.definedResources };
          } catch (error) {
            this.logger.error('Error fetching resources via listResources():', { error });
            throw error;
          }
        }
      });
    }

    // Read resource handler
    if (capturedResourceOptions.getResourceContent) {
      serverInstance.setRequestHandler(ReadResourceRequestSchema, async request => {
        const startTime = Date.now();
        const uri = request.params.uri;
        this.logger.debug(`Handling ReadResource request for URI: ${uri}`);

        if (!this.definedResources) {
          const resources = await this.resourceOptions?.listResources?.();
          if (!resources) throw new Error('Failed to load resources');
          this.definedResources = resources;
        }

        const resource = this.definedResources?.find(r => r.uri === uri);

        if (!resource) {
          this.logger.warn(`ReadResource: Unknown resource URI '${uri}' requested.`);
          throw new Error(`Resource not found: ${uri}`);
        }

        try {
          const resourcesOrResourceContent = await capturedResourceOptions.getResourceContent({ uri });
          const resourcesContent = Array.isArray(resourcesOrResourceContent)
            ? resourcesOrResourceContent
            : [resourcesOrResourceContent];
          const contents: ResourceContents[] = resourcesContent.map(resourceContent => {
            const contentItem: ResourceContents = {
              uri: resource.uri,
              mimeType: resource.mimeType,
            };
            if ('text' in resourceContent) {
              contentItem.text = resourceContent.text;
            }

            if ('blob' in resourceContent) {
              contentItem.blob = resourceContent.blob;
            }

            return contentItem;
          });
          const duration = Date.now() - startTime;
          this.logger.info(`Resource '${uri}' read successfully in ${duration}ms.`);
          return {
            contents,
          };
        } catch (error) {
          const duration = Date.now() - startTime;
          this.logger.error(`Failed to get content for resource URI '${uri}' in ${duration}ms`, { error });
          throw error;
        }
      });
    }

    // Resource templates handler
    if (capturedResourceOptions.resourceTemplates) {
      serverInstance.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
        this.logger.debug('Handling ListResourceTemplates request');
        if (this.definedResourceTemplates) {
          return { resourceTemplates: this.definedResourceTemplates };
        } else {
          try {
            const templates = await capturedResourceOptions.resourceTemplates!();
            this.definedResourceTemplates = templates;
            this.logger.debug(`Fetched and cached ${this.definedResourceTemplates.length} resource templates.`);
            return { resourceTemplates: this.definedResourceTemplates };
          } catch (error) {
            this.logger.error('Error fetching resource templates via resourceTemplates():', { error });
            throw error;
          }
        }
      });
    }

    // Subscribe/unsubscribe handlers
    serverInstance.setRequestHandler(SubscribeRequestSchema, async (request: { params: { uri: string } }) => {
      const uri = request.params.uri;
      this.logger.info(`Received resources/subscribe request for URI: ${uri}`);
      this.subscriptions.add(uri);
      return {};
    });

    serverInstance.setRequestHandler(UnsubscribeRequestSchema, async (request: { params: { uri: string } }) => {
      const uri = request.params.uri;
      this.logger.info(`Received resources/unsubscribe request for URI: ${uri}`);
      this.subscriptions.delete(uri);
      return {};
    });
  }

  /**
   * Registers prompt-related handlers on a server instance.
   */
  private registerPromptHandlersOnServer(serverInstance: Server) {
    const capturedPromptOptions = this.promptOptions;
    if (!capturedPromptOptions) return;

    // List prompts handler
    if (capturedPromptOptions.listPrompts) {
      serverInstance.setRequestHandler(ListPromptsRequestSchema, async () => {
        this.logger.debug('Handling ListPrompts request');
        if (this.definedPrompts) {
          return {
            prompts: this.definedPrompts?.map(p => ({ ...p, version: p.version ?? undefined })),
          };
        } else {
          try {
            const prompts = await capturedPromptOptions.listPrompts();
            for (const prompt of prompts) {
              PromptSchema.parse(prompt);
            }
            this.definedPrompts = prompts;
            this.logger.debug(`Fetched and cached ${this.definedPrompts.length} prompts.`);
            return {
              prompts: this.definedPrompts?.map(p => ({ ...p, version: p.version ?? undefined })),
            };
          } catch (error) {
            this.logger.error('Error fetching prompts via listPrompts():', {
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        }
      });
    }

    // Get prompt handler
    if (capturedPromptOptions.getPromptMessages) {
      serverInstance.setRequestHandler(
        GetPromptRequestSchema,
        async (request: { params: { name: string; version?: string; arguments?: any } }) => {
          const startTime = Date.now();
          const { name, version, arguments: args } = request.params;
          if (!this.definedPrompts) {
            const prompts = await this.promptOptions?.listPrompts?.();
            if (!prompts) throw new Error('Failed to load prompts');
            this.definedPrompts = prompts;
          }
          // Select prompt by name and version (if provided)
          let prompt;
          if (version) {
            prompt = this.definedPrompts?.find(p => p.name === name && p.version === version);
          } else {
            // Select the first matching name if no version is provided.
            prompt = this.definedPrompts?.find(p => p.name === name);
          }
          if (!prompt) throw new Error(`Prompt "${name}"${version ? ` (version ${version})` : ''} not found`);
          // Validate required arguments
          if (prompt.arguments) {
            for (const arg of prompt.arguments) {
              if (arg.required && (args?.[arg.name] === undefined || args?.[arg.name] === null)) {
                throw new Error(`Missing required argument: ${arg.name}`);
              }
            }
          }
          try {
            let messages: any[] = [];
            if (capturedPromptOptions.getPromptMessages) {
              messages = await capturedPromptOptions.getPromptMessages({ name, version, args });
            }
            const duration = Date.now() - startTime;
            this.logger.info(
              `Prompt '${name}'${version ? ` (version ${version})` : ''} retrieved successfully in ${duration}ms.`,
            );
            return { prompt, messages };
          } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`Failed to get content for prompt '${name}' in ${duration}ms`, { error });
            throw error;
          }
        },
      );
    }
  }

  private convertAgentsToTools(
    agentsConfig?: Record<string, Agent>,
    definedConvertedTools?: Record<string, ConvertedTool>,
  ): Record<string, ConvertedTool> {
    const agentTools: Record<string, ConvertedTool> = {};
    if (!agentsConfig) {
      return agentTools;
    }

    for (const agentKey in agentsConfig) {
      const agent = agentsConfig[agentKey];
      if (!agent || !('generate' in agent)) {
        this.logger.warn(`Agent instance for '${agentKey}' is invalid or missing a generate function. Skipping.`);
        continue;
      }

      const agentDescription = agent.getDescription();

      if (!agentDescription) {
        throw new Error(
          `Agent '${agent.name}' (key: '${agentKey}') must have a non-empty description to be used in an MCPServer.`,
        );
      }

      const agentToolName = `ask_${agentKey}`;
      if (definedConvertedTools?.[agentToolName] || agentTools[agentToolName]) {
        this.logger.warn(
          `Tool with name '${agentToolName}' already exists. Agent '${agentKey}' will not be added as a duplicate tool.`,
        );
        continue;
      }

      const agentToolDefinition = createTool({
        id: agentToolName,
        description: `Ask agent '${agent.name}' a question. Agent description: ${agentDescription}`,
        inputSchema: z.object({
          message: z.string().describe('The question or input for the agent.'),
        }),
        execute: async ({ context, runtimeContext }) => {
          this.logger.debug(
            `Executing agent tool '${agentToolName}' for agent '${agent.name}' with message: "${context.message}"`,
          );
          try {
            const response = await agent.generate(context.message, { runtimeContext });
            return response;
          } catch (error) {
            this.logger.error(`Error executing agent tool '${agentToolName}' for agent '${agent.name}':`, error);
            throw error;
          }
        },
      });

      const options = {
        name: agentToolName,
        logger: this.logger,
        mastra: this.mastra,
        runtimeContext: new RuntimeContext(),
        description: agentToolDefinition.description,
      };
      const coreTool = makeCoreTool(agentToolDefinition, options) as InternalCoreTool;

      agentTools[agentToolName] = {
        name: agentToolName,
        description: coreTool.description,
        parameters: coreTool.parameters,
        execute: coreTool.execute!,
        toolType: 'agent',
      };
      this.logger.info(`Registered agent '${agent.name}' (key: '${agentKey}') as tool: '${agentToolName}'`);
    }
    return agentTools;
  }

  private convertWorkflowsToTools(
    workflowsConfig?: Record<string, Workflow>,
    definedConvertedTools?: Record<string, ConvertedTool>,
  ): Record<string, ConvertedTool> {
    const workflowTools: Record<string, ConvertedTool> = {};
    if (!workflowsConfig) {
      return workflowTools;
    }

    for (const workflowKey in workflowsConfig) {
      const workflow = workflowsConfig[workflowKey];
      if (!workflow || typeof workflow.createRun !== 'function') {
        this.logger.warn(
          `Workflow instance for '${workflowKey}' is invalid or missing a createRun function. Skipping.`,
        );
        continue;
      }

      const workflowDescription = workflow.description;
      if (!workflowDescription) {
        throw new Error(
          `Workflow '${workflow.id}' (key: '${workflowKey}') must have a non-empty description to be used in an MCPServer.`,
        );
      }

      const workflowToolName = `run_${workflowKey}`;
      if (definedConvertedTools?.[workflowToolName] || workflowTools[workflowToolName]) {
        this.logger.warn(
          `Tool with name '${workflowToolName}' already exists. Workflow '${workflowKey}' will not be added as a duplicate tool.`,
        );
        continue;
      }

      const workflowToolDefinition = createTool({
        id: workflowToolName,
        description: `Run workflow '${workflowKey}'. Workflow description: ${workflowDescription}`,
        inputSchema: workflow.inputSchema,
        execute: async ({ context, runtimeContext }) => {
          this.logger.debug(
            `Executing workflow tool '${workflowToolName}' for workflow '${workflow.id}' with input:`,
            context,
          );
          try {
            const run = workflow.createRun({ runId: runtimeContext?.get('runId') });

            const response = await run.start({ inputData: context, runtimeContext });

            return response;
          } catch (error) {
            this.logger.error(
              `Error executing workflow tool '${workflowToolName}' for workflow '${workflow.id}':`,
              error,
            );
            throw error;
          }
        },
      });

      const options = {
        name: workflowToolName,
        logger: this.logger,
        mastra: this.mastra,
        runtimeContext: new RuntimeContext(),
        description: workflowToolDefinition.description,
      };

      const coreTool = makeCoreTool(workflowToolDefinition, options) as InternalCoreTool;

      workflowTools[workflowToolName] = {
        name: workflowToolName,
        description: coreTool.description,
        parameters: coreTool.parameters,
        outputSchema: coreTool.outputSchema,
        execute: coreTool.execute!,
        toolType: 'workflow',
      };
      this.logger.info(`Registered workflow '${workflow.id}' (key: '${workflowKey}') as tool: '${workflowToolName}'`);
    }
    return workflowTools;
  }

  /**
   * Convert and validate all provided tools, logging registration status.
   * Also converts agents and workflows into tools.
   * @param tools Tool definitions
   * @param agentsConfig Agent definitions to be converted to tools, expected from MCPServerConfig
   * @param workflowsConfig Workflow definitions to be converted to tools, expected from MCPServerConfig
   * @returns Converted tools registry
   */
  convertTools(
    tools: ToolsInput,
    agentsConfig?: Record<string, Agent>,
    workflowsConfig?: Record<string, Workflow>,
  ): Record<string, ConvertedTool> {
    const definedConvertedTools: Record<string, ConvertedTool> = {};

    for (const toolName of Object.keys(tools)) {
      const toolInstance = tools[toolName];
      if (!toolInstance) {
        this.logger.warn(`Tool instance for '${toolName}' is undefined. Skipping.`);
        continue;
      }

      if (typeof toolInstance.execute !== 'function') {
        this.logger.warn(`Tool '${toolName}' does not have a valid execute function. Skipping.`);
        continue;
      }

      const options = {
        name: toolName,
        runtimeContext: new RuntimeContext(),
        mastra: this.mastra,
        logger: this.logger,
        description: toolInstance?.description,
      };

      const coreTool = makeCoreTool(toolInstance, options) as InternalCoreTool;

      definedConvertedTools[toolName] = {
        name: toolName,
        description: coreTool.description,
        parameters: coreTool.parameters,
        outputSchema: coreTool.outputSchema,
        execute: coreTool.execute!,
      };
      this.logger.info(`Registered explicit tool: '${toolName}'`);
    }
    this.logger.info(`Total defined tools registered: ${Object.keys(definedConvertedTools).length}`);

    let agentDerivedTools: Record<string, ConvertedTool> = {};
    let workflowDerivedTools: Record<string, ConvertedTool> = {};
    try {
      agentDerivedTools = this.convertAgentsToTools(agentsConfig, definedConvertedTools);
      workflowDerivedTools = this.convertWorkflowsToTools(workflowsConfig, definedConvertedTools);
    } catch (e) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_AGENT_OR_WORKFLOW_TOOL_CONVERSION_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
        },
        e,
      );
      this.logger.trackException(mastraError);
      this.logger.error('Failed to convert tools:', {
        error: mastraError.toString(),
      });
      throw mastraError;
    }

    const allConvertedTools = { ...definedConvertedTools, ...agentDerivedTools, ...workflowDerivedTools };

    const finalToolCount = Object.keys(allConvertedTools).length;
    const definedCount = Object.keys(definedConvertedTools).length;
    const fromAgentsCount = Object.keys(agentDerivedTools).length;
    const fromWorkflowsCount = Object.keys(workflowDerivedTools).length;
    this.logger.info(
      `${finalToolCount} total tools registered (${definedCount} defined + ${fromAgentsCount} agents + ${fromWorkflowsCount} workflows)`,
    );

    return allConvertedTools;
  }

  /**
   * Start the MCP server using stdio transport (for Windsurf integration).
   */
  public async startStdio(): Promise<void> {
    this.stdioTransport = new StdioServerTransport();
    try {
      await this.server.connect(this.stdioTransport);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_STDIO_CONNECTION_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
      this.logger.trackException(mastraError);
      this.logger.error('Failed to connect MCP server using stdio transport:', {
        error: mastraError.toString(),
      });
      throw mastraError;
    }
    this.logger.info('Started MCP Server (stdio)');
  }

  /**
   * Handles MCP-over-SSE protocol for user-provided HTTP servers.
   * Call this from your HTTP server for both the SSE and message endpoints.
   *
   * @param url Parsed URL of the incoming request
   * @param ssePath Path for establishing the SSE connection (e.g. '/sse')
   * @param messagePath Path for POSTing client messages (e.g. '/message')
   * @param req Incoming HTTP request
   * @param res HTTP response (must support .write/.end)
   */
  public async startSSE({ url, ssePath, messagePath, req, res }: MCPServerSSEOptions): Promise<void> {
    try {
      if (url.pathname === ssePath) {
        await this.connectSSE({
          messagePath,
          res,
        });
      } else if (url.pathname === messagePath) {
        this.logger.debug('Received message');
        if (!this.sseTransport) {
          res.writeHead(503);
          res.end('SSE connection not established');
          return;
        }
        await this.sseTransport.handlePostMessage(req, res);
      } else {
        this.logger.debug('Unknown path:', { path: url.pathname });
        res.writeHead(404);
        res.end();
      }
    } catch (e) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_SSE_START_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          details: {
            url: url.toString(),
            ssePath,
            messagePath,
          },
        },
        e,
      );
      this.logger.trackException(mastraError);
      this.logger.error('Failed to start MCP Server (SSE):', { error: mastraError.toString() });
      throw mastraError;
    }
  }

  /**
   * Handles MCP-over-SSE protocol for user-provided HTTP servers.
   * Call this from your HTTP server for both the SSE and message endpoints.
   *
   * @param url Parsed URL of the incoming request
   * @param ssePath Path for establishing the SSE connection (e.g. '/sse')
   * @param messagePath Path for POSTing client messages (e.g. '/message')
   * @param context Incoming Hono context
   */
  public async startHonoSSE({ url, ssePath, messagePath, context }: MCPServerHonoSSEOptions) {
    try {
      if (url.pathname === ssePath) {
        return streamSSE(context, async stream => {
          await this.connectHonoSSE({
            messagePath,
            stream,
          });
        });
      } else if (url.pathname === messagePath) {
        this.logger.debug('Received message');
        const sessionId = context.req.query('sessionId');
        this.logger.debug('Received message for sessionId', { sessionId });
        if (!sessionId) {
          return context.text('No sessionId provided', 400);
        }
        if (!this.sseHonoTransports.has(sessionId)) {
          return context.text(`No transport found for sessionId ${sessionId}`, 400);
        }
        const message = await this.sseHonoTransports.get(sessionId)?.handlePostMessage(context);
        if (!message) {
          return context.text('Transport not found', 400);
        }
        return message;
      } else {
        this.logger.debug('Unknown path:', { path: url.pathname });
        return context.text('Unknown path', 404);
      }
    } catch (e) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_HONO_SSE_START_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          details: {
            url: url.toString(),
            ssePath,
            messagePath,
          },
        },
        e,
      );
      this.logger.trackException(mastraError);
      this.logger.error('Failed to start MCP Server (Hono SSE):', { error: mastraError.toString() });
      throw mastraError;
    }
  }

  /**
   * Handles MCP-over-StreamableHTTP protocol for user-provided HTTP servers.
   * Call this from your HTTP server for the streamable HTTP endpoint.
   *
   * @param url Parsed URL of the incoming request
   * @param httpPath Path for establishing the streamable HTTP connection (e.g. '/mcp')
   * @param req Incoming HTTP request
   * @param res HTTP response (must support .write/.end)
   * @param options Optional options to pass to the transport (e.g. sessionIdGenerator)
   */
  public async startHTTP({
    url,
    httpPath,
    req,
    res,
    options = { sessionIdGenerator: () => randomUUID() },
  }: {
    url: URL;
    httpPath: string;
    req: http.IncomingMessage;
    res: http.ServerResponse<http.IncomingMessage>;
    options?: StreamableHTTPServerTransportOptions;
  }) {
    this.logger.debug(`startHTTP: Received ${req.method} request to ${url.pathname}`);

    if (url.pathname !== httpPath) {
      this.logger.debug(`startHTTP: Pathname ${url.pathname} does not match httpPath ${httpPath}. Returning 404.`);
      res.writeHead(404);
      res.end();
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport | undefined;

    this.logger.debug(
      `startHTTP: Session ID from headers: ${sessionId}. Active transports: ${Array.from(this.streamableHTTPTransports.keys()).join(', ')}`,
    );

    try {
      if (sessionId && this.streamableHTTPTransports.has(sessionId)) {
        // Found existing session
        transport = this.streamableHTTPTransports.get(sessionId)!;
        this.logger.debug(`startHTTP: Using existing Streamable HTTP transport for session ID: ${sessionId}`);

        if (req.method === 'GET') {
          this.logger.debug(
            `startHTTP: Handling GET request for existing session ${sessionId}. Calling transport.handleRequest.`,
          );
        }

        // Handle the request using the existing transport
        // Need to parse body for POST requests before passing to handleRequest
        const body =
          req.method === 'POST'
            ? await new Promise((resolve, reject) => {
                let data = '';
                req.on('data', chunk => (data += chunk));
                req.on('end', () => {
                  try {
                    resolve(JSON.parse(data));
                  } catch (e) {
                    reject(e);
                  }
                });
                req.on('error', reject);
              })
            : undefined;

        await transport.handleRequest(req, res, body);
      } else {
        // No session ID or session ID not found
        this.logger.debug(`startHTTP: No existing Streamable HTTP session ID found. ${req.method}`);

        // Only allow new sessions via POST initialize request
        if (req.method === 'POST') {
          const body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => (data += chunk));
            req.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(e);
              }
            });
            req.on('error', reject);
          });

          // Import isInitializeRequest from the correct path
          const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');

          if (isInitializeRequest(body)) {
            this.logger.debug('startHTTP: Received Streamable HTTP initialize request, creating new transport.');

            // Create a new transport for the new session
            transport = new StreamableHTTPServerTransport({
              ...options,
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: id => {
                this.streamableHTTPTransports.set(id, transport!);
              },
            });

            // Set up onclose handler to clean up transport when closed
            transport.onclose = () => {
              const closedSessionId = transport?.sessionId;
              if (closedSessionId && this.streamableHTTPTransports.has(closedSessionId)) {
                this.logger.debug(
                  `startHTTP: Streamable HTTP transport closed for session ${closedSessionId}, removing from map.`,
                );
                this.streamableHTTPTransports.delete(closedSessionId);
                // Also clean up the server instance for this session
                if (this.httpServerInstances.has(closedSessionId)) {
                  this.httpServerInstances.delete(closedSessionId);
                  this.logger.debug(`startHTTP: Cleaned up server instance for closed session ${closedSessionId}`);
                }
              }
            };

            // Create a new server instance for this HTTP session
            const sessionServerInstance = this.createServerInstance();

            // Connect the new server instance to the new transport
            await sessionServerInstance.connect(transport);

            // Store both the transport and server instance when the session is initialized
            if (transport.sessionId) {
              this.streamableHTTPTransports.set(transport.sessionId, transport);
              this.httpServerInstances.set(transport.sessionId, sessionServerInstance);
              this.logger.debug(
                `startHTTP: Streamable HTTP session initialized and stored with ID: ${transport.sessionId}`,
              );
            } else {
              this.logger.warn('startHTTP: Streamable HTTP transport initialized without a session ID.');
            }

            // Handle the initialize request
            return await transport.handleRequest(req, res, body);
          } else {
            // POST request but not initialize, and no session ID
            this.logger.warn('startHTTP: Received non-initialize POST request without a session ID.');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: -32000,
                  message: 'Bad Request: No valid session ID provided for non-initialize request',
                },
                id: (body as any)?.id ?? null, // Include original request ID if available
              }),
            );
          }
        } else {
          // Non-POST request (GET/DELETE) without a session ID
          this.logger.warn(`startHTTP: Received ${req.method} request without a session ID.`);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: `Bad Request: ${req.method} request requires a valid session ID`,
              },
              id: null,
            }),
          );
        }
      }
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_HTTP_CONNECTION_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          text: 'Failed to connect MCP server using HTTP transport',
        },
        error,
      );
      this.logger.trackException(mastraError);
      this.logger.error('startHTTP: Error handling Streamable HTTP request:', { error: mastraError });
      // If headers haven't been sent, send an error response
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null, // Cannot determine original request ID in catch
          }),
        );
      }
    }
  }

  public async connectSSE({
    messagePath,
    res,
  }: {
    messagePath: string;
    res: http.ServerResponse<http.IncomingMessage>;
  }) {
    try {
      this.logger.debug('Received SSE connection');
      this.sseTransport = new SSEServerTransport(messagePath, res);
      await this.server.connect(this.sseTransport);

      this.server.onclose = async () => {
        this.sseTransport = undefined;
        await this.server.close();
      };

      res.on('close', () => {
        this.sseTransport = undefined;
      });
    } catch (e) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_SSE_CONNECT_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          details: {
            messagePath,
          },
        },
        e,
      );
      this.logger.trackException(mastraError);
      this.logger.error('Failed to connect to MCP Server (SSE):', { error: mastraError });
      throw mastraError;
    }
  }

  public async connectHonoSSE({ messagePath, stream }: { messagePath: string; stream: SSEStreamingApi }) {
    this.logger.debug('Received SSE connection');
    const sseTransport = new SSETransport(messagePath, stream);
    const sessionId = sseTransport.sessionId;
    this.logger.debug('SSE Transport created with sessionId:', { sessionId });
    this.sseHonoTransports.set(sessionId, sseTransport);

    stream.onAbort(() => {
      this.logger.debug('SSE Transport aborted with sessionId:', { sessionId });
      this.sseHonoTransports.delete(sessionId);
    });
    try {
      await this.server.connect(sseTransport);
      this.server.onclose = async () => {
        this.logger.debug('SSE Transport closed with sessionId:', { sessionId });
        this.sseHonoTransports.delete(sessionId);
        await this.server.close();
      };

      while (true) {
        // This will keep the connection alive
        // You can also await for a promise that never resolves
        const sessionIds = Array.from(this.sseHonoTransports.keys() || []);
        this.logger.debug('Active Hono SSE sessions:', { sessionIds });
        await stream.write(':keep-alive\n\n');
        await stream.sleep(60_000);
      }
    } catch (e) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_HONO_SSE_CONNECT_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          details: {
            messagePath,
          },
        },
        e,
      );
      this.logger.trackException(mastraError);
      this.logger.error('Failed to connect to MCP Server (Hono SSE):', { error: mastraError });
      throw mastraError;
    }
  }

  /**
   * Close the MCP server and all its connections
   */
  async close() {
    try {
      if (this.stdioTransport) {
        await this.stdioTransport.close?.();
        this.stdioTransport = undefined;
      }
      if (this.sseTransport) {
        await this.sseTransport.close?.();
        this.sseTransport = undefined;
      }
      if (this.sseHonoTransports) {
        for (const transport of this.sseHonoTransports.values()) {
          await transport.close?.();
        }
        this.sseHonoTransports.clear();
      }
      // Close all active Streamable HTTP transports and their server instances
      if (this.streamableHTTPTransports) {
        for (const transport of this.streamableHTTPTransports.values()) {
          await transport.close?.();
        }
        this.streamableHTTPTransports.clear();
      }
      // Close all HTTP server instances
      if (this.httpServerInstances) {
        for (const serverInstance of this.httpServerInstances.values()) {
          await serverInstance.close?.();
        }
        this.httpServerInstances.clear();
      }
      await this.server.close();
      this.logger.info('MCP server closed.');
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_CLOSE_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
      this.logger.trackException(mastraError);
      this.logger.error('Error closing MCP server:', { error: mastraError });
      throw mastraError;
    }
  }

  /**
   * Gets the basic information about the server, conforming to the Server schema.
   * @returns ServerInfo object.
   */
  public getServerInfo(): ServerInfo {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      repository: this.repository,
      version_detail: {
        version: this.version,
        release_date: this.releaseDate,
        is_latest: this.isLatest,
      },
    };
  }

  /**
   * Gets detailed information about the server, conforming to the ServerDetail schema.
   * @returns ServerDetailInfo object.
   */
  public getServerDetail(): ServerDetailInfo {
    return {
      ...this.getServerInfo(),
      package_canonical: this.packageCanonical,
      packages: this.packages,
      remotes: this.remotes,
    };
  }

  /**
   * Gets a list of tools provided by this MCP server, including their schemas.
   * This leverages the same tool information used by the internal ListTools MCP request.
   * @returns An object containing an array of tool information.
   */
  public getToolListInfo(): {
    tools: Array<{ name: string; description?: string; inputSchema: any; outputSchema?: any; toolType?: MCPToolType }>;
  } {
    this.logger.debug(`Getting tool list information for MCPServer '${this.name}'`);
    return {
      tools: Object.entries(this.convertedTools).map(([toolId, tool]) => ({
        id: toolId,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters?.jsonSchema || tool.parameters,
        outputSchema: tool.outputSchema?.jsonSchema || tool.outputSchema,
        toolType: tool.toolType,
      })),
    };
  }

  /**
   * Gets information for a specific tool provided by this MCP server.
   * @param toolId The ID/name of the tool to retrieve.
   * @returns Tool information (name, description, inputSchema) or undefined if not found.
   */
  public getToolInfo(
    toolId: string,
  ): { name: string; description?: string; inputSchema: any; outputSchema?: any; toolType?: MCPToolType } | undefined {
    const tool = this.convertedTools[toolId];
    if (!tool) {
      this.logger.debug(`Tool '${toolId}' not found on MCPServer '${this.name}'`);
      return undefined;
    }
    this.logger.debug(`Getting info for tool '${toolId}' on MCPServer '${this.name}'`);
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters?.jsonSchema || tool.parameters,
      outputSchema: tool.outputSchema?.jsonSchema || tool.outputSchema,
      toolType: tool.toolType,
    };
  }

  /**
   * Executes a specific tool provided by this MCP server.
   * @param toolId The ID/name of the tool to execute.
   * @param args The arguments to pass to the tool's execute function.
   * @param executionContext Optional context for the tool execution.
   * @returns A promise that resolves to the result of the tool execution.
   * @throws Error if the tool is not found, validation fails, or execution fails.
   */
  public async executeTool(
    toolId: string,
    args: any,
    executionContext?: { messages?: any[]; toolCallId?: string },
  ): Promise<any> {
    const tool = this.convertedTools[toolId];
    let validatedArgs = args;
    try {
      if (!tool) {
        this.logger.warn(`ExecuteTool: Unknown tool '${toolId}' requested on MCPServer '${this.name}'.`);
        throw new Error(`Unknown tool: ${toolId}`);
      }

      this.logger.debug(`ExecuteTool: Invoking '${toolId}' with arguments:`, args);

      if (tool.parameters instanceof z.ZodType && typeof tool.parameters.safeParse === 'function') {
        const validation = tool.parameters.safeParse(args ?? {});
        if (!validation.success) {
          const errorMessages = validation.error.errors
            .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
          this.logger.warn(`ExecuteTool: Invalid tool arguments for '${toolId}': ${errorMessages}`, {
            errors: validation.error.format(),
          });
          throw new z.ZodError(validation.error.issues);
        }
        validatedArgs = validation.data;
      } else {
        this.logger.debug(
          `ExecuteTool: Tool '${toolId}' parameters is not a Zod schema with safeParse or is undefined. Skipping validation.`,
        );
      }

      if (!tool.execute) {
        this.logger.error(`ExecuteTool: Tool '${toolId}' does not have an execute function.`);
        throw new Error(`Tool '${toolId}' cannot be executed.`);
      }
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_TOOL_EXECUTE_PREPARATION_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          details: {
            toolId,
            args,
          },
        },
        error,
      );
      this.logger.trackException(mastraError);
      throw mastraError;
    }

    try {
      const finalExecutionContext = {
        messages: executionContext?.messages || [],
        toolCallId: executionContext?.toolCallId || randomUUID(),
      };
      const result = await tool.execute(validatedArgs, finalExecutionContext);
      this.logger.info(`ExecuteTool: Tool '${toolId}' executed successfully.`);
      return result;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_TOOL_EXECUTE_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          details: {
            toolId,
            validatedArgs: validatedArgs,
          },
        },
        error,
      );
      this.logger.trackException(mastraError);
      this.logger.error(`ExecuteTool: Tool execution failed for '${toolId}':`, { error });
      throw mastraError;
    }
  }
}
