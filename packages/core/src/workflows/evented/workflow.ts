import { randomUUID } from 'node:crypto';
import type { CoreMessage } from '@internal/ai-sdk-v4';
import { z } from 'zod/v3';
import { Agent } from '../../agent';
import type { MastraDBMessage } from '../../agent';
import { MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import { RequestContext } from '../../di';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { MastraScorers } from '../../evals';
import type { Event } from '../../events';
import type { Mastra } from '../../mastra';
import type { TracingContext } from '../../observability';
import { EntityType, SpanType } from '../../observability';
import type { Processor } from '../../processors';
import { ProcessorRunner, ProcessorStepOutputSchema, ProcessorStepSchema } from '../../processors';
import type { ProcessorStepOutput } from '../../processors/step-schema';
import type { InferSchemaOutput, SchemaWithValidation } from '../../stream/base/schema';
import type { ChunkType } from '../../stream/types';
import { Tool } from '../../tools';
import type { ToolExecutionContext } from '../../tools/types';
import type { DynamicArgument } from '../../types';
import { Workflow, Run } from '../../workflows';
import type { AgentStepOptions } from '../../workflows';
import type { ExecutionEngine, ExecutionGraph } from '../../workflows/execution-engine';
import type { Step } from '../../workflows/step';
import type {
  SerializedStepFlowEntry,
  WorkflowConfig,
  WorkflowResult,
  StepWithComponent,
  WorkflowStreamEvent,
  WorkflowEngineType,
  StepParams,
  ToolStep,
  DefaultEngineType,
} from '../../workflows/types';
import { PUBSUB_SYMBOL } from '../constants';
import { EventedExecutionEngine } from './execution-engine';
import { WorkflowEventProcessor } from './workflow-event-processor';

export type EventedEngineType = {};

export function cloneWorkflow<
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any, EventedEngineType, any>[] = Step<
    string,
    any,
    any,
    any,
    any,
    any,
    EventedEngineType,
    any
  >[],
  TPrevSchema extends z.ZodType<any> = TInput,
  TRequestContextSchema extends z.ZodType<any> | undefined = undefined,
>(
  workflow: Workflow<EventedEngineType, TSteps, string, TState, TInput, TOutput, TPrevSchema, TRequestContextSchema>,
  opts: { id: TWorkflowId },
): Workflow<EventedEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema, TRequestContextSchema> {
  const wf: Workflow<
    EventedEngineType,
    TSteps,
    TWorkflowId,
    TState,
    TInput,
    TOutput,
    TPrevSchema,
    TRequestContextSchema
  > = new Workflow({
    id: opts.id,
    inputSchema: workflow.inputSchema,
    outputSchema: workflow.outputSchema,
    steps: workflow.stepDefs,
    mastra: workflow.mastra,
    options: workflow.options,
    requestContextSchema: workflow.requestContextSchema,
  });

  wf.setStepFlow(workflow.stepGraph);
  wf.commit();
  return wf;
}

export function cloneStep<TStepId extends string>(
  step: Step<string, any, any, any, any, any, EventedEngineType>,
  opts: { id: TStepId },
): Step<TStepId, any, any, any, any, any, EventedEngineType> {
  return {
    id: opts.id,
    description: step.description,
    inputSchema: step.inputSchema,
    outputSchema: step.outputSchema,
    suspendSchema: step.suspendSchema,
    resumeSchema: step.resumeSchema,
    stateSchema: step.stateSchema,
    requestContextSchema: step.requestContextSchema,
    execute: step.execute,
    retries: step.retries,
    scorers: step.scorers,
    component: step.component,
  };
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

/**
 * Type guard to check if an object is a Processor.
 * A Processor must have an 'id' property and at least one processor method.
 */
function isProcessor(obj: unknown): obj is Processor {
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
      typeof (obj as any).processOutputStep === 'function')
  );
}

// ============================================
// Overloads (Public API - clean types for consumers)
// ============================================

/**
 * Creates a step from explicit params
 * @param params Configuration parameters for the step
 * @param params.id Unique identifier for the step
 * @param params.description Optional description of what the step does
 * @param params.inputSchema Zod schema defining the input structure
 * @param params.outputSchema Zod schema defining the output structure
 * @param params.execute Function that performs the step's operations
 * @returns A Step object that can be added to the workflow
 */
