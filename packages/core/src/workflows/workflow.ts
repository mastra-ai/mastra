import { randomUUID } from 'node:crypto';
import { ReadableStream, TransformStream } from 'node:stream/web';
import type { CoreMessage } from '@internal/ai-sdk-v4';
import { z } from 'zod/v4';
import type { MastraPrimitives } from '../action';
import type { Agent } from '../agent/agent';
import { MessageList, messagesAreEqual } from '../agent/message-list';
import type { MastraDBMessage, MessageInput } from '../agent/message-list';
import { isAgentCompatible } from '../agent/subagent';
import type { SubAgent } from '../agent/subagent';
import { TripWire } from '../agent/trip-wire';
import { MastraFGAPermissions, getWorkflowFGAResourceId, requireFGA } from '../auth/ee';
import type { ActorSignal } from '../auth/ee';
import { MastraBase } from '../base';
import { RequestContext } from '../di';
import { ErrorCategory, ErrorDomain, MastraError, MastraNonRetryableError, getErrorFromUnknown } from '../error';
import type { MastraScorers } from '../evals';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import type { Event } from '../events/types';
import type { IMastraLogger } from '../logger';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { ObservabilityContext, Span, TracingOptions, TracingPolicy } from '../observability';
import {
  EntityType,
  SpanType,
  createObservabilityContext,
  getOrCreateSpan,
  getRootExportSpan,
  resolveObservabilityContext,
} from '../observability';
import { executeWithContext } from '../observability/utils';
import type { OutputResult, Processor, ProcessorStreamWriter, ProcessorStreamWriterOptions } from '../processors';
import { ProcessorRunner, ProcessorState } from '../processors/runner';
import { createProcessorSendSignal } from '../processors/send-signal';
import {
  resolveProcessorSpanAttributes,
  resolveProcessorSpanName,
  toProcessorSpanPhase,
} from '../processors/span-declaration';
import {
  summarizeActiveToolsForSpan,
  summarizeProcessorModelForSpan,
  summarizeProcessorResultForSpan,
  summarizeProcessorToolsForSpan,
  summarizeToolChoiceForSpan,
} from '../processors/span-payload';
import { ProcessorStepOutputSchema, ProcessorStepInputSchema } from '../processors/step-schema';
import type { ProcessorStepInput, ProcessorStepOutput } from '../processors/step-schema';
import { getRequestContextInputValues } from '../request-context/input-source';
import { standardSchemaToJSONSchema, toStandardSchema } from '../schema';
import type { InferPublicSchema, InferStandardSchemaOutput, PublicSchema, StandardSchemaWithJSON } from '../schema';
import type { StorageListWorkflowRunsInput } from '../storage';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { WorkflowRunOutput } from '../stream/RunOutput';
import type { ChunkType, LanguageModelUsage, ProviderMetadata } from '../stream/types';
import { ChunkFrom } from '../stream/types';
import type { Tool } from '../tools/tool';
import { isMastraTool } from '../tools/toolchecks';
import type { ToolExecutionContext } from '../tools/types';
import type { DynamicArgument } from '../types';
import { PUBSUB_SYMBOL } from './constants';
import { DefaultExecutionEngine } from './default';
import type { ExecutionEngine, ExecutionGraph } from './execution-engine';
import { validateTemplate } from './mapping-template';
import { derivePredicateLabel, evaluatePredicate } from './predicate';
import type { Predicate } from './predicate';
import type {
  ConditionFunction,
  ExecuteFunction,
  InnerOutput,
  LoopConditionFunction,
  Step,
  SuspendOptions,
} from './step';
import { createMappingStep, createStepFromAgent, createStepFromTool } from './step-factories';
import type { AgentStepOptions } from './step-factories';
import type {
  DefaultEngineType,
  DynamicMapping,
  ExtractSchemaFromStep,
  ExtractSchemaType,
  MappingConfig,
  PathsToStringProps,
  SerializedSingleStepEntry,
  SerializedStep,
  SerializedStepFlowEntry,
  SingleStepEntry,
  StepFlowEntry,
  StepResult,
  StepsRecord,
  StepWithComponent,
  StreamEvent,
  SubsetOf,
  TimeTravelContext,
  WorkflowConfig,
  WorkflowEngineType,
  WorkflowOptions,
  WorkflowResult,
  WorkflowType,
  WorkflowRunState,
  WorkflowRunStatus,
  WorkflowState,
  WorkflowStateField,
  WorkflowStreamEvent,
  ToolStep,
  StepParams,
  OutputWriter,
  StepMetadata,
  WorkflowRunStartOptions,
  ForeachOptions,
  StepFlowEntryOptions,
} from './types';
import {
  cleanStepResult,
  createRestartExecutionParams,
  createTimeTravelExecutionParams,
  hydrateSerializedStepErrors,
  waitForSuspendedSnapshot,
} from './utils';

// Re-exported so the public `@mastra/core/workflows` surface (and existing
// `./workflow` imports) are unchanged; the factories live in `step-factories.ts`
// so the execution engines can use them without importing this module.
export { createMappingStep, createStepFromAgent, createStepFromTool } from './step-factories';
export type { AgentStepOptions } from './step-factories';

/**
 * Extract the JSON-safe subset of an agent-step options bag for the in-process
 * `serializedStepFlow` (which feeds `WorkflowInfo.stepGraph` for dashboards
 * and client-side rendering). Kept intentionally best-effort: this path is
 * write-only and can't throw — the strict throwing round-trip serialization
 * lives in `toStorableGraph` / `serializeSingleEntry`.
 */
function serializeAgentStepFields(options: any): {
  outputSchema?: Record<string, any>;
  options?: { retries?: number; metadata?: StepMetadata };
} {
  const out: { outputSchema?: Record<string, any>; options?: { retries?: number; metadata?: StepMetadata } } = {};
  const raw = options?.structuredOutput?.schema;
  if (raw !== undefined && raw !== null) {
    try {
      out.outputSchema = standardSchemaToJSONSchema(toStandardSchema(raw)) as Record<string, any>;
    } catch {
      // best-effort; toStorableGraph will surface the real error at persist time
    }
  }
  const opts: { retries?: number; metadata?: StepMetadata } = {};
  if (typeof options?.retries === 'number') opts.retries = options.retries;
  if (options?.metadata && typeof options.metadata === 'object') opts.metadata = options.metadata;
  if (Object.keys(opts).length > 0) out.options = opts;
  return out;
}

/**
 * Type guard for the opt-in declarative-predicate arg accepted by
 * `.branch()`, `.dowhile()`, and `.dountil()`.
 */
function isDeclarativePredicateArg(value: unknown): value is { predicate: Predicate } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { predicate?: unknown }).predicate === 'object' &&
    (value as { predicate?: unknown }).predicate !== null
  );
}

/**
 * Wrap a declarative `Predicate` as a runtime condition callback so the
 * existing execution engine (which only knows how to call `condition(params)`)
 * can execute stored / declarative predicates unchanged.
 *
 * Exported for the rehydration path (workflows/dynamic), which rebuilds
 * conditional/loop entries from stored predicates.
 */
export function predicateToCondition(predicate: Predicate): (params: any) => Promise<boolean> {
  return async (params: any) => {
    return evaluatePredicate(predicate, {
      initData: params?.getInitData ? params.getInitData() : undefined,
      inputData: params?.inputData,
      state: params?.state,
      getStepResult: typeof params?.getStepResult === 'function' ? (id: string) => params.getStepResult(id) : undefined,
    });
  };
}

function serializeToolStepFields(options: any): { options?: { retries?: number; metadata?: StepMetadata } } {
  const opts: { retries?: number; metadata?: StepMetadata } = {};
  if (typeof options?.retries === 'number') opts.retries = options.retries;
  if (options?.metadata && typeof options.metadata === 'object') opts.metadata = options.metadata;
  return Object.keys(opts).length > 0 ? { options: opts } : {};
}

export function mapVariable<TStep extends Step<string, any, any, any, any, any>>({
  step,
  path,
}: {
  step: TStep;
  path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '.';
}): {
  step: TStep;
  path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '.';
};
export function mapVariable<TWorkflow extends AnyWorkflow>({
  initData: TWorkflow,
  path,
}: {
  initData: TWorkflow;
  path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TWorkflow, 'inputSchema'>>> | '.';
}): {
  initData: TWorkflow;
  path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TWorkflow, 'inputSchema'>>> | '.';
};
export function mapVariable(config: any): any {
  return config;
}

// ============================================
// Type Guards
// ============================================

function isToolStep(input: unknown): input is ToolStep<any, any, any, any, any> {
  // `isMastraTool` also recognizes tools by their shared marker symbol, which
  // survives module duplication (Vite SSR) and spread copies — e.g. tools
  // renamed by `resolveStoredToolProviders` — where `instanceof` fails.
  return isMastraTool(input);
}

/**
 * Check if something is an Agent or Tool without importing the Agent class
 * (which would create an ESM init-time cycle with agent.ts).
 * Uses the `component` discriminator from MastraBase instead of instanceof.
 */
function isAgentOrTool(input: unknown): boolean {
  if (isMastraTool(input)) return true;
  const base = input as MastraBase;
  if (base && base.component === RegisteredLogger.AGENT) return true;
  return false;
}

function isStepParams(input: unknown): input is StepParams<any, any, any, any, any, any> {
  return input !== null && typeof input === 'object' && 'id' in input && 'execute' in input && !isAgentOrTool(input);
}

function areProcessorMessageArraysEqual(before: unknown[] | undefined, after: unknown[] | undefined): boolean {
  if (before === after) {
    return true;
  }

  if (!before || !after) {
    return before === after;
  }

  return (
    before.length === after.length &&
    before.every((message, index) => messagesAreEqual(message as MessageInput, after[index] as MessageInput))
  );
}

function findStepInGraph(graph: SerializedStepFlowEntry[], stepId: string): SerializedStepFlowEntry | undefined {
  for (const entry of graph) {
    if (entry.type === 'loop') {
      const inner = entry.step;
      const innerId = inner.type === 'step' ? inner.step.id : inner.id;
      if (innerId === stepId) return entry;
    }
    if (entry.type === 'foreach') {
      const inner = entry.step;
      const innerId = inner.type === 'step' ? inner.step.id : inner.id;
      if (innerId === stepId) return entry;
    }
    if (entry.type === 'step' && entry.step?.id === stepId) return entry;
    if (entry.type === 'workflow' && entry.id === stepId) return entry;
    if ('id' in entry && typeof entry.id === 'string' && entry.id === stepId) return entry;
    if ((entry.type === 'conditional' || entry.type === 'parallel') && 'steps' in entry) {
      const found = findStepInGraph(entry.steps as SerializedStepFlowEntry[], stepId);
      if (found) return found;
    }
  }
  return undefined;
}

// ============================================
// Overloads (Public API - clean types for consumers)
// ============================================

/**
 * Creates a step from explicit params (IMPORTANT: FIRST overload for best error messages when using .then in workflows)
 * @param params Configuration parameters for the step
 * @param params.id Unique identifier for the step
 * @param params.description Optional description of what the step does
 * @param params.inputSchema Zod schema defining the input structure
 * @param params.outputSchema Zod schema defining the output structure
 * @param params.execute Function that performs the step's operations
 * @returns A Step object that can be added to the workflow
 */
export function createStep<
  TStepId extends string,
  TStateSchema extends PublicSchema | undefined,
  TInputSchema extends PublicSchema,
  TOutputSchema extends PublicSchema,
  TResumeSchema extends PublicSchema | undefined = undefined,
  TSuspendSchema extends PublicSchema | undefined = undefined,
  TRequestContextSchema extends PublicSchema | undefined = undefined,
>(
  params: StepParams<
    TStepId,
    TStateSchema,
    TInputSchema,
    TOutputSchema,
    TResumeSchema,
    TSuspendSchema,
    TRequestContextSchema
  >,
): Step<
  TStepId,
  TStateSchema extends PublicSchema ? InferPublicSchema<TStateSchema> : unknown,
  InferPublicSchema<TInputSchema>,
  InferPublicSchema<TOutputSchema>,
  TResumeSchema extends PublicSchema ? InferPublicSchema<TResumeSchema> : unknown,
  TSuspendSchema extends PublicSchema ? InferPublicSchema<TSuspendSchema> : unknown,
  DefaultEngineType,
  TRequestContextSchema extends PublicSchema ? InferPublicSchema<TRequestContextSchema> : unknown
>;

/**
 * Creates a step from an agent (defaults to { text: string } output)
 */
export function createStep<TStepId extends string>(
  agent: SubAgent<TStepId, any> | Agent<TStepId, any>,
  agentOptions?: Omit<AgentStepOptions<{ text: string }>, 'structuredOutput'> & {
    structuredOutput?: never;
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
  },
): Step<TStepId, unknown, { prompt: string }, { text: string }, unknown, unknown, DefaultEngineType>;

/**
 * Creates a step from an agent with structured output
 */
export function createStep<TStepId extends string, TStepOutput>(
  agent: SubAgent<TStepId, any> | Agent<TStepId, any>,
  agentOptions: Omit<AgentStepOptions<TStepOutput>, 'structuredOutput'> & {
    structuredOutput: { schema: StandardSchemaWithJSON<TStepOutput> };
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
    metadata?: StepMetadata;
  },
): Step<TStepId, unknown, { prompt: string }, TStepOutput, unknown, unknown, DefaultEngineType>;

/**
 * Creates a step from a tool
 */
export function createStep<
  TSchemaIn,
  TSchemaOut,
  TSuspend,
  TResume,
  TContext extends ToolExecutionContext<TSuspend, TResume, any>,
  TId extends string,
  TRequestContext extends Record<string, any> | unknown = unknown,
>(
  tool: Tool<TSchemaIn, TSchemaOut, TSuspend, TResume, TContext, TId, TRequestContext>,
  toolOptions?: {
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
    metadata?: StepMetadata;
    actor?: ActorSignal;
  },
): Step<TId, unknown, TSchemaIn, TSchemaOut, TSuspend, TResume, DefaultEngineType, TRequestContext>;

/**
 * Creates a step from a Processor - wraps a Processor as a workflow step
 * Note: We require at least one processor method to distinguish from StepParams
 */
export function createStep<TProcessorId extends string>(
  processor:
    | (Processor<TProcessorId> & { processInput: Function })
    | (Processor<TProcessorId> & { processInputStream: Function })
    | (Processor<TProcessorId> & { processInputStep: Function })
    | (Processor<TProcessorId> & { processOutputStream: Function })
    | (Processor<TProcessorId> & { processOutputResult: Function })
    | (Processor<TProcessorId> & { processOutputStep: Function })
    | (Processor<TProcessorId> & { processToolResult: Function })
    | (Processor<TProcessorId> & { computeStateSignal: Function }),
): Step<
  `processor:${TProcessorId}`,
  unknown,
  InferPublicSchema<typeof ProcessorStepInputSchema>,
  InferPublicSchema<typeof ProcessorStepOutputSchema>,
  unknown,
  unknown,
  DefaultEngineType
>;

/**
 * IMPORTANT: Fallback overload - provides better error messages when StepParams doesn't match
 * This should be LAST and will show clearer errors about what's wrong
 * This is a copy of first one, KEEP THIS IN SYNC!
 */
export function createStep<
  TStepId extends string,
  TStateSchema extends PublicSchema | undefined,
  TInputSchema extends PublicSchema,
  TOutputSchema extends PublicSchema,
  TResumeSchema extends PublicSchema | undefined = undefined,
  TSuspendSchema extends PublicSchema | undefined = undefined,
  TRequestContextSchema extends PublicSchema | undefined = undefined,
>(
  params: StepParams<
    TStepId,
    TStateSchema,
    TInputSchema,
    TOutputSchema,
    TResumeSchema,
    TSuspendSchema,
    TRequestContextSchema
  >,
): Step<
  TStepId,
  TStateSchema extends PublicSchema ? InferPublicSchema<TStateSchema> : unknown,
  InferPublicSchema<TInputSchema>,
  InferPublicSchema<TOutputSchema>,
  TResumeSchema extends PublicSchema ? InferPublicSchema<TResumeSchema> : unknown,
  TSuspendSchema extends PublicSchema ? InferPublicSchema<TSuspendSchema> : unknown,
  DefaultEngineType,
  TRequestContextSchema extends PublicSchema ? InferPublicSchema<TRequestContextSchema> : unknown
>;

// ============================================
// Implementation (uses type guards for clean logic)
// ============================================

export function createStep(params: any, agentOrToolOptions?: any): Step<any, any, any, any, any, any, any> {
  // Type assertions are needed because each branch returns a different Step type,
  // but the overloads ensure type safety for consumers
  if (isAgentCompatible(params)) {
    return createStepFromAgent(params, agentOrToolOptions);
  }

  if (isToolStep(params)) {
    return createStepFromTool(params, agentOrToolOptions);
  }

  // StepParams check must come before isProcessor since both have 'id'
  // StepParams always has 'execute', while Processor has processor methods
  if (isStepParams(params)) {
    return createStepFromParams(params);
  }

  if (isProcessor(params)) {
    const step = createStepFromProcessor(params) as ReturnType<typeof createStepFromProcessor> & {
      providesSkillDiscovery?: Processor['providesSkillDiscovery'];
    };
    step.providesSkillDiscovery = params.providesSkillDiscovery;
    return step;
  }

  throw new Error('Invalid input: expected StepParams, Agent, ToolStep, or Processor');
}

// ============================================
// Internal Implementations
// ============================================

function createStepFromParams<
  TStepId extends string,
  TStateSchema extends PublicSchema<any> | undefined,
  TInputSchema extends PublicSchema<any>,
  TOutputSchema extends PublicSchema<any>,
  TResumeSchema extends PublicSchema<any> | undefined = undefined,
  TSuspendSchema extends PublicSchema<any> | undefined = undefined,
>(
  params: StepParams<TStepId, TStateSchema, TInputSchema, TOutputSchema, TResumeSchema, TSuspendSchema>,
): Step<
  TStepId,
  TStateSchema extends PublicSchema<any> ? InferPublicSchema<TStateSchema> : unknown,
  InferPublicSchema<TInputSchema>,
  InferPublicSchema<TOutputSchema>,
  TResumeSchema extends PublicSchema<any> ? InferPublicSchema<TResumeSchema> : unknown,
  TSuspendSchema extends PublicSchema<any> ? InferPublicSchema<TSuspendSchema> : unknown,
  DefaultEngineType
> {
  // Type assertion needed because toStandardSchema returns StandardSchemaWithJSON<unknown>
  // but we need it to match the inferred generic types. The public overloads ensure
  // type safety for consumers.
  const step = {
    id: params.id,
    description: params.description,
    inputSchema: params.inputSchema ? toStandardSchema(params.inputSchema) : params.inputSchema,
    stateSchema: params.stateSchema ? toStandardSchema(params.stateSchema) : undefined,
    outputSchema: params.outputSchema ? toStandardSchema(params.outputSchema) : params.outputSchema,
    resumeSchema: params.resumeSchema ? toStandardSchema(params.resumeSchema) : undefined,
    suspendSchema: params.suspendSchema ? toStandardSchema(params.suspendSchema) : undefined,
    requestContextSchema: params.requestContextSchema ? toStandardSchema(params.requestContextSchema) : undefined,
    scorers: params.scorers,
    retries: params.retries,
    metadata: params.metadata,
    execute: params.execute.bind(params) as Step<
      TStepId,
      TStateSchema extends PublicSchema<any> ? InferPublicSchema<TStateSchema> : unknown,
      InferPublicSchema<TInputSchema>,
      InferPublicSchema<TOutputSchema>,
      TResumeSchema extends PublicSchema<any> ? InferPublicSchema<TResumeSchema> : unknown,
      TSuspendSchema extends PublicSchema<any> ? InferPublicSchema<TSuspendSchema> : unknown,
      DefaultEngineType
    >['execute'],
  };

  const paramsWithChildren = params as StepParams<
    TStepId,
    TStateSchema,
    TInputSchema,
    TOutputSchema,
    TResumeSchema,
    TSuspendSchema
  > & {
    steps?: Record<string, unknown> | unknown[];
    children?: Record<string, unknown> | unknown[];
    stepGraph?: unknown[];
  };

  if (paramsWithChildren.steps || paramsWithChildren.children || paramsWithChildren.stepGraph) {
    Object.assign(step, {
      steps: paramsWithChildren.steps,
      children: paramsWithChildren.children,
      stepGraph: paramsWithChildren.stepGraph,
    });
  }

  return step;
}

/**
 * Steps produced by {@link createStepFromAgent} / {@link createStepFromTool}
 * smuggle the original agent/tool ref and options on non-public fields so we
 * can rebuild a declarative graph entry when they land in `.then()` etc.
 * The intersection with the widest `Step` generic keeps the return-side
 * assignment to {@link SingleStepEntry} typed while the optional metadata
 * fields carry the smuggled agent/tool refs.
 */
type StepWithRefMetadata = Step<string, any, any, any, any, any, any, any> & {
  __agentRef?: { id: string };
  __agentOptions?: unknown;
  __toolRef?: { id: string };
  __toolOptions?: unknown;
};

/**
 * Converts a step passed to `.then()` / `.parallel()` / `.branch()` into the
 * appropriate declarative live graph entry based on its `component` discriminator.
 * Agent/tool steps (built via `createStep`) carry their original ref + options on
 * `__agentRef`/`__toolRef`, allowing us to emit a declarative entry.
 */
