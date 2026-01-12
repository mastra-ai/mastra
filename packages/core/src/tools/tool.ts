import type { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import type { ZodLikeSchema, InferZodLikeSchema, InferZodLikeSchemaInput } from '../types/zod-compat';
import type { SuspendOptions } from '../workflows';
import type { ToolAction, ToolAnnotations, ToolExecutionContext } from './types';
import { validateToolInput, validateToolOutput, validateToolSuspendData } from './validation';

/**
 * A type-safe tool that agents and workflows can call to perform specific actions.
 *
 * @template TSchemaIn - Input schema type
 * @template TSchemaOut - Output schema type
 * @template TSuspendSchema - Suspend operation schema type
 * @template TResumeSchema - Resume operation schema type
 * @template TContext - Execution context type
 *
 * @example Basic tool with validation
 * ```typescript
 * const weatherTool = createTool({
 *   id: 'get-weather',
 *   description: 'Get weather for a location',
 *   inputSchema: z.object({
 *     location: z.string(),
 *     units: z.enum(['celsius', 'fahrenheit']).optional()
 *   }),
 *   execute: async (inputData) => {
 *     return await fetchWeather(inputData.location, inputData.units);
 *   }
 * });
 * ```
 *
 * @example Tool requiring approval
 * ```typescript
 * const deleteFileTool = createTool({
 *   id: 'delete-file',
 *   description: 'Delete a file',
 *   requireApproval: true,
 *   inputSchema: z.object({ filepath: z.string() }),
 *   execute: async (inputData) => {
 *     await fs.unlink(inputData.filepath);
 *     return { deleted: true };
 *   }
 * });
 * ```
 *
 * @example Tool with Mastra integration
 * ```typescript
 * const saveTool = createTool({
 *   id: 'save-data',
 *   description: 'Save data to storage',
 *   inputSchema: z.object({ key: z.string(), value: z.any() }),
 *   execute: async (inputData, context) => {
 *     const storage = context?.mastra?.getStorage();
 *     await storage?.set(inputData.key, inputData.value);
 *     return { saved: true };
 *   }
 * });
 * ```
 */
export class Tool<
  TSchemaIn extends ZodLikeSchema | undefined = undefined,
  TSchemaOut extends ZodLikeSchema | undefined = undefined,
  TSuspendSchema extends ZodLikeSchema = any,
  TResumeSchema extends ZodLikeSchema = any,
  TContext extends ToolExecutionContext<TSuspendSchema, TResumeSchema> = ToolExecutionContext<
    TSuspendSchema,
    TResumeSchema
  >,
  TId extends string = string,
> implements ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext, TId> {
  /** Unique identifier for the tool */
  id: TId;

  /** Description of what the tool does */
  description: string;

  /** Schema for validating input parameters */
  inputSchema?: TSchemaIn;

  /** Schema for validating output structure */
  outputSchema?: TSchemaOut;

  /** Schema for suspend operation data */
  suspendSchema?: TSuspendSchema;

  /** Schema for resume operation data */
  resumeSchema?: TResumeSchema;

  /**
   * Tool execution function
   * @param inputData - The raw, validated input data
   * @param context - Optional execution context with metadata
   * @returns Promise resolving to tool output or a ValidationError if input validation fails
   */
  execute?: ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext>['execute'];

  /** Parent Mastra instance for accessing shared resources */
  mastra?: Mastra;

  /**
   * Whether the tool requires explicit user approval before execution
   * @example
   * ```typescript
   * // For destructive operations
   * requireApproval: true
   * ```
   */
  requireApproval?: boolean;

  /**
   * Provider-specific options passed to the model when this tool is used.
   * Keys are provider names (e.g., 'anthropic', 'openai'), values are provider-specific configs.
   * @example
   * ```typescript
   * providerOptions: {
   *   anthropic: {
   *     cacheControl: { type: 'ephemeral' }
   *   }
   * }
   * ```
   */
  providerOptions?: Record<string, Record<string, unknown>>;

  /**
   * MCP tool annotations for describing tool behavior and UI presentation.
   * These are exposed via MCP protocol and used by clients like OpenAI Apps SDK.
   * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/server/tools/#tool-annotations
   * @example
   * ```typescript
   * annotations: {
   *   title: 'Weather Lookup',
   *   readOnlyHint: true,
   *   destructiveHint: false
   * }
   * ```
   */
  annotations?: ToolAnnotations;

  /**
   * Arbitrary metadata that will be passed through to MCP clients.
   * This field allows custom metadata to be attached to tools for
   * client-specific functionality.
   * @example
   * ```typescript
   * _meta: {
   *   version: '1.0.0',
   *   author: 'team@example.com'
   * }
   * ```
   */
  _meta?: Record<string, unknown>;

  /**
   * Creates a new Tool instance with input validation wrapper.
   *
   * @param opts - Tool configuration and execute function
   * @example
   * ```typescript
   * const tool = new Tool({
   *   id: 'my-tool',
   *   description: 'Does something useful',
   *   inputSchema: z.object({ name: z.string() }),
   *   execute: async (inputData) => ({ greeting: `Hello ${inputData.name}` })
   * });
   * ```
   */
  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext, TId>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.suspendSchema = opts.suspendSchema;
    this.resumeSchema = opts.resumeSchema;
    this.mastra = opts.mastra;
    this.requireApproval = opts.requireApproval || false;
    this.providerOptions = opts.providerOptions;
    this.annotations = opts.annotations;
    this._meta = opts._meta;

    // Tools receive two parameters:
    // 1. input - The raw, validated input data
    // 2. context - Execution metadata (mastra, suspend, etc.)
    if (opts.execute) {
      const originalExecute = opts.execute;
      this.execute = async (inputData: unknown, context?: any) => {
        // Validate input if schema exists
        const { data, error } = validateToolInput(this.inputSchema, inputData, this.id);
        if (error) {
          return error as any;
        }

        let suspendData = null;

        const baseContext = context
          ? {
              ...context,
              ...(context.suspend
                ? {
                    suspend: (args: any, suspendOptions?: SuspendOptions) => {
                      suspendData = args;
                      return context.suspend?.(args, suspendOptions);
                    },
                  }
                : {}),
            }
          : {};

        // Organize context based on execution source
        let organizedContext = baseContext;
        if (!context) {
          // No context provided - create a minimal context with requestContext
          organizedContext = {
            requestContext: new RequestContext(),
            mastra: undefined,
          };
        } else {
          // Check if this is agent execution (has toolCallId and messages)
          const isAgentExecution = baseContext.toolCallId && baseContext.messages;

          // Check if this is workflow execution (has workflow properties)
          // Agent execution takes precedence - don't treat as workflow if it's an agent call
          const isWorkflowExecution = !isAgentExecution && (baseContext.workflow || baseContext.workflowId);

          if (isAgentExecution && !baseContext.agent) {
            // Reorganize agent context - nest agent-specific properties under 'agent' key
            const { toolCallId, messages, suspend, resumeData, threadId, resourceId, writableStream, ...rest } =
              baseContext;
            organizedContext = {
              ...rest,
              agent: {
                toolCallId,
                messages,
                suspend,
                resumeData,
                threadId,
                resourceId,
                writableStream,
              },
              // Ensure requestContext is always present
              requestContext: rest.requestContext || new RequestContext(),
            };
          } else if (isWorkflowExecution && !baseContext.workflow) {
            // Reorganize workflow context - nest workflow-specific properties under 'workflow' key
            const { workflowId, runId, state, setState, suspend, resumeData, ...rest } = baseContext;
            organizedContext = {
              ...rest,
              workflow: {
                workflowId,
                runId,
                state,
                setState,
                suspend,
                resumeData,
              },
              // Ensure requestContext is always present
              requestContext: rest.requestContext || new RequestContext(),
            };
          } else {
            // Ensure requestContext is always present even for direct execution
            organizedContext = {
              ...baseContext,
              agent: baseContext.agent
                ? {
                    ...baseContext.agent,
                    suspend: (args: any, suspendOptions?: SuspendOptions) => {
                      suspendData = args;
                      return baseContext.agent?.suspend?.(args, suspendOptions);
                    },
                  }
                : baseContext.agent,
              workflow: baseContext.workflow
                ? {
                    ...baseContext.workflow,
                    suspend: (args: any, suspendOptions?: SuspendOptions) => {
                      suspendData = args;
                      return baseContext.workflow?.suspend?.(args, suspendOptions);
                    },
                  }
                : baseContext.workflow,
              requestContext: baseContext.requestContext || new RequestContext(),
            };
          }
        }

        const resumeData =
          organizedContext.agent?.resumeData ?? organizedContext.workflow?.resumeData ?? organizedContext?.resumeData;

        if (resumeData) {
          const resumeValidation = validateToolInput(this.resumeSchema, resumeData, this.id);
          if (resumeValidation.error) {
            return resumeValidation.error as any;
          }
        }

        // Call the original execute with validated input and organized context
        const output = await originalExecute(data as any, organizedContext);

        if (suspendData) {
          const suspendValidation = validateToolSuspendData(this.suspendSchema, suspendData, this.id);
          if (suspendValidation.error) {
            return suspendValidation.error as any;
          }
        }

        const skiptOutputValidation = !!(typeof output === 'undefined' && suspendData);

        // Validate output if schema exists
        const outputValidation = validateToolOutput(this.outputSchema, output, this.id, skiptOutputValidation);
        if (outputValidation.error) {
          return outputValidation.error as any;
        }

        return outputValidation.data;
      };
    }
  }
}