export function createStep<TStepId extends string, TState, TStepInput, TStepOutput, TResume, TSuspend>(
  params: StepParams<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend>,
): Step<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType>;

/**
 * Creates a step from an agent with structured output
 */
export function createStep<TStepId extends string, TStepOutput>(
  agent: Agent<TStepId, any>,
  agentOptions: AgentStepOptions<TStepOutput> & {
    structuredOutput: { schema: TStepOutput };
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
  },
): Step<TStepId, unknown, { prompt: string }, TStepOutput, unknown, unknown, DefaultEngineType>;

/**
 * Creates a step from an agent (defaults to { text: string } output)
 */
export function createStep<
  TStepId extends string,
  TStepInput extends { prompt: string },
  TStepOutput extends { text: string },
  TResume,
  TSuspend,
>(
  agent: Agent<TStepId, any>,
  agentOptions?: AgentStepOptions<TStepOutput> & {
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
  },
): Step<TStepId, any, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType>;

/**
 * Creates a step from a tool
 */
export function createStep<
  TSchemaIn,
  TSuspend,
  TResume,
  TSchemaOut,
  TContext extends ToolExecutionContext<TSuspend, TResume>,
>(
  tool: ToolStep<TSchemaIn, TSuspend, TResume, TSchemaOut, TContext>,
  toolOptions?: { retries?: number; scorers?: DynamicArgument<MastraScorers> },
): Step<string, any, TSchemaIn, TSchemaOut, TResume, TSuspend, DefaultEngineType>;

/**
 * Creates a step from a Processor - wraps a Processor as a workflow step
 */
export function createStep<TProcessorId extends string>(
  processor: Processor<TProcessorId> & { inputSchema?: InferSchemaOutput<typeof ProcessorStepSchema> },
): Step<
  `processor:${TProcessorId}`,
  unknown,
  InferSchemaOutput<typeof ProcessorStepSchema>,
  InferSchemaOutput<typeof ProcessorStepOutputSchema>,
  unknown,
  unknown,
  DefaultEngineType
>;

// ============================================
// Implementation (uses type guards for clean logic)
// ============================================

export function createStep<TStepId extends string, TState, TStepInput, TStepOutput, TResume, TSuspend>(
  params:
    | StepParams<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend>
    | Agent<TStepId, any>
    | ToolStep<TStepInput, TSuspend, TResume, TStepOutput, any>
    | (Processor<TStepId> & { inputSchema?: TStepInput }),
  agentOrToolOptions?:
    | (AgentStepOptions<TStepOutput> & {
        retries?: number;
        scorers?: DynamicArgument<MastraScorers>;
      })
    | {
        retries?: number;
        scorers?: DynamicArgument<MastraScorers>;
      },
): Step<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType> {
  // Type assertions are needed because each branch returns a different Step type,
  // but the overloads ensure type safety for consumers
  if (isAgent(params)) {
    return createStepFromAgent(params, agentOrToolOptions) as Step<
      TStepId,
      TState,
      TStepInput,
      TStepOutput,
      TResume,
      TSuspend,
      DefaultEngineType
    >;
  }

  if (isToolStep(params)) {
    return createStepFromTool(params, agentOrToolOptions) as Step<
      TStepId,
      TState,
      TStepInput,
      TStepOutput,
      TResume,
      TSuspend,
      DefaultEngineType
    >;
  }

  if (isProcessor(params)) {
    return createStepFromProcessor(params) as unknown as Step<
      TStepId,
      TState,
      TStepInput,
      TStepOutput,
      TResume,
      TSuspend,
      DefaultEngineType
    >;
  }

  if (isStepParams(params)) {
    return createStepFromParams(params);
  }

  throw new Error('Invalid input: expected StepParams, Agent, ToolStep, or Processor');
}

// ============================================
// Internal Implementations
// ============================================

function createStepFromParams<TStepId extends string, TState, TStepInput, TStepOutput, TResume, TSuspend>(
  params: StepParams<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend>,
): Step<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType> {
  return {
    id: params.id,
    description: params.description,
    inputSchema: params.inputSchema,
    stateSchema: params.stateSchema,
    outputSchema: params.outputSchema,
    resumeSchema: params.resumeSchema,
    suspendSchema: params.suspendSchema,
    scorers: params.scorers,
    retries: params.retries,
    execute: params.execute.bind(params),
  };
}