function toSingleStepEntry(step: StepWithRefMetadata): SingleStepEntry {
  if (step?.component === 'AGENT' && step.__agentRef) {
    return {
      type: 'agent',
      id: step.id,
      agentId: step.__agentRef.id,
      agent: step.__agentRef,
      options: step.__agentOptions,
    };
  }
  if (step?.component === 'TOOL' && step.__toolRef) {
    return { type: 'tool', id: step.id, toolId: step.__toolRef.id, tool: step.__toolRef, options: step.__toolOptions };
  }
  return { type: 'step', step: step as unknown as Step };
}

/** JSON-safe mirror of {@link toSingleStepEntry}. */
function toSerializedSingleStepEntry(step: StepWithRefMetadata): SerializedSingleStepEntry {
  if (step?.component === 'AGENT' && step.__agentRef) {
    return {
      type: 'agent',
      id: step.id,
      agentId: step.__agentRef.id,
      description: step.description,
      ...serializeAgentStepFields(step.__agentOptions),
    };
  }
  if (step?.component === 'TOOL' && step.__toolRef) {
    return {
      type: 'tool',
      id: step.id,
      toolId: step.__toolRef.id,
      description: step.description,
      ...serializeToolStepFields(step.__toolOptions),
    };
  }
  if ((step as any)?.component === 'WORKFLOW') {
    // Prefer the public getter; fall back to the protected field / legacy
    // SerializedStep shape for any partial mock consumers.
    const nestedFlow =
      (step as { serializedStepGraph?: SerializedStepFlowEntry[] }).serializedStepGraph ??
      (step as SerializedStep).serializedStepFlow;
    return {
      type: 'workflow',
      id: step.id,
      workflowId: step.id,
      description: step.description,
      ...(nestedFlow ? { serializedStepFlow: nestedFlow } : {}),
    };
  }
  return {
    type: 'step',
    step: {
      id: step.id,
      description: step.description,
      metadata: step.metadata,
      component: (step as SerializedStep).component,
      serializedStepFlow: (step as SerializedStep).serializedStepFlow,
      canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
    },
  };
}

/**
 * The identity/display fields of a control-flow entry as a spreadable object,
 * omitting absent fields so live and serialized graphs stay free of
 * `undefined`-valued keys (serialized graphs are persisted as JSON).
 */
function toEntryOptionFields(options?: StepFlowEntryOptions): StepFlowEntryOptions {
  const out: StepFlowEntryOptions = {};
  if (options?.id !== undefined) out.id = options.id;
  if (options?.description !== undefined) out.description = options.description;
  if (options?.metadata !== undefined) out.metadata = options.metadata;
  return out;
}

function createStepFromProcessor<TProcessorId extends string>(
  processor: Processor<TProcessorId>,
): Step<
  `processor:${TProcessorId}`,
  unknown,
  z.infer<typeof ProcessorStepInputSchema>,
  z.infer<typeof ProcessorStepOutputSchema>,
  unknown,
  unknown,
  DefaultEngineType