/**
 * Creates a type-safe tool with automatic input validation.
 *
 * @template TSchemaIn - Input schema type
 * @template TSchemaOut - Output schema type
 * @template TSuspendSchema - Suspend operation schema type
 * @template TResumeSchema - Resume operation schema type
 * @template TContext - Execution context type
 * @template TExecute - Execute function type
 *
 * @param opts - Tool configuration including schemas and execute function
 * @returns Type-safe Tool instance with conditional typing based on schemas
 *
 * @example Simple tool
 * ```typescript
 * const greetTool = createTool({
 *   id: 'greet',
 *   description: 'Say hello',
 *   execute: async () => ({ message: 'Hello!' })
 * });
 * ```
 *
 * @example Tool with input validation
 * ```typescript
 * const calculateTool = createTool({
 *   id: 'calculate',
 *   description: 'Perform calculations',
 *   inputSchema: z.object({
 *     operation: z.enum(['add', 'subtract']),
 *     a: z.number(),
 *     b: z.number()
 *   }),
 *   execute: async (inputData) => {
 *     const result = inputData.operation === 'add'
 *       ? inputData.a + inputData.b
 *       : inputData.a - inputData.b;
 *     return { result };
 *   }
 * });
 * ```
 *
 * @example Tool with output schema
 * ```typescript
 * const userTool = createTool({
 *   id: 'get-user',
 *   description: 'Get user data',
 *   inputSchema: z.object({ userId: z.string() }),
 *   outputSchema: z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     email: z.string()
 *   }),
 *   execute: async (inputData) => {
 *     return await fetchUser(inputData.userId);
 *   }
 * });
 * ```
 *
 * @example Tool with external API
 * ```typescript
 * const weatherTool = createTool({
 *   id: 'weather',
 *   description: 'Get weather data',
 *   inputSchema: z.object({
 *     city: z.string(),
 *     units: z.enum(['metric', 'imperial']).default('metric')
 *   }),
 *   execute: async (inputData) => {
 *     const response = await fetch(
 *       `https://api.weather.com/v1/weather?q=${inputData.city}&units=${inputData.units}`
 *     );
 *     return response.json();
 *   }
 * });
 * ```
 */
export function createTool<
  TId extends string = string,
  TSchemaIn extends ZodLikeSchema | undefined = undefined,
  TSchemaOut extends ZodLikeSchema | undefined = undefined,
  TSuspendSchema extends ZodLikeSchema = any,
  TResumeSchema extends ZodLikeSchema = any,
  TContext extends ToolExecutionContext<TSuspendSchema, TResumeSchema> = ToolExecutionContext<
    TSuspendSchema,
    TResumeSchema
  >,
>(
  opts: ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext, TId>,
): [TSchemaIn, TSchemaOut] extends [ZodLikeSchema, ZodLikeSchema]
  ? Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext, TId> & {
      inputSchema: TSchemaIn;
      outputSchema: TSchemaOut;
      execute: (
        inputData: InferZodLikeSchema<TSchemaIn>,
        context?: TContext,
      ) => Promise<InferZodLikeSchemaInput<TSchemaOut> & { error?: never }>;
    }
  : Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext, TId> {
  return new Tool(opts) as any;
}
