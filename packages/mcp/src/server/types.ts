import type { MCPServerConfig as BaseMCPServerConfig } from '@mastra/core/mcp';
import type { InternalCoreTool, ToolAction, VercelTool, VercelToolV5 } from '@mastra/core/tools';
import { validateToolInput } from '@mastra/core/tools';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  ElicitRequest,
  ElicitResult,
  Prompt,
  PromptMessage,
  Resource,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';

export type MCPServerResourceContentCallback = ({
  uri,
}: {
  uri: string;
}) => Promise<MCPServerResourceContent | MCPServerResourceContent[]>;
export type MCPServerResourceContent = { text?: string } | { blob?: string };
export type MCPServerResources = {
  listResources: () => Promise<Resource[]>;
  getResourceContent: MCPServerResourceContentCallback;
  resourceTemplates?: () => Promise<ResourceTemplate[]>;
};

export type MCPServerPromptMessagesCallback = ({
  name,
  version,
  args,
}: {
  name: string;
  version?: string;
  args?: any;
}) => Promise<PromptMessage[]>;

export type MCPServerPrompts = {
  listPrompts: () => Promise<Prompt[]>;
  getPromptMessages?: MCPServerPromptMessagesCallback;
};

export type ElicitationActions = {
  sendRequest: (request: ElicitRequest['params']) => Promise<ElicitResult>;
};

export type MCPRequestHandlerExtra = RequestHandlerExtra<any, any>;

export type MCPTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
> = {
  id?: InternalCoreTool['id'];
  description?: InternalCoreTool['description'];
  parameters: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any;
  outputSchema?: TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : any;
  execute: (
    params: { context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any },
    options: Parameters<NonNullable<InternalCoreTool['execute']>>[1] & {
      elicitation: ElicitationActions;
      extra: MCPRequestHandlerExtra;
    },
  ) => Promise<any>;
};

/**
 * Enhanced execute options for MCP tools that includes elicitation and extra context
 */
export interface MCPToolExecuteOptions<TSchemaIn extends z.ZodSchema | undefined = undefined> {
  context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any;
  elicitation: ElicitationActions;
  extra: MCPRequestHandlerExtra;
}

/**
 * Action interface for MCP tools
 */
export interface MCPToolAction<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
> {
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute: (
    params: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any,
    options: MCPToolExecuteOptions<TSchemaIn>,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : any>;
}

/**
 * Creates an MCP tool with proper typing for the MCP server environment.
 * Similar to createTool but specifically designed for MCP tools with elicitation support.
 *
 * @param opts Tool action configuration
 * @returns MCPTool instance
 *
 * @example
 * ```typescript
 * const mcpTool = createMCPTool({
 *   id: 'weather',
 *   description: 'Get weather information',
 *   inputSchema: z.object({
 *     city: z.string(),
 *   }),
 *   outputSchema: z.object({
 *     temperature: z.number(),
 *     condition: z.string(),
 *   }),
 *   execute: async (params, { context, elicitation, extra }) => {
 *     // params contains the validated input: { city: string }
 *     // context is the same as params for convenience
 *     // Can use elicitation.sendRequest() for interactive prompts
 *     // Access extra MCP context via extra parameter
 *     return { temperature: 72, condition: 'sunny' };
 *   },
 * });
 * ```
 */
export function createMCPTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
>(opts: MCPToolAction<TSchemaIn, TSchemaOut>): MCPTool {
  let parameters: InternalCoreTool['parameters'];
  let outputSchema: InternalCoreTool['outputSchema'];

  if (opts.inputSchema) {
    // Create a basic validator-like object for the parameters
    parameters = {
      jsonSchema: opts.inputSchema,
      validate: (value: any) => {
        try {
          const result = opts.inputSchema!.safeParse(value);
          return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
        } catch (e) {
          return { success: false, error: e };
        }
      },
    } as any;
  } else {
    parameters = undefined as any;
  }

  if (opts.outputSchema) {
    // Create a basic validator-like object for the output schema
    outputSchema = {
      jsonSchema: opts.outputSchema,
      validate: (value: any) => {
        try {
          const result = opts.outputSchema!.safeParse(value);
          return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
        } catch (e) {
          return { success: false, error: e };
        }
      },
    } as any;
  }

  return {
    id: opts.id,
    description: opts.description,
    parameters,
    outputSchema,
    execute: async (
      params: any,
      options: {
        messages: any[];
        toolCallId: string;
        elicitation: ElicitationActions;
        extra: MCPRequestHandlerExtra;
      },
    ) => {
      // Create enhanced options that include MCP-specific context
      const mcpOptions: MCPToolExecuteOptions<TSchemaIn> = {
        context: params,
        elicitation: options.elicitation,
        extra: options.extra,
      };

      const { data, error } = validateToolInput(opts.inputSchema, params, opts.id);
      if (error) {
        return error as any;
      }

      return opts.execute(data as TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any, mcpOptions);
    },
  };
}

/**
 * MCP-specific tools input that supports MCPToolAction and MCPTool types in addition to regular tools
 */
export type MCPToolsInput = Record<
  string,
  ToolAction<any, any, any> | VercelTool | VercelToolV5 | MCPToolAction<any, any> | MCPTool
>;

/**
 * Enhanced MCPServerConfig that supports MCP-specific tool types.
 * This overrides the base MCPServerConfig from @mastra/core/mcp to accept our enhanced tool types.
 */
export interface MCPServerConfig extends Omit<BaseMCPServerConfig, 'tools'> {
  /** The tools that this MCP server will expose. Supports regular tools, MCP tool actions, or MCP tools. */
  tools: MCPToolsInput;
}

export type { Resource, ResourceTemplate };
