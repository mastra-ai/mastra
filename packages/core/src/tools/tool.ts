import type { Mastra } from '../mastra';
import type { ZodLikeSchema } from '../types/zod-compat';
import type { ToolAction, ToolExecutionContext, ToolInvocationOptions } from './types';
import { validateToolInput } from './validation';

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
 *   execute: async ({ context }) => {
 *     return await fetchWeather(context.location, context.units);
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
 *   execute: async ({ context }) => {
 *     await fs.unlink(context.filepath);
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
 *   execute: async ({ context, mastra }) => {
 *     const storage = mastra?.getStorage();
 *     await storage?.set(context.key, context.value);
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
  TContext extends ToolExecutionContext<TSchemaIn, TSuspendSchema, TResumeSchema> = ToolExecutionContext<
    TSchemaIn,
    TSuspendSchema,
    TResumeSchema
  >,
> implements ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext>
{
  /** Unique identifier for the tool */
  id: string;

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
   * Function that performs the tool's action
   * @param context - Execution context with validated input
   * @param options - Invocation options including suspend/resume data
   * @returns Promise resolving to tool output
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
   * Creates a new Tool instance with input validation wrapper.
   *
   * @param opts - Tool configuration and execute function
   * @example
   * ```typescript
   * const tool = new Tool({
   *   id: 'my-tool',
   *   description: 'Does something useful',
   *   inputSchema: z.object({ name: z.string() }),
   *   execute: async ({ context }) => ({ greeting: `Hello ${context.name}` })
   * });
   * ```
   */
  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.suspendSchema = opts.suspendSchema;
    this.resumeSchema = opts.resumeSchema;
    this.mastra = opts.mastra;
    this.requireApproval = opts.requireApproval || false;

    // Wrap the execute function with validation if it exists
    if (opts.execute) {
      const originalExecute = opts.execute;
      this.execute = async (context: TContext, options?: ToolInvocationOptions) => {
        const { resumeData, suspend } = (options ?? {}) as {
          resumeData?: any;
          suspend?: (suspendPayload: any) => Promise<any>;
        };
        // Validate input if schema exists
        const { data, error } = validateToolInput(this.inputSchema, context, this.id);
        if (error) {
          return error as any;
        }

        return originalExecute({ ...(data as TContext), suspend, resumeData } as TContext, options);
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
 *   execute: async ({ context }) => {
 *     const result = context.operation === 'add'
 *       ? context.a + context.b
 *       : context.a - context.b;
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
 *   execute: async ({ context }) => {
 *     return await fetchUser(context.userId);
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
 *   execute: async ({ context }) => {
 *     const response = await fetch(
 *       `https://api.weather.com/v1/weather?q=${context.city}&units=${context.units}`
 *     );
 *     return response.json();
 *   }
 * });
 * ```
 */
export function createTool<
  TSchemaIn extends ZodLikeSchema | undefined = undefined,
  TSchemaOut extends ZodLikeSchema | undefined = undefined,
  TSuspendSchema extends ZodLikeSchema = any,
  TResumeSchema extends ZodLikeSchema = any,
  TContext extends ToolExecutionContext<TSchemaIn, TSuspendSchema, TResumeSchema> = ToolExecutionContext<
    TSchemaIn,
    TSuspendSchema,
    TResumeSchema
  >,
  TExecute extends ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext>['execute'] = ToolAction<
    TSchemaIn,
    TSchemaOut,
    TSuspendSchema,
    TResumeSchema,
    TContext
  >['execute'],
>(
  opts: ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> & {
    execute?: TExecute;
  },
): [TSchemaIn, TSchemaOut, TExecute] extends [ZodLikeSchema, ZodLikeSchema, Function]
  ? Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> & {
      inputSchema: TSchemaIn;
      outputSchema: TSchemaOut;
      execute: (context: TContext, options: ToolInvocationOptions) => Promise<any>;
    }
  : Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> {
  return new Tool(opts) as any;
}