> {
  type ProcessorLoadedToolsProvider = {
    getLoadedToolsForRequestContext?: (args: { requestContext: RequestContext }) => unknown | Promise<unknown>;
  };

  // Helper to map phase to entity type
  const getProcessorEntityType = (phase: string): EntityType => {
    switch (phase) {
      case 'input':
        return EntityType.INPUT_PROCESSOR;
      case 'inputStep':
        return EntityType.INPUT_STEP_PROCESSOR;
      case 'outputStream':
      case 'outputResult':
        return EntityType.OUTPUT_PROCESSOR;
      case 'outputStep':
        return EntityType.OUTPUT_STEP_PROCESSOR;
      case 'toolResult':
        return EntityType.TOOL_RESULT_PROCESSOR;
      default:
        return EntityType.OUTPUT_PROCESSOR;
    }
  };

  // Helper to get span name prefix
  const getSpanNamePrefix = (phase: string): string => {
    switch (phase) {
      case 'input':
        return 'input processor';
      case 'inputStep':
        return 'input step processor';
      case 'outputStream':
        return 'output stream processor';
      case 'outputResult':
        return 'output processor';
      case 'outputStep':
        return 'output step processor';
      case 'toolResult':
        return 'tool result processor';
      default:
        return 'processor';
    }
  };

  // Helper to check if processor implements a phase
  const hasPhaseMethod = (phase: string): boolean => {
    switch (phase) {
      case 'input':
        return !!processor.processInput;
      case 'inputStep':
        return !!processor.processInputStep;
      case 'outputStream':
        return !!processor.processOutputStream;
      case 'outputResult':
        return !!processor.processOutputResult;
      case 'outputStep':
        return !!processor.processOutputStep;
      case 'toolResult':
        return !!processor.processToolResult;
      default:
        return false;
    }
  };

  // Note: Zod v4 schemas natively implement StandardSchemaWithJSON at runtime,
  // but TypeScript type inference has issues with the complex discriminated union types.
  // We use type assertions here since toStandardSchema returns the schema directly
  // when it already implements StandardSchemaWithJSON.
  const step = {
    id: `processor:${processor.id}`,
    description: processor.name ?? `Processor ${processor.id}`,
    inputSchema: toStandardSchema(ProcessorStepInputSchema) as StandardSchemaWithJSON<ProcessorStepInput>,
    outputSchema: toStandardSchema(ProcessorStepOutputSchema) as StandardSchemaWithJSON<ProcessorStepOutput>,
    execute: async ({ inputData, requestContext, tracingContext, outputWriter }) => {
      // Cast to output type for easier property access - the discriminated union
      // ensures type safety at the schema level, but inside the execute function
      // we need access to all possible properties
      const input = inputData as ProcessorStepOutput & {
        processorStates?: Map<string, ProcessorState>;
        abortSignal?: AbortSignal;
        agent?: Agent;
      };
      const {
        phase,
        messages,
        messageList,
        stepNumber,
        systemMessages,
        part,
        streamParts,
        state,
        result: outputResult,
        finishReason,
        providerMetadata,
        toolCalls,
        text,
        retryCount,
        // inputStep phase fields for model/tools configuration
        model,
        tools,
        toolChoice,
        activeTools,
        providerOptions,
        modelSettings,
        structuredOutput,
        steps,
        usage,
        messageId,
        rotateResponseMessageId,
        // toolResult phase fields
        toolName,
        toolCallId,
        args: toolCallArgs,
        toolResultValue,
        providerExecuted,
        // Shared processor states map for accessing persisted state
        processorStates,
        // Abort signal for cancelling in-flight processor work (e.g. OM observations)
        abortSignal,
        // Agent reference so processors can access the running agent (e.g. on signal/schedule wake)
        agent,
      } = input;

      // Create a minimal abort function that throws TripWire
      const abort = (reason?: string, options?: { retry?: boolean; metadata?: unknown }): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.id}`, options, processor.id);
      };
      const initialMessageId = messageId;
      let currentMessageId = messageId;
      const rotateCurrentResponseMessageId = rotateResponseMessageId
        ? () => {
            currentMessageId = rotateResponseMessageId();
            return currentMessageId;
          }
        : undefined;
      const defaultOutputResult: OutputResult = {
        text: '',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        finishReason: 'unknown',
        steps: [],
      };

      const buildProcessorSpanInput = () => {
        switch (phase) {
          case 'input':
            return {
              messages: (messages as MastraDBMessage[]) ?? [],
              ...(systemMessages ? { systemMessages } : {}),
              ...(retryCount !== undefined ? { retryCount } : {}),
            };
          case 'inputStep': {
            const summarizedModel = summarizeProcessorModelForSpan(model);
            const summarizedTools = summarizeProcessorToolsForSpan(tools);
            const summarizedToolChoice = summarizeToolChoiceForSpan(toolChoice, tools);
            const summarizedActiveTools = summarizeActiveToolsForSpan(activeTools, tools);

            return {
              messages: (messages as MastraDBMessage[]) ?? [],
              ...(systemMessages ? { systemMessages } : {}),
              ...(stepNumber !== undefined ? { stepNumber } : {}),
              ...(currentMessageId ? { messageId: currentMessageId } : {}),
              ...(retryCount !== undefined ? { retryCount } : {}),
              ...(summarizedModel ? { model: summarizedModel } : {}),
              ...(summarizedTools ? { tools: summarizedTools } : {}),
              ...(summarizedToolChoice ? { toolChoice: summarizedToolChoice } : {}),
              ...(summarizedActiveTools ? { activeTools: summarizedActiveTools } : {}),
            };
          }
          case 'outputResult': {
            const summarizedResult = summarizeProcessorResultForSpan(outputResult ?? defaultOutputResult);

            return {
              messages: (messages as MastraDBMessage[]) ?? [],
              ...(summarizedResult ? { result: summarizedResult } : {}),
              ...(retryCount !== undefined ? { retryCount } : {}),
            };
          }
          case 'outputStep':
            return {
              messages: (messages as MastraDBMessage[]) ?? [],
              ...(systemMessages ? { systemMessages } : {}),
              ...(stepNumber !== undefined ? { stepNumber } : {}),
              ...(finishReason !== undefined ? { finishReason } : {}),
              ...(text !== undefined ? { text } : {}),
              ...(toolCalls !== undefined ? { toolCalls } : {}),
              ...(retryCount !== undefined ? { retryCount } : {}),
            };
          case 'toolResult':
            return {
              ...(stepNumber !== undefined ? { stepNumber } : {}),
              ...(toolName !== undefined ? { toolName } : {}),
              ...(toolCallId !== undefined ? { toolCallId } : {}),
              ...(providerExecuted !== undefined ? { providerExecuted } : {}),
              ...(retryCount !== undefined ? { retryCount } : {}),
            };
          default:
            return undefined;
        }
      };

      const buildProcessorSpanOutput = (result: unknown) => {
        if (result === null || typeof result !== 'object' || Array.isArray(result)) {
          return result;
        }

        const payload = result as Record<string, unknown>;
        switch (phase) {
          case 'input':
            return {
              ...(Array.isArray(payload.messages) &&
              !areProcessorMessageArraysEqual(messages as unknown[] | undefined, payload.messages)
                ? { messages: payload.messages }
                : {}),
              ...(Array.isArray(payload.systemMessages) &&
              !areProcessorMessageArraysEqual(systemMessages as unknown[] | undefined, payload.systemMessages)
                ? { systemMessages: payload.systemMessages }
                : {}),
            };
          case 'inputStep': {
            const output: Record<string, unknown> = {};

            if (
              Array.isArray(payload.messages) &&
              !areProcessorMessageArraysEqual(messages as unknown[] | undefined, payload.messages)
            ) {
              output.messages = payload.messages;
            }

            if (
              Array.isArray(payload.systemMessages) &&
              !areProcessorMessageArraysEqual(systemMessages as unknown[] | undefined, payload.systemMessages)
            ) {
              output.systemMessages = payload.systemMessages;
            }

            if (payload.messageId !== undefined && payload.messageId !== initialMessageId) {
              output.messageId = payload.messageId;
            }

            if (payload.model !== undefined && payload.model !== model) {
              const summarizedModel = summarizeProcessorModelForSpan(payload.model);
              if (summarizedModel) {
                output.model = summarizedModel;
              }
            }

            if (payload.tools !== undefined && payload.tools !== tools) {
              const summarizedTools = summarizeProcessorToolsForSpan(payload.tools);
              if (summarizedTools) {
                output.tools = summarizedTools;
              }
            }

            if (payload.toolChoice !== undefined && payload.toolChoice !== toolChoice) {
              const summarizedToolChoice = summarizeToolChoiceForSpan(payload.toolChoice, payload.tools ?? tools);
              if (summarizedToolChoice) {
                output.toolChoice = summarizedToolChoice;
              }
            }

            if (payload.activeTools !== undefined && payload.activeTools !== activeTools) {
              const summarizedActiveTools = summarizeActiveToolsForSpan(payload.activeTools, payload.tools ?? tools);
              if (summarizedActiveTools) {
                output.activeTools = summarizedActiveTools;
              }
            }

            if (payload.retryCount !== undefined && payload.retryCount !== retryCount) {
              output.retryCount = payload.retryCount;
            }

            return output;
          }
          case 'outputResult':
          case 'outputStep':
          case 'toolResult':
            return {
              ...(Array.isArray(payload.messages) &&
              !areProcessorMessageArraysEqual(messages as unknown[] | undefined, payload.messages)
                ? { messages: payload.messages }
                : {}),
              ...(Array.isArray(payload.systemMessages) &&
              !areProcessorMessageArraysEqual(systemMessages as unknown[] | undefined, payload.systemMessages)
                ? { systemMessages: payload.systemMessages }
                : {}),
            };
          default:
            return undefined;
        }
      };

      // Early return if processor doesn't implement this phase - no span created
      // This prevents empty spans for phases the processor doesn't handle
      if (!hasPhaseMethod(phase)) {
        return input;
      }

      // Create processor span for non-stream phases
      // outputStream phase doesn't need its own span (stream chunks are already tracked)
      const currentSpan = tracingContext?.currentSpan;

      // Find appropriate parent span:
      // - For input/outputResult: find AGENT_RUN (processor runs once at start/end)
      // - For inputStep/outputStep/toolResult: find MODEL_STEP (processor runs per LLM call / tool round-trip)
      // When workflow is executed, currentSpan is WORKFLOW_STEP, so we walk up the parent chain
      // Fall back to currentSpan only when its tree can reach exporters — otherwise
      // the public processor span would export as an orphan trace root.
      const fallbackSpan = currentSpan && getRootExportSpan(currentSpan) ? currentSpan : undefined;
      const parentSpan =
        phase === 'inputStep' || phase === 'outputStep' || phase === 'toolResult'
          ? currentSpan?.findParent(SpanType.MODEL_STEP) || fallbackSpan
          : currentSpan?.findParent(SpanType.AGENT_RUN) || fallbackSpan;

      const processorSpan =
        phase !== 'outputStream'
          ? parentSpan?.createChildSpan({
              type: processor.spanType ?? SpanType.PROCESSOR_RUN,
              name: resolveProcessorSpanName(
                processor,
                toProcessorSpanPhase(phase),
                `${getSpanNamePrefix(phase)}: ${processor.id}`,
              ),
              entityType: getProcessorEntityType(phase),
              entityId: processor.id,
              entityName: processor.name ?? processor.id,
              input: buildProcessorSpanInput(),
              attributes: {
                ...resolveProcessorSpanAttributes(processor, toProcessorSpanPhase(phase)),
                processorExecutor: 'workflow',
                // Read processorIndex from processor (set in combineProcessorsIntoWorkflow)
                processorIndex: processor.processorIndex,
              },
            })
          : undefined;

      // Create observability context with processor span so internal agent calls nest correctly
      const processorObservabilityContext: ObservabilityContext | undefined = createObservabilityContext(
        processorSpan ? { currentSpan: processorSpan } : tracingContext,
      );

      // Create ProcessorStreamWriter from outputWriter if available
      // This enables processors to stream data-* parts to the UI in real-time
      const processorWriter: ProcessorStreamWriter | undefined = outputWriter
        ? {
            custom: async <T extends { type: string }>(data: T, options?: ProcessorStreamWriterOptions) => {
              await outputWriter(data as any, { messageId: options?.messageId ?? currentMessageId });
            },
          }
        : undefined;

      // Base context for all processor methods - includes requestContext for memory processors
      // and tracingContext for proper span nesting when processors call internal agents
      // state is per-processor state that persists across all method calls within this request
      // writer enables real-time streaming of data-* parts to the UI

      // If processorStates map is provided (from ProcessorRunner), use it to get this processor's state
      // Otherwise fall back to the state passed in inputData
      let processorState: Record<string, unknown>;
      if (processorStates) {
        // Get or create the ProcessorState for this processor
        let ps = processorStates.get(processor.id);
        if (!ps) {
          ps = new ProcessorState();
          processorStates.set(processor.id, ps);
        }
        processorState = ps.customState;
      } else {
        processorState = state ?? {};
      }

      const processorMessageList =
        messageList ??
        (Array.isArray(messages)
          ? new MessageList()
              .add(messages as MastraDBMessage[], 'input')
              .addSystem((systemMessages ?? []) as CoreMessage[])
          : undefined);

      const baseContext = {
        abort,
        agent,
        retryCount: retryCount ?? 0,
        requestContext,
        ...processorObservabilityContext,
        state: processorState,
        writer: processorWriter,
        abortSignal,
        messageId: currentMessageId,
        rotateResponseMessageId: rotateCurrentResponseMessageId,
        ...(processorMessageList
          ? {
              sendSignal: createProcessorSendSignal({
                messageList: processorMessageList,
                writer: processorWriter,
                rotateResponseMessageId: rotateCurrentResponseMessageId,
              }),
            }
          : {}),
      };

      // Pass-through data that should flow to the next processor in a chain
      // This enables processor workflows to use .then(), .parallel(), .branch(), etc.
      const passThrough = {
        phase,
        // Auto-create MessageList from messages if not provided
        // This enables running processor workflows from the UI where messageList can't be serialized
        messageList: processorMessageList,
        stepNumber,
        systemMessages,
        streamParts,
        state: processorState,
        processorStates,
        result: outputResult,
        finishReason,
        providerMetadata,
        toolCalls,
        text,
        retryCount,
        // inputStep phase fields for model/tools configuration
        model,
        tools,
        toolChoice,
        activeTools,
        providerOptions,
        modelSettings,
        structuredOutput,
        steps,
        usage,
        messageId: currentMessageId,
        rotateResponseMessageId: rotateCurrentResponseMessageId,
        // toolResult phase fields — passed through so chained processor steps can read them
        toolName,
        toolCallId,
        args: toolCallArgs,
        toolResultValue,
        providerExecuted,
      };

      // Helper to execute phase with proper span lifecycle management
      // Uses executeWithContext to set the processor span as the active OTEL context,
      // so auto-instrumented operations inside processors nest correctly under the span.
      const executePhaseWithSpan = async <T>(fn: () => Promise<T>): Promise<T> => {
        try {
          const result = await executeWithContext({ span: processorSpan, fn });
          processorSpan?.end({ output: buildProcessorSpanOutput(result) });
          return result;
        } catch (error) {
          // TripWire errors should end span but bubble up to halt the workflow
          if (error instanceof TripWire) {
            processorSpan?.error({
              error,
              endSpan: true,
              attributes: {
                tripwireAbort: {
                  reason: error.message,
                  retry: error.options?.retry,
                  metadata: error.options?.metadata,
                },
              },
            });
          } else {
            processorSpan?.error({ error: error as Error, endSpan: true });
          }
          throw error;
        }
      };

      // Execute the phase with span lifecycle management
      return executePhaseWithSpan(async () => {
        switch (phase) {
          case 'input': {
            if (processor.processInput) {
              if (!passThrough.messageList) {
                throw new MastraError({
                  category: ErrorCategory.USER,
                  domain: ErrorDomain.MASTRA_WORKFLOW,
                  id: 'PROCESSOR_MISSING_MESSAGE_LIST',
                  text: `Processor ${processor.id} requires messageList or messages for processInput phase`,
                });
              }

              // Extract messageList after null check for proper type narrowing
              const checkedMessageList = passThrough.messageList;

              // Create source checker before processing to preserve message sources
              const idsBeforeProcessing = (messages as MastraDBMessage[]).map(m => m.id);
              const check = checkedMessageList.makeMessageSourceChecker();

              const result = await processor.processInput({
                ...baseContext,
                messages: messages as MastraDBMessage[],
                messageList: checkedMessageList,
                systemMessages: (systemMessages ?? []) as CoreMessage[],
              });

              if (result instanceof MessageList) {
                // Validate same instance
                if (result !== checkedMessageList) {
                  throw new MastraError({
                    category: ErrorCategory.USER,
                    domain: ErrorDomain.MASTRA_WORKFLOW,
                    id: 'PROCESSOR_RETURNED_EXTERNAL_MESSAGE_LIST',
                    text: `Processor ${processor.id} returned a MessageList instance other than the one passed in. Use the messageList argument instead.`,
                  });
                }
                return {
                  ...passThrough,
                  messages: result.get.all.db(),
                  systemMessages: result.getSystemMessages(),
                };
              } else if (Array.isArray(result)) {
                // Processor returned an array of messages
                ProcessorRunner.applyMessagesToMessageList(
                  result as MastraDBMessage[],
                  checkedMessageList,
                  idsBeforeProcessing,
                  check,
                  'input',
                );
                return { ...passThrough, messages: result };
              } else if (result && 'messages' in result && 'systemMessages' in result) {
                // Processor returned { messages, systemMessages }
                const typedResult = result as { messages: MastraDBMessage[]; systemMessages: CoreMessage[] };
                ProcessorRunner.applyMessagesToMessageList(
                  typedResult.messages,
                  checkedMessageList,
                  idsBeforeProcessing,
                  check,
                  'input',
                );
                checkedMessageList.replaceAllSystemMessages(typedResult.systemMessages);
                return {
                  ...passThrough,
                  messages: typedResult.messages,
                  systemMessages: checkedMessageList.getSystemMessages(),
                };
              }
              return { ...passThrough, messages };
            }
            return { ...passThrough, messages };
          }

          case 'inputStep': {
            if (processor.processInputStep) {
              if (!passThrough.messageList) {
                throw new MastraError({
                  category: ErrorCategory.USER,
                  domain: ErrorDomain.MASTRA_WORKFLOW,
                  id: 'PROCESSOR_MISSING_MESSAGE_LIST',
                  text: `Processor ${processor.id} requires messageList or messages for processInputStep phase`,
                });
              }

              // Extract messageList after null check for proper type narrowing
              const checkedMessageList = passThrough.messageList;

              // Create source checker before processing to preserve message sources
              const idsBeforeProcessing = (messages as MastraDBMessage[]).map(m => m.id);
              const check = checkedMessageList.makeMessageSourceChecker();

              const result = await processor.processInputStep({
                ...baseContext,
                messages: messages as MastraDBMessage[],
                messageList: checkedMessageList,
                stepNumber: stepNumber ?? 0,
                systemMessages: (systemMessages ?? []) as CoreMessage[],
                // Pass model/tools configuration fields - types match ProcessInputStepArgs
                model: model!,
                tools,
                toolChoice,
                activeTools,
                providerOptions,
                modelSettings,
                structuredOutput,
                steps: steps ?? [],
                messageId: currentMessageId,
                rotateResponseMessageId: rotateCurrentResponseMessageId,
              });

              const validatedResult = await ProcessorRunner.validateAndFormatProcessInputStepResult(result, {
                messageList: checkedMessageList,
                processor,
                stepNumber: stepNumber ?? 0,
              });

              if (validatedResult.messages) {
                ProcessorRunner.applyMessagesToMessageList(
                  validatedResult.messages,
                  checkedMessageList,
                  idsBeforeProcessing,
                  check,
                );
              }

              if (validatedResult.systemMessages) {
                checkedMessageList.replaceAllSystemMessages(validatedResult.systemMessages as CoreMessage[]);
              }

              // Preserve messages in return - passThrough doesn't include messages,
              // so we must explicitly include it to avoid losing it for subsequent steps.
              return {
                ...passThrough,
                messages,
                ...validatedResult,
                systemMessages: checkedMessageList.getSystemMessages(),
                ...(currentMessageId ? { messageId: validatedResult.messageId ?? currentMessageId } : {}),
              };
            }
            return { ...passThrough, messages };
          }

          case 'outputStream': {
            // Skip data-* chunks for processors that haven't opted in
            if (part && (part as ChunkType).type.startsWith('data-') && !processor.processDataParts) {
              return { ...passThrough, part };
            }
            if (processor.processOutputStream && part) {
              // Manage per-processor span lifecycle across stream chunks
              // Use unique key to store span on shared state object
              const spanKey = `__outputStreamSpan_${processor.id}`;
              // Use processorState (from the shared processorStates Map) so state persists
              // across processOutputStream and processOutputResult calls
              const mutableState = processorState;
              let processorSpan = mutableState[spanKey] as
                | ReturnType<NonNullable<typeof parentSpan>['createChildSpan']>
                | undefined;

              if (!processorSpan && parentSpan) {
                // First chunk - create span for this processor
                processorSpan = parentSpan.createChildSpan({
                  type: processor.spanType ?? SpanType.PROCESSOR_RUN,
                  name: resolveProcessorSpanName(processor, 'output', `output stream processor: ${processor.id}`),
                  entityType: EntityType.OUTPUT_PROCESSOR,
                  entityId: processor.id,
                  entityName: processor.name ?? processor.id,
                  attributes: {
                    ...resolveProcessorSpanAttributes(processor, 'output'),
                    processorExecutor: 'workflow',
                    processorIndex: processor.processorIndex,
                  },
                });
                mutableState[spanKey] = processorSpan;
              }

              // Create observability context with processor span for internal agent calls
              const processorObservabilityContext = createObservabilityContext(
                processorSpan ? { currentSpan: processorSpan } : baseContext.tracingContext,
              );

              // Handle outputStream span lifecycle explicitly (not via executePhaseWithSpan)
              // because outputStream uses a per-processor span stored in mutableState
              let result: ChunkType | null | undefined;
              try {
                result = await processor.processOutputStream({
                  ...baseContext,
                  ...processorObservabilityContext,
                  part: part as ChunkType,
                  streamParts: (streamParts ?? []) as ChunkType[],
                  state: mutableState,
                  messageList: passThrough.messageList, // Optional for stream processing
                });

                // End span on finish chunk
                if (part && (part as ChunkType).type === 'finish') {
                  // Output just totalChunks (workflow processors don't track accumulated text yet)
                  processorSpan?.end({ output: { totalChunks: (streamParts ?? []).length } });
                  // Keep the ended span reference in mutableState so that
                  // post-finish chunks (e.g. step-finish) don't trigger a
                  // new span creation at the guard above.
                }
              } catch (error) {
                // End span with error (keep reference to prevent re-creation)
                if (error instanceof TripWire) {
                  processorSpan?.error({
                    error,
                    endSpan: true,
                    attributes: {
                      tripwireAbort: {
                        reason: error.message,
                        retry: error.options?.retry,
                        metadata: error.options?.metadata,
                      },
                    },
                  });
                } else {
                  processorSpan?.error({ error: error as Error, endSpan: true });
                }
                throw error;
              }

              return { ...passThrough, state: mutableState, part: result };
            }
            return { ...passThrough, part };
          }

          case 'outputResult': {
            if (processor.processOutputResult) {
              if (!passThrough.messageList) {
                throw new MastraError({
                  category: ErrorCategory.USER,
                  domain: ErrorDomain.MASTRA_WORKFLOW,
                  id: 'PROCESSOR_MISSING_MESSAGE_LIST',
                  text: `Processor ${processor.id} requires messageList or messages for processOutputResult phase`,
                });
              }

              // Create source checker before processing to preserve message sources
              const idsBeforeProcessing = (messages as MastraDBMessage[]).map(m => m.id);
              const check = passThrough.messageList.makeMessageSourceChecker();

              const defaultResult: OutputResult = {
                text: '',
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                finishReason: 'unknown',
                steps: [],
              };

              const result = await processor.processOutputResult({
                ...baseContext,
                messages: messages as MastraDBMessage[],
                messageList: passThrough.messageList,
                result: (passThrough.result as OutputResult) ?? defaultResult,
              });

              if (result instanceof MessageList) {
                // Validate same instance
                if (result !== passThrough.messageList) {
                  throw new MastraError({
                    category: ErrorCategory.USER,
                    domain: ErrorDomain.MASTRA_WORKFLOW,
                    id: 'PROCESSOR_RETURNED_EXTERNAL_MESSAGE_LIST',
                    text: `Processor ${processor.id} returned a MessageList instance other than the one passed in. Use the messageList argument instead.`,
                  });
                }
                return {
                  ...passThrough,
                  messages: result.get.all.db(),
                  systemMessages: result.getSystemMessages(),
                };
              } else if (Array.isArray(result)) {
                // Processor returned an array of messages
                ProcessorRunner.applyMessagesToMessageList(
                  result as MastraDBMessage[],
                  passThrough.messageList,
                  idsBeforeProcessing,
                  check,
                  'response',
                );
                return { ...passThrough, messages: result };
              } else if (result && 'messages' in result && 'systemMessages' in result) {
                // Processor returned { messages, systemMessages }
                const typedResult = result as { messages: MastraDBMessage[]; systemMessages: CoreMessage[] };
                ProcessorRunner.applyMessagesToMessageList(
                  typedResult.messages,
                  passThrough.messageList,
                  idsBeforeProcessing,
                  check,
                  'response',
                );
                passThrough.messageList.replaceAllSystemMessages(typedResult.systemMessages);
                return {
                  ...passThrough,
                  messages: typedResult.messages,
                  systemMessages: passThrough.messageList.getSystemMessages(),
                };
              }
              return { ...passThrough, messages };
            }
            return { ...passThrough, messages };
          }

          case 'outputStep': {
            if (processor.processOutputStep) {
              if (!passThrough.messageList) {
                throw new MastraError({
                  category: ErrorCategory.USER,
                  domain: ErrorDomain.MASTRA_WORKFLOW,
                  id: 'PROCESSOR_MISSING_MESSAGE_LIST',
                  text: `Processor ${processor.id} requires messageList or messages for processOutputStep phase`,
                });
              }

              // Extract messageList after null check for proper type narrowing
              const checkedMessageList = passThrough.messageList;

              // Create source checker before processing to preserve message sources
              const idsBeforeProcessing = (messages as MastraDBMessage[]).map(m => m.id);
              const check = checkedMessageList.makeMessageSourceChecker();

              const defaultUsage: LanguageModelUsage = {
                inputTokens: undefined,
                outputTokens: undefined,
                totalTokens: undefined,
              };
              const result = await processor.processOutputStep({
                ...baseContext,
                messages: messages as MastraDBMessage[],
                messageList: checkedMessageList,
                stepNumber: stepNumber ?? 0,
                finishReason,
                providerMetadata: providerMetadata as ProviderMetadata | undefined,
                toolCalls: toolCalls as any,
                text,
                usage: (usage as LanguageModelUsage) ?? defaultUsage,
                systemMessages: (systemMessages ?? []) as CoreMessage[],
                steps: steps ?? [],
              });

              if (result instanceof MessageList) {
                // Validate same instance
                if (result !== checkedMessageList) {
                  throw new MastraError({
                    category: ErrorCategory.USER,
                    domain: ErrorDomain.MASTRA_WORKFLOW,
                    id: 'PROCESSOR_RETURNED_EXTERNAL_MESSAGE_LIST',
                    text: `Processor ${processor.id} returned a MessageList instance other than the one passed in. Use the messageList argument instead.`,
                  });
                }
                return {
                  ...passThrough,
                  messages: result.get.all.db(),
                  systemMessages: result.getSystemMessages(),
                };
              } else if (Array.isArray(result)) {
                // Processor returned an array of messages
                ProcessorRunner.applyMessagesToMessageList(
                  result as MastraDBMessage[],
                  checkedMessageList,
                  idsBeforeProcessing,
                  check,
                  'response',
                );
                return { ...passThrough, messages: result };
              } else if (result && 'messages' in result && 'systemMessages' in result) {
                // Processor returned { messages, systemMessages }
                const typedResult = result as { messages: MastraDBMessage[]; systemMessages: CoreMessage[] };
                ProcessorRunner.applyMessagesToMessageList(
                  typedResult.messages,
                  checkedMessageList,
                  idsBeforeProcessing,
                  check,
                  'response',
                );
                checkedMessageList.replaceAllSystemMessages(typedResult.systemMessages);
                return {
                  ...passThrough,
                  messages: typedResult.messages,
                  systemMessages: checkedMessageList.getSystemMessages(),
                };
              }
              return { ...passThrough, messages };
            }
            return { ...passThrough, messages };
          }

          case 'toolResult': {
            if (processor.processToolResult) {
              if (!passThrough.messageList) {
                throw new MastraError({
                  category: ErrorCategory.USER,
                  domain: ErrorDomain.MASTRA_WORKFLOW,
                  id: 'PROCESSOR_MISSING_MESSAGE_LIST',
                  text: `Processor ${processor.id} requires messageList or messages for processToolResult phase`,
                });
              }

              const checkedMessageList = passThrough.messageList;
              const idsBeforeProcessing = (messages as MastraDBMessage[]).map(m => m.id);
              const check = checkedMessageList.makeMessageSourceChecker();

              const result = await processor.processToolResult({
                ...baseContext,
                messages: messages as MastraDBMessage[],
                messageList: checkedMessageList,
                stepNumber: stepNumber ?? 0,
                toolName: toolName ?? '',
                toolCallId: toolCallId ?? '',
                args: toolCallArgs,
                result: toolResultValue,
                providerExecuted,
                systemMessages: (systemMessages ?? []) as CoreMessage[],
                steps: steps ?? [],
              });

              if (result instanceof MessageList) {
                if (result !== checkedMessageList) {
                  throw new MastraError({
                    category: ErrorCategory.USER,
                    domain: ErrorDomain.MASTRA_WORKFLOW,
                    id: 'PROCESSOR_RETURNED_EXTERNAL_MESSAGE_LIST',
                    text: `Processor ${processor.id} returned a MessageList instance other than the one passed in. Use the messageList argument instead.`,
                  });
                }
                return {
                  ...passThrough,
                  messages: result.get.all.db(),
                  systemMessages: result.getAllSystemMessages(),
                };
              } else if (Array.isArray(result)) {
                ProcessorRunner.applyMessagesToMessageList(
                  result as MastraDBMessage[],
                  checkedMessageList,
                  idsBeforeProcessing,
                  check,
                  'response',
                );
                return { ...passThrough, messages: result };
              } else if (result && 'messages' in result && 'systemMessages' in result) {
                const typedResult = result as { messages: MastraDBMessage[]; systemMessages: CoreMessage[] };
                ProcessorRunner.applyMessagesToMessageList(
                  typedResult.messages,
                  checkedMessageList,
                  idsBeforeProcessing,
                  check,
                  'response',
                );
                checkedMessageList.replaceAllSystemMessages(typedResult.systemMessages);
                return {
                  ...passThrough,
                  messages: typedResult.messages,
                  systemMessages: typedResult.systemMessages,
                };
              }
              return { ...passThrough, messages };
            }
            return { ...passThrough, messages };
          }

          default:
            return { ...passThrough, messages };
        }
      });
    },
    component: 'PROCESSOR',
  } satisfies Step<
    `processor:${TProcessorId}`,
    unknown,
    InferStandardSchemaOutput<typeof ProcessorStepInputSchema>,
    InferStandardSchemaOutput<typeof ProcessorStepOutputSchema>,
    unknown,
    unknown,
    DefaultEngineType
  >;

  const toolProvider = processor as ProcessorLoadedToolsProvider;
  if (typeof toolProvider.getLoadedToolsForRequestContext === 'function') {
    (step as ProcessorLoadedToolsProvider).getLoadedToolsForRequestContext =
      toolProvider.getLoadedToolsForRequestContext.bind(processor);
  }

  return step;
}

export function cloneStep<TStepId extends string>(
  step: Step<string, any, any, any, any, any, DefaultEngineType>,
  opts: { id: TStepId },
): Step<TStepId, any, any, any, any, any, DefaultEngineType> {
  return {
    id: opts.id,
    description: step.description,
    inputSchema: step.inputSchema,
    outputSchema: step.outputSchema,
    suspendSchema: step.suspendSchema,
    resumeSchema: step.resumeSchema,
    stateSchema: step.stateSchema,
    execute: step.execute,
    retries: step.retries,
    scorers: step.scorers,
    component: step.component,
    metadata: step.metadata,
  };
}

/**
 * Type guard to check if an object is a Processor.
 * A Processor must have an 'id' property and at least one processor method.
 */
export function isProcessor(obj: unknown): obj is Processor {
  if (
    obj === null ||
    typeof obj !== 'object' ||
    !('id' in obj) ||
    typeof (obj as Record<string, unknown>).id !== 'string' ||
    isAgentOrTool(obj)
  ) {
    return false;
  }
  const rec = obj as Record<string, unknown>;
  return (
    typeof rec.processInput === 'function' ||
    typeof rec.processInputStep === 'function' ||
    typeof rec.processOutputStream === 'function' ||
    typeof rec.processOutputResult === 'function' ||
    typeof rec.processOutputStep === 'function' ||
    typeof rec.processToolResult === 'function' ||
    typeof rec.processAPIError === 'function' ||
    typeof rec.computeStateSignal === 'function'
  );
}

/**
 * A Workflow with all type parameters erased.
 * Use this instead of manually specifying `Workflow<any, any, ...>` so that
 * adding or removing type parameters only requires updating one place.
 */
export type AnyWorkflow = Workflow<any, any, any, any, any, any, any, any>;

/**
 * Compile-time guard for the declarative `.agent()` builder. Agent steps require a
 * `{ prompt: string }` input. When the previous step output `TPrev` is assignable to
 * that, this resolves to `unknown` (a no-op intersection); otherwise it resolves to a
 * branded object the passed agent can't satisfy, surfacing a readable error on the
 * argument that names the expected input.
 *
 * `[any] extends [...]` is `true` => `unknown`, so a `.map()` returning `any` stays a
 * deliberate escape hatch. A `unknown`/mismatched prev output errors. The tuple wrap
 * prevents distribution over union prev-output types.
 */
type RequireAgentInput<TPrev> = [TPrev] extends [{ prompt: string }]
  ? unknown
  : {
      readonly __chainError: 'Previous step output must be assignable to { prompt: string }';
      readonly expectedInput: { prompt: string };
      readonly receivedPrevOutput: TPrev;
    };

export class Workflow<
  TEngineType = DefaultEngineType,
  TSteps extends Step<string, any, any, any, any, any, TEngineType, any>[] = Step<
    string,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    TEngineType
  >[],
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TPrevSchema = TInput,
  TRequestContext extends Record<string, any> | unknown = unknown,
>
  extends MastraBase
  implements Step<TWorkflowId, TState, TInput, TOutput | undefined, any, any, DefaultEngineType, TRequestContext>
{
  public id: TWorkflowId;
  public description?: string | undefined;
  public metadata?: Record<string, unknown> | undefined;
  public inputSchema: StandardSchemaWithJSON<TInput>;
  public outputSchema: StandardSchemaWithJSON<TOutput>;
  public stateSchema?: StandardSchemaWithJSON<TState>;
  public requestContextSchema?: StandardSchemaWithJSON<TRequestContext>;
  public steps: Record<string, StepWithComponent>;
  public stepDefs?: TSteps;
  public engineType: WorkflowEngineType = 'default';
  /** Type of workflow - 'processor' for processor workflows, 'default' otherwise */
  public type: WorkflowType = 'default';
  /** Where this workflow came from: 'code' for statically registered workflows, 'dynamic' for workflows rehydrated from storage. Set by rehydrateWorkflow; defaults to 'code'. */
  public origin: 'code' | 'dynamic' = 'code';
  public isInternal = false;
  #nestedWorkflowInput?: TInput;
  public committed: boolean = false;
  protected stepFlow: StepFlowEntry<TEngineType>[];
  protected serializedStepFlow: SerializedStepFlowEntry[];
  protected executionEngine: ExecutionEngine;
  protected executionGraph: ExecutionGraph;
  #options: Omit<WorkflowOptions, 'shouldPersistSnapshot' | 'validateInputs'> &
    Required<Pick<WorkflowOptions, 'shouldPersistSnapshot' | 'validateInputs'>>;
  public retryConfig: {
    attempts?: number;
    delay?: number;
  };

  #mastra?: Mastra;

  #runs: Map<string, Run<TEngineType, TSteps, TState, TInput, TOutput, TRequestContext>> = new Map();

  constructor({
    mastra,
    id,
    inputSchema,
    outputSchema,
    stateSchema,
    requestContextSchema,
    description,
    metadata,
    executionEngine,
    retryConfig,
    steps,
    options = {},
    type,
  }: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps, TRequestContext>) {
    super({ name: id, component: RegisteredLogger.WORKFLOW });
    this.id = id;
    this.description = description;
    this.metadata = metadata;
    this.inputSchema = inputSchema ? toStandardSchema(inputSchema) : inputSchema;
    this.outputSchema = outputSchema ? toStandardSchema(outputSchema) : outputSchema;
    this.stateSchema = stateSchema ? toStandardSchema(stateSchema) : undefined;
    this.requestContextSchema = requestContextSchema ? toStandardSchema(requestContextSchema) : undefined;
    this.retryConfig = retryConfig ?? { attempts: 0, delay: 0 };
    this.executionGraph = this.buildExecutionGraph();
    this.stepFlow = [];
    this.serializedStepFlow = [];
    this.#mastra = mastra;
    this.steps = {};
    this.stepDefs = steps;
    this.type = type ?? 'default';
    this.#options = {
      validateInputs: options.validateInputs ?? true,
      emitStepEvents: options.emitStepEvents ?? true,
      shouldPersistSnapshot: options.shouldPersistSnapshot ?? (() => true),
      allowUnclaimedResumes: options.allowUnclaimedResumes,
      pruneSnapshot: options.pruneSnapshot,
      tracingPolicy: options.tracingPolicy,
      onStart: options.onStart,
      onFinish: options.onFinish,
      onError: options.onError,
      sharePubsub: options.sharePubsub,
      autoRestartActiveRuns: options.autoRestartActiveRuns,
    };

    if (!executionEngine) {
      // TODO: this should be configured using the Mastra class instance that's passed in
      this.executionEngine = new DefaultExecutionEngine({
        mastra: this.#mastra,
        options: this.#options,
      });
    } else {
      this.executionEngine = executionEngine;
    }

    this.engineType = 'default';

    this.#runs = new Map();
  }

  get runs() {
    return this.#runs;
  }

  get mastra() {
    return this.#mastra;
  }

  get options() {
    return this.#options;
  }

  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;
    this.executionEngine.__registerMastra(mastra);
  }

  __markInternal() {
    this.isInternal = true;
  }

  __registerPrimitives(p: MastraPrimitives) {
    if (p.logger) {
      this.__setLogger(p.logger);
    }
  }

  __setLogger(logger: IMastraLogger) {
    super.__setLogger(logger);
    this.executionEngine.__setLogger(logger);
  }

  setStepFlow(stepFlow: StepFlowEntry<TEngineType>[]) {
    this.stepFlow = stepFlow;
  }

  /**
   * @internal Rehydration-only (workflows/dynamic). Appends a fully-built
   * graph entry without laundering it through the live-`Step` builder
   * overloads: rehydration already holds the declarative entry it parsed from
   * storage, so wrapping it in a fake `Step` just so the builder can sniff it
   * back into the same entry would lose data (options, ids) and lie to the
   * type system. Mirrors the bookkeeping the public builder methods do:
   * pushes the live + serialized entries and registers inner steps in
   * `this.steps`.
   */
  __pushStepFlowEntry(live: StepFlowEntry<TEngineType>, serialized: SerializedStepFlowEntry): void {
    this.stepFlow.push(live);
    this.serializedStepFlow.push(serialized);
    const register = (entry: SingleStepEntry<TEngineType>) => {
      switch (entry.type) {
        case 'step':
          this.steps[entry.step.id] = entry.step as any;
          return;
        case 'agent':
          // Same lightweight handle the by-id `.agent()` builder registers.
          this.steps[entry.id] = { id: entry.id, component: 'AGENT' } as any;
          return;
        case 'tool':
          this.steps[entry.id] = { id: entry.id, component: 'TOOL' } as any;
          return;
        case 'mapping':
          this.steps[entry.id] = createMappingStep(entry.id, entry.mapConfig as MappingConfig) as any;
          return;
      }
    };
    switch (live.type) {
      case 'parallel':
      case 'conditional':
        live.steps.forEach(register);
        return;
      case 'loop':
      case 'foreach':
        register(live.step);
        return;
      case 'step':
      case 'agent':
      case 'tool':
      case 'mapping':
        register(live);
        return;
      case 'sleep':
      case 'sleepUntil':
        // Same no-op placeholder the sleep/sleepUntil builder methods register,
        // including the entry's display fields so steps/allSteps stay in sync.
        this.steps[live.id] = createStep({
          id: live.id,
          description: live.description,
          metadata: live.metadata,
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        });
        return;
      default:
        return;
    }
  }

  /**
   * Adds a step to the workflow
   * @param step The step to add to the workflow
   * @returns The workflow instance for chaining
   *
   * The step's inputSchema must be satisfied by the previous step's output (or workflow input for first step).
   * This means: TPrevSchema must be assignable to TStepInput
   */
  then<TStepId extends string, TStepState, TStepInput, TSchemaOut>(
    step: Step<
      TStepId,
      // Allow steps with any/unknown state, or steps whose state is a subset of workflow state
      unknown extends TStepState ? TStepState : SubsetOf<TStepState, TState>,
      // Check: previous output (TPrevSchema) must satisfy step's input requirements (TStepInput)
      // If TPrevSchema can be assigned to TStepInput, allow it. Otherwise show expected type.
      TPrevSchema extends TStepInput ? TStepInput : TPrevSchema,
      TSchemaOut,
      any,
      any,
      TEngineType,
      any
    >,
  ) {
    this.stepFlow.push(toSingleStepEntry(step as StepWithRefMetadata));
    this.serializedStepFlow.push(toSerializedSingleStepEntry(step as StepWithRefMetadata));
    this.steps[step.id] = step;
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      TSchemaOut,
      TRequestContext
    >;
  }

  /**
   * Adds an agent as a declarative `{ type: 'agent' }` step to the workflow.
   *
   * The step output is the agent's structured output (when `structuredOutput` is
   * provided) or `{ text: string }` otherwise.
   */
  agent<TStepId extends string>(
    // The previous step output (TPrevSchema) must satisfy the agent step input
    // `{ prompt: string }`; otherwise the guard makes this argument unsatisfiable.
    agent: (SubAgent<TStepId, any> | Agent<TStepId, any>) & RequireAgentInput<TPrevSchema>,
    options?: Omit<AgentStepOptions<{ text: string }>, 'structuredOutput'> & {
      structuredOutput?: never;
      retries?: number;
      scorers?: DynamicArgument<MastraScorers>;
      metadata?: StepMetadata;
    },
    stepOptions?: { id?: string },
  ): Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, { text: string }, TRequestContext>;
  agent<TStepId extends string, TStepOutput>(
    agent: (SubAgent<TStepId, any> | Agent<TStepId, any>) & RequireAgentInput<TPrevSchema>,
    options: Omit<AgentStepOptions<TStepOutput>, 'structuredOutput'> & {
      structuredOutput: { schema: StandardSchemaWithJSON<TStepOutput> };
      retries?: number;
      scorers?: DynamicArgument<MastraScorers>;
      metadata?: StepMetadata;
    },
    stepOptions?: { id?: string },
  ): Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TStepOutput, TRequestContext>;
  agent(
    agentId: string,
    options?: AgentStepOptions<any> & {
      retries?: number;
      scorers?: DynamicArgument<MastraScorers>;
      metadata?: StepMetadata;
    },
    stepOptions?: { id?: string },
  ): Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, { text: string }, TRequestContext>;
  agent(agentOrId: any, options?: any, stepOptions?: { id?: string }): any {
    const isId = typeof agentOrId === 'string';
    const agentId = isId ? agentOrId : agentOrId.id;
    const id = stepOptions?.id || agentId;
    this.stepFlow.push({ type: 'agent', id, agentId, agent: isId ? undefined : agentOrId, options });
    this.serializedStepFlow.push({
      type: 'agent',
      id,
      agentId,
      description: isId ? undefined : agentOrId.getDescription?.(),
      ...serializeAgentStepFields(options),
    });
    this.steps[id] = isId
      ? ({ id, component: 'AGENT' } as any)
      : ({ ...createStepFromAgent(agentOrId, options), id } as any);
    return this as any;
  }

  /**
   * Adds a tool as a declarative `{ type: 'tool' }` step to the workflow.
   *
   * The step output type is the tool's `outputSchema` type; the input it accepts
   * is the tool's `inputSchema` type.
   */
  tool<
    TSchemaIn,
    TSchemaOut,
    TSuspend,
    TResume,
    TContext extends ToolExecutionContext<TSuspend, TResume, any>,
    TId extends string,
    TToolRC extends Record<string, any> | unknown = unknown,
  >(
    // The previous step output (TPrevSchema) must satisfy the tool's input (TSchemaIn).
    // On a mismatch the input slot resolves to TPrevSchema, making the passed tool
    // unassignable so the call errors — same mechanics as `.then`.
    tool: Tool<
      TPrevSchema extends TSchemaIn ? TSchemaIn : TPrevSchema,
      TSchemaOut,
      TSuspend,
      TResume,
      TContext,
      TId,
      TToolRC
    >,
    options?: { retries?: number; scorers?: DynamicArgument<MastraScorers>; metadata?: StepMetadata },
    stepOptions?: { id?: string },
  ): Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TSchemaOut, TRequestContext>;
  tool(
    toolId: string,
    options?: { retries?: number; scorers?: DynamicArgument<MastraScorers>; metadata?: StepMetadata },
    stepOptions?: { id?: string },
  ): Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, unknown, TRequestContext>;
  tool(toolOrId: any, options?: any, stepOptions?: { id?: string }): any {
    const isId = typeof toolOrId === 'string';
    const toolId = isId ? toolOrId : toolOrId.id;
    const id = stepOptions?.id || toolId;
    this.stepFlow.push({ type: 'tool', id, toolId, tool: isId ? undefined : toolOrId, options });
    this.serializedStepFlow.push({
      type: 'tool',
      id,
      toolId,
      description: isId ? undefined : toolOrId.description,
      ...serializeToolStepFields(options),
    });
    this.steps[id] = isId
      ? ({ id, component: 'TOOL' } as any)
      : ({ ...createStepFromTool(toolOrId, options), id } as any);
    return this as any;
  }

  /**
   * Adds a sleep step to the workflow
   * @param duration The duration to sleep for
   * @param options Optional stable `id`, `description`, and `metadata` for the entry
   * @returns The workflow instance for chaining
   */
  sleep(
    duration: number | ExecuteFunction<TState, TPrevSchema, number, any, any, TEngineType>,
    options?: StepFlowEntryOptions,
  ) {
    const id =
      options?.id ||
      `sleep_${this.#mastra?.generateId({ idType: 'step', source: 'workflow', entityId: this.id, stepType: 'sleep' }) || randomUUID()}`;
    // Only the display fields: `id` is spelled explicitly from the normalized
    // value above, so a falsy caller id can never override the generated one.
    const displayFields = toEntryOptionFields({ description: options?.description, metadata: options?.metadata });

    const opts: StepFlowEntry<TEngineType> =
      typeof duration === 'function'
        ? { type: 'sleep', id, ...displayFields, fn: duration }
        : { type: 'sleep', id, ...displayFields, duration: duration as number };
    const serializedOpts: SerializedStepFlowEntry =
      typeof duration === 'function'
        ? { type: 'sleep', id, ...displayFields, fn: duration.toString() }
        : { type: 'sleep', id, ...displayFields, duration: duration as number };

    this.stepFlow.push(opts);
    this.serializedStepFlow.push(serializedOpts);
    this.steps[id] = createStep({
      id,
      description: options?.description,
      metadata: options?.metadata,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => {
        return {};
      },
    });
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      TPrevSchema,
      TRequestContext
    >;
  }

  /**
   * Adds a sleep until step to the workflow
   * @param date The date to sleep until
   * @param options Optional stable `id`, `description`, and `metadata` for the entry
   * @returns The workflow instance for chaining
   */
  sleepUntil(
    date: Date | ExecuteFunction<TState, TPrevSchema, Date, any, any, TEngineType>,
    options?: StepFlowEntryOptions,
  ) {
    const id =
      options?.id ||
      `sleep_${this.#mastra?.generateId({ idType: 'step', source: 'workflow', entityId: this.id, stepType: 'sleep-until' }) || randomUUID()}`;
    // Only the display fields: `id` is spelled explicitly from the normalized
    // value above, so a falsy caller id can never override the generated one.
    const displayFields = toEntryOptionFields({ description: options?.description, metadata: options?.metadata });
    const opts: StepFlowEntry<TEngineType> =
      typeof date === 'function'
        ? { type: 'sleepUntil', id, ...displayFields, fn: date }
        : { type: 'sleepUntil', id, ...displayFields, date: date as Date };
    const serializedOpts: SerializedStepFlowEntry =
      typeof date === 'function'
        ? { type: 'sleepUntil', id, ...displayFields, fn: date.toString() }
        : { type: 'sleepUntil', id, ...displayFields, date: date as Date };

    this.stepFlow.push(opts);
    this.serializedStepFlow.push(serializedOpts);
    this.steps[id] = createStep({
      id,
      description: options?.description,
      metadata: options?.metadata,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => {
        return {};
      },
    });
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      TPrevSchema,
      TRequestContext
    >;
  }

  /**
   * @deprecated waitForEvent has been removed. Please use suspend/resume instead.
   */
  waitForEvent<TStepState, TStepInputSchema extends TPrevSchema, TStepId extends string, TSchemaOut>(
    _event: string,
    _step: Step<TStepId, SubsetOf<TStepState, TState>, TStepInputSchema, TSchemaOut, any, any, TEngineType>,
    _opts?: {
      timeout?: number;
    },
  ) {
    throw new MastraError({
      id: 'WORKFLOW_WAIT_FOR_EVENT_REMOVED',
      domain: ErrorDomain.MASTRA_WORKFLOW,
      category: ErrorCategory.USER,
      text: 'waitForEvent has been removed. Please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details.',
    });
  }

  map(
    mappingConfig:
      | {
          [k: string]:
            | {
                step:
                  | Step<string, any, any, any, any, any, TEngineType, any>
                  | Step<string, any, any, any, any, any, TEngineType, any>[];
                path: string;
              }
            | { value: any; schema: PublicSchema<any> }
            | {
                initData: Workflow<TEngineType, any, any, any, any, any, any>;
                path: string;
              }
            | {
                requestContextPath: string;
                schema: PublicSchema<any>;
              }
            /**
             * String template with `${<scope>.<path>}` placeholders. Resolved at
             * run time against the step's execution context.
             *
             * Scopes: `inputData`, `initData`, `state`, `requestContext`,
             * `stepResults.<stepId>`. Paths are dotted (`a.b.c`). Whitespace
             * inside placeholders is not allowed (`${ inputData.x }` errors at
             * workflow-definition time). Renders `null`/`undefined` as `''`;
             * throws on objects/arrays.
             */
            | { template: string }
            | DynamicMapping<TPrevSchema, any>;
        }
      | ExecuteFunction<TState, TPrevSchema, any, any, any, TEngineType>,
    stepOptions?: { id?: string | null; description?: string; metadata?: StepMetadata },
  ): Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, any, TRequestContext> {
    // Build a declarative `{ type: 'mapping' }` graph entry; the mapping logic is
    // interpreted at execution time by `createMappingStep`, not baked in here.
    // Mapping ids must be stable across process restarts: they are recorded in
    // workflow snapshots, and `timeTravel()` matches the live graph against those
    // recorded ids. Only defer to `generateId` when a CUSTOM id generator is
    // configured (the built-in default is `randomUUID()`, which would mint a
    // different id per build and break time travel across restarts). Otherwise
    // mint a deterministic id from the workflow id plus the ordinal of this
    // mapping entry within the step flow.
    // Skip ordinals whose id is already taken (an explicit `stepOptions.id` may
    // have claimed a `mapping_<workflowId>_<n>` name) so the fallback never
    // collides with an existing step.
    let mappingOrdinal = this.stepFlow.filter(entry => entry.type === 'mapping').length;
    while (`mapping_${this.id}_${mappingOrdinal}` in this.steps) {
      mappingOrdinal++;
    }
    const mappingId =
      stepOptions?.id ||
      (this.#mastra?.getIdGenerator()
        ? `mapping_${this.#mastra.generateId({ idType: 'step', source: 'workflow', entityId: this.id, stepType: 'mapping' })}`
        : `mapping_${this.id}_${mappingOrdinal}`);

    const truncate = (s: string) => (s.length > 1000 ? s.slice(0, 1000) + '...\n}' : s);

    // Fail-fast: validate every `{ template }` source at definition time so
    // malformed placeholders surface here, not at run time.
    if (typeof mappingConfig === 'object' && mappingConfig !== null) {
      for (const mapping of Object.values(mappingConfig)) {
        const m: any = mapping;
        if (m && typeof m.template === 'string') {
          validateTemplate(m.template);
        }
      }
    }

    const mappingDisplayFields = toEntryOptionFields({
      description: stepOptions?.description,
      metadata: stepOptions?.metadata,
    });

    if (typeof mappingConfig === 'function') {
      this.stepFlow.push({ type: 'mapping', id: mappingId, ...mappingDisplayFields, mapConfig: mappingConfig as any });
      this.serializedStepFlow.push({
        type: 'mapping',
        id: mappingId,
        ...mappingDisplayFields,
        mapConfig: truncate(mappingConfig.toString()),
      });
      this.steps[mappingId] = createMappingStep(mappingId, mappingConfig as any) as any;
      return this as unknown as Workflow<
        TEngineType,
        TSteps,
        TWorkflowId,
        TState,
        TInput,
        TOutput,
        any,
        TRequestContext
      >;
    }

    const newMappingConfig: Record<string, any> = Object.entries(mappingConfig).reduce(
      (a, [key, mapping]) => {
        const m: any = mapping;
        if (m.value !== undefined) {
          a[key] = m;
        } else if (m.fn !== undefined) {
          a[key] = {
            fn: m.fn.toString(),
            schema: m.schema,
          };
        } else if (m.requestContextPath) {
          a[key] = {
            requestContextPath: m.requestContextPath,
            schema: m.schema,
          };
        } else if (typeof m.template === 'string') {
          a[key] = { template: m.template };
        } else if (m.initData !== undefined) {
          // `mapVariable({ initData: <workflow> })` keeps a live Workflow instance
          // by reference. Serializing it here would deep-walk the whole workflow
          // (logger, nested step graph, …) into `mapConfig` — a multi-hundred-MB
          // string that OOMs at .commit() before the length guard below can trim
          // it (#19018). The execute path only reads `m.initData` for truthiness
          // (it calls getInitData()), so a slim id reference is behaviourally
          // identical at runtime. Fall back to `true` so callers using the
          // sentinel form still round-trip successfully.
          a[key] = {
            initData: m.initData?.id ?? true,
            path: m.path,
          };
        } else if (m.step) {
          // Serialize step references as ids (single or array). The live entry
          // (this.stepFlow) keeps the real reference for execution; stringifying
          // the Step object here would walk back into the workflow graph and
          // form a circular structure.
          a[key] = {
            step: Array.isArray(m.step) ? m.step.map((s: any) => s?.id) : m.step?.id,
            path: m.path,
          };
        } else {
          a[key] = m;
        }
        return a;
      },
      {} as Record<string, any>,
    );

    type MappedOutputSchema = any;

    this.stepFlow.push({
      type: 'mapping',
      id: mappingId,
      ...mappingDisplayFields,
      mapConfig: mappingConfig as MappingConfig,
    });
    this.serializedStepFlow.push({
      type: 'mapping',
      id: mappingId,
      ...mappingDisplayFields,
      mapConfig: truncate(JSON.stringify(newMappingConfig, null, 2)),
    });
    this.steps[mappingId] = createMappingStep(mappingId, mappingConfig as MappingConfig) as any;
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      MappedOutputSchema,
      TRequestContext
    >;
  }

  // TODO: make typing better here
  parallel<TParallelSteps extends readonly Step<string, any, TPrevSchema, any, any, any, TEngineType, any>[]>(
    steps: TParallelSteps & {
      [K in keyof TParallelSteps]: TParallelSteps[K] extends Step<
        string,
        infer S,
        TPrevSchema,
        infer O,
        any, // Don't infer TResume - causes issues with heterogeneous tuples
        any, // Don't infer TSuspend - causes issues with heterogeneous tuples
        TEngineType,
        infer TStepRC
      >
        ? Step<
            string,
            SubsetOf<S, TState>,
            TPrevSchema,
            O,
            any,
            any,
            TEngineType,
            // Allow steps that don't declare a requestContextSchema (TStepRC=unknown) or that
            // declare one matching the workflow's TRequestContext. Mismatched schemas error.
            unknown extends TStepRC ? unknown : TRequestContext
          >
        : `Error: Expected Step with state schema that is a subset of workflow state`;
    },
    options?: StepFlowEntryOptions,
  ) {
    const entryOptionFields = toEntryOptionFields(options);
    this.stepFlow.push({
      type: 'parallel',
      ...entryOptionFields,
      steps: steps.map(step => toSingleStepEntry(step as StepWithRefMetadata)),
    });
    this.serializedStepFlow.push({
      type: 'parallel',
      ...entryOptionFields,
      steps: steps.map(step => toSerializedSingleStepEntry(step as StepWithRefMetadata)),
    });
    steps.forEach(step => {
      this.steps[step.id] = step;
    });
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      {
        [K in keyof StepsRecord<TParallelSteps>]: InferStandardSchemaOutput<
          StepsRecord<TParallelSteps>[K]['outputSchema']
        >;
      },
      TRequestContext
    >;
  }

  // TODO: make typing better here
  // TODO: add state schema to the type, this is currently broken
  branch<
    TBranchSteps extends Array<
      [
        ConditionFunction<TState, TPrevSchema, any, any, any, TEngineType> | { predicate: Predicate },
        Step<string, any, TPrevSchema, any, any, any, TEngineType, any>,
      ]
    >,
  >(steps: TBranchSteps, options?: StepFlowEntryOptions) {
    const entryOptionFields = toEntryOptionFields(options);
    const resolved = steps.map(([condOrPred, step]) => {
      const isDeclarative = isDeclarativePredicateArg(condOrPred);
      const predicate = isDeclarative ? (condOrPred as { predicate: Predicate }).predicate : undefined;
      const condition = isDeclarative
        ? (predicateToCondition(predicate!) as ConditionFunction<TState, TPrevSchema, any, any, any, TEngineType>)
        : (condOrPred as ConditionFunction<TState, TPrevSchema, any, any, any, TEngineType>);
      const label = predicate ? derivePredicateLabel(predicate) : condition.toString();
      return { step, condition, predicate, label };
    });
    this.stepFlow.push({
      type: 'conditional',
      ...entryOptionFields,
      steps: resolved.map(({ step }) => toSingleStepEntry(step as StepWithRefMetadata)),
      conditions: resolved.map(({ condition }) => condition),
      serializedConditions: resolved.map(({ step, label }) => ({ id: `${step.id}-condition`, fn: label })),
      ...(resolved.some(({ predicate }) => predicate)
        ? { predicates: resolved.map(({ predicate }) => predicate ?? null) }
        : {}),
    } as StepFlowEntry<TEngineType>);
    this.serializedStepFlow.push({
      type: 'conditional',
      ...entryOptionFields,
      steps: resolved.map(({ step }) => toSerializedSingleStepEntry(step as StepWithRefMetadata)),
      serializedConditions: resolved.map(({ step, label }) => ({ id: `${step.id}-condition`, fn: label })),
      ...(resolved.some(({ predicate }) => predicate)
        ? { predicates: resolved.map(({ predicate }) => predicate ?? null) }
        : {}),
    } as SerializedStepFlowEntry);
    resolved.forEach(({ step }) => {
      this.steps[step.id] = step;
    });

    // Extract just the Step elements from the tuples array
    type BranchStepsArray = { [K in keyof TBranchSteps]: TBranchSteps[K][1] };

    // This creates a mapped type that extracts the second element from each tuple
    type ExtractedSteps = BranchStepsArray[number];

    // Now we can use this type as an array, similar to TParallelSteps
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      {
        [K in keyof StepsRecord<ExtractedSteps[]>]?: InferStandardSchemaOutput<
          StepsRecord<ExtractedSteps[]>[K]['outputSchema']
        >;
      },
      TRequestContext
    >;
  }

  dowhile<TStepState, TStepInputSchema extends TPrevSchema, TStepId extends string, TSchemaOut, TStepRC>(
    step: Step<
      TStepId,
      SubsetOf<TStepState, TState>,
      TStepInputSchema,
      TSchemaOut,
      any,
      any,
      TEngineType,
      // Allow steps that don't declare a requestContextSchema (TStepRC=unknown) or that
      // declare one matching the workflow's TRequestContext. Mismatched schemas error.
      unknown extends TStepRC ? unknown : TRequestContext
    >,
    condition: LoopConditionFunction<TState, TSchemaOut, any, any, any, TEngineType> | { predicate: Predicate },
    options?: StepFlowEntryOptions,
  ) {
    const entryOptionFields = toEntryOptionFields(options);
    const isDeclarative = isDeclarativePredicateArg(condition);
    const predicate = isDeclarative ? (condition as { predicate: Predicate }).predicate : undefined;
    const runtimeCondition = isDeclarative
      ? (predicateToCondition(predicate!) as LoopConditionFunction<TState, TSchemaOut, any, any, any, TEngineType>)
      : (condition as LoopConditionFunction<TState, TSchemaOut, any, any, any, TEngineType>);
    const label = predicate ? derivePredicateLabel(predicate) : runtimeCondition.toString();
    this.stepFlow.push({
      type: 'loop',
      ...entryOptionFields,
      step: toSingleStepEntry(step),
      condition: runtimeCondition,
      loopType: 'dowhile',
      serializedCondition: { id: `${step.id}-condition`, fn: label },
      ...(predicate ? { predicate } : {}),
    } as StepFlowEntry<TEngineType>);
    this.serializedStepFlow.push({
      type: 'loop',
      ...entryOptionFields,
      step: toSerializedSingleStepEntry(step as StepWithRefMetadata),
      serializedCondition: { id: `${step.id}-condition`, fn: label },
      loopType: 'dowhile',
      ...(predicate ? { predicate } : {}),
    });
    this.steps[step.id] = step as any;
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      TSchemaOut,
      TRequestContext
    >;
  }

  dountil<TStepState, TStepInputSchema extends TPrevSchema, TStepId extends string, TSchemaOut, TStepRC>(
    step: Step<
      TStepId,
      SubsetOf<TStepState, TState>,
      TStepInputSchema,
      TSchemaOut,
      any,
      any,
      TEngineType,
      // Allow steps that don't declare a requestContextSchema (TStepRC=unknown) or that
      // declare one matching the workflow's TRequestContext. Mismatched schemas error.
      unknown extends TStepRC ? unknown : TRequestContext
    >,
    condition: LoopConditionFunction<TState, TSchemaOut, any, any, any, TEngineType> | { predicate: Predicate },
    options?: StepFlowEntryOptions,
  ) {
    const entryOptionFields = toEntryOptionFields(options);
    const isDeclarative = isDeclarativePredicateArg(condition);
    const predicate = isDeclarative ? (condition as { predicate: Predicate }).predicate : undefined;
    const runtimeCondition = isDeclarative
      ? (predicateToCondition(predicate!) as LoopConditionFunction<TState, TSchemaOut, any, any, any, TEngineType>)
      : (condition as LoopConditionFunction<TState, TSchemaOut, any, any, any, TEngineType>);
    const label = predicate ? derivePredicateLabel(predicate) : runtimeCondition.toString();
    this.stepFlow.push({
      type: 'loop',
      ...entryOptionFields,
      step: toSingleStepEntry(step),
      condition: runtimeCondition,
      loopType: 'dountil',
      serializedCondition: { id: `${step.id}-condition`, fn: label },
      ...(predicate ? { predicate } : {}),
    } as StepFlowEntry<TEngineType>);
    this.serializedStepFlow.push({
      type: 'loop',
      ...entryOptionFields,
      step: toSerializedSingleStepEntry(step as StepWithRefMetadata),
      serializedCondition: { id: `${step.id}-condition`, fn: label },
      loopType: 'dountil',
      ...(predicate ? { predicate } : {}),
    });
    this.steps[step.id] = step as any;
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      TSchemaOut,
      TRequestContext
    >;
  }

  foreach<
    TPrevIsArray extends (TPrevSchema extends any[] ? true : false),
    TStepState,
    TStepInputSchema extends (TPrevSchema extends (infer TElement)[] ? TElement : never),
    TStepId extends string,
    TSchemaOut,
    TStepRC,
  >(
    step: TPrevIsArray extends true
      ? Step<
          TStepId,
          SubsetOf<TStepState, TState>,
          TStepInputSchema,
          TSchemaOut,
          any,
          any,
          TEngineType,
          // Allow steps that don't declare a requestContextSchema (TStepRC=unknown) or that
          // declare one matching the workflow's TRequestContext. Mismatched schemas error.
          unknown extends TStepRC ? unknown : TRequestContext
        >
      : 'Previous step must return an array type',
    opts?: Partial<ForeachOptions> & StepFlowEntryOptions,
  ) {
    const concurrency = opts?.concurrency ?? 1;
    const serializedOpts = typeof concurrency === 'function' ? { fn: concurrency.toString() } : { concurrency };
    const entryOptionFields = toEntryOptionFields(opts);
    const foreachStep = step as StepWithRefMetadata;
    this.stepFlow.push({
      type: 'foreach',
      ...entryOptionFields,
      step: toSingleStepEntry(foreachStep),
      // Keep the caller's options object BY REFERENCE when it carries a
      // concurrency: the agentic execution workflow mutates `concurrency` on it
      // between build and execution (see createAgenticExecutionWorkflow's
      // map-tool-calls step), and snapshotting would freeze tool-call
      // parallelism at its conservative initial value. `.foreach(step, { id })`
      // has no concurrency to mutate, so give that live entry the engine
      // default instead of an opts object that lies about the type.
      opts: opts?.concurrency === undefined ? { ...opts, concurrency: 1 } : (opts as ForeachOptions),
    });
    this.serializedStepFlow.push({
      type: 'foreach',
      ...entryOptionFields,
      step: toSerializedSingleStepEntry(foreachStep),
      opts: serializedOpts,
    });
    this.steps[foreachStep.id] = foreachStep;
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      TSchemaOut[],
      TRequestContext
    >;
  }

  /**
   * Builds the execution graph for this workflow
   * @returns The execution graph that can be used to execute the workflow
   */
  buildExecutionGraph(): ExecutionGraph {
    return {
      id: this.id,
      steps: this.stepFlow,
    };
  }

  /**
   * Finalizes the workflow definition and prepares it for execution
   * This method should be called after all steps have been added to the workflow
   * @returns A built workflow instance ready for execution
   */
  commit() {
    this.executionGraph = this.buildExecutionGraph();
    this.committed = true;
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      TOutput,
      TRequestContext
    >;
  }

  get stepGraph() {
    return this.stepFlow;
  }

  get serializedStepGraph() {
    return this.serializedStepFlow;
  }

  /**
   * Creates a new workflow run instance and stores a snapshot of the workflow in the storage
   * @param options Optional configuration for the run
   * @param options.runId Optional custom run ID, defaults to a random UUID
   * @param options.resourceId Optional resource ID to associate with this run
   * @param options.disableScorers Optional flag to disable scorers for this run
   * @returns A Run instance that can be used to execute the workflow
   */
  async createRun(options?: {
    runId?: string;
    resourceId?: string;
    disableScorers?: boolean;
    /** Optional pubsub instance for streaming events. If not provided, a new EventEmitterPubSub is created. */
    pubsub?: PubSub;
    /**
     * Overrides the workflow-wide `shouldPersistSnapshot` option for this run only.
     * Used for transient runs that must never touch storage even when the workflow
     * persists normally (e.g. per-chunk agent output-processor runs, #19605).
     */
    shouldPersistSnapshot?: WorkflowOptions['shouldPersistSnapshot'];
    /** Overrides the workflow-wide tracing policy for this run only. */
    tracingPolicy?: TracingPolicy;
  }): Promise<Run<TEngineType, TSteps, TState, TInput, TOutput, TRequestContext>> {
    if (this.stepFlow.length === 0) {
      throw new Error(
        'Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.',
      );
    }
    if (!this.executionGraph.steps) {
      throw new Error('Uncommitted step flow changes detected. Call .commit() to register the steps.');
    }
    const runIdToUse =
      options?.runId ||
      this.#mastra?.generateId({
        idType: 'run',
        source: 'workflow',
        entityId: this.id,
        resourceId: options?.resourceId,
      }) ||
      randomUUID();

    // Return a new Run instance with object parameters
    const run =
      this.#runs.get(runIdToUse) ??
      new Run({
        workflowId: this.id,
        stateSchema: this.stateSchema,
        inputSchema: this.inputSchema,
        requestContextSchema: this.requestContextSchema,
        runId: runIdToUse,
        resourceId: options?.resourceId,
        isInternalWorkflow: this.isInternal,
        executionEngine: this.executionEngine,
        executionGraph: this.executionGraph,
        mastra: this.#mastra,
        retryConfig: this.retryConfig,
        serializedStepGraph: this.serializedStepGraph,
        disableScorers: options?.disableScorers,
        cleanup: () => {
          this.#runs.delete(runIdToUse);
          this.executionEngine.clearRunPersistenceOverride(runIdToUse);
        },
        tracingPolicy: options?.tracingPolicy ?? this.#options?.tracingPolicy,
        workflowSteps: this.steps,
        validateInputs: this.#options?.validateInputs,
        workflowEngineType: this.engineType,
        pubsub: options?.pubsub,
      });

    this.#runs.set(runIdToUse, run);

    if (options?.shouldPersistSnapshot) {
      this.executionEngine.setRunPersistenceOverride(runIdToUse, options.shouldPersistSnapshot);
    }

    const shouldPersistSnapshot = (options?.shouldPersistSnapshot ?? this.#options.shouldPersistSnapshot)({
      workflowStatus: run.workflowRunStatus,
      stepResults: {},
    });

    // A freshly-minted run for a workflow that never persists a snapshot (e.g. the
    // transient processor workflows from #17344) cannot have a stored row, so this
    // existence read would be a guaranteed miss. Skipping it removes one storage
    // round trip per streamed chunk on the agent output-processor hot path (#19015).
    const existingRun =
      shouldPersistSnapshot || options?.runId
        ? await this.getWorkflowRunById(runIdToUse, { withNestedWorkflows: false })
        : undefined;

    // Check if run exists in persistent storage (not just in-memory)
    const existsInStorage = existingRun && !existingRun.isFromInMemory;

    // If a run exists in storage, update the run's status to reflect the actual state
    // This fixes the issue where createRun checks storage but doesn't use the stored data
    if (existsInStorage && existingRun.status) {
      run.workflowRunStatus = existingRun.status as WorkflowRunStatus;
    }

    if (!existsInStorage && shouldPersistSnapshot) {
      const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
      const initialSnapshot: WorkflowRunState = {
        runId: runIdToUse,
        status: 'pending',
        value: {},
        // @ts-expect-error - context type mismatch
        context: this.#nestedWorkflowInput ? { input: this.#nestedWorkflowInput } : {},
        activePaths: [],
        activeStepsPath: {},
        serializedStepGraph: this.serializedStepGraph,
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        result: undefined,
        error: undefined,
        timestamp: Date.now(),
      };
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: this.id,
        runId: runIdToUse,
        resourceId: options?.resourceId,
        snapshot: this.#options.pruneSnapshot
          ? this.#options.pruneSnapshot({ snapshot: initialSnapshot, workflowStatus: 'pending' })
          : initialSnapshot,
      });
    }

    return run;
  }

  async listScorers({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): Promise<MastraScorers> {
    const steps = this.steps;

    if (!steps || Object.keys(steps).length === 0) {
      return {};
    }

    const scorers: MastraScorers = {};

    for (const step of Object.values(steps)) {
      if (step.scorers) {
        let scorersToUse = step.scorers;

        if (typeof scorersToUse === 'function') {
          scorersToUse = await scorersToUse({ requestContext });
        }

        for (const [id, scorer] of Object.entries(scorersToUse)) {
          scorers[id] = scorer;
        }
      }
    }

    return scorers;
  }

  // This method should only be called internally for nested workflow execution, as well as from mastra server handlers
  // To run a workflow use `.createRun` and then `.start` or `.resume`
  async execute({
    runId,
    resourceId,
    inputData,
    resumeData,
    state,
    setState,
    suspend,
    restart,
    resume,
    timeTravel,
    [PUBSUB_SYMBOL]: pubsub,
    mastra,
    requestContext,
    abort,
    abortSignal,
    retryCount,
    outputWriter,
    validateInputs,
    perStep,
    actor,
    engine: _engine,
    bail: _bail,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    inputData: TInput;
    resumeData?: unknown;
    state: TState;
    setState: (state: TState) => Promise<void>;
    suspend: (suspendPayload: any, suspendOptions?: SuspendOptions) => InnerOutput | Promise<InnerOutput>;
    restart?: boolean;
    timeTravel?: {
      inputData?: TInput;
      steps: string[];
      nestedStepResults?: Record<string, Record<string, StepResult<any, any, any, any>>>;
      resumeData?: any;
    };
    resume?: {
      steps: string[];
      resumePayload: any;
      runId?: string;
      label?: string;
      forEachIndex?: number;
    };
    [PUBSUB_SYMBOL]: PubSub;
    mastra: Mastra;
    requestContext?: RequestContext<TRequestContext>;
    engine: DefaultEngineType;
    abortSignal: AbortSignal;
    bail: (result: any) => any;
    abort: () => any;
    retryCount?: number;
    outputWriter?: OutputWriter;
    validateInputs?: boolean;
    perStep?: boolean;
    actor?: ActorSignal;
  } & Partial<ObservabilityContext>): Promise<TOutput | undefined> {
    const observabilityContext = resolveObservabilityContext(rest);
    this.__registerMastra(mastra);

    // FGA authorization check
    const fgaProvider = mastra?.getServer()?.fga;
    if (fgaProvider) {
      const user = requestContext?.get('user' as any);
      await requireFGA({
        fgaProvider,
        user,
        resource: { type: 'workflow', id: getWorkflowFGAResourceId(this.id) },
        permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
        requestContext,
        actor,
        context: {
          resourceId,
        },
        metadata: {
          workflowId: this.id,
          runId,
          resourceId,
        },
      });
    }

    const effectiveValidateInputs = validateInputs ?? this.#options.validateInputs ?? true;

    this.#options = {
      ...(this.#options || {}),
      validateInputs: effectiveValidateInputs,
    };

    this.executionEngine.options = {
      ...(this.executionEngine.options || {}),
      validateInputs: effectiveValidateInputs,
    };

    const isResume =
      !!(resume?.steps && resume.steps.length > 0) ||
      !!resume?.label ||
      !!(resume?.steps && resume.steps.length === 0 && (!retryCount || retryCount === 0));
    // this check is for cases where you suspend/resume a nested workflow.
    // retryCount helps us know the step has been run at least once, which means it's running in a loop and should not be calling resume.

    if (!restart && !isResume) {
      this.#nestedWorkflowInput = inputData;
    }

    const isTimeTravel = !!(timeTravel && timeTravel.steps.length > 0);

    // Forward the parent run's resourceId into the nested run so that
    // child workflow snapshots preserve the tenant/resource association.
    // When sharePubsub is enabled (e.g. durable agent workflows), pass the parent
    // pubsub so inner step events are visible to the outer subscriber.
    // Skip the watch relay in that case — events are already on the shared pubsub
    // and relaying with the same runId would cause an infinite event loop.
    const useSharedPubsub = !!this.#options?.sharePubsub;
    const nestedPubsub = useSharedPubsub ? pubsub : undefined;
    const run = isResume
      ? await this.createRun({ runId: resume.runId, resourceId, pubsub: nestedPubsub })
      : await this.createRun({ runId, resourceId, pubsub: nestedPubsub });
    const nestedAbortCb = () => {
      abort();
    };
    const parentAbortCb = async () => {
      run.abortController.signal.removeEventListener('abort', nestedAbortCb);
      await run.cancel();
    };
    run.abortController.signal.addEventListener('abort', nestedAbortCb);
    abortSignal.addEventListener('abort', parentAbortCb);

    const unwatch = useSharedPubsub
      ? () => {}
      : run.watch(event => {
          void pubsub.publish('nested-watch', {
            type: 'nested-watch',
            runId: run.runId,
            data: { event, workflowId: this.id },
          });
        });

    if (retryCount && retryCount > 0 && isResume && requestContext) {
      (requestContext as RequestContext).set('__mastraWorflowInputData', inputData);
    }

    let res: WorkflowResult<TState, TInput, TOutput, TSteps>;

    try {
      if (isTimeTravel) {
        res = await run.timeTravel({
          inputData: timeTravel?.inputData,
          resumeData: timeTravel?.resumeData,
          initialState: state,
          step: timeTravel?.steps,
          context: (timeTravel?.nestedStepResults?.[this.id] ?? {}) as any,
          nestedStepsContext: timeTravel?.nestedStepResults as any,
          requestContext,
          actor,
          ...observabilityContext,
          outputWriter,
          outputOptions: { includeState: true, includeResumeLabels: true },
          perStep,
        });
      } else if (restart) {
        res = await run.restart({ requestContext, actor, ...observabilityContext, outputWriter });
      } else if (isResume) {
        res = await run.resume({
          resumeData,
          step: resume.steps?.length > 0 ? (resume.steps as any) : undefined,
          requestContext,
          actor,
          ...observabilityContext,
          outputWriter,
          outputOptions: { includeState: true, includeResumeLabels: true },
          label: resume.label,
          perStep,
        });
      } else {
        res = await run.start({
          inputData,
          requestContext,
          actor,
          ...observabilityContext,
          outputWriter,
          initialState: state,
          outputOptions: { includeState: true, includeResumeLabels: true },
          perStep,
        } as any);
      }
    } finally {
      run.abortController.signal.removeEventListener('abort', nestedAbortCb);
      abortSignal.removeEventListener('abort', parentAbortCb);
      unwatch();
    }

    const suspendedSteps = Object.entries(res.steps).filter(([_stepName, stepResult]) => {
      const stepRes: StepResult<any, any, any, any> = stepResult as StepResult<any, any, any, any>;
      return stepRes?.status === 'suspended';
    });

    if (res.state) {
      await setState(res.state);
    }

    if (suspendedSteps?.length) {
      for (const [stepName, stepResult] of suspendedSteps) {
        // @ts-expect-error - context type mismatch
        const suspendPath: string[] = [stepName, ...(stepResult?.suspendPayload?.__workflow_meta?.path ?? [])];
        const nestedMeta = (stepResult as any)?.suspendPayload?.__workflow_meta ?? {};
        // Keep the nested workflow metadata (foreachIndex, foreachOutput, resumeLabels) when
        // propagating a suspension to the parent — mirrors the evented engine — so the parent
        // snapshot is self-describing about EVERY parked iteration, not just the first one.
        // Only runId and path change as we propagate up. Per-iteration `__streamState` blobs
        // are stripped from the propagated copies: they can be large and resume reads them
        // from the nested run's own snapshot, so the parent only needs the identifying fields.
        const propagatedForeachOutput = Array.isArray(nestedMeta.foreachOutput)
          ? nestedMeta.foreachOutput.map((entry: any) => {
              if (entry?.status !== 'suspended' || !entry.suspendPayload) return entry;
              const { __streamState: _streamState, ...suspendPayload } = entry.suspendPayload;
              return { ...entry, suspendPayload };
            })
          : undefined;
        await suspend(
          {
            ...(stepResult as any)?.suspendPayload,
            __workflow_meta: {
              ...nestedMeta,
              ...(propagatedForeachOutput ? { foreachOutput: propagatedForeachOutput } : {}),
              runId: run.runId,
              path: suspendPath,
            },
          },
          {
            resumeLabel: Object.keys(res.resumeLabels ?? {}),
          },
        );
      }
    }

    if (res.status === 'failed') {
      const isNonRetryable = Object.values(res.steps).some(stepResult => {
        const result = stepResult as StepResult<any, any, any, any>;
        return result.status === 'failed' && result.nonRetryable;
      });
      if (isNonRetryable) {
        throw new MastraNonRetryableError(res.error.message, { cause: res.error });
      }
      throw res.error;
    }

    if (res.status === 'tripwire') {
      const tripwire = res.tripwire;
      throw new TripWire(
        tripwire?.reason || 'Processor tripwire triggered',
        {
          retry: tripwire?.retry,
          metadata: tripwire?.metadata,
        },
        tripwire?.processorId,
      );
    }

    return res.status === 'success' ? res.result : undefined;
  }

  async listWorkflowRuns(args?: StorageListWorkflowRunsInput) {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow runs. Mastra storage is not initialized');
      return { runs: [], total: 0 };
    }

    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) {
      this.logger.debug('Cannot get workflow runs. Workflows storage domain is not available');
      return { runs: [], total: 0 };
    }

    return workflowsStore.listWorkflowRuns({ workflowName: this.id, ...(args ?? {}) });
  }

  public async listActiveWorkflowRuns() {
    const [runningRuns, waitingRuns] = await Promise.all([
      this.listWorkflowRuns({ status: 'running' }),
      this.listWorkflowRuns({ status: 'waiting' }),
    ]);

    return {
      runs: [...runningRuns.runs, ...waitingRuns.runs],
      total: runningRuns.total + waitingRuns.total,
    };
  }

  public async restartAllActiveWorkflowRuns(): Promise<void> {
    if (this.engineType !== 'default') {
      this.logger.debug('Cannot restart active workflow runs for engine type', { engineType: this.engineType });
      return;
    }
    const activeRuns = await this.listActiveWorkflowRuns();
    if (activeRuns.runs.length > 0) {
      this.logger.debug('Restarting active workflow runs', { count: activeRuns.runs.length });
    }
    for (const runSnapshot of activeRuns.runs) {
      try {
        const run = await this.createRun({ runId: runSnapshot.runId });
        await run.restart();
        this.logger.debug('Restarted workflow run', { workflowId: this.id, runId: runSnapshot.runId });
      } catch (error) {
        this.logger.error('Failed to restart workflow run', { workflowId: this.id, runId: runSnapshot.runId, error });
      }
    }
  }

  async deleteWorkflowRunById(runId: string) {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot delete workflow run by ID. Mastra storage is not initialized');
      return;
    }

    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) {
      this.logger.debug('Cannot delete workflow run. Workflows storage domain is not available');
      return;
    }

    await workflowsStore.deleteWorkflowRunById({ runId, workflowName: this.id });
    // deleting the run from the in memory runs
    this.#runs.delete(runId);
  }

  protected async getWorkflowRunSteps({ runId, workflowId }: { runId: string; workflowId: string }) {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow run steps. Mastra storage is not initialized');
      return {};
    }

    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) {
      this.logger.debug('Cannot get workflow run steps. Workflows storage domain is not available');
      return {};
    }

    const run = await workflowsStore.getWorkflowRunById({ runId, workflowName: workflowId });

    let snapshot: WorkflowRunState | string = run?.snapshot!;

    if (!snapshot) {
      return {};
    }

    if (typeof snapshot === 'string') {
      // this occurs whenever the parsing of snapshot fails in storage
      try {
        snapshot = JSON.parse(snapshot);
      } catch (e) {
        this.logger.debug('Cannot get workflow run execution result. Snapshot is not a valid JSON string', {
          error: e,
        });
        return {};
      }
    }

    const { serializedStepGraph, context } = snapshot as WorkflowRunState;
    const { input, ...steps } = context;

    let finalSteps = {} as Record<string, StepResult<any, any, any, any>>;

    for (const step of Object.keys(steps)) {
      const stepGraph = findStepInGraph(serializedStepGraph, step);
      finalSteps[step] = steps[step] as StepResult<any, any, any, any>;
      const nestedWorkflowEntry =
        stepGraph?.type === 'workflow'
          ? stepGraph
          : (stepGraph as any)?.step?.type === 'workflow'
            ? (stepGraph as any).step
            : (stepGraph as any)?.step?.component === 'WORKFLOW'
              ? { workflowId: step }
              : undefined;
      if (nestedWorkflowEntry) {
        const nestedWorkflowId = nestedWorkflowEntry.workflowId as string;
        const stepResult = steps[step] as any;
        const nestedRunIdMetadata = stepResult?.metadata?.nestedRunId;
        const invocationResults = Array.isArray(stepResult) ? stepResult : undefined;
        const nestedRunIds = Array.isArray(nestedRunIdMetadata)
          ? nestedRunIdMetadata
          : invocationResults
            ? invocationResults.map(result => result?.metadata?.nestedRunId)
            : [nestedRunIdMetadata ?? runId];
        const useIndexedPaths = Array.isArray(nestedRunIdMetadata) || !!invocationResults;
        const updatedNestedSteps = {} as Record<string, StepResult<any, any, any, any>>;

        for (const [index, nestedRunId] of nestedRunIds.entries()) {
          if (typeof nestedRunId !== 'string') continue;

          const nestedSteps = await this.getWorkflowRunSteps({ runId: nestedRunId, workflowId: nestedWorkflowId });
          for (const [key, value] of Object.entries(nestedSteps)) {
            const prefix = useIndexedPaths ? `${step}[${index}]` : step;
            updatedNestedSteps[`${prefix}.${key}`] = value as StepResult<any, any, any, any>;
          }
        }

        finalSteps = { ...finalSteps, ...updatedNestedSteps };

        // Nested suspend is recorded on both the container and the flattened leaf.
        // Demote the container in the public steps map so clients (e.g. Studio)
        // that treat every status==='suspended' entry as a resume target only
        // see the leaf. Keep the container entry for hierarchy; leave suspendedPaths alone.
        const parentStep = finalSteps[step];
        if (parentStep?.status === 'suspended') {
          const hasSuspendedChild = Object.values(updatedNestedSteps).some(child => child?.status === 'suspended');
          if (hasSuspendedChild) {
            finalSteps[step] = { ...parentStep, status: 'running' };
          }
        }
      }
    }

    return finalSteps;
  }

  /**
   * Converts an in-memory Run to a WorkflowState for API responses.
   * Used as a fallback when storage is not available.
   *
   * Limitations of in-memory fallback:
   * - createdAt/updatedAt are set to current time (approximate values)
   * - steps is empty {} because in-memory Run objects don't maintain step results
   *   in the WorkflowState format - step data is only available from persisted snapshots
   *
   * The returned object includes `isFromInMemory: true` so callers can distinguish
   * between persisted and in-memory runs.
   */
  #getInMemoryRunAsWorkflowState(runId: string): WorkflowState | null {
    const inMemoryRun = this.#runs.get(runId);
    if (!inMemoryRun) return null;

    // Explicitly construct WorkflowState to avoid leaking internal Run properties
    // Fields like result, payload, error are not available from in-memory runs (only from persisted snapshots)
    return {
      runId,
      workflowName: this.id,
      resourceId: inMemoryRun.resourceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      isFromInMemory: true,
      status: inMemoryRun.workflowRunStatus,
      steps: {},
    };
  }

  /**
   * Get a workflow run by ID with processed execution state and metadata.
   *
   * @param runId - The unique identifier of the workflow run
   * @param options - Configuration options for the result
   * @param options.withNestedWorkflows - Whether to include nested workflow steps (default: true)
   * @param options.fields - Specific fields to return (for performance optimization)
   * @returns The workflow run result with metadata and processed execution state, or null if not found
   */
  async getWorkflowRunById(
    runId: string,
    options: {
      withNestedWorkflows?: boolean;
      fields?: WorkflowStateField[];
    } = {},
  ): Promise<WorkflowState | null> {
    const { withNestedWorkflows = true, fields } = options;

    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow run. Mastra storage is not initialized');
      return this.#getInMemoryRunAsWorkflowState(runId);
    }

    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) {
      this.logger.debug('Cannot get workflow run. Workflows storage domain is not available');
      return this.#getInMemoryRunAsWorkflowState(runId);
    }

    const run = await workflowsStore.getWorkflowRunById({ runId, workflowName: this.id });
    if (!run) {
      return this.#getInMemoryRunAsWorkflowState(runId);
    }

    // Parse snapshot if it's a string
    let snapshot: WorkflowRunState | string = run.snapshot;
    if (typeof snapshot === 'string') {
      try {
        snapshot = JSON.parse(snapshot);
      } catch (e) {
        this.logger.debug('Cannot parse workflow run snapshot. Snapshot is not valid JSON', { error: e });
        return null;
      }
    }

    const snapshotState = snapshot as WorkflowRunState;

    // Build the result based on requested fields
    const includeAllFields = !fields || fields.length === 0;
    const fieldsSet = new Set(fields ?? []);

    // Get steps if needed
    let steps: Record<string, any> = {};
    if (includeAllFields || fieldsSet.has('steps')) {
      let rawSteps: Record<string, any>;
      if (withNestedWorkflows) {
        rawSteps = await this.getWorkflowRunSteps({ runId, workflowId: this.id });
      } else {
        const { input, ...stepsOnly } = snapshotState.context || {};
        rawSteps = stepsOnly;
      }
      // Strip __state from steps (internal implementation detail for state propagation).
      // The evented runtime adds __state to step results for cross-step state passing.
      const { __state: _removedTopLevelState, ...stepsWithoutTopLevelState } = rawSteps;
      // Clean each step result to remove internal properties (__state, metadata.nestedRunId)
      // that are implementation details not meant for API consumers.
      // Handles both object and array step results (e.g., forEach outputs).
      for (const [stepId, stepResult] of Object.entries(stepsWithoutTopLevelState)) {
        steps[stepId] = cleanStepResult(stepResult);
      }
    }

    const result: WorkflowState = {
      // Metadata - always include these core fields
      runId: run.runId,
      workflowName: run.workflowName,
      resourceId: run.resourceId,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,

      // Execution state
      status: snapshotState.status,
      initialState: Object.keys(snapshotState.value).length > 0 ? snapshotState.value : undefined,
      result: includeAllFields || fieldsSet.has('result') ? snapshotState.result : undefined,
      error: includeAllFields || fieldsSet.has('error') ? snapshotState.error : undefined,
      payload: includeAllFields || fieldsSet.has('payload') ? snapshotState.context?.input : undefined,
      steps,

      // Optional detailed fields
      activeStepsPath: includeAllFields || fieldsSet.has('activeStepsPath') ? snapshotState.activeStepsPath : undefined,
      serializedStepGraph:
        includeAllFields || fieldsSet.has('serializedStepGraph') ? snapshotState.serializedStepGraph : undefined,
      suspendedPaths: includeAllFields || fieldsSet.has('suspendedPaths') ? snapshotState.suspendedPaths : undefined,
      resumeLabels: includeAllFields || fieldsSet.has('resumeLabels') ? snapshotState.resumeLabels : undefined,
      waitingPaths: includeAllFields || fieldsSet.has('waitingPaths') ? snapshotState.waitingPaths : undefined,
      ...(fieldsSet.has('requestContext') ? { requestContext: snapshotState.requestContext } : {}),
      ...(fieldsSet.has('tracingContext') ? { tracingContext: snapshotState.tracingContext } : {}),
    };

    // Clean up undefined/empty values if field filtering is active
    if (fields && fields.length > 0) {
      if (result.initialState === undefined) delete result.initialState;
      if (result.result === undefined) delete result.result;
      if (result.error === undefined) delete result.error;
      if (result.payload === undefined) delete result.payload;
      if (!fieldsSet.has('steps')) delete result.steps;
      if (result.activeStepsPath === undefined) delete result.activeStepsPath;
      if (result.serializedStepGraph === undefined) delete result.serializedStepGraph;
      if (result.suspendedPaths === undefined) delete result.suspendedPaths;
      if (result.resumeLabels === undefined) delete result.resumeLabels;
      if (result.waitingPaths === undefined) delete result.waitingPaths;
      if (result.requestContext === undefined) delete result.requestContext;
      if (result.tracingContext === undefined) delete result.tracingContext;
    }

    return result;
  }
}