function createStepFromAgent<TStepId extends string, TStepOutput>(
  params: Agent<TStepId, any>,
  agentOrToolOptions?: Record<string, unknown>,
): Step<TStepId, any, any, TStepOutput, unknown, unknown, DefaultEngineType> {
  const options = (agentOrToolOptions ?? {}) as
    | (AgentStepOptions<TStepOutput> & { retries?: number; scorers?: DynamicArgument<MastraScorers> })
    | undefined;
  // Determine output schema based on structuredOutput option
  const outputSchema = (options?.structuredOutput?.schema ??
    z.object({ text: z.string() })) as unknown as SchemaWithValidation<TStepOutput>;
  const { retries, scorers, ...agentOptions } = options ?? {};

  return {
    id: params.id,
    description: params.getDescription(),
    inputSchema: z.object({
      prompt: z.string(),
    }),
    outputSchema,
    retries,
    scorers,
    execute: async ({
      inputData,
      runId,
      [PUBSUB_SYMBOL]: pubsub,
      requestContext,
      tracingContext,
      abortSignal,
      abort,
    }) => {
      // TODO: support stream
      let streamPromise = {} as {
        promise: Promise<string>;
        resolve: (value: string) => void;
        reject: (reason?: any) => void;
      };

      streamPromise.promise = new Promise((resolve, reject) => {
        streamPromise.resolve = resolve;
        streamPromise.reject = reject;
      });
      // TODO: should use regular .stream()
      const { fullStream } = await params.streamLegacy((inputData as { prompt: string }).prompt, {
        ...(agentOptions ?? {}),
        tracingContext,
        requestContext,
        onFinish: result => {
          streamPromise.resolve(result.text);
        },
        abortSignal,
      });

      if (abortSignal.aborted) {
        return abort() as TStepOutput;
      }

      const toolData = {
        name: params.name,
        args: inputData,
      };

      await pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: { type: 'tool-call-streaming-start', ...(toolData ?? {}) },
      });
      for await (const chunk of fullStream) {
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

      return {
        text: await streamPromise.promise,
      } as TStepOutput;
    },
    component: params.component,
  };
}

function createStepFromTool<TStepInput, TSuspend, TResume, TStepOutput>(
  params: ToolStep<TStepInput, TSuspend, TResume, TStepOutput, any>,
  agentOrToolOptions?: Record<string, unknown>,
): Step<string, any, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType> {
  const toolOpts = agentOrToolOptions as { retries?: number; scorers?: DynamicArgument<MastraScorers> } | undefined;
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
    execute: async ({ inputData, mastra, requestContext, suspend, resumeData, runId, workflowId, state, setState }) => {
      // Tools receive (input, context) - just call the tool's execute
      if (!params.execute) {
        throw new Error(`Tool ${params.id} does not have an execute function`);
      }

      // Build context matching ToolExecutionContext structure
      const context = {
        mastra,
        requestContext,
        tracingContext: { currentSpan: undefined }, // TODO: Pass proper tracing context when evented workflows support tracing
        workflow: {
          runId,
          workflowId,
          state,
          setState,
          suspend,
          resumeData,
        },
      };

      // Tool.execute already handles the v1.0 signature properly
      return params.execute(inputData, context) as TStepOutput;
    },
    component: 'TOOL',
  };
}

