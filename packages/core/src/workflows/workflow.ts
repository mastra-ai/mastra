import { randomUUID } from 'node:crypto';
import { ReadableStream, TransformStream } from 'node:stream/web';
import type { CoreMessage } from '@internal/ai-sdk-v4';
import { z } from 'zod/v4';
import type { MastraPrimitives } from '../action';
import { Agent } from '../agent';
import type { AgentExecutionOptions, AgentStreamOptions, MastraDBMessage } from '../agent';
import { MessageList, messagesAreEqual } from '../agent/message-list';
import type { MessageInput } from '../agent/message-list';
import { TripWire } from '../agent/trip-wire';
import { MastraFGAPermissions } from '../auth/ee';
import { MastraBase } from '../base';
import { RequestContext } from '../di';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { MastraScorers } from '../evals';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import type { Event } from '../events/types';
import type { IMastraLogger } from '../logger';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { ObservabilityContext, TracingOptions, TracingPolicy } from '../observability';
import {
  EntityType,
  SpanType,
  createObservabilityContext,
  getOrCreateSpan,
  resolveObservabilityContext,
} from '../observability';
import { executeWithContext } from '../observability/utils';
import { ProcessorRunner, ProcessorState } from '../processors';
import type { OutputResult, Processor, ProcessorStreamWriter } from '../processors';
import {
  summarizeActiveToolsForSpan,
  summarizeProcessorModelForSpan,
  summarizeProcessorResultForSpan,
  summarizeProcessorToolsForSpan,
  summarizeToolChoiceForSpan,
} from '../processors/span-payload';
import { ProcessorStepOutputSchema, ProcessorStepInputSchema } from '../processors/step-schema';
import type { ProcessorStepInput, ProcessorStepOutput } from '../processors/step-schema';
import { toStandardSchema } from '../schema';
import type { InferPublicSchema, InferStandardSchemaOutput, PublicSchema, StandardSchemaWithJSON } from '../schema';
import type { StorageListWorkflowRunsInput } from '../storage';
import { WorkflowRunOutput } from '../stream/RunOutput';
import type { ChunkType, LanguageModelUsage } from '../stream/types';
import { ChunkFrom } from '../stream/types';
import { Tool } from '../tools';
import type { ToolExecutionContext } from '../tools';
import type { DynamicArgument } from '../types';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from './constants';
import { DefaultExecutionEngine } from './default';
import type { ExecutionEngine, ExecutionGraph } from './execution-engine';
import type {
  ConditionFunction,
  ExecuteFunction,
  InnerOutput,
  LoopConditionFunction,
  Step,
  SuspendOptions,
} from './step';
import { forwardAgentStreamChunk } from './stream-utils';
import type {
  DefaultEngineType,
  DynamicMapping,
  ExtractSchemaFromStep,
  ExtractSchemaType,
  RestartExecutionParams,
  PathsToStringProps,
  SerializedStep,
  SerializedStepFlowEntry,
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
} from './types';
import { cleanStepResult, createTimeTravelExecutionParams } from './utils';

// Options that can be passed when wrapping an agent with createStep
// These work for both stream() (v2) and streamLegacy() (v1) methods
export type AgentStepOptions<TOUTPUT> = Omit<
  AgentExecutionOptions<TOUTPUT> & AgentStreamOptions,
  | 'format'
  | 'tracingContext'
  | 'requestContext'
  | 'abortSignal'
  | 'context'
  | 'onStepFinish'
  | 'output'
  | 'experimental_output'
  | 'resourceId'
  | 'threadId'
  | 'scorers'
>;

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

function isAgent<TStepId extends string>(input: unknown): input is Agent<TStepId, any> {
  return input instanceof Agent;
}

function isToolStep(input: unknown): input is ToolStep<any, any, any, any, any> {
  return input instanceof Tool;
}