/**
 * Represents a workflow run that can be executed
 */

export class Run<
  TEngineType = DefaultEngineType,
  TSteps extends Step<string, any, any, any, any, any, TEngineType, any>[] = Step<
    string,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    TEngineType
  >[],
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TRequestContext extends Record<string, any> | unknown = unknown,
> {
  #abortController?: AbortController;
  protected workflowRunSpan?: Span<SpanType.WORKFLOW_RUN>;
  protected pubsub: PubSub;
  /**
   * Unique identifier for this workflow
   */
  readonly workflowId: string;

  /**
   * Unique identifier for this run
   */
  readonly runId: string;

  /**
   * Unique identifier for the resource this run is associated with
   */
  readonly resourceId?: string;

  readonly isInternalWorkflow: boolean;

  /**
   * Whether to disable scorers for this run
   */
  readonly disableScorers?: boolean;

  /**
   * Options around how to trace this run
   */
  readonly tracingPolicy?: TracingPolicy;

  /**
   * Options around how to trace this run
   */
  readonly validateInputs?: boolean;

  /**
   * Internal state of the workflow run
   */
  protected state: Record<string, any> = {};

  /**
   * The execution engine for this run
   */
  public executionEngine: ExecutionEngine;

  /**
   * The execution graph for this run
   */
  public executionGraph: ExecutionGraph;

  /**
   * The serialized step graph for this run
   */
  public serializedStepGraph: SerializedStepFlowEntry[];

  /**
   * The steps for this workflow
   */

  readonly workflowSteps: Record<string, StepWithComponent>;

  workflowRunStatus: WorkflowRunStatus;

  readonly workflowEngineType: WorkflowEngineType;

  /**
   * The storage for this run
   */
  #mastra?: Mastra;

  #observerHandlers: (() => void)[] = [];

  get mastra() {
    return this.#mastra;
  }

  streamOutput?: WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>;
  protected closeStreamAction?: () => Promise<void>;
  protected executionResults?: Promise<WorkflowResult<TState, TInput, TOutput, TSteps>>;
  protected stateSchema?: StandardSchemaWithJSON<TState>;
  protected inputSchema?: StandardSchemaWithJSON<TInput>;
  protected requestContextSchema?: StandardSchemaWithJSON<any>;

  protected cleanup?: () => void;

  protected retryConfig?: {
    attempts?: number;
    delay?: number;
  };

  constructor(params: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    isInternalWorkflow?: boolean;
    stateSchema?: StandardSchemaWithJSON<TState>;
    inputSchema?: StandardSchemaWithJSON<TInput>;
    requestContextSchema?: StandardSchemaWithJSON<any>;
    executionEngine: ExecutionEngine;
    executionGraph: ExecutionGraph;
    mastra?: Mastra;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    cleanup?: () => void;
    serializedStepGraph: SerializedStepFlowEntry[];
    disableScorers?: boolean;
    tracingPolicy?: TracingPolicy;
    workflowSteps: Record<string, StepWithComponent>;
    validateInputs?: boolean;
    workflowEngineType: WorkflowEngineType;
    /** Optional pubsub instance. If not provided, a new EventEmitterPubSub is created. */
    pubsub?: PubSub;
  }) {
    this.workflowId = params.workflowId;
    this.runId = params.runId;
    this.resourceId = params.resourceId;
    this.isInternalWorkflow = params.isInternalWorkflow ?? false;
    this.serializedStepGraph = params.serializedStepGraph;
    this.executionEngine = params.executionEngine;
    this.executionGraph = params.executionGraph;
    this.#mastra = params.mastra;
    this.pubsub = params.pubsub ?? new EventEmitterPubSub();
    this.retryConfig = params.retryConfig;
    this.cleanup = params.cleanup;
    this.disableScorers = params.disableScorers;
    this.tracingPolicy = params.tracingPolicy;
    this.workflowSteps = params.workflowSteps;
    this.validateInputs = params.validateInputs;
    this.stateSchema = params.stateSchema;
    this.inputSchema = params.inputSchema;
    this.requestContextSchema = params.requestContextSchema;
    this.workflowRunStatus = 'pending';
    this.workflowEngineType = params.workflowEngineType;
  }

  public get abortController(): AbortController {
    if (!this.#abortController) {
      this.#abortController = new AbortController();
    }

    return this.#abortController;
  }

  /**
   * Cancels the workflow execution.
   * This aborts any running execution and updates the workflow status to 'canceled' in storage.
   */
  async cancel() {
    // Abort any running execution and update in-memory status
    this.abortController.abort();
    this.workflowRunStatus = 'canceled';

    // End the whole span tree now: a step that ignores abortSignal keeps running, so the
    // execution engine may never unwind and no span in the tree would otherwise be ended.
    this.workflowRunSpan?.endTree({ attributes: { status: 'canceled' } });

    // Update workflow status in storage to 'canceled'
    // This is necessary for suspended/waiting workflows where the abort signal won't be checked
    try {
      const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
      await workflowsStore?.updateWorkflowState({
        workflowName: this.workflowId,
        runId: this.runId,
        opts: {
          status: 'canceled',
        },
      });
    } catch {
      // Storage errors should not prevent cancellation from succeeding
      // The abort signal and in-memory status are already updated
    }
  }

  async #validateSchema<TInput>(schema: StandardSchemaWithJSON<TInput>, data: TInput, type: string) {
    const validatedInputData = await schema['~standard'].validate(data);

    if (validatedInputData.issues) {
      throw new MastraError({
        category: ErrorCategory.USER,
        domain: ErrorDomain.MASTRA_WORKFLOW,
        id: 'WORKFLOW_SCHEMA_VALIDATION_FAILED',
        text:
          `Invalid ${type}: \n` + validatedInputData.issues.map(e => `- ${e.path?.join('.')}: ${e.message}`).join('\n'),
        details: { type },
      });
    }

    return validatedInputData.value;
  }

  protected async _validateInput(inputData?: TInput) {
    if (!this.validateInputs || !this.inputSchema) {
      return inputData;
    }

    return this.#validateSchema(this.inputSchema, inputData, 'input data');
  }

  protected async _validateInitialState(initialState?: TState) {
    if (!this.validateInputs || !this.stateSchema) {
      return initialState;
    }

    return this.#validateSchema(this.stateSchema, initialState, 'initial data');
  }

  protected async _validateRequestContext(requestContext?: RequestContext) {
    if (this.validateInputs && this.requestContextSchema) {
      const contextValues = getRequestContextInputValues(requestContext);
      const validation = this.requestContextSchema['~standard'].validate(contextValues);

      if (validation instanceof Promise) {
        throw new Error('Your schema is async, which is not supported. Please use a sync schema.');
      }

      if (!('value' in validation)) {
        const errors = validation.issues;
        throw new Error(
          `Request context validation failed for workflow '${this.workflowId}': \n` +
            errors
              .map(e => {
                const pathStr = e.path?.map(p => (typeof p === 'object' ? p.key : p)).join('.');
                return `- ${pathStr}: ${e.message}`;
              })
              .join('\n'),
        );
      }
    }
  }

  protected async _validateResumeData<TResume>(resumeData: TResume, suspendedStep?: StepWithComponent) {
    if (!this.validateInputs || !suspendedStep?.resumeSchema) {
      return resumeData;
    }

    return this.#validateSchema(suspendedStep.resumeSchema, resumeData, 'resume data');
  }

  protected async _validateTimetravelInputData<TInput>(
    inputData: TInput,
    step: Step<string, any, TInput, any, any, any, TEngineType, any>,
  ) {
    if (!this.validateInputs || !step?.inputSchema) {
      return inputData;
    }

    return this.#validateSchema(step.inputSchema, inputData, 'inputData');
  }

  protected async _start({
    inputData,
    initialState,
    requestContext,
    outputWriter,
    tracingOptions,
    format,
    outputOptions,
    perStep,
    actor,
    ...rest
  }: (TInput extends unknown
    ? {
        inputData?: TInput;
      }
    : {
        inputData: TInput;
      }) &
    (TState extends unknown
      ? {
          initialState?: TState;
        }
      : {
          initialState: TState;
        }) & {
      requestContext?: RequestContext<TRequestContext>;
      outputWriter?: OutputWriter;
      tracingOptions?: TracingOptions;
      format?: 'legacy' | 'vnext' | undefined;
      outputOptions?: {
        includeState?: boolean;
        includeResumeLabels?: boolean;
      };
      perStep?: boolean;
      actor?: ActorSignal;
    } & Partial<ObservabilityContext>): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const observabilityContext = resolveObservabilityContext(rest);
    // note: this span is ended inside this.executionEngine.execute()
    const workflowSpan = getOrCreateSpan({
      type: SpanType.WORKFLOW_RUN,
      name: `workflow run: '${this.workflowId}'`,
      entityType: EntityType.WORKFLOW_RUN,
      entityId: this.workflowId,
      entityName: this.workflowId,
      input: inputData,
      metadata: {
        resourceId: this.resourceId,
        runId: this.runId,
      },
      tracingPolicy: this.tracingPolicy,
      tracingOptions,
      tracingContext: observabilityContext.tracingContext,
      requestContext: requestContext as RequestContext,
      mastra: this.#mastra,
    });

    this.workflowRunSpan = workflowSpan;
    const traceId = workflowSpan?.externalTraceId;
    const spanId = workflowSpan?.id;

    // execute() ends the span, so anything that rejects before we reach it has to end the
    // span itself or it stays open for the life of the trace. onStart makes that reachable
    // from user code, not just from a malformed input.
    const { inputDataToUse, initialStateToUse } = await (async () => {
      const validatedInput = await this._validateInput(inputData);
      const validatedState = await this._validateInitialState(initialState ?? ({} as TState));
      await this._validateRequestContext(requestContext as RequestContext);

      // Pre-flight gate: runs before the run executes, and rejects the caller if it throws.
      await this.executionEngine.invokeStartCallback({
        runId: this.runId,
        workflowId: this.workflowId,
        resourceId: this.resourceId,
        getInitData: () => validatedInput,
        requestContext: (requestContext ?? new RequestContext()) as RequestContext,
        state: validatedState as Record<string, any>,
      });

      return { inputDataToUse: validatedInput, initialStateToUse: validatedState };
    })().catch(error => {
      workflowSpan?.error({ error: error as Error });
      throw error;
    });

    const result = await this.executionEngine.execute<TState, TInput, WorkflowResult<TState, TInput, TOutput, TSteps>>({
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      disableScorers: this.disableScorers,
      graph: this.executionGraph,
      serializedStepGraph: this.serializedStepGraph,
      input: inputDataToUse,
      initialState: initialStateToUse,
      pubsub: this.pubsub,
      retryConfig: this.retryConfig,
      requestContext: (requestContext ?? new RequestContext()) as RequestContext,
      actor,
      abortController: this.abortController,
      outputWriter,
      workflowSpan,
      format,
      outputOptions,
      perStep,
    });

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    result.traceId = traceId;
    result.spanId = spanId;
    return result;
  }

  /**
   * Starts the workflow execution with the provided input
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async start(
    args: (TInput extends unknown
      ? {
          inputData?: TInput;
        }
      : {
          inputData: TInput;
        }) &
      (TState extends unknown
        ? {
            initialState?: TState;
          }
        : {
            initialState: TState;
          }) & {
        requestContext?: RequestContext<TRequestContext>;
      } & WorkflowRunStartOptions,
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._start(args);
  }

  /**
   * Starts the workflow execution without waiting for completion (fire-and-forget).
   * Returns immediately with the runId. The workflow executes in the background.
   * Use this when you don't need to wait for the result or want to avoid polling failures.
   * @param args The input data and configuration for the workflow
   * @returns A promise that resolves immediately with the runId
   */
  async startAsync(
    args: (TInput extends unknown
      ? {
          inputData?: TInput;
        }
      : {
          inputData: TInput;
        }) &
      (TState extends unknown
        ? {
            initialState?: TState;
          }
        : {
            initialState: TState;
          }) & {
        requestContext?: RequestContext<TRequestContext>;
      } & WorkflowRunStartOptions,
  ): Promise<{ runId: string }> {
    // Fire execution in background, don't await completion
    this._start(args).catch(err => {
      this.mastra?.getLogger()?.error(`[Workflow ${this.workflowId}] Background execution failed:`, err);
    });
    return { runId: this.runId };
  }

  /**
   * Starts the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  streamLegacy(
    {
      inputData,
      requestContext,
      onChunk,
      tracingOptions,
      actor,
      ...rest
    }: (TInput extends unknown
      ? {
          inputData?: TInput;
        }
      : {
          inputData: TInput;
        }) & {
      requestContext?: RequestContext<TRequestContext>;
      onChunk?: (chunk: StreamEvent) => Promise<unknown>;
      tracingOptions?: TracingOptions;
      actor?: ActorSignal;
    } & Partial<ObservabilityContext> = {} as (TInput extends unknown
      ? {
          inputData?: TInput;
        }
      : {
          inputData: TInput;
        }) & {
      requestContext?: RequestContext<TRequestContext>;
      onChunk?: (chunk: StreamEvent) => Promise<unknown>;
      tracingOptions?: TracingOptions;
      actor?: ActorSignal;
    } & Partial<ObservabilityContext>,
  ): {
    stream: ReadableStream<StreamEvent>;
    getWorkflowState: () => Promise<WorkflowResult<TState, TInput, TOutput, TSteps>>;
  } {
    const observabilityContext = resolveObservabilityContext(rest);
    if (this.closeStreamAction) {
      return {
        stream: this.observeStreamLegacy().stream,
        getWorkflowState: () => this.executionResults!,
      };
    }

    const { readable, writable } = new TransformStream<StreamEvent, StreamEvent>();

    const writer = writable.getWriter();
    const unwatch = this.watch(async event => {
      try {
        const e: any = {
          ...event,
          type: event.type.replace('workflow-', ''),
        };
        // watch events are data stream events, so we need to cast them to the correct type
        await writer.write(e as any);
        if (onChunk) {
          await onChunk(e as any);
        }
      } catch {}
    });

    const closeStreamAction = async () => {
      await this.pubsub.publish(`workflow.events.v2.${this.runId}`, {
        type: 'watch',
        runId: this.runId,
        data: { type: 'workflow-finish', payload: { runId: this.runId } },
      });
      unwatch();

      try {
        await Promise.allSettled(this.#observerHandlers.map(handler => handler()));
        this.#observerHandlers = [];
        await writer.close();
      } catch (err) {
        this.mastra?.getLogger()?.error('Error closing stream:', err);
      } finally {
        writer.releaseLock();
      }
    };
    this.closeStreamAction = closeStreamAction;

    void this.pubsub.publish(`workflow.events.v2.${this.runId}`, {
      type: 'watch',
      runId: this.runId,
      data: { type: 'workflow-start', payload: { runId: this.runId } },
    });

    this.executionResults = this._start({
      inputData,
      requestContext,
      actor,
      format: 'legacy',
      ...observabilityContext,
      tracingOptions,
    } as any).then(result => {
      if (result.status !== 'suspended') {
        closeStreamAction().catch(() => {});
      }

      return result;
    });

    return {
      stream: readable,
      getWorkflowState: () => this.executionResults!,
    };
  }

  /**
   * Observe the workflow stream
   * @returns A readable stream of the workflow events
   */
  observeStreamLegacy(): {
    stream: ReadableStream<StreamEvent>;
  } {
    const { readable, writable } = new TransformStream<StreamEvent, StreamEvent>();

    const writer = writable.getWriter();
    const unwatch = this.watch(async event => {
      try {
        const e: any = {
          ...event,
          type: event.type.replace('workflow-', ''),
        };
        // watch events are data stream events, so we need to cast them to the correct type
        await writer.write(e as any);
      } catch {}
    });

    this.#observerHandlers.push(() => {
      unwatch();
      void writer.close().catch(err => {
        this.mastra?.getLogger()?.error('Error closing stream:', err);
      });
      writer.releaseLock();
    });

    return {
      stream: readable,
    };
  }

  /**
   * Observe the workflow stream
   * @returns A readable stream of the workflow events
   */
  observeStream(): ReadableStream<WorkflowStreamEvent> {
    if (!this.streamOutput) {
      return new ReadableStream<WorkflowStreamEvent>({
        pull(controller) {
          controller.close();
        },
        cancel(controller) {
          controller.close();
        },
      });
    }

    return this.streamOutput.fullStream;
  }

  /**
   * Starts the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  stream({
    inputData,
    requestContext,
    tracingOptions,
    closeOnSuspend = true,
    initialState,
    outputOptions,
    perStep,
    actor,
    ...rest
  }: (TInput extends unknown
    ? {
        inputData?: TInput;
      }
    : {
        inputData: TInput;
      }) &
    (TState extends unknown
      ? {
          initialState?: TState;
        }
      : {
          initialState: TState;
        }) & {
      requestContext?: RequestContext<TRequestContext>;
      tracingOptions?: TracingOptions;
      closeOnSuspend?: boolean;
      outputOptions?: {
        includeState?: boolean;
        includeResumeLabels?: boolean;
      };
      perStep?: boolean;
      actor?: ActorSignal;
    } & Partial<ObservabilityContext>): WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const observabilityContext = resolveObservabilityContext(rest);
    if (this.closeStreamAction && this.streamOutput) {
      return this.streamOutput;
    }

    this.closeStreamAction = async () => {};

    const self = this;
    const stream = new ReadableStream<WorkflowStreamEvent>({
      async start(controller) {
        // TODO: fix this, watch doesn't have a type
        const unwatch = self.watch(async (event: any) => {
          const { type, from = ChunkFrom.WORKFLOW, payload, data, ...rest } = event;
          // Check if this is a custom event (has 'data' property instead of 'payload')
          // Custom events should be passed through as-is with their original structure
          if (data !== undefined && payload === undefined) {
            controller.enqueue({
              type,
              runId: self.runId,
              from,
              data,
              ...rest,
            } as WorkflowStreamEvent);
          } else {
            controller.enqueue({
              type,
              runId: self.runId,
              from,
              payload: {
                stepName: (payload as unknown as { id: string })?.id,
                ...payload,
              },
            } as WorkflowStreamEvent);
          }
        });

        // Captured per invocation: `closeStreamAction` is a field on the run, and
        // `createRun({ runId })` returns the cached run, so concurrent calls would
        // otherwise each close the most recently created stream and strand the rest.
        // The field is still assigned for external consumers (observeStreamLegacy).
        const closeStreamAction = async () => {
          unwatch();

          try {
            // only close when not yet closed
            if (controller.desiredSize !== null) {
              controller.close();
            }
          } catch (err) {
            self.mastra?.getLogger()?.error('Error closing stream:', err);
          }
        };
        self.closeStreamAction = closeStreamAction;

        const executionResultsPromise = self._start({
          inputData,
          requestContext,
          actor,
          ...observabilityContext,
          tracingOptions,
          initialState,
          outputOptions,
          outputWriter: async (chunk: WorkflowStreamEvent) => {
            void self.pubsub.publish(`workflow.events.v2.${self.runId}`, {
              type: 'watch',
              runId: self.runId,
              data: chunk,
            });
          },
          perStep,
        } as any);
        let executionResults;
        try {
          executionResults = await executionResultsPromise;

          if (self.streamOutput) {
            self.streamOutput.updateResults(
              executionResults as unknown as WorkflowResult<TState, TInput, TOutput, TSteps>,
            );
          }

          if (closeOnSuspend) {
            // always close stream, even if the workflow is suspended
            // this will trigger a finish event with workflow status set to suspended
            closeStreamAction().catch(() => {});
          } else if (executionResults.status !== 'suspended') {
            closeStreamAction().catch(() => {});
          }
        } catch (err) {
          self.streamOutput?.rejectResults(err as unknown as Error);
          closeStreamAction().catch(() => {});
        }
      },
    });

    this.streamOutput = new WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>({
      runId: this.runId,
      workflowId: this.workflowId,
      stream,
    });

    return this.streamOutput;
  }

  /**
   * Resumes the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  resumeStream<TResume>({
    step,
    resumeData,
    requestContext,
    tracingOptions,
    forEachIndex,
    outputOptions,
    perStep,
    actor,
    ...rest
  }: {
    resumeData?: TResume;
    step?:
      | Step<string, any, any, any, TResume, any, TEngineType, any>
      | [
          ...Step<string, any, any, any, any, any, TEngineType, any>[],
          Step<string, any, any, any, TResume, any, TEngineType, any>,
        ]
      | string
      | string[];
    requestContext?: RequestContext<TRequestContext>;
    tracingOptions?: TracingOptions;
    forEachIndex?: number;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    perStep?: boolean;
    actor?: ActorSignal;
  } & Partial<ObservabilityContext> = {}) {
    const observabilityContext = resolveObservabilityContext(rest);
    this.closeStreamAction = async () => {};

    const self = this;
    const stream = new ReadableStream<WorkflowStreamEvent>({
      async start(controller) {
        // TODO: fix this, watch doesn't have a type
        const unwatch = self.watch(async (event: any) => {
          const { type, from = ChunkFrom.WORKFLOW, payload, data, ...rest } = event;
          // Check if this is a custom event (has 'data' property instead of 'payload')
          // Custom events should be passed through as-is with their original structure
          if (data !== undefined && payload === undefined) {
            controller.enqueue({
              type,
              runId: self.runId,
              from,
              data,
              ...rest,
            } as WorkflowStreamEvent);
          } else {
            controller.enqueue({
              type,
              runId: self.runId,
              from,
              payload: {
                stepName: (payload as unknown as { id: string })?.id,
                ...payload,
              },
            } as WorkflowStreamEvent);
          }
        });

        // Captured per invocation — see the note in the stream() path. Two concurrent
        // resumes of one suspended run are reachable in normal use (double-clicked
        // approval, client retry, two tabs) and each returned stream must terminate.
        const closeStreamAction = async () => {
          unwatch();

          try {
            // only close when not yet closed
            if (controller.desiredSize !== null) {
              controller.close();
            }
          } catch (err) {
            self.mastra?.getLogger()?.error('Error closing stream:', err);
          }
        };
        self.closeStreamAction = closeStreamAction;

        const executionResultsPromise = self._resume({
          resumeData,
          step,
          requestContext,
          actor,
          ...observabilityContext,
          tracingOptions,
          outputWriter: async chunk => {
            void controller.enqueue(chunk);
          },
          isVNext: true,
          forEachIndex,
          outputOptions,
          perStep,
        });

        self.executionResults = executionResultsPromise;

        let executionResults;
        try {
          executionResults = await executionResultsPromise;
          if (self.streamOutput) {
            self.streamOutput.updateResults(executionResults);
          }

          closeStreamAction().catch(() => {});
        } catch (err) {
          self.streamOutput?.rejectResults(err as unknown as Error);
          closeStreamAction().catch(() => {});
        }
      },
    });

    this.streamOutput = new WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>({
      runId: this.runId,
      workflowId: this.workflowId,
      stream,
    });

    return this.streamOutput;
  }

  /**
   * @internal
   */
  watch(cb: (event: WorkflowStreamEvent) => void | Promise<void>): () => void {
    // Both callbacks acknowledge every delivery, including events for other
    // runs. `nested-watch` is a shared topic, so a watcher sees every nested
    // workflow's events; leaving the ones it filters out unacknowledged grows
    // the subscription's pending list on a durable transport for as long as
    // the watcher is attached. The ack is the last thing each callback does so
    // a failure in the consumer or in the nested republish leaves the delivery
    // unacknowledged and redeliverable.
    const wrappedCb = async (event: Event, ack?: () => Promise<void>) => {
      if (event.runId === this.runId) {
        await cb(event.data as WorkflowStreamEvent);
      }
      await ack?.();
    };

    const nestedWatchCb = async (event: Event, ack?: () => Promise<void>) => {
      if (event.runId === this.runId) {
        const { event: nestedEvent, workflowId } = event.data as {
          event: { type: string; payload?: { id: string } & Record<string, unknown>; data?: any };
          workflowId: string;
        };

        // Data chunks from writer.custom() should bubble up directly without modification
        // These are events with type starting with 'data-' and have a 'data' property
        if (nestedEvent.type.startsWith('data-') && nestedEvent.data !== undefined) {
          // Bubble up custom data events directly to preserve their structure
          await this.pubsub.publish(`workflow.events.v2.${this.runId}`, {
            type: 'watch',
            runId: this.runId,
            data: nestedEvent,
          });
        } else {
          // Regular workflow events get prefixed with nested workflow ID
          await this.pubsub.publish(`workflow.events.v2.${this.runId}`, {
            type: 'watch',
            runId: this.runId,
            data: {
              ...nestedEvent,
              ...(nestedEvent.payload?.id
                ? { payload: { ...nestedEvent.payload, id: `${workflowId}.${nestedEvent.payload.id}` } }
                : {}),
            },
          });
        }
      }
      await ack?.();
    };

    void this.pubsub.subscribe(`workflow.events.v2.${this.runId}`, wrappedCb);
    void this.pubsub.subscribe('nested-watch', nestedWatchCb);

    return () => {
      void this.pubsub.unsubscribe(`workflow.events.v2.${this.runId}`, wrappedCb);
      void this.pubsub.unsubscribe('nested-watch', nestedWatchCb);
    };
  }

  /**
   * @internal
   */
  async watchAsync(cb: (event: WorkflowStreamEvent) => void | Promise<void>): Promise<() => void> {
    return this.watch(cb);
  }

  async resume<TResume>(
    params: {
      resumeData?: TResume;
      step?:
        | Step<string, any, any, any, TResume, any, TEngineType, any>
        | [
            ...Step<string, any, any, any, any, any, TEngineType, any>[],
            Step<string, any, any, any, TResume, any, TEngineType, any>,
          ]
        | string
        | string[];
      label?: string;
      requestContext?: RequestContext<TRequestContext>;
      retryCount?: number;
      tracingOptions?: TracingOptions;
      outputWriter?: OutputWriter;
      outputOptions?: {
        includeState?: boolean;
        includeResumeLabels?: boolean;
      };
      forEachIndex?: number;
      perStep?: boolean;
      actor?: ActorSignal;
    } & Partial<ObservabilityContext>,
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._resume(params);
  }

  /**
   * Resumes a suspended workflow without waiting for completion (fire-and-forget).
   * Returns immediately with the runId after dispatching the resume.
   *
   * The resume executes in the background and the result is never awaited. Engines that
   * poll for results (e.g. Inngest) override this with an implementation that skips polling
   * entirely, which avoids the `getRunOutput()` polling race.
   *
   * NOTE: this is exposed over HTTP / the client SDK as `resume-no-wait` / `resumeNoWait()`,
   * not `resumeAsync`, because the existing `resumeAsync()` client/server surface awaits the
   * full workflow result. TODO(v2): consolidate so `resumeAsync` consistently means
   * fire-and-forget (mirroring `start`/`startAsync` semantics) across core, client SDK and
   * HTTP routes; that consolidation is a breaking change deferred to Mastra v2.
   * @returns A promise that resolves to the runId
   */
  async resumeAsync<TResume>(
    params: {
      resumeData?: TResume;
      step?:
        | Step<string, any, any, any, TResume, any, TEngineType, any>
        | [
            ...Step<string, any, any, any, any, any, TEngineType, any>[],
            Step<string, any, any, any, TResume, any, TEngineType, any>,
          ]
        | string
        | string[];
      label?: string;
      requestContext?: RequestContext<TRequestContext>;
      retryCount?: number;
      tracingOptions?: TracingOptions;
      outputWriter?: OutputWriter;
      outputOptions?: {
        includeState?: boolean;
        includeResumeLabels?: boolean;
      };
      forEachIndex?: number;
      perStep?: boolean;
      actor?: ActorSignal;
    } & Partial<ObservabilityContext>,
  ): Promise<{ runId: string }> {
    // Fire resume in background, don't await completion
    this._resume(params).catch(err => {
      this.mastra?.getLogger()?.error(`[Workflow ${this.workflowId}] Background resume failed:`, err);
    });
    return { runId: this.runId };
  }

  /**
   * Restarts the workflow execution that was previously active
   * @returns A promise that resolves to the workflow output
   */
  async restart(
    args: {
      requestContext?: RequestContext<TRequestContext>;
      outputWriter?: OutputWriter;
      tracingOptions?: TracingOptions;
      actor?: ActorSignal;
    } & Partial<ObservabilityContext> = {},
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._restart(args);
  }

  /**
   * Atomically claims a suspended run for exactly one resume caller by flipping the persisted
   * status from `suspended` to `running`.
   *
   * Throws `WORKFLOW_RESUME_ALREADY_CLAIMED` when another caller already claimed this
   * suspension, so losing callers never enter the execution engine.
   */
  async #claimResume({
    workflowsStore,
    snapshot,
  }: {
    workflowsStore: WorkflowsStorage | undefined;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    if (!workflowsStore) {
      return;
    }

    // The claim is a persisted state transition, so a workflow that opts out of persisting
    // `running` snapshots cannot be claimed: writing one anyway would leave the stored snapshot
    // in a state the caller explicitly asked us never to write.
    const persistsRunningState = this.executionEngine.options.shouldPersistSnapshot({
      workflowStatus: 'running',
      stepResults: (snapshot.context ?? {}) as Record<string, StepResult<any, any, any, any>>,
    });

    if (!persistsRunningState) {
      // Workflows that acknowledged the trade-off (internal agent loops that
      // exclude `running` snapshots to avoid write amplification) opt out of
      // the per-resume warning: it fires on every resume and is not actionable.
      if (!this.executionEngine.options.allowUnclaimedResumes) {
        this.#mastra
          ?.getLogger()
          ?.warn(
            `[Workflow ${this.workflowId}] shouldPersistSnapshot excludes the "running" status, so concurrent resume() calls for run ${this.runId} cannot be de-duplicated. Concurrent resumes may execute downstream steps more than once.`,
          );
      }
      return;
    }

    // Stores that report no concurrent-update support cannot honor the compare-and-set: some of
    // them (Cloudflare D1/KV/DO, ClickHouse, LanceDB) do not implement `updateWorkflowState` at all
    // and throw. Claiming is an optimization over the pre-existing behaviour, so a store that
    // cannot claim keeps resuming exactly as it did before rather than failing the resume.
    if (!workflowsStore.supportsConcurrentUpdates()) {
      this.#mastra
        ?.getLogger()
        ?.warn(
          `[Workflow ${this.workflowId}] The configured workflow storage does not support concurrent updates, so concurrent resume() calls for run ${this.runId} cannot be de-duplicated atomically. Concurrent resumes may execute downstream steps more than once.`,
        );
      return;
    }

    const claimed = await workflowsStore.updateWorkflowState({
      workflowName: this.workflowId,
      runId: this.runId,
      opts: { status: 'running', expectedStatus: 'suspended' },
    });

    if (claimed) {
      return;
    }

    // The compare-and-set found a status other than `suspended`. Re-read so the error names the
    // status the run actually landed in rather than guessing.
    const current = await workflowsStore.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    if (!current) {
      throw new Error('No snapshot found for this workflow run: ' + this.workflowId + ' ' + this.runId);
    }

    throw new MastraError({
      id: 'WORKFLOW_RESUME_ALREADY_CLAIMED',
      domain: ErrorDomain.MASTRA_WORKFLOW,
      category: ErrorCategory.USER,
      text:
        `This suspended workflow run was already resumed by another caller. Workflow "${this.workflowId}" run "${this.runId}" ` +
        `moved from "${snapshot.status}" to "${current.status}" before this resume could claim it. ` +
        `Only one resume() call may continue a given suspension; re-read the run state before resuming again.`,
      details: {
        workflowId: this.workflowId,
        runId: this.runId,
        expectedStatus: 'suspended',
        actualStatus: current.status ?? 'unknown',
      },
    });
  }

  protected async _resume<TResume>(
    params: {
      resumeData?: TResume;
      step?:
        | Step<string, any, any, TResume, any, any, TEngineType, any>
        | [
            ...Step<string, any, any, any, any, any, TEngineType, any>[],
            Step<string, any, any, TResume, any, any, TEngineType, any>,
          ]
        | string
        | string[];
      label?: string;
      requestContext?: RequestContext<TRequestContext>;
      retryCount?: number;
      tracingOptions?: TracingOptions;
      outputWriter?: OutputWriter;
      format?: 'legacy' | 'vnext' | undefined;
      isVNext?: boolean;
      outputOptions?: {
        includeState?: boolean;
        includeResumeLabels?: boolean;
      };
      forEachIndex?: number;
      perStep?: boolean;
      actor?: ActorSignal;
    } & Partial<ObservabilityContext>,
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const observabilityContext = resolveObservabilityContext(params);
    const fgaProvider = this.#mastra?.getServer()?.fga;
    if (fgaProvider && !this.isInternalWorkflow) {
      await requireFGA({
        fgaProvider,
        user: params.requestContext?.get('user' as any),
        resource: { type: 'workflow', id: getWorkflowFGAResourceId(this.workflowId) },
        permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
        requestContext: params.requestContext,
        actor: params.actor,
        context: {
          resourceId: this.resourceId,
        },
        metadata: {
          workflowId: this.workflowId,
          runId: this.runId,
          resourceId: this.resourceId,
        },
      });
    }

    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const snapshot = await waitForSuspendedSnapshot(workflowsStore, this.workflowId, this.runId);

    if (!snapshot) {
      throw new Error('No snapshot found for this workflow run: ' + this.workflowId + ' ' + this.runId);
    }

    if (snapshot.status !== 'suspended') {
      throw new Error('This workflow run was not suspended');
    }

    const snapshotResumeLabel = params.label ? snapshot?.resumeLabels?.[params.label] : undefined;
    const stepParam = snapshotResumeLabel?.stepId ?? params.step;

    // Auto-detect suspended steps if no step is provided
    let steps: string[];
    if (stepParam) {
      let newStepParam = stepParam;
      if (typeof stepParam === 'string') {
        newStepParam = stepParam.split('.');
      }
      steps = (Array.isArray(newStepParam) ? newStepParam : [newStepParam]).map(step =>
        typeof step === 'string' ? step : step?.id,
      );
    } else {
      // Use suspendedPaths to detect suspended steps
      const suspendedStepPaths: string[][] = [];

      Object.entries(snapshot?.suspendedPaths ?? {}).forEach(([stepId, _executionPath]) => {
        // Check if this step has nested workflow suspension data
        const stepResult = snapshot?.context?.[stepId];
        if (stepResult && typeof stepResult === 'object' && 'status' in stepResult) {
          const stepRes = stepResult as any;
          if (stepRes.status === 'suspended') {
            const nestedPath = stepRes.suspendPayload?.__workflow_meta?.path;
            if (nestedPath && Array.isArray(nestedPath)) {
              // For nested workflows, combine the parent step ID with the nested path
              suspendedStepPaths.push([stepId, ...nestedPath]);
            } else {
              // For single-level suspension, just use the step ID
              suspendedStepPaths.push([stepId]);
            }
          }
        }
      });

      if (suspendedStepPaths.length === 0) {
        throw new Error('No suspended steps found in this workflow run');
      }

      if (suspendedStepPaths.length === 1) {
        // For single suspended step, use the full path
        steps = suspendedStepPaths[0]!;
      } else {
        const pathStrings = suspendedStepPaths.map(path => `[${path.join(', ')}]`);
        throw new Error(
          `Multiple suspended steps found: ${pathStrings.join(', ')}. ` +
            'Please specify which step to resume using the "step" parameter.',
        );
      }
    }

    if (!params.retryCount) {
      const suspendedStepIds = Object.keys(snapshot?.suspendedPaths ?? {});

      const isStepSuspended = suspendedStepIds.includes(steps?.[0] ?? '');

      if (!isStepSuspended) {
        throw new Error(
          `This workflow step "${steps?.[0]}" was not suspended. Available suspended steps: [${suspendedStepIds.join(', ')}]`,
        );
      }
    }

    const suspendedStep = this.workflowSteps[steps?.[0] ?? ''];

    const resumeDataToUse = await this._validateResumeData(params.resumeData, suspendedStep);

    let requestContextInput;
    if (params.retryCount && params.retryCount > 0 && params.requestContext) {
      requestContextInput = (params.requestContext as RequestContext).get('__mastraWorflowInputData');
      (params.requestContext as RequestContext).delete('__mastraWorflowInputData');
    }

    const stepResults = { ...(snapshot?.context ?? {}), input: requestContextInput ?? snapshot?.context?.input } as any;

    const requestContextToUse = params.requestContext ?? new RequestContext();

    Object.entries(snapshot?.requestContext ?? {}).forEach(([key, value]) => {
      if (!(requestContextToUse as RequestContext).has(key)) {
        (requestContextToUse as RequestContext).set(key, value);
      }
    });

    // Build tracing options for the resumed span, linking to the original suspended span if available
    // Priority: user-provided tracingOptions > persisted tracingContext from snapshot
    const persistedTracingContext = snapshot?.tracingContext;
    const userProvidedTraceId = params.tracingOptions?.traceId;
    const userProvidedParentSpanId = params.tracingOptions?.parentSpanId;

    // Only fall back to persisted traceId when the caller didn't provide either tracing identifier.
    // If the caller provided parentSpanId without traceId, using the persisted traceId would create
    // invalid cross-trace parentage (a span in one trace claiming a parent from another trace).
    const effectiveTraceId =
      userProvidedTraceId ?? (!userProvidedParentSpanId ? persistedTracingContext?.traceId : undefined);

    // Only use persisted spanId as parentSpanId if:
    // 1. User didn't provide their own parentSpanId, AND
    // 2. Either no user traceId was provided, OR user traceId matches persisted traceId
    // This prevents cross-trace parentage where a span in one trace claims a parent from another trace
    const shouldUsePersistedParentSpan =
      !userProvidedParentSpanId && (!userProvidedTraceId || userProvidedTraceId === persistedTracingContext?.traceId);

    const resumeTracingOptions = {
      ...params.tracingOptions,
      traceId: effectiveTraceId,
    };

    // The persisted resume link travels separately from tracingOptions:
    // tracingOptions.parentSpanId is reserved for external correlation ids,
    // while the suspended span's id is a Mastra span present in storage.
    const resumedFromSpanId = shouldUsePersistedParentSpan ? persistedTracingContext?.spanId : undefined;

    // note: this span is ended inside this.executionEngine.execute()
    const workflowSpan = getOrCreateSpan({
      type: SpanType.WORKFLOW_RUN,
      name: `workflow run: '${this.workflowId}' (resumed)`,
      entityType: EntityType.WORKFLOW_RUN,
      entityId: this.workflowId,
      entityName: this.workflowId,
      input: resumeDataToUse,
      metadata: {
        resourceId: this.resourceId,
        runId: this.runId,
        resumed: true,
        resumedFromSpanId: persistedTracingContext?.spanId,
      },
      tracingPolicy: this.tracingPolicy,
      tracingOptions: resumeTracingOptions,
      tracingContext: observabilityContext.tracingContext,
      requestContext: requestContextToUse as RequestContext,
      mastra: this.#mastra,
      resumedFromSpanId,
    });

    this.workflowRunSpan = workflowSpan;
    const traceId = workflowSpan?.externalTraceId;
    const spanId = workflowSpan?.id;

    // Claim this suspension before entering the execution engine.
    //
    // Everything above this point is a read of the snapshot loaded at the top of this method,
    // and the engine does not persist `running` until the resumed step actually starts. Without
    // an atomic claim, two concurrent resume() callers can both observe the same `suspended`
    // snapshot and both enter the engine, running downstream steps (and their side effects)
    // twice. See https://github.com/mastra-ai/mastra/issues/20443.
    //
    // The compare-and-set is executed inside the store's own critical section, so exactly one
    // caller flips `suspended -> running` and every other caller loses and throws below.
    await this.#claimResume({ workflowsStore, snapshot });

    const releaseClaimIfUnused = async () => {
      // Only roll the claim back when the engine never reached its first step persist, which is
      // the only state where re-resuming is guaranteed not to duplicate work. That first persist
      // writes the engine's own status and clears `suspendedPaths`, so a snapshot that is still
      // `running` with the pre-claim `suspendedPaths` proves nothing downstream ran. Anything
      // else is left alone: a stuck `running` run is strictly safer than silently re-arming a
      // suspension whose downstream steps already fired.
      try {
        const current = await workflowsStore?.loadWorkflowSnapshot({
          workflowName: this.workflowId,
          runId: this.runId,
        });

        const claimedPaths = Object.keys(snapshot.suspendedPaths ?? {});
        const currentPaths = Object.keys(current?.suspendedPaths ?? {});
        const claimedStepIds = Object.keys(snapshot.context ?? {});
        const currentStepIds = Object.keys(current?.context ?? {});
        const resumedStepId = steps?.[0] ?? '';
        const resumedStepResult = current?.context?.[resumedStepId] as { status?: string } | undefined;

        // Every one of these must still look exactly as it did at claim time. The status alone
        // is not enough evidence: the engine deliberately suppresses `running` step persists
        // while the last persisted status is `suspended`, so a run that failed midway can still
        // read back as `running`.
        const engineNeverStarted =
          current?.status === 'running' &&
          currentPaths.length === claimedPaths.length &&
          claimedPaths.every(path => currentPaths.includes(path)) &&
          currentStepIds.length === claimedStepIds.length &&
          claimedStepIds.every(stepId => currentStepIds.includes(stepId)) &&
          resumedStepResult?.status === 'suspended';

        if (!engineNeverStarted) {
          return;
        }

        await workflowsStore?.updateWorkflowState({
          workflowName: this.workflowId,
          runId: this.runId,
          opts: { status: 'suspended', expectedStatus: 'running' },
        });
      } catch (releaseError) {
        this.#mastra
          ?.getLogger()
          ?.warn(`[Workflow ${this.workflowId}] Failed to release resume claim for run ${this.runId}`, releaseError);
      }
    };

    const executionResultPromise = this.executionEngine
      .execute<TState, TInput, WorkflowResult<TState, TInput, TOutput, TSteps>>({
        workflowId: this.workflowId,
        runId: this.runId,
        resourceId: this.resourceId,
        graph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        input: snapshot?.context?.input as TInput,
        initialState: (snapshot?.value ?? {}) as any,
        resume: {
          steps,
          stepResults,
          resumePayload: resumeDataToUse,
          // @ts-expect-error - context type mismatch
          resumePath: snapshot?.suspendedPaths?.[steps?.[0]] as any,
          stepExecutionPath: snapshot?.stepExecutionPath,
          forEachIndex: params.forEachIndex ?? snapshotResumeLabel?.foreachIndex,
          label: params.label,
        },
        format: params.format,
        pubsub: this.pubsub,
        requestContext: requestContextToUse as RequestContext,
        actor: params.actor,
        abortController: this.abortController,
        workflowSpan,
        outputOptions: params.outputOptions,
        outputWriter: params.outputWriter,
        perStep: params.perStep,
      })
      .then(result => {
        if (!params.isVNext && result.status !== 'suspended') {
          this.closeStreamAction?.().catch(() => {});
        }
        result.traceId = traceId;
        result.spanId = spanId;
        return result;
      })
      .catch(async error => {
        await releaseClaimIfUnused();
        throw error;
      });

    this.executionResults = executionResultPromise;

    return executionResultPromise.then(result => {
      this.streamOutput?.updateResults(result as unknown as WorkflowResult<TState, TInput, TOutput, TSteps>);

      return result;
    });
  }

  protected async _restart({
    requestContext,
    outputWriter,
    tracingOptions,
    actor,
    ...rest
  }: {
    requestContext?: RequestContext<TRequestContext>;
    outputWriter?: OutputWriter;
    tracingOptions?: TracingOptions;
    actor?: ActorSignal;
  } & Partial<ObservabilityContext>): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const observabilityContext = resolveObservabilityContext(rest);
    const allowedEngines = ['default', 'evented'];
    if (!allowedEngines.includes(this.workflowEngineType)) {
      throw new Error(`restart() is not supported on ${this.workflowEngineType} workflows`);
    }

    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    if (!snapshot) {
      throw new Error(`Snapshot not found for run ${this.runId}`);
    }

    // Parent parallel activeStepsPath can lag behind nested child completion after a crash:
    // children may already be terminal while the parent still lists them as active and
    // re-invokes restart(). Treat terminal snapshots as authoritative and reuse them.
    // See https://github.com/mastra-ai/mastra/issues/20225
    //
    // Only statuses already represented on WorkflowResult are reconstructed here.
    // Other terminal statuses (canceled/bailed) keep the existing createRestartExecutionParams
    // "was not active" behavior — expanding WorkflowResult is out of scope for this fix.
    if (snapshot.status === 'success' || snapshot.status === 'failed' || snapshot.status === 'tripwire') {
      this.cleanup?.();
      // Match fmtReturnValue: context keeps `input` alongside step results, and `input`
      // is also surfaced as a top-level field on the returned WorkflowResult.
      const hydratedSteps = hydrateSerializedStepErrors({ ...(snapshot.context ?? {}) }) ?? {};
      // Strip internal bookkeeping (__state, metadata.nestedRunId) from step results so the
      // reconstructed result matches what a live run would have returned via fmtReturnValue.
      const steps = Object.fromEntries(
        Object.entries(hydratedSteps).map(([stepId, stepResult]) => [stepId, cleanStepResult(stepResult)]),
      ) as typeof hydratedSteps;
      const input = (snapshot.context as { input?: TInput } | undefined)?.input as TInput;
      const base = {
        steps,
        input,
        runId: this.runId,
        ...(snapshot.value && Object.keys(snapshot.value).length > 0 ? { state: snapshot.value as TState } : {}),
        ...(snapshot.stepExecutionPath ? { stepExecutionPath: snapshot.stepExecutionPath } : {}),
        ...(snapshot.resumeLabels ? { resumeLabels: snapshot.resumeLabels } : {}),
      };

      if (snapshot.status === 'success') {
        return { ...base, status: 'success', result: snapshot.result as TOutput } as WorkflowResult<
          TState,
          TInput,
          TOutput,
          TSteps
        >;
      }
      if (snapshot.status === 'failed') {
        return {
          ...base,
          status: 'failed',
          error: getErrorFromUnknown(snapshot.error, { serializeStack: false }),
        } as WorkflowResult<TState, TInput, TOutput, TSteps>;
      }
      return { ...base, status: 'tripwire', tripwire: snapshot.tripwire } as WorkflowResult<
        TState,
        TInput,
        TOutput,
        TSteps
      >;
    }

    const restartData = createRestartExecutionParams({ snapshot, graph: this.executionGraph });

    const requestContextToUse = requestContext ?? new RequestContext();
    for (const [key, value] of Object.entries(snapshot.requestContext ?? {})) {
      if (!(requestContextToUse as RequestContext).has(key)) {
        (requestContextToUse as RequestContext).set(key, value);
      }
    }
    const workflowSpan = getOrCreateSpan({
      type: SpanType.WORKFLOW_RUN,
      name: `workflow run: '${this.workflowId}'`,
      entityType: EntityType.WORKFLOW_RUN,
      entityId: this.workflowId,
      entityName: this.workflowId,
      metadata: {
        resourceId: this.resourceId,
        runId: this.runId,
      },
      tracingPolicy: this.tracingPolicy,
      tracingOptions,
      tracingContext: observabilityContext.tracingContext,
      requestContext: requestContextToUse as RequestContext,
      mastra: this.#mastra,
    });

    this.workflowRunSpan = workflowSpan;
    const traceId = workflowSpan?.externalTraceId;
    const spanId = workflowSpan?.id;

    const result = await this.executionEngine.execute<TState, TInput, WorkflowResult<TState, TInput, TOutput, TSteps>>({
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      disableScorers: this.disableScorers,
      graph: this.executionGraph,
      serializedStepGraph: this.serializedStepGraph,
      restart: restartData,
      pubsub: this.pubsub,
      retryConfig: this.retryConfig,
      requestContext: requestContextToUse as RequestContext,
      actor,
      abortController: this.abortController,
      outputWriter,
      workflowSpan,
    });

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    result.traceId = traceId;
    result.spanId = spanId;
    return result;
  }

  protected async _timeTravel<TInput>({
    inputData,
    resumeData,
    initialState,
    step: stepParam,
    context,
    nestedStepsContext,
    requestContext,
    outputWriter,
    tracingOptions,
    outputOptions,
    perStep,
    actor,
    ...rest
  }: {
    inputData?: TInput;
    resumeData?: any;
    initialState?: TState;
    step:
      | Step<string, any, TInput, any, any, any, TEngineType, any>
      | [
          ...Step<string, any, any, any, any, any, TEngineType, any>[],
          Step<string, any, TInput, any, any, any, TEngineType, any>,
        ]
      | string
      | string[];
    context?: TimeTravelContext<any, any, any, any>;
    nestedStepsContext?: Record<string, TimeTravelContext<any, any, any, any>>;
    requestContext?: RequestContext<TRequestContext>;
    outputWriter?: OutputWriter;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    perStep?: boolean;
    actor?: ActorSignal;
  } & Partial<ObservabilityContext>): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const observabilityContext = resolveObservabilityContext(rest);
    if (!stepParam || (Array.isArray(stepParam) && stepParam.length === 0)) {
      throw new Error('Step is required and must be a valid step or array of steps');
    }

    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    if (!snapshot) {
      throw new Error(`Snapshot not found for run ${this.runId}`);
    }

    if (snapshot.status === 'running') {
      throw new Error('This workflow run is still running, cannot time travel');
    }

    let steps: string[];
    let newStepParam = stepParam;
    if (typeof stepParam === 'string') {
      newStepParam = stepParam.split('.');
    }
    steps = (Array.isArray(newStepParam) ? newStepParam : [newStepParam]).map(step =>
      typeof step === 'string' ? step : step?.id,
    );

    let inputDataToUse = inputData;

    if (inputDataToUse && steps.length === 1) {
      inputDataToUse = await this._validateTimetravelInputData(inputData, this.workflowSteps[steps[0]!]!);
    }

    const timeTravelData = createTimeTravelExecutionParams({
      steps,
      inputData: inputDataToUse,
      resumeData,
      context,
      nestedStepsContext,
      snapshot,
      initialState,
      graph: this.executionGraph,
      perStep,
    });

    const requestContextToUse = requestContext ?? new RequestContext();
    for (const [key, value] of Object.entries(snapshot.requestContext ?? {})) {
      if (!(requestContextToUse as RequestContext).has(key)) {
        (requestContextToUse as RequestContext).set(key, value);
      }
    }

    const workflowSpan = getOrCreateSpan({
      type: SpanType.WORKFLOW_RUN,
      name: `workflow run: '${this.workflowId}'`,
      input: inputData,
      entityType: EntityType.WORKFLOW_RUN,
      entityId: this.workflowId,
      entityName: this.workflowId,
      metadata: {
        resourceId: this.resourceId,
        runId: this.runId,
      },
      tracingPolicy: this.tracingPolicy,
      tracingOptions,
      tracingContext: observabilityContext.tracingContext,
      requestContext: requestContextToUse as RequestContext,
      mastra: this.#mastra,
    });

    this.workflowRunSpan = workflowSpan;
    const traceId = workflowSpan?.externalTraceId;
    const spanId = workflowSpan?.id;

    const result = await this.executionEngine.execute<TState, TInput, WorkflowResult<TState, TInput, TOutput, TSteps>>({
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      disableScorers: this.disableScorers,
      graph: this.executionGraph,
      timeTravel: timeTravelData,
      serializedStepGraph: this.serializedStepGraph,
      pubsub: this.pubsub,
      retryConfig: this.retryConfig,
      requestContext: requestContextToUse as RequestContext,
      actor,
      abortController: this.abortController,
      outputWriter,
      workflowSpan,
      outputOptions,
      perStep,
    });

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    result.traceId = traceId;
    result.spanId = spanId;
    return result;
  }

  async timeTravel<TInput>(
    args: {
      inputData?: TInput;
      resumeData?: any;
      initialState?: TState;
      step:
        | Step<string, any, TInput, any, any, any, TEngineType, any>
        | [
            ...Step<string, any, any, any, any, any, TEngineType, any>[],
            Step<string, any, TInput, any, any, any, TEngineType, any>,
          ]
        | string
        | string[];
      context?: TimeTravelContext<any, any, any, any>;
      nestedStepsContext?: Record<string, TimeTravelContext<any, any, any, any>>;
      requestContext?: RequestContext<TRequestContext>;
      outputWriter?: OutputWriter;
      tracingOptions?: TracingOptions;
      outputOptions?: {
        includeState?: boolean;
        includeResumeLabels?: boolean;
      };
      perStep?: boolean;
      actor?: ActorSignal;
    } & Partial<ObservabilityContext>,
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._timeTravel(args);
  }

  timeTravelStream<TTravelInput>({
    inputData,
    resumeData,
    initialState,
    step,
    context,
    nestedStepsContext,
    requestContext,
    tracingOptions,
    outputOptions,
    perStep,
    actor,
    ...rest
  }: {
    inputData?: TTravelInput;
    initialState?: TState;
    resumeData?: any;
    step:
      | Step<string, any, any, any, any, any, TEngineType, any>
      | [
          ...Step<string, any, any, any, any, any, TEngineType, any>[],
          Step<string, any, any, any, any, any, TEngineType, any>,
        ]
      | string
      | string[];
    context?: TimeTravelContext<any, any, any, any>;
    nestedStepsContext?: Record<string, TimeTravelContext<any, any, any, any>>;
    requestContext?: RequestContext<TRequestContext>;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    perStep?: boolean;
    actor?: ActorSignal;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    this.closeStreamAction = async () => {};

    const self = this;
    const stream = new ReadableStream<WorkflowStreamEvent>({
      async start(controller) {
        // TODO: fix this, watch doesn't have a type
        const unwatch = self.watch(async ({ type, from = ChunkFrom.WORKFLOW, payload }) => {
          controller.enqueue({
            type,
            runId: self.runId,
            from,
            payload: {
              stepName: (payload as unknown as { id: string }).id,
              ...payload,
            },
          } as WorkflowStreamEvent);
        });

        // Captured per invocation — see the note in the stream() path.
        const closeStreamAction = async () => {
          unwatch();

          try {
            // only close when not yet closed
            if (controller.desiredSize !== null) {
              controller.close();
            }
          } catch (err) {
            self.mastra?.getLogger()?.error('Error closing stream:', err);
          }
        };
        self.closeStreamAction = closeStreamAction;

        const executionResultsPromise = self._timeTravel({
          inputData,
          step,
          context,
          nestedStepsContext,
          resumeData,
          initialState,
          requestContext,
          actor,
          ...observabilityContext,
          tracingOptions,
          outputWriter: async chunk => {
            void controller.enqueue(chunk);
          },
          outputOptions,
          perStep,
        });

        self.executionResults = executionResultsPromise;

        let executionResults;
        try {
          executionResults = await executionResultsPromise;
          if (self.streamOutput) {
            self.streamOutput.updateResults(executionResults);
          }

          closeStreamAction().catch(() => {});
        } catch (err) {
          self.streamOutput?.rejectResults(err as unknown as Error);
          closeStreamAction().catch(() => {});
        }
      },
    });

    this.streamOutput = new WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>({
      runId: this.runId,
      workflowId: this.workflowId,
      stream,
    });

    return this.streamOutput;
  }

  /**
   * @access private
   * @returns The execution results of the workflow run
   */
  _getExecutionResults(): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> | undefined {
    return this.executionResults ?? this.streamOutput?.result;
  }
}
