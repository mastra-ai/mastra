import { specTypeSchemas } from '@modelcontextprotocol/server';
import type {
  ElicitRequestFormParams,
  ElicitResult,
  InputRequiredResult,
  LoggingLevel,
} from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import type { Mastra } from '../mastra';
import type { ObservabilityContext } from '../observability';
import { RequestContext } from '../request-context';
import { toStandardSchema } from '../schema';
import type { PublicSchema, StandardSchemaWithJSON } from '../schema';
import type { ToolAnnotations } from '../tools/types';
import { validateRequestContext, validateToolInput, validateToolOutput } from '../tools/validation';

const MCP_NATIVE_TOOL = Symbol.for('mastra.mcp.native-tool.v2');

/** Exclude native protocol tools at business-tool ingestion boundaries. */
export type NonNativeMCPTool = { readonly [MCP_NATIVE_TOOL]?: never };

export interface MCPRequestContextV2 {
  readonly protocolVersion: '2026-07-28';
  readonly requestId: string | number;
  readonly signal: AbortSignal;
  readonly metadata?: Record<string, unknown>;
  readonly inputResponses?: Record<string, ElicitResult>;
  /**
   * Client-echoed continuation state. The raw wire string when the server has no
   * verify hook, otherwise the payload that hook returned. Handlers must not
   * trust the raw form for authorization or business decisions.
   */
  readonly requestState?: unknown;
  log(level: LoggingLevel, data: unknown, logger?: string): Promise<void>;
  progress(progress: number, total?: number, message?: string): Promise<void>;
}

export interface MCPToolExecutionContextV2 extends Partial<ObservabilityContext> {
  readonly request: MCPRequestContextV2;
  readonly requestContext: RequestContext;
  readonly mastra?: Mastra;
}

export type MCPInputRequiredResultV2 = InputRequiredResult;

export type MCPToolOutcomeV2<T> =
  | { kind: 'completed'; value: T }
  | { kind: 'input_required'; result: MCPInputRequiredResultV2 };

export interface MCPToolV2<TInput = unknown, TOutput = unknown> {
  readonly [MCP_NATIVE_TOOL]: true;
  readonly id: string;
  readonly description: string;
  readonly inputSchema: StandardSchemaWithJSON<TInput>;
  readonly outputSchema: StandardSchemaWithJSON<TOutput>;
  readonly annotations?: ToolAnnotations;
  readonly _meta?: Record<string, unknown>;
  invoke(input: TInput, context: MCPToolExecutionContextV2): Promise<MCPToolOutcomeV2<TOutput>>;
}

export function isMCPToolV2(value: unknown): value is MCPToolV2<any, any> {
  return typeof value === 'object' && value !== null && MCP_NATIVE_TOOL in value && value[MCP_NATIVE_TOOL] === true;
}

const formSchema = z.custom<ElicitRequestFormParams['requestedSchema']>(
  value =>
    specTypeSchemas.ElicitRequestFormParams['~standard'].validate({ message: '', requestedSchema: value }).issues ===
    undefined,
  'Invalid embedded input request schema',
);
const inputRequestSchema = z.strictObject({
  method: z.literal('elicitation/create', { error: 'Unsupported embedded input request' }),
  params: z.union([
    z.strictObject({
      mode: z.literal('form').optional(),
      message: z.string(),
      requestedSchema: formSchema,
      _meta: z.record(z.string(), z.unknown()).optional(),
    }),
    z.strictObject({
      mode: z.literal('url'),
      message: z.string(),
      url: z.url(),
      _meta: z.record(z.string(), z.unknown()).optional(),
    }),
  ]),
});
const inputResponseSchema = z.custom<ElicitResult>(
  value => specTypeSchemas.ElicitResult['~standard'].validate(value).issues === undefined,
  'Invalid embedded input response',
);
const inputRequiredSchema = z
  .strictObject({
    resultType: z.literal('input_required'),
    inputRequests: z.record(z.string(), inputRequestSchema).optional(),
    requestState: z.string().optional(),
    _meta: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    result => result.requestState !== undefined || Object.keys(result.inputRequests ?? {}).length > 0,
    'Input-required control must contain input requests or request state',
  );
/**
 * Validates an `input_required` control result before it is serialized. Only
 * elicitation requests (form or URL mode) are accepted as embedded requests.
 */
export function parseMCPInputRequiredV2(value: MCPInputRequiredResultV2): MCPInputRequiredResultV2 {
  inputRequiredSchema.parse(value);
  return value;
}

const outcomeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('completed'), value: z.unknown() }),
  z.strictObject({ kind: z.literal('input_required'), result: inputRequiredSchema }),
]);
const callableSchema = z.custom(value => typeof value === 'function');
const contextSchema = z
  .looseObject({
    request: z.strictObject({
      protocolVersion: z.literal('2026-07-28'),
      requestId: z.union([z.string(), z.number().int()]),
      signal: z.instanceof(AbortSignal),
      metadata: z.record(z.string(), z.unknown()).optional(),
      inputResponses: z.record(z.string(), inputResponseSchema).optional(),
      requestState: z.unknown().optional(),
      log: callableSchema,
      progress: callableSchema,
    }),
    requestContext: z.instanceof(RequestContext),
  })
  .refine(value => !('mcp' in value), 'Legacy MCP context is not supported by native tools');

export interface MCPToolActionV2<TInput, TOutput> {
  id: string;
  description: string;
  inputSchema: PublicSchema<TInput>;
  outputSchema: PublicSchema<TOutput>;
  requestContextSchema?: PublicSchema;
  /** MCP tool annotations advertised on `tools/list`. */
  annotations?: ToolAnnotations;
  /** Arbitrary `_meta` advertised on `tools/list` (for example MCP Apps UI metadata). */
  _meta?: Record<string, unknown>;
  execute(
    input: NoInfer<TInput>,
    context: MCPToolExecutionContextV2,
  ): MCPToolOutcomeV2<NoInfer<TOutput>> | Promise<MCPToolOutcomeV2<NoInfer<TOutput>>>;
}

/** Define a protocol-aware tool that cannot be executed as a business tool. */
export function createMCPTool<TInput, TOutput>(options: MCPToolActionV2<TInput, TOutput>): MCPToolV2<TInput, TOutput> {
  const inputSchema = toStandardSchema(options.inputSchema);
  const outputSchema = toStandardSchema(options.outputSchema);
  return {
    [MCP_NATIVE_TOOL]: true,
    id: options.id,
    description: options.description,
    inputSchema,
    outputSchema,
    annotations: options.annotations,
    _meta: options._meta,
    async invoke(input, context) {
      contextSchema.parse(context);
      context.request.signal.throwIfAborted();
      const validatedInput = validateToolInput(inputSchema, input, options.id);
      if (validatedInput.error) throw new Error(validatedInput.error.message);
      const validatedContext = validateRequestContext(options.requestContextSchema, context.requestContext, options.id);
      if (validatedContext.error) throw new Error(validatedContext.error.message);
      const outcome = await options.execute(validatedInput.data, context);
      outcomeSchema.parse(outcome);
      context.request.signal.throwIfAborted();
      if (outcome.kind === 'input_required') return outcome;
      const validatedOutput = validateToolOutput(outputSchema, outcome.value, options.id);
      if (validatedOutput.error) throw new Error(validatedOutput.error.message);
      return { kind: 'completed', value: validatedOutput.data };
    },
  };
}