function isStepParams(input: unknown): input is StepParams<any, any, any, any, any, any> {
  return (
    input !== null &&
    typeof input === 'object' &&
    'id' in input &&
    'execute' in input &&
    !(input instanceof Agent) &&
    !(input instanceof Tool)
  );
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
    if ('step' in entry && entry.step?.id === stepId) return entry;
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
  agent: Agent<TStepId, any>,
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
  agent: Agent<TStepId, any>,
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
  toolOptions?: { retries?: number; scorers?: DynamicArgument<MastraScorers>; metadata?: StepMetadata },
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
    | (Processor<TProcessorId> & { processOutputStep: Function }),
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
  if (isAgent(params)) {
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
  return {
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
}

function createStepFromAgent<TStepId extends string, TStepOutput>(
  params: Agent<TStepId, any>,
  agentOrToolOptions?: AgentStepOptions<TStepOutput> & {
    structuredOutput?: { schema: StandardSchemaWithJSON<TStepOutput> };
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
    metadata?: StepMetadata;
  },
): Step<TStepId, unknown, any, TStepOutput, unknown, unknown, DefaultEngineType> {
  const options = (agentOrToolOptions ?? {}) as
    | (AgentStepOptions<TStepOutput> & {
        retries?: number;
        scorers?: DynamicArgument<MastraScorers>;
        metadata?: StepMetadata;
      })
    | undefined;
  // Determine output schema based on structuredOutput option
  const outputSchema = toStandardSchema(
    (options?.structuredOutput?.schema ?? z.object({ text: z.string() })) as PublicSchema<TStepOutput>,
  ) as StandardSchemaWithJSON<TStepOutput>;
  const { retries, scorers, metadata, ...agentOptions } =
    options ??
    ({} as AgentStepOptions<TStepOutput> & {
      retries?: number;
      scorers?: DynamicArgument<MastraScorers>;
      metadata?: StepMetadata;
    });

  return {
    id: params.id,
    description: params.getDescription(),
    inputSchema: toStandardSchema(
      z.object({
        prompt: z.string(),
      }),
    ),
    outputSchema: toStandardSchema(outputSchema),
    retries,
    scorers,
    metadata,
    execute: async ({
      inputData,
      runId,
      [PUBSUB_SYMBOL]: pubsub,
      [STREAM_FORMAT_SYMBOL]: streamFormat,
      requestContext,
      abortSignal,
      abort,
      writer,
      ...rest
    }) => {
      const observabilityContext = resolveObservabilityContext(rest);
      let streamPromise = {} as {
        promise: Promise<string>;
        resolve: (value: string) => void;
        reject: (reason?: any) => void;
      };

      streamPromise.promise = new Promise((resolve, reject) => {
        streamPromise.resolve = resolve;
        streamPromise.reject = reject;
      });

      // Track structured output result
      let structuredResult: any = null;

      const toolData = {
        name: params.name,
        args: inputData,
      };

      let stream: ReadableStream<any>;

      if ((await params.getModel()).specificationVersion === 'v1') {
        const { fullStream } = await params.streamLegacy((inputData as { prompt: string }).prompt, {
          ...agentOptions,
          requestContext,
          ...observabilityContext,
          onFinish: result => {
            // Capture structured output if available
            const resultWithObject = result as typeof result & { object?: unknown };
            if (agentOptions?.structuredOutput?.schema && resultWithObject.object) {
              structuredResult = resultWithObject.object;
            }
            streamPromise.resolve(result.text);
            void agentOptions?.onFinish?.(result);
          },
          abortSignal,
        });
        stream = fullStream as any;
      } else {
        // @ts-expect-error - TODO: fix this
        const modelOutput = await params.stream((inputData as { prompt: string }).prompt, {
          ...agentOptions,
          requestContext,
          ...observabilityContext,
          onFinish: result => {
            // Capture structured output if available
            const resultWithObject = result as typeof result & { object?: unknown };
            if (agentOptions?.structuredOutput?.schema && resultWithObject.object) {
              structuredResult = resultWithObject.object;
            }
            streamPromise.resolve(result.text);
            void agentOptions?.onFinish?.(result);
          },
          abortSignal,
        });

        stream = modelOutput.fullStream;
      }

      let tripwireChunk: any = null;

      if (streamFormat === 'legacy') {
        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: { type: 'tool-call-streaming-start', ...(toolData ?? {}) },
        });
        for await (const chunk of stream) {
          if (chunk.type === 'tripwire') {
            tripwireChunk = chunk;
            break;
          }
          if (chunk.type === 'text-delta') {
            await pubsub.publish(`workflow.events.v2.${runId}`, {
              type: 'watch',
              runId,
              data: { type: 'tool-call-delta', ...(toolData ?? {}), argsTextDelta: chunk.textDelta },
            });
          }
        }
        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: { type: 'tool-call-streaming-finish', ...(toolData ?? {}) },
        });
      } else {
        for await (const chunk of stream) {
          await forwardAgentStreamChunk({ writer, chunk });
          if (chunk.type === 'tripwire') {
            tripwireChunk = chunk;
            break;
          }
        }
      }

      // If a tripwire was detected, throw TripWire to abort the workflow step
      if (tripwireChunk) {
        throw new TripWire(
          tripwireChunk.payload?.reason || 'Agent tripwire triggered',
          {
            retry: tripwireChunk.payload?.retry,
            metadata: tripwireChunk.payload?.metadata,
          },
          tripwireChunk.payload?.processorId,
        );
      }

      if (abortSignal.aborted) {
        return abort();
      }

      // Return structured output if available, otherwise default text
      if (structuredResult !== null) {
        return structuredResult satisfies TStepOutput;
      }
      return {
        text: await streamPromise.promise,
      } satisfies {
        text: string;
      };
    },
    component: params.component,
  };
}