function createStepFromProcessor<TProcessorId extends string>(
  processor: Processor<TProcessorId>,
): Step<
  `processor:${TProcessorId}`,
  unknown,
  InferSchemaOutput<typeof ProcessorStepSchema>,
  InferSchemaOutput<typeof ProcessorStepOutputSchema>,
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

  return {
    id: `processor:${processor.id}`,
    description: processor.name ?? `Processor ${processor.id}`,
    inputSchema: ProcessorStepSchema,
    outputSchema: ProcessorStepOutputSchema,
    execute: async ({ inputData, requestContext, tracingContext }) => {
      // Cast to output type for easier property access - the discriminated union
      // ensures type safety at the schema level, but inside the execute function
      // we need access to all possible properties
      const input = inputData as ProcessorStepOutput;
      const {
        phase,
        messages,
        messageList,
        stepNumber,
        systemMessages,
        part,
        streamParts,
        state,
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
      } = input;

      // Create a minimal abort function that throws TripWire
      const abort = (reason?: string, options?: { retry?: boolean; metadata?: unknown }): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.id}`, options, processor.id);
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
              input: { phase, messageCount: messages?.length },
              attributes: {
                processorExecutor: 'workflow',
                // Read processorIndex from processor (set in combineProcessorsIntoWorkflow)
                processorIndex: processor.processorIndex,
              },
            })
          : undefined;

      // Create tracing context with processor span so internal agent calls nest correctly
      const processorTracingContext: TracingContext | undefined = processorSpan
        ? { currentSpan: processorSpan }
        : tracingContext;

      // Base context for all processor methods - includes requestContext for memory processors
      // and tracingContext for proper span nesting when processors call internal agents
      const baseContext = {
        abort,
        retryCount: retryCount ?? 0,
        requestContext,
        tracingContext: processorTracingContext,
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
        state,
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
      };

      // Helper to execute phase with proper span lifecycle management
      const executePhaseWithSpan = async <T>(fn: () => Promise<T>): Promise<T> => {
        try {
          const result = await fn();
          processorSpan?.end({ output: result });
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

              // Create source checker before processing to preserve message sources
              const idsBeforeProcessing = (messages as MastraDBMessage[]).map(m => m.id);
              const check = passThrough.messageList.makeMessageSourceChecker();

              const result = await processor.processInput({
                ...baseContext,
                messages: messages as MastraDBMessage[],
                messageList: passThrough.messageList,
                systemMessages: (systemMessages ?? []) as CoreMessage[],
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
                  'input',
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
                  'input',
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

              // Create source checker before processing to preserve message sources
              const idsBeforeProcessing = (messages as MastraDBMessage[]).map(m => m.id);
              const check = passThrough.messageList.makeMessageSourceChecker();

              const result = await processor.processInputStep({
                ...baseContext,
                messages: messages as MastraDBMessage[],
                messageList: passThrough.messageList,
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
              });

              const validatedResult = await ProcessorRunner.validateAndFormatProcessInputStepResult(result, {
                messageList: passThrough.messageList,
                processor,
                stepNumber: stepNumber ?? 0,
              });

              if (validatedResult.messages) {
                ProcessorRunner.applyMessagesToMessageList(
                  validatedResult.messages,
                  passThrough.messageList,
                  idsBeforeProcessing,
                  check,
                );
              }

              if (validatedResult.systemMessages) {
                passThrough.messageList!.replaceAllSystemMessages(validatedResult.systemMessages as CoreMessage[]);
              }

              // Preserve messages in return - passThrough doesn't include messages,
              // so we must explicitly include it to avoid losing it for subsequent steps
              return { ...passThrough, messages, ...validatedResult };
            }
            return { ...passThrough, messages };
          }

          case 'outputStream': {
            if (processor.processOutputStream) {
              // Manage per-processor span lifecycle across stream chunks
              // Use unique key to store span on shared state object
              const spanKey = `__outputStreamSpan_${processor.id}`;
              const mutableState = (state ?? {}) as Record<string, unknown>;
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
                  input: { phase, streamParts: [] },
                  attributes: {
                    processorExecutor: 'workflow',
                    processorIndex: processor.processorIndex,
                  },
                });
                mutableState[spanKey] = processorSpan;
              }

              // Update span with current chunk data
              if (processorSpan) {
                processorSpan.input = {
                  phase,
                  streamParts: streamParts ?? [],
                  totalChunks: (streamParts ?? []).length,
                };
              }

              // Create tracing context with processor span for internal agent calls
              const processorTracingContext = processorSpan
                ? { currentSpan: processorSpan }
                : baseContext.tracingContext;

              // Handle outputStream span lifecycle explicitly (not via executePhaseWithSpan)
              // because outputStream uses a per-processor span stored in mutableState
              let result: ChunkType | null | undefined;
              try {
                result = await processor.processOutputStream({
                  ...baseContext,
                  tracingContext: processorTracingContext,
                  part: part as ChunkType,
                  streamParts: (streamParts ?? []) as ChunkType[],
                  state: mutableState,
                  messageList: passThrough.messageList, // Optional for stream processing
                });

                // End span on finish chunk
                if (part && (part as ChunkType).type === 'finish') {
                  processorSpan?.end({ output: result });
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

              const result = await processor.processOutputResult({
                ...baseContext,
                messages: messages as MastraDBMessage[],
                messageList: passThrough.messageList,
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

              // Create source checker before processing to preserve message sources
              const idsBeforeProcessing = (messages as MastraDBMessage[]).map(m => m.id);
              const check = passThrough.messageList.makeMessageSourceChecker();

              const result = await processor.processOutputStep({
                ...baseContext,
                messages: messages as MastraDBMessage[],
                messageList: passThrough.messageList,
                stepNumber: stepNumber ?? 0,
                finishReason,
                toolCalls: toolCalls as any,
                text,
                systemMessages: (systemMessages ?? []) as CoreMessage[],
                steps: steps ?? [],
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

          default:
            return { ...passThrough, messages };
        }
      });
    },
    component: 'PROCESSOR',
  };
}

export function createWorkflow<
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TSteps extends Step<string, any, any, any, any, any, EventedEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    any,
    EventedEngineType
  >[],
>(params: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
  const eventProcessor = new WorkflowEventProcessor({ mastra: params.mastra! });
  const executionEngine = new EventedExecutionEngine({
    mastra: params.mastra!,
    eventProcessor,
    options: {
      validateInputs: params.options?.validateInputs ?? true,
      shouldPersistSnapshot: params.options?.shouldPersistSnapshot ?? (() => true),
      tracingPolicy: params.options?.tracingPolicy,
      onFinish: params.options?.onFinish,
      onError: params.options?.onError,
    },
  });
  return new EventedWorkflow<EventedEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TInput>({
    ...params,
    executionEngine,
  });
}

export class EventedWorkflow<
  TEngineType = EventedEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TPrevSchema = TInput,
> extends Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  constructor(params: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
    super(params);
    this.engineType = 'evented';
  }

  __registerMastra(mastra: Mastra) {
    super.__registerMastra(mastra);
    this.executionEngine.__registerMastra(mastra);
  }

  async createRun(options?: {
    runId?: string;
    resourceId?: string;
    disableScorers?: boolean;
  }): Promise<Run<TEngineType, TSteps, TState, TInput, TOutput>> {
    const runIdToUse = options?.runId || randomUUID();

    // Return a new Run instance with object parameters
    const run: Run<TEngineType, TSteps, TState, TInput, TOutput> =
      this.runs.get(runIdToUse) ??
      new EventedRun({
        workflowId: this.id,
        runId: runIdToUse,
        resourceId: options?.resourceId,
        executionEngine: this.executionEngine,
        executionGraph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        mastra: this.mastra,
        retryConfig: this.retryConfig,
        cleanup: () => this.runs.delete(runIdToUse),
        workflowSteps: this.steps,
        validateInputs: this.options?.validateInputs,
        workflowEngineType: this.engineType,
      });

    this.runs.set(runIdToUse, run);

    const shouldPersistSnapshot = this.options?.shouldPersistSnapshot?.({
      workflowStatus: run.workflowRunStatus,
      stepResults: {},
    });

    const existingRun = await this.getWorkflowRunById(runIdToUse, {
      withNestedWorkflows: false,
    });

    // Check if run exists in persistent storage (not just in-memory)
    const existsInStorage = existingRun && !existingRun.isFromInMemory;

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
          context: {},
          activePaths: [],
          serializedStepGraph: this.serializedStepGraph,
          activeStepsPath: {},
          suspendedPaths: {},
          resumeLabels: {},
          waitingPaths: {},
          result: undefined,
          error: undefined,
          // @ts-ignore
          timestamp: Date.now(),
        },
      });
    }

    return run;
  }
}

export class EventedRun<
  TEngineType = EventedEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
> extends Run<TEngineType, TSteps, TState, TInput, TOutput> {
  constructor(params: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    executionEngine: ExecutionEngine;
    executionGraph: ExecutionGraph;
    serializedStepGraph: SerializedStepFlowEntry[];
    mastra?: Mastra;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    cleanup?: () => void;
    workflowSteps: Record<string, StepWithComponent>;
    validateInputs?: boolean;
    workflowEngineType: WorkflowEngineType;
  }) {
    super(params);
    this.serializedStepGraph = params.serializedStepGraph;
  }

  /**
   * Set up abort signal handler to publish workflow.cancel event when abortController.abort() is called.
   * This ensures consistent cancellation behavior whether abort() is called directly or via cancel().
   */
  private setupAbortHandler(): void {
    const abortHandler = () => {
      this.mastra?.pubsub
        .publish('workflows', {
          type: 'workflow.cancel',
          runId: this.runId,
          data: {
            workflowId: this.workflowId,
            runId: this.runId,
          },
        })
        .catch(err => {
          this.mastra?.getLogger()?.error(`Failed to publish workflow.cancel for runId ${this.runId}:`, err);
        });
    };
    this.abortController.signal.addEventListener('abort', abortHandler, { once: true });
  }

  async start({
    inputData,
    initialState,
    requestContext,
    perStep,
  }: {
    inputData?: TInput;
    requestContext?: RequestContext;
    initialState?: TState;
    perStep?: boolean;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    // Add validation checks
    if (this.serializedStepGraph.length === 0) {
      throw new Error(
        'Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.',
      );
    }
    if (!this.executionGraph.steps) {
      throw new Error('Uncommitted step flow changes detected. Call .commit() to register the steps.');
    }

    requestContext = requestContext ?? new RequestContext();

    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      snapshot: {
        runId: this.runId,
        serializedStepGraph: this.serializedStepGraph,
        status: 'running',
        value: {},
        context: {} as any,
        requestContext: Object.fromEntries(requestContext.entries()),
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: Date.now(),
      },
    });

    const inputDataToUse = await this._validateInput(inputData ?? ({} as TInput));
    const initialStateToUse = await this._validateInitialState(initialState ?? ({} as TState));

    if (!this.mastra?.pubsub) {
      throw new Error('Mastra instance with pubsub is required for workflow execution');
    }

    this.setupAbortHandler();

    const result = await this.executionEngine.execute<TState, TInput, WorkflowResult<TState, TInput, TOutput, TSteps>>({
      workflowId: this.workflowId,
      runId: this.runId,
      graph: this.executionGraph,
      serializedStepGraph: this.serializedStepGraph,
      input: inputDataToUse,
      initialState: initialStateToUse,
      pubsub: this.mastra.pubsub,
      retryConfig: this.retryConfig,
      requestContext,
      abortController: this.abortController,
      perStep,
    });

    // console.dir({ startResult: result }, { depth: null });

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    return result;
  }

  /**
   * Starts the workflow execution without waiting for completion (fire-and-forget).
   * Returns immediately with the runId. The workflow executes in the background via pubsub.
   * Use this when you don't need to wait for the result or want to avoid polling failures.
   */
  async startAsync({
    inputData,
    initialState,
    requestContext,
    perStep,
  }: {
    inputData?: TInput;
    requestContext?: RequestContext;
    initialState?: TState;
    perStep?: boolean;
  }): Promise<{ runId: string }> {
    // Add validation checks
    if (this.serializedStepGraph.length === 0) {
      throw new Error(
        'Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.',
      );
    }
    if (!this.executionGraph.steps) {
      throw new Error('Uncommitted step flow changes detected. Call .commit() to register the steps.');
    }

    requestContext = requestContext ?? new RequestContext();

    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      snapshot: {
        runId: this.runId,
        serializedStepGraph: this.serializedStepGraph,
        status: 'running',
        value: {},
        context: {} as any,
        requestContext: Object.fromEntries(requestContext.entries()),
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: Date.now(),
      },
    });

    const inputDataToUse = await this._validateInput(inputData ?? ({} as TInput));
    const initialStateToUse = await this._validateInitialState(initialState ?? ({} as TState));

    if (!this.mastra?.pubsub) {
      throw new Error('Mastra instance with pubsub is required for workflow execution');
    }

    // Fire-and-forget: publish the workflow start event without subscribing for completion
    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.start',
      runId: this.runId,
      data: {
        workflowId: this.workflowId,
        runId: this.runId,
        prevResult: { status: 'success', output: inputDataToUse },
        requestContext: Object.fromEntries(requestContext.entries()),
        initialState: initialStateToUse,
        perStep,
      },
    });

    // Return immediately without waiting for completion
    return { runId: this.runId };
  }

  // TODO: stream

  async resume<TResumeSchema>(params: {
    resumeData?: TResumeSchema;
    step:
      | Step<string, any, any, TResumeSchema, any, any, TEngineType>
      | [
          ...Step<string, any, any, any, any, any, TEngineType>[],
          Step<string, any, any, TResumeSchema, any, any, TEngineType>,
        ]
      | string
      | string[];
    requestContext?: RequestContext;
    perStep?: boolean;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    let steps: string[] = [];
    if (typeof params.step === 'string') {
      steps = params.step.split('.');
    } else {
      steps = (Array.isArray(params.step) ? params.step : [params.step]).map(step =>
        typeof step === 'string' ? step : step?.id,
      );
    }

    if (steps.length === 0) {
      throw new Error('No steps provided to resume');
    }

    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    if (!workflowsStore) {
      throw new Error('Cannot resume workflow: workflows store is required');
    }
    const snapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });
    if (!snapshot) {
      throw new Error(`Cannot resume workflow: no snapshot found for runId ${this.runId}`);
    }

    const resumePath = snapshot.suspendedPaths?.[steps[0]!] as any;
    if (!resumePath) {
      throw new Error(
        `No resume path found for step ${JSON.stringify(steps)}, currently suspended paths are ${JSON.stringify(snapshot.suspendedPaths)}`,
      );
    }

    console.dir(
      { resume: { requestContextObj: snapshot.requestContext, requestContext: params.requestContext } },
      { depth: null },
    );
    // Start with the snapshot's request context (old values)
    const requestContextObj = snapshot.requestContext ?? {};
    const requestContext = new RequestContext();

    // First, set values from the snapshot
    for (const [key, value] of Object.entries(requestContextObj)) {
      requestContext.set(key, value);
    }

    // Then, override with any values from the passed request context (new values take precedence)
    if (params.requestContext) {
      for (const [key, value] of params.requestContext.entries()) {
        requestContext.set(key, value);
      }
    }

    const suspendedStep = this.workflowSteps[steps?.[0] ?? ''];

    const resumeDataToUse = await this._validateResumeData(params.resumeData, suspendedStep);

    if (!this.mastra?.pubsub) {
      throw new Error('Mastra instance with pubsub is required for workflow execution');
    }

    this.setupAbortHandler();

    const executionResultPromise = this.executionEngine
      .execute<TState, TInput, WorkflowResult<TState, TInput, TOutput, TSteps>>({
        workflowId: this.workflowId,
        runId: this.runId,
        graph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        input: snapshot?.context?.input as TInput,
        resume: {
          steps,
          stepResults: snapshot?.context as any,
          resumePayload: resumeDataToUse,
          resumePath,
        },
        pubsub: this.mastra.pubsub,
        requestContext,
        abortController: this.abortController,
        perStep: params.perStep,
      })
      .then(result => {
        if (result.status !== 'suspended') {
          this.closeStreamAction?.().catch(() => {});
        }

        return result;
      });

    this.executionResults = executionResultPromise;

    return executionResultPromise;
  }

  watch(cb: (event: WorkflowStreamEvent) => void): () => void {
    const watchCb = async (event: Event, ack?: () => Promise<void>) => {
      if (event.runId !== this.runId) {
        return;
      }

      cb(event.data);
      await ack?.();
    };

    this.mastra?.pubsub.subscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});

    return () => {
      this.mastra?.pubsub.unsubscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});
    };
  }

  async watchAsync(cb: (event: WorkflowStreamEvent) => void): Promise<() => void> {
    const watchCb = async (event: Event, ack?: () => Promise<void>) => {
      if (event.runId !== this.runId) {
        return;
      }

      cb(event.data);
      await ack?.();
    };

    await this.mastra?.pubsub.subscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});

    return async () => {
      await this.mastra?.pubsub.unsubscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});
    };
  }

  async cancel() {
    // Update storage directly for immediate status update (same pattern as Inngest)
    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    await workflowsStore?.updateWorkflowState({
      workflowName: this.workflowId,
      runId: this.runId,
      opts: {
        status: 'canceled',
      },
    });

    // Trigger abort signal - the abort handler will publish the workflow.cancel event
    // This ensures consistent behavior whether cancel() or abort() is called
    this.abortController.abort();
  }
}
