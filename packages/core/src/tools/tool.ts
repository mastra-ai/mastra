import type { ToolBackgroundConfig } from '../background-tasks';
import type { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import { toStandardSchema } from '../schema';
import type { PublicSchema, StandardSchemaWithJSON, InferPublicSchema } from '../schema';
import type { SuspendOptions } from '../workflows';
import type {
  McpMetadata,
  MCPToolProperties,
  NeedsApprovalFn,
  ToolAction,
  ToolExecuteFunction,
  ToolExecutionContext,
  ToolPayloadTransform,
} from './types';
import { validateToolInput, validateToolOutput, validateToolSuspendData, validateRequestContext } from './validation';

/**
 * Marker to identify Mastra tools even when `instanceof` fails.
 * This can happen in environments like Vite SSR where the same module
 * may be loaded multiple times, creating different class instances.
 * Uses Symbol.for() so the same symbol is shared across module copies.
 * Follows the naming convention: <org>.<product>.<category>.<className>
 */
export const MASTRA_TOOL_MARKER = Symbol.for('mastra.core.tool.Tool');

/**
 * A per-tool view of the request context that serves values transformed by the
 * tool's `requestContextSchema` (codecs, coercions, defaults) while writing all
 * mutations through to the shared context. This keeps two behaviors intact:
 * - transformed values never leak into the shared context, so other tools
 *   re-validate against the original raw values
 * - mutations made inside `execute` stay visible to subsequent tool calls,
 *   which share the same underlying RequestContext reference
 */
class TransformedRequestContext extends RequestContext<Record<string, any>> {
  #source: RequestContext<any>;

  constructor(source: RequestContext<any>, transformedValues: Record<string, unknown>) {
    super(Object.entries({ ...source.all, ...transformedValues }));
    this.#source = source;
  }

  public override set(key: string, value: any): void {
    super.set(key, value);
    this.#source.set(key, value);
  }

  public override delete(key: string): boolean {
    this.#source.delete(key);
    return super.delete(key);
  }

  public override clear(): void {
    this.#source.clear();
    super.clear();
  }
}

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
  TSchemaIn = unknown,
  TSchemaOut = unknown,
  TSuspendSchema = unknown,
  TResumeSchema = unknown,
  TContext extends ToolExecutionContext<TSuspendSchema, TResumeSchema, any> = ToolExecutionContext<
    TSuspendSchema,
    TResumeSchema
  >,
  TId extends string = string,
  TRequestContext extends Record<string, any> | unknown = unknown,
> implements ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext, TId, TRequestContext> {
  /** Unique identifier for the tool */
  id: TId;

  /** Description of what the tool does */
  description: string;

  /** Schema for validating input parameters */
  inputSchema?: StandardSchemaWithJSON<TSchemaIn>;

  /** Schema for validating output structure */
  outputSchema?: StandardSchemaWithJSON<TSchemaOut>;

  /** Schema for suspend operation data */
  suspendSchema?: StandardSchemaWithJSON<TSuspendSchema>;

  /** Schema for resume operation data */
  resumeSchema?: StandardSchemaWithJSON<TResumeSchema>;

  /**
   * Schema for validating request context values.
   * When provided, the request context will be validated against this schema before tool execution.
   */
  requestContextSchema?: PublicSchema<TRequestContext>;

  /**
   * Tool execution function
   * @param inputData - The raw, validated input data
   * @param context - Optional execution context with metadata
   * @returns Promise resolving to tool output or a ValidationError if input validation fails
   */
  execute?: ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext, TId, TRequestContext>['execute'];

  /** Parent Mastra instance for accessing shared resources */
  mastra?: Mastra;

  /**
   * Whether the tool requires explicit user approval before execution.
   * Accepts a boolean for static behavior, or a function evaluated per-call
   * for conditional approval.
   * @example
   * ```typescript
   * // Static
   * requireApproval: true
   *
   * // Conditional — only require approval for non-dry-run calls
   * requireApproval: async ({ isDryRun }) => !isDryRun
   * ```
   */
  requireApproval?: ToolAction<
    TSchemaIn,
    TSchemaOut,
    TSuspendSchema,
    TResumeSchema,
    TContext,
    TId,
    TRequestContext
  >['requireApproval'];

  /**
   * Runtime-resolved per-tool approval predicate, evaluated per call.
   *
   * This is set automatically when a tool's `requireApproval` is a function, or by the
   * MCP client when wrapping a server-level `requireToolApproval` function — not something
   * you normally set yourself (prefer the `requireApproval` option). When present it is the
   * authoritative per-tool approval decision and is always evaluated by the agent runtime.
   */
  needsApprovalFn?: NeedsApprovalFn;

  /**
   * Enables strict tool input generation for providers that support it.
   */
  strict?: boolean;

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
   * Optional function to transform the tool's raw output before sending it to the model.
   * The raw result is still available for application logic; only the model sees the transformed version.
   */
  toModelOutput?: (output: TSchemaOut) => unknown;

  /**
   * Optional target-aware transform for display and transcript payloads.
   */
  transform?: ToolPayloadTransform<TSchemaIn, TSchemaOut>;

  /**
   * Optional MCP-specific properties including annotations and metadata.
   * Only relevant when the tool is being used in an MCP context.
   * @example
   * ```typescript
   * mcp: {
   *   annotations: {
   *     title: 'Weather Lookup',
   *     readOnlyHint: true,
   *     destructiveHint: false
   *   },
   *   _meta: {
   *     version: '1.0.0',
   *     author: 'team@example.com'
   *   }
   * }
   * ```
   */
  mcp?: MCPToolProperties;

  onInputStart?: ToolAction<
    TSchemaIn,
    TSchemaOut,
    TSuspendSchema,
    TResumeSchema,
    TContext,
    TId,
    TRequestContext
  >['onInputStart'];
  onInputDelta?: ToolAction<
    TSchemaIn,
    TSchemaOut,
    TSuspendSchema,
    TResumeSchema,
    TContext,
    TId,
    TRequestContext
  >['onInputDelta'];
  onInputAvailable?: ToolAction<
    TSchemaIn,
    TSchemaOut,
    TSuspendSchema,
    TResumeSchema,
    TContext,
    TId,
    TRequestContext
  >['onInputAvailable'];
  onOutput?: ToolAction<
    TSchemaIn,
    TSchemaOut,
    TSuspendSchema,
    TResumeSchema,
    TContext,
    TId,
    TRequestContext
  >['onOutput'];

  /**
   * Examples of valid tool inputs passed through to the AI SDK.
   */
  inputExamples?: Array<{ input: Record<string, unknown> }>;

  /**
   * Metadata identifying this tool as originating from an MCP server.
   * Set automatically by the MCP client when creating tools.
   */
  mcpMetadata?: McpMetadata;

  /**
   * Background task configuration for this tool.
   * When enabled, the tool can be executed in the background while the agent conversation continues.
   */
  background?: ToolBackgroundConfig;

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
  constructor(
    opts: Omit<
      ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext, TId, TRequestContext>,
      'execute'
    > & {
      execute?: ToolExecuteFunction<TSchemaIn, TSchemaOut, TContext, TRequestContext>;
    },
  ) {
    (this as any)[MASTRA_TOOL_MARKER] = true;
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema ? toStandardSchema(opts.inputSchema) : undefined;
    this.outputSchema = opts.outputSchema ? toStandardSchema(opts.outputSchema) : undefined;
    this.suspendSchema = opts.suspendSchema ? toStandardSchema(opts.suspendSchema) : undefined;
    this.resumeSchema = opts.resumeSchema ? toStandardSchema(opts.resumeSchema) : undefined;
    this.requestContextSchema = opts.requestContextSchema;
    this.mastra = opts.mastra;
    this.requireApproval = opts.requireApproval || false;
    this.strict = opts.strict;
    this.providerOptions = opts.providerOptions;
    this.toModelOutput = opts.toModelOutput;
    this.transform = opts.transform;
    this.inputExamples = opts.inputExamples;
    this.mcp = opts.mcp;
    this.mcpMetadata = opts.mcpMetadata;
    this.background = opts.background;
    this.onInputStart = opts.onInputStart;
    this.onInputDelta = opts.onInputDelta;
    this.onInputAvailable = opts.onInputAvailable;
    this.onOutput = opts.onOutput;

    // Tools receive two parameters:
    // 1. input - The raw, validated input data
    // 2. context - Execution metadata (mastra, suspend, etc.)
    if (opts.execute) {
      const originalExecute = opts.execute;
      this.execute = async (inputData: TSchemaIn, context?: any) => {
        // When a tool is being resumed (resumeData present in context), skip input
        // validation. The original args were already validated during the initial
        // execution, and during resume the tool's execute function checks resumeData
        // and returns early without using the input args.
        const isResuming = !!(context?.resumeData || context?.agent?.resumeData);

        let data: any = inputData;
        if (!isResuming) {
          // Validate input if schema exists
          const validationResult = validateToolInput(this.inputSchema, inputData, this.id);
          if (validationResult.error) {
            return validationResult.error;
          }
          data = validationResult.data;
        }

        // Validate request context if schema exists
        const { data: validatedRequestContext, error: requestContextError } = validateRequestContext(
          this.requestContextSchema,
          context?.requestContext,
          this.id,
        );
        if (requestContextError) {
          return requestContextError as any;
        }

        // Hand execute a view of the request context with schema transformations
        // (codecs, coercions, defaults) applied, writing mutations through to the
        // shared context so they remain visible to subsequent tool calls.
        if (this.requestContextSchema && context?.requestContext) {
          context = {
            ...context,
            requestContext: new TransformedRequestContext(
              context.requestContext,
              validatedRequestContext as Record<string, unknown>,
            ),
          };
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
            const {
              agentId,
              toolCallId,
              messages,
              suspend,
              resumeData,
              threadId,
              resourceId,
              writableStream,
              ...rest
            } = baseContext;
            organizedContext = {
              ...rest,
              agent: {
                agentId: agentId || '',
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
                    agentId: baseContext.agent.agentId ?? '',
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
type SchemaLike = PublicSchema<any> | undefined;
type InferSchema<T extends SchemaLike> = T extends PublicSchema<any> ? InferPublicSchema<T> : unknown;

type CreateToolOpts<
  TId extends string,
  TInputSchema extends SchemaLike,
  TOutputSchema extends SchemaLike,
  TSuspendSchema extends SchemaLike,
  TResumeSchema extends SchemaLike,
  TRequestContext,
  TContext extends ToolExecutionContext<InferSchema<TSuspendSchema>, InferSchema<TResumeSchema>, TRequestContext>,
> = Omit<
  ToolAction<
    InferSchema<TInputSchema>,
    InferSchema<TOutputSchema>,
    InferSchema<TSuspendSchema>,
    InferSchema<TResumeSchema>,
    TContext,
    TId,
    TRequestContext
  >,
  'inputSchema' | 'outputSchema' | 'suspendSchema' | 'resumeSchema' | 'execute'
> & {
  inputSchema?: TInputSchema;
  outputSchema?: TOutputSchema;
  suspendSchema?: TSuspendSchema;
  resumeSchema?: TResumeSchema;
  execute?: ToolExecuteFunction<InferSchema<TInputSchema>, InferSchema<TOutputSchema>, TContext, TRequestContext>;
};
export function createTool<
  TId extends string = string,
  TInputSchema extends SchemaLike = undefined,
  TOutputSchema extends SchemaLike = undefined,
  TSuspendSchema extends SchemaLike = undefined,
  TResumeSchema extends SchemaLike = undefined,
  TRequestContext extends Record<string, any> | unknown = unknown,
  TContext extends ToolExecutionContext<InferSchema<TSuspendSchema>, InferSchema<TResumeSchema>, TRequestContext> =
    ToolExecutionContext<InferSchema<TSuspendSchema>, InferSchema<TResumeSchema>, TRequestContext>,
>(
  opts: CreateToolOpts<TId, TInputSchema, TOutputSchema, TSuspendSchema, TResumeSchema, TRequestContext, TContext>,
): Tool<
  InferSchema<TInputSchema>,
  InferSchema<TOutputSchema>,
  InferSchema<TSuspendSchema>,
  InferSchema<TResumeSchema>,
  TContext,
  TId,
  TRequestContext
> {
  return new Tool(opts);
}