function createStepFromTool<TStepInput, TSuspend, TResume, TStepOutput>(
  params: ToolStep<TStepInput, TSuspend, TResume, TStepOutput, any>,
  toolOpts?: { retries?: number; scorers?: DynamicArgument<MastraScorers>; metadata?: StepMetadata },
): Step<string, any, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType> {
  if (!params.inputSchema || !params.outputSchema) {
    throw new Error('Tool must have input and output schemas defined');
  }

  return {
    id: params.id,
    description: params.description,
    inputSchema: params.inputSchema,
    outputSchema: params.outputSchema,
    resumeSchema: params.resumeSchema,
    suspendSchema: params.suspendSchema,
    retries: toolOpts?.retries,
    scorers: toolOpts?.scorers,
    metadata: toolOpts?.metadata,
    execute: async ({
      inputData,
      mastra,
      requestContext,
      suspend,
      resumeData,
      runId,
      workflowId,
      state,
      setState,
      ...rest
    }) => {
      // BREAKING CHANGE v1.0: Pass raw input as first arg, context as second
      const observabilityContext = resolveObservabilityContext(rest);
      const toolContext = {
        mastra,
        requestContext,
        ...observabilityContext,
        resumeData,
        workflow: {
          runId,
          suspend,
          resumeData,
          workflowId,
          state,
          setState,
        },
      };

      return params.execute(inputData, toolContext) as TStepOutput;
    },
    component: 'TOOL',
  };
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
      default:
        return false;
    }
  };

  // Note: Zod v4 schemas natively implement StandardSchemaWithJSON at runtime,
  // but TypeScript type inference has issues with the complex discriminated union types.
  // We use type assertions here since toStandardSchema returns the schema directly
  // when it already implements StandardSchemaWithJSON.
  return {
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
        // Shared processor states map for accessing persisted state
        processorStates,
        // Abort signal for cancelling in-flight processor work (e.g. OM observations)
        abortSignal,
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
      // - For inputStep/outputStep: find MODEL_STEP (processor runs per LLM call)
      // When workflow is executed, currentSpan is WORKFLOW_STEP, so we walk up the parent chain
      const parentSpan =
        phase === 'inputStep' || phase === 'outputStep'
          ? currentSpan?.findParent(SpanType.MODEL_STEP) || currentSpan
          : currentSpan?.findParent(SpanType.AGENT_RUN) || currentSpan;

      const processorSpan =
        phase !== 'outputStream'
          ? parentSpan?.createChildSpan({
              type: SpanType.PROCESSOR_RUN,
              name: `${getSpanNamePrefix(phase)}: ${processor.id}`,
              entityType: getProcessorEntityType(phase),
              entityId: processor.id,
              entityName: processor.name ?? processor.id,
              input: buildProcessorSpanInput(),
              attributes: {
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
            custom: async <T extends { type: string }>(data: T) => {
              await outputWriter(data as any);
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

      const baseContext = {
        abort,
        retryCount: retryCount ?? 0,
        requestContext,
        ...processorObservabilityContext,
        state: processorState,
        writer: processorWriter,
        abortSignal,
        messageId: currentMessageId,
        rotateResponseMessageId: rotateCurrentResponseMessageId,
      };

      // Pass-through data that should flow to the next processor in a chain
      // This enables processor workflows to use .then(), .parallel(), .branch(), etc.
      const passThrough = {
        phase,
        // Auto-create MessageList from messages if not provided
        // This enables running processor workflows from the UI where messageList can't be serialized
        messageList:
          messageList ??
          (Array.isArray(messages)
            ? new MessageList()
                .add(messages as MastraDBMessage[], 'input')
                .addSystem((systemMessages ?? []) as CoreMessage[])
            : undefined),
        stepNumber,
        systemMessages,
        streamParts,
        state: processorState,
        processorStates,
        result: outputResult,
        finishReason,
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
            processorSpan?.end({ output: { tripwire: error.message } });
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
                  systemMessages: result.getAllSystemMessages(),
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
                  systemMessages: typedResult.systemMessages,
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
                  type: SpanType.PROCESSOR_RUN,
                  name: `output stream processor: ${processor.id}`,
                  entityType: EntityType.OUTPUT_PROCESSOR,
                  entityId: processor.id,
                  entityName: processor.name ?? processor.id,
                  attributes: {
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
                  delete mutableState[spanKey];
                }
              } catch (error) {
                // End span with error and clean up state
                if (error instanceof TripWire) {
                  processorSpan?.end({ output: { tripwire: error.message } });
                } else {
                  processorSpan?.error({ error: error as Error, endSpan: true });
                }
                delete mutableState[spanKey];
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
                  systemMessages: result.getAllSystemMessages(),
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
                  systemMessages: typedResult.systemMessages,
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
                  systemMessages: result.getAllSystemMessages(),
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
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    typeof (obj as any).id === 'string' &&
    !(obj instanceof Agent) &&
    !(obj instanceof Tool) &&
    (typeof (obj as any).processInput === 'function' ||
      typeof (obj as any).processInputStep === 'function' ||
      typeof (obj as any).processOutputStream === 'function' ||
      typeof (obj as any).processOutputResult === 'function' ||
      typeof (obj as any).processOutputStep === 'function' ||
      typeof (obj as any).processAPIError === 'function')
  );
}

/**
 * A Workflow with all type parameters erased.
 * Use this instead of manually specifying `Workflow<any, any, ...>` so that
 * adding or removing type parameters only requires updating one place.
 */
export type AnyWorkflow = Workflow<any, any, any, any, any, any, any, any>;

/**
 * Registration slot for the evented `createWorkflow` factory.
 *
 * The evented module registers itself here at module-load time. We use a
 * registration slot rather than a static import because `evented/workflow.ts`
 * already imports `Workflow` from this module, and a reverse static import
 * would create an init-time cycle that leaves `Workflow` undefined when
 * `class EventedWorkflow extends Workflow` evaluates.
 *
 * Any caller that needs schedule promotion must ensure the evented module is
 * loaded — typically by importing from `@mastra/core/workflows` (which
 * re-exports `./evented`) or by an explicit `import '@mastra/core/workflows/evented'`.
 */
type EventedCreateWorkflowFn = (
  params: WorkflowConfig<any, any, any, any, any, any>,
) => Workflow<any, any, any, any, any, any, any, any>;

// `var` is intentional: it is hoisted and initialized to `undefined` at the top
// of module evaluation, which avoids TDZ if the evented module ends up being
// evaluated before this module finishes its body (e.g. when both are reached
// via different import chains during the same load).

var eventedCreateWorkflow: EventedCreateWorkflowFn | undefined;

/** @internal Called once by the evented module at load time. */
export function __registerEventedCreateWorkflow(fn: EventedCreateWorkflowFn): void {
  eventedCreateWorkflow = fn;
}

export function createWorkflow<
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TSteps extends Step<string, any, any, any, any, any, DefaultEngineType>[] = Step[],
  TRequestContext extends Record<string, any> | unknown = unknown,
>(params: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps, TRequestContext>) {
  // A workflow that declares a `schedule` is auto-promoted to the evented engine.
  // The public Workflow API surface is unchanged — EventedWorkflow extends Workflow
  // and overrides createRun/start/startAsync/streamLegacy/stream/resume with matching
  // signatures. Users keep calling it the same way; manual runs and scheduled fires
  // share a single execution path.
  if (params.schedule) {
    if (!eventedCreateWorkflow) {
      throw new MastraError({
        id: 'MASTRA_WORKFLOW_SCHEDULE_EVENTED_MODULE_NOT_LOADED',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
        text:
          `Workflow "${params.id}" declares a schedule, which auto-promotes it to the evented execution engine, ` +
          `but the evented module has not been loaded. This usually means you imported \`createWorkflow\` from a deep path. ` +
          `Import from \`@mastra/core/workflows\` or add \`import '@mastra/core/workflows/evented';\` to your entry file.`,
        details: { workflowId: String(params.id ?? '') },
      });
    }
    return eventedCreateWorkflow(params) as unknown as Workflow<
      DefaultEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      TInput,
      TRequestContext
    >;
  }
  return new Workflow<DefaultEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TInput, TRequestContext>(params);
}

export function cloneWorkflow<
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TSteps extends Step<string, any, any, any, any, any, DefaultEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    any,
    DefaultEngineType
  >[],
  TPrevSchema = TInput,
>(
  workflow: Workflow<DefaultEngineType, TSteps, string, TState, TInput, TOutput, TPrevSchema>,
  opts: { id: TWorkflowId },
): Workflow<DefaultEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  const wf: Workflow<DefaultEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> = new Workflow({
    id: opts.id,
    inputSchema: workflow.inputSchema,
    outputSchema: workflow.outputSchema,
    steps: workflow.stepDefs,
    mastra: workflow.mastra,
    options: workflow.options,
  });

  wf.setStepFlow(workflow.stepGraph);
  wf.commit();
  return wf;
}

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
  public inputSchema: StandardSchemaWithJSON<TInput>;
  public outputSchema: StandardSchemaWithJSON<TOutput>;
  public stateSchema?: StandardSchemaWithJSON<TState>;
  public requestContextSchema?: StandardSchemaWithJSON<TRequestContext>;
  public steps: Record<string, StepWithComponent>;
  public stepDefs?: TSteps;
  public engineType: WorkflowEngineType = 'default';
  /** Type of workflow - 'processor' for processor workflows, 'default' otherwise */
  public type: WorkflowType = 'default';
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
    executionEngine,
    retryConfig,
    steps,
    options = {},
    type,
  }: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps, TRequestContext>) {
    super({ name: id, component: RegisteredLogger.WORKFLOW });
    this.id = id;
    this.description = description;
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
      shouldPersistSnapshot: options.shouldPersistSnapshot ?? (() => true),
      tracingPolicy: options.tracingPolicy,
      onFinish: options.onFinish,
      onError: options.onError,
      sharePubsub: options.sharePubsub,
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
    this.stepFlow.push({ type: 'step', step: step as any });
    this.serializedStepFlow.push({
      type: 'step',
      step: {
        id: step.id,
        description: step.description,
        metadata: step.metadata,
        component: (step as SerializedStep).component,
        serializedStepFlow: (step as SerializedStep).serializedStepFlow,
        canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
      },
    });
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
   * Adds a sleep step to the workflow
   * @param duration The duration to sleep for
   * @returns The workflow instance for chaining
   */
  sleep(duration: number | ExecuteFunction<TState, TPrevSchema, number, any, any, TEngineType>) {
    const id = `sleep_${this.#mastra?.generateId({ idType: 'step', source: 'workflow', entityId: this.id, stepType: 'sleep' }) || randomUUID()}`;

    const opts: StepFlowEntry<TEngineType> =
      typeof duration === 'function'
        ? { type: 'sleep', id, fn: duration }
        : { type: 'sleep', id, duration: duration as number };
    const serializedOpts: SerializedStepFlowEntry =
      typeof duration === 'function'
        ? { type: 'sleep', id, fn: duration.toString() }
        : { type: 'sleep', id, duration: duration as number };

    this.stepFlow.push(opts);
    this.serializedStepFlow.push(serializedOpts);
    this.steps[id] = createStep({
      id,
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
   * @returns The workflow instance for chaining
   */
  sleepUntil(date: Date | ExecuteFunction<TState, TPrevSchema, Date, any, any, TEngineType>) {
    const id = `sleep_${this.#mastra?.generateId({ idType: 'step', source: 'workflow', entityId: this.id, stepType: 'sleep-until' }) || randomUUID()}`;
    const opts: StepFlowEntry<TEngineType> =
      typeof date === 'function'
        ? { type: 'sleepUntil', id, fn: date }
        : { type: 'sleepUntil', id, date: date as Date };
    const serializedOpts: SerializedStepFlowEntry =
      typeof date === 'function'
        ? { type: 'sleepUntil', id, fn: date.toString() }
        : { type: 'sleepUntil', id, date: date as Date };

    this.stepFlow.push(opts);
    this.serializedStepFlow.push(serializedOpts);
    this.steps[id] = createStep({
      id,
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
            | DynamicMapping<TPrevSchema, any>;
        }
      | ExecuteFunction<TState, TPrevSchema, any, any, any, TEngineType>,
    stepOptions?: { id?: string | null },
  ): Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, any, TRequestContext> {
    // Create an implicit step that handles the mapping
    if (typeof mappingConfig === 'function') {
      const mappingStep: any = createStep({
        id:
          stepOptions?.id ||
          `mapping_${this.#mastra?.generateId({ idType: 'step', source: 'workflow', entityId: this.id, stepType: 'mapping' }) || randomUUID()}`,
        inputSchema: z.any(),
        outputSchema: z.any(),
        execute: mappingConfig as any,
      });

      this.stepFlow.push({ type: 'step', step: mappingStep as any });
      this.serializedStepFlow.push({
        type: 'step',
        step: {
          id: mappingStep.id,
          mapConfig:
            mappingConfig.toString()?.length > 1000
              ? mappingConfig.toString().slice(0, 1000) + '...\n}'
              : mappingConfig.toString(),
        },
      });
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
        } else {
          a[key] = m;
        }
        return a;
      },
      {} as Record<string, any>,
    );
    const mappingStep: any = createStep({
      id:
        stepOptions?.id ||
        `mapping_${this.#mastra?.generateId({ idType: 'step', source: 'workflow', entityId: this.id, stepType: 'mapping' }) || randomUUID()}`,
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ctx => {
        const { getStepResult, getInitData, requestContext } = ctx;

        const result: Record<string, any> = {};
        for (const [key, mapping] of Object.entries(mappingConfig)) {
          const m: any = mapping;

          if (m.value !== undefined) {
            result[key] = m.value;
            continue;
          }

          if (m.fn !== undefined) {
            result[key] = await m.fn(ctx);
            continue;
          }

          if (m.requestContextPath) {
            result[key] = requestContext.get(m.requestContextPath);
            continue;
          }

          const stepResult = m.initData
            ? getInitData()
            : getStepResult(
                Array.isArray(m.step)
                  ? m.step.find((s: any) => {
                      const result = getStepResult(s);
                      if (typeof result === 'object' && result !== null) {
                        return Object.keys(result).length > 0;
                      }
                      return result;
                    })
                  : m.step,
              );

          if (m.path === '.') {
            result[key] = stepResult;
            continue;
          }

          const pathParts = m.path.split('.');
          let value: any = stepResult;
          for (const part of pathParts) {
            if (typeof value === 'object' && value !== null) {
              value = value[part];
            } else {
              throw new Error(`Invalid path ${m.path} in step ${m?.step?.id ?? 'initData'}`);
            }
          }

          result[key] = value;
        }
        return result;
      },
    });

    type MappedOutputSchema = any;

    this.stepFlow.push({ type: 'step', step: mappingStep as any });
    this.serializedStepFlow.push({
      type: 'step',
      step: {
        id: mappingStep.id,
        mapConfig:
          JSON.stringify(newMappingConfig, null, 2)?.length > 1000
            ? JSON.stringify(newMappingConfig, null, 2).slice(0, 1000) + '...\n}'
            : JSON.stringify(newMappingConfig, null, 2),
      },
    });
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
        TEngineType
      >
        ? Step<string, SubsetOf<S, TState>, TPrevSchema, O, any, any, TEngineType>
        : `Error: Expected Step with state schema that is a subset of workflow state`;
    },
  ) {
    this.stepFlow.push({ type: 'parallel', steps: steps.map(step => ({ type: 'step', step: step as any })) });
    this.serializedStepFlow.push({
      type: 'parallel',
      steps: steps.map((step: any) => ({
        type: 'step',
        step: {
          id: step.id,
          description: step.description,
          metadata: step.metadata,
          component: (step as SerializedStep).component,
          serializedStepFlow: (step as SerializedStep).serializedStepFlow,
          canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
        },
      })),
    });
    steps.forEach((step: any) => {
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
        ConditionFunction<TState, TPrevSchema, any, any, any, TEngineType>,
        Step<string, any, TPrevSchema, any, any, any, TEngineType, any>,
      ]
    >,
  >(steps: TBranchSteps) {
    this.stepFlow.push({
      type: 'conditional',
      steps: steps.map(([_cond, step]) => ({ type: 'step', step: step as any })),
      conditions: steps.map(([cond]) => cond),
      serializedConditions: steps.map(([cond, _step]) => ({ id: `${_step.id}-condition`, fn: cond.toString() })),
    });
    this.serializedStepFlow.push({
      type: 'conditional',
      steps: steps.map(([_cond, step]) => ({
        type: 'step',
        step: {
          id: step.id,
          description: step.description,
          metadata: step.metadata,
          component: (step as SerializedStep).component,
          serializedStepFlow: (step as SerializedStep).serializedStepFlow,
          canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
        },
      })),
      serializedConditions: steps.map(([cond, _step]) => ({ id: `${_step.id}-condition`, fn: cond.toString() })),
    });
    steps.forEach(([_, step]) => {
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
    condition: LoopConditionFunction<TState, TSchemaOut, any, any, any, TEngineType>,
  ) {
    this.stepFlow.push({
      type: 'loop',
      step: step as any,
      condition,
      loopType: 'dowhile',
      serializedCondition: { id: `${step.id}-condition`, fn: condition.toString() },
    });
    this.serializedStepFlow.push({
      type: 'loop',
      step: {
        id: step.id,
        description: step.description,
        metadata: step.metadata,
        component: (step as SerializedStep).component,
        serializedStepFlow: (step as SerializedStep).serializedStepFlow,
        canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
      },
      serializedCondition: { id: `${step.id}-condition`, fn: condition.toString() },
      loopType: 'dowhile',
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
    condition: LoopConditionFunction<TState, TSchemaOut, any, any, any, TEngineType>,
  ) {
    this.stepFlow.push({
      type: 'loop',
      step: step as any,
      condition,
      loopType: 'dountil',
      serializedCondition: { id: `${step.id}-condition`, fn: condition.toString() },
    });
    this.serializedStepFlow.push({
      type: 'loop',
      step: {
        id: step.id,
        description: step.description,
        metadata: step.metadata,
        component: (step as SerializedStep).component,
        serializedStepFlow: (step as SerializedStep).serializedStepFlow,
        canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
      },
      serializedCondition: { id: `${step.id}-condition`, fn: condition.toString() },
      loopType: 'dountil',
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
    TPrevIsArray extends TPrevSchema extends any[] ? true : false,
    TStepState,
    TStepInputSchema extends TPrevSchema extends (infer TElement)[] ? TElement : never,
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
    opts?: {
      concurrency: number;
    },
  ) {
    const actualStep = step as Step<any, any, any, any, any, any>;
    this.stepFlow.push({ type: 'foreach', step: step as any, opts: opts ?? { concurrency: 1 } });
    this.serializedStepFlow.push({
      type: 'foreach',
      step: {
        id: (step as SerializedStep).id,
        description: (step as SerializedStep).description,
        metadata: (step as SerializedStep).metadata,
        component: (step as SerializedStep).component,
        serializedStepFlow: (step as SerializedStep).serializedStepFlow,
        canSuspend: Boolean(actualStep.suspendSchema || actualStep.resumeSchema),
      },
      opts: opts ?? { concurrency: 1 },
    });
    this.steps[(step as any).id] = step as any;
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
        executionEngine: this.executionEngine,
        executionGraph: this.executionGraph,
        mastra: this.#mastra,
        retryConfig: this.retryConfig,
        serializedStepGraph: this.serializedStepGraph,
        disableScorers: options?.disableScorers,
        cleanup: () => this.#runs.delete(runIdToUse),
        tracingPolicy: this.#options?.tracingPolicy,
        workflowSteps: this.steps,
        validateInputs: this.#options?.validateInputs,
        workflowEngineType: this.engineType,
        pubsub: options?.pubsub,
      });

    this.#runs.set(runIdToUse, run);

    const shouldPersistSnapshot = this.#options.shouldPersistSnapshot({
      workflowStatus: run.workflowRunStatus,
      stepResults: {},
    });

    const existingRun = await this.getWorkflowRunById(runIdToUse, {
      withNestedWorkflows: false,
    });

    // Check if run exists in persistent storage (not just in-memory)
    const existsInStorage = existingRun && !existingRun.isFromInMemory;

    // If a run exists in storage, update the run's status to reflect the actual state
    // This fixes the issue where createRun checks storage but doesn't use the stored data
    if (existsInStorage && existingRun.status) {
      run.workflowRunStatus = existingRun.status as WorkflowRunStatus;
    }

    if (!existsInStorage && shouldPersistSnapshot) {
      const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: this.id,
        runId: runIdToUse,
        resourceId: options?.resourceId,
        snapshot: {
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
        },
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
  } & Partial<ObservabilityContext>): Promise<TOutput | undefined> {
    const observabilityContext = resolveObservabilityContext(rest);
    this.__registerMastra(mastra);

    // FGA authorization check
    const fgaProvider = mastra?.getServer()?.fga;
    if (fgaProvider) {
      const user = requestContext?.get('user' as any);
      if (user) {
        const { checkFGA } = await import('../auth/ee/fga-check');
        await checkFGA({
          fgaProvider,
          user,
          resource: { type: 'workflow', id: this.id },
          permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
        });
      }
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
    run.abortController.signal.addEventListener('abort', nestedAbortCb);
    abortSignal.addEventListener('abort', async () => {
      run.abortController.signal.removeEventListener('abort', nestedAbortCb);
      await run.cancel();
    });

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

    if (isTimeTravel) {
      res = await run.timeTravel({
        inputData: timeTravel?.inputData,
        resumeData: timeTravel?.resumeData,
        initialState: state,
        step: timeTravel?.steps,
        context: (timeTravel?.nestedStepResults?.[this.id] ?? {}) as any,
        nestedStepsContext: timeTravel?.nestedStepResults as any,
        requestContext,
        ...observabilityContext,
        outputWriter,
        outputOptions: { includeState: true, includeResumeLabels: true },
        perStep,
      });
    } else if (restart) {
      res = await run.restart({ requestContext, ...observabilityContext, outputWriter });
    } else if (isResume) {
      res = await run.resume({
        resumeData,
        step: resume.steps?.length > 0 ? (resume.steps as any) : undefined,
        requestContext,
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
        ...observabilityContext,
        outputWriter,
        initialState: state,
        outputOptions: { includeState: true, includeResumeLabels: true },
        perStep,
      } as any);
    }

    unwatch();
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
        await suspend(
          {
            ...(stepResult as any)?.suspendPayload,
            __workflow_meta: { runId: run.runId, path: suspendPath },
          },
          {
            resumeLabel: Object.keys(res.resumeLabels ?? {}),
          },
        );
      }
    }

    if (res.status === 'failed') {
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
    const runningRuns = await this.listWorkflowRuns({ status: 'running' });
    const waitingRuns = await this.listWorkflowRuns({ status: 'waiting' });

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
      if (stepGraph && (stepGraph as any)?.step?.component === 'WORKFLOW') {
        // Evented runtime stores nested workflow's runId in metadata.nestedRunId (set by step-executor).
        // Default runtime uses the parent runId directly to look up nested workflow steps.
        const stepResult = steps[step] as any;
        const nestedRunId = stepResult?.metadata?.nestedRunId ?? runId;

        const nestedSteps = await this.getWorkflowRunSteps({ runId: nestedRunId, workflowId: step });
        if (nestedSteps) {
          const updatedNestedSteps = Object.entries(nestedSteps).reduce(
            (acc, [key, value]) => {
              acc[`${step}.${key}`] = value as StepResult<any, any, any, any>;
              return acc;
            },
            {} as Record<string, StepResult<any, any, any, any>>,
          );
          finalSteps = { ...finalSteps, ...updatedNestedSteps };
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
      throw new Error(
        `Invalid ${type}: \n` + validatedInputData.issues.map(e => `- ${e.path?.join('.')}: ${e.message}`).join('\n'),
      );
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
      const contextValues = requestContext?.all ?? {};
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

    const traceId = workflowSpan?.externalTraceId;
    const spanId = workflowSpan?.id;
    const inputDataToUse = await this._validateInput(inputData);
    const initialStateToUse = await this._validateInitialState(initialState ?? ({} as TState));
    await this._validateRequestContext(requestContext as RequestContext);

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

    this.closeStreamAction = async () => {
      await this.pubsub.publish(`workflow.events.v2.${this.runId}`, {
        type: 'watch',
        runId: this.runId,
        data: { type: 'workflow-finish', payload: { runId: this.runId } },
      });
      unwatch();
      await Promise.all(this.#observerHandlers.map(handler => handler()));
      this.#observerHandlers = [];

      try {
        await writer.close();
      } catch (err) {
        this.mastra?.getLogger()?.error('Error closing stream:', err);
      } finally {
        writer.releaseLock();
      }
    };

    void this.pubsub.publish(`workflow.events.v2.${this.runId}`, {
      type: 'watch',
      runId: this.runId,
      data: { type: 'workflow-start', payload: { runId: this.runId } },
    });

    this.executionResults = this._start({
      inputData,
      requestContext,
      format: 'legacy',
      ...observabilityContext,
      tracingOptions,
    } as any).then(result => {
      if (result.status !== 'suspended') {
        this.closeStreamAction?.().catch(() => {});
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

    this.#observerHandlers.push(async () => {
      unwatch();
      try {
        await writer.close();
      } catch (err) {
        this.mastra?.getLogger()?.error('Error closing stream:', err);
      } finally {
        writer.releaseLock();
      }
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

        self.closeStreamAction = async () => {
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

        const executionResultsPromise = self._start({
          inputData,
          requestContext,
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

          if (closeOnSuspend) {
            // always close stream, even if the workflow is suspended
            // this will trigger a finish event with workflow status set to suspended
            self.closeStreamAction?.().catch(() => {});
          } else if (executionResults.status !== 'suspended') {
            self.closeStreamAction?.().catch(() => {});
          }
          if (self.streamOutput) {
            self.streamOutput.updateResults(
              executionResults as unknown as WorkflowResult<TState, TInput, TOutput, TSteps>,
            );
          }
        } catch (err) {
          self.streamOutput?.rejectResults(err as unknown as Error);
          self.closeStreamAction?.().catch(() => {});
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

        self.closeStreamAction = async () => {
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
        const executionResultsPromise = self._resume({
          resumeData,
          step,
          requestContext,
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
          self.closeStreamAction?.().catch(() => {});

          if (self.streamOutput) {
            self.streamOutput.updateResults(executionResults);
          }
        } catch (err) {
          self.streamOutput?.rejectResults(err as unknown as Error);
          self.closeStreamAction?.().catch(() => {});
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
  watch(cb: (event: WorkflowStreamEvent) => void): () => void {
    const wrappedCb = (event: Event) => {
      if (event.runId === this.runId) {
        cb(event.data as WorkflowStreamEvent);
      }
    };

    const nestedWatchCb = (event: Event) => {
      if (event.runId === this.runId) {
        const { event: nestedEvent, workflowId } = event.data as {
          event: { type: string; payload?: { id: string } & Record<string, unknown>; data?: any };
          workflowId: string;
        };

        // Data chunks from writer.custom() should bubble up directly without modification
        // These are events with type starting with 'data-' and have a 'data' property
        if (nestedEvent.type.startsWith('data-') && nestedEvent.data !== undefined) {
          // Bubble up custom data events directly to preserve their structure
          void this.pubsub.publish(`workflow.events.v2.${this.runId}`, {
            type: 'watch',
            runId: this.runId,
            data: nestedEvent,
          });
        } else {
          // Regular workflow events get prefixed with nested workflow ID
          void this.pubsub.publish(`workflow.events.v2.${this.runId}`, {
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
  async watchAsync(cb: (event: WorkflowStreamEvent) => void): Promise<() => void> {
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
    } & Partial<ObservabilityContext>,
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._resume(params);
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
    } & Partial<ObservabilityContext> = {},
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._restart(args);
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
    } & Partial<ObservabilityContext>,
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const observabilityContext = resolveObservabilityContext(params);
    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

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
      parentSpanId: shouldUsePersistedParentSpan
        ? persistedTracingContext?.spanId
        : params.tracingOptions?.parentSpanId,
    };

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
    });

    const traceId = workflowSpan?.externalTraceId;
    const spanId = workflowSpan?.id;

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
    ...rest
  }: {
    requestContext?: RequestContext<TRequestContext>;
    outputWriter?: OutputWriter;
    tracingOptions?: TracingOptions;
  } & Partial<ObservabilityContext>): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const observabilityContext = resolveObservabilityContext(rest);
    if (this.workflowEngineType !== 'default') {
      throw new Error(`restart() is not supported on ${this.workflowEngineType} workflows`);
    }

    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    let nestedWorkflowPending = false;

    if (!snapshot) {
      throw new Error(`Snapshot not found for run ${this.runId}`);
    }

    if (snapshot.status !== 'running' && snapshot.status !== 'waiting') {
      if (snapshot.status === 'pending' && !!snapshot.context.input) {
        //possible the server died just before the nested workflow execution started.
        //only nested workflows have input data in context when it's still pending
        nestedWorkflowPending = true;
      } else {
        throw new Error('This workflow run was not active');
      }
    }

    let nestedWorkflowActiveStepsPath: Record<string, number[]> = {};

    const firstEntry = this.executionGraph.steps[0]!;

    if (firstEntry.type === 'step' || firstEntry.type === 'foreach' || firstEntry.type === 'loop') {
      nestedWorkflowActiveStepsPath = {
        [firstEntry.step.id]: [0],
      };
    } else if (firstEntry.type === 'sleep' || firstEntry.type === 'sleepUntil') {
      nestedWorkflowActiveStepsPath = {
        [firstEntry.id]: [0],
      };
    } else if (firstEntry.type === 'conditional' || firstEntry.type === 'parallel') {
      nestedWorkflowActiveStepsPath = firstEntry.steps.reduce(
        (acc, step) => {
          acc[step.step.id] = [0];
          return acc;
        },
        {} as Record<string, number[]>,
      );
    }
    const restartData: RestartExecutionParams = {
      activePaths: nestedWorkflowPending ? [0] : snapshot.activePaths,
      activeStepsPath: nestedWorkflowPending ? nestedWorkflowActiveStepsPath : snapshot.activeStepsPath,
      stepResults: snapshot.context,
      state: snapshot.value,
      stepExecutionPath: snapshot?.stepExecutionPath,
    };
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

        self.closeStreamAction = async () => {
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
        const executionResultsPromise = self._timeTravel({
          inputData,
          step,
          context,
          nestedStepsContext,
          resumeData,
          initialState,
          requestContext,
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
          self.closeStreamAction?.().catch(() => {});

          if (self.streamOutput) {
            self.streamOutput.updateResults(executionResults);
          }
        } catch (err) {
          self.streamOutput?.rejectResults(err as unknown as Error);
          self.closeStreamAction?.().catch(() => {});
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
