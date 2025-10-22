import type { InternalCoreTool } from '@mastra/core/tools';
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

/**
 * Callback function to retrieve content for a specific resource.
 *
 * @param params - Parameters for resource content retrieval
 * @param params.uri - URI of the resource to retrieve
 * @param params.extra - Additional request handler context
 * @returns Promise resolving to resource content (single or array)
 */
export type MCPServerResourceContentCallback = ({
  uri,
  extra,
}: {
  uri: string;
  extra: MCPRequestHandlerExtra;
}) => Promise<MCPServerResourceContent | MCPServerResourceContent[]>;

/**
 * Content for an MCP resource, either text or binary (base64-encoded).
 */
export type MCPServerResourceContent = { text?: string } | { blob?: string };

/**
 * Configuration for MCP server resource handling.
 *
 * Defines callbacks for listing resources, retrieving content, and optionally listing templates.
 */
export type MCPServerResources = {
  /** Function to list all available resources */
  listResources: ({ extra }: { extra: MCPRequestHandlerExtra }) => Promise<Resource[]>;
  /** Function to get content for a specific resource */
  getResourceContent: MCPServerResourceContentCallback;
  /** Optional function to list resource templates */
  resourceTemplates?: ({ extra }: { extra: MCPRequestHandlerExtra }) => Promise<ResourceTemplate[]>;
};

/**
 * Callback function to retrieve messages for a specific prompt.
 *
 * @param params - Parameters for prompt message retrieval
 * @param params.name - Name of the prompt
 * @param params.version - Optional version of the prompt
 * @param params.args - Optional arguments for the prompt
 * @param params.extra - Additional request handler context
 * @returns Promise resolving to array of prompt messages
 */
export type MCPServerPromptMessagesCallback = ({
  name,
  version,
  args,
  extra,
}: {
  name: string;
  version?: string;
  args?: any;
  extra: MCPRequestHandlerExtra;
}) => Promise<PromptMessage[]>;

/**
 * Configuration for MCP server prompt handling.
 *
 * Defines callbacks for listing prompts and retrieving prompt messages.
 */
export type MCPServerPrompts = {
  /** Function to list all available prompts */
  listPrompts: ({ extra }: { extra: MCPRequestHandlerExtra }) => Promise<Prompt[]>;
  /** Optional function to get messages for a specific prompt */
  getPromptMessages?: MCPServerPromptMessagesCallback;
};

/**
 * Actions for handling elicitation requests (interactive user input collection).
 */
export type ElicitationActions = {
  /** Function to send an elicitation request to the client */
  sendRequest: (request: ElicitRequest['params']) => Promise<ElicitResult>;
};

/**
 * Extra context passed to MCP request handlers.
 */
export type MCPRequestHandlerExtra = RequestHandlerExtra<any, any>;

/**
 * Tool definition for MCP servers with support for elicitation.
 *
 * Extends standard Mastra tools with MCP-specific capabilities including interactive
 * user input collection via elicitation and request context access.
 *
 * @template TSchemaIn - Input schema type (Zod schema or undefined)
 * @template TSchemaOut - Output schema type (Zod schema or undefined)
 *
 * @example
 * ```typescript
 * const myTool: MCPTool<z.ZodObject<{ name: z.ZodString }>> = {
 *   id: 'greet',
 *   description: 'Greets a person',
 *   parameters: z.object({ name: z.string() }),
 *   execute: async ({ context }, { elicitation, extra }) => {
 *     // Can request additional user input during execution
 *     const userInfo = await elicitation.sendRequest({
 *       message: 'Please provide your email',
 *       requestedSchema: { type: 'object', properties: { email: { type: 'string' } } }
 *     });
 *     return `Hello ${context.name}!`;
 *   }
 * };
 * ```
 */
export type MCPTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
> = {
  /** Optional unique identifier for the tool */
  id?: InternalCoreTool['id'];
  /** Optional description of what the tool does */
  description?: InternalCoreTool['description'];
  /** Input parameters schema (inferred from TSchemaIn if provided) */
  parameters: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any;
  /** Optional output schema for structured responses (inferred from TSchemaOut if provided) */
  outputSchema?: TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : any;
  /**
   * Function that executes the tool's logic.
   *
   * @param params - Tool input parameters
   * @param params.context - Validated input matching the parameters schema
   * @param options - Execution options
   * @param options.elicitation - Actions for requesting user input during execution
   * @param options.extra - MCP request handler context with session information
   * @returns Promise resolving to the tool's result
   */
  execute: (
    params: { context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any },
    options: Parameters<NonNullable<InternalCoreTool['execute']>>[1] & {
      elicitation: ElicitationActions;
      extra: MCPRequestHandlerExtra;
    },
  ) => Promise<any>;
};

/**
 * Re-exported MCP SDK types for resource handling.
 *
 * - `Resource`: Represents a data resource exposed by the server
 * - `ResourceTemplate`: URI template for dynamic resource generation
 */
export type { Resource, ResourceTemplate };
