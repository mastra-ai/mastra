import type { ReadableStream } from 'node:stream/web';
import { Agent, MessageList, TripWire } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraScorers } from '@mastra/core/evals';
import type { CoreMessage } from '@mastra/core/llm';
import type { TracingContext } from '@mastra/core/observability';
import { EntityType, SpanType } from '@mastra/core/observability';
import type { Processor, ProcessorStepOutput } from '@mastra/core/processors';
import { ProcessorRunner, ProcessorStepOutputSchema, ProcessorStepSchema } from '@mastra/core/processors';
import type { ChunkType, OutputSchema, SchemaWithValidation } from '@mastra/core/stream';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { Tool, createTool } from '@mastra/core/tools';
import type { DynamicArgument } from '@mastra/core/types';
import type { Step, AgentStepOptions, StepParams, ToolStep, StepMetadata } from '@mastra/core/workflows';
import { Workflow } from '@mastra/core/workflows';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '@mastra/core/workflows/_constants';
import type { Inngest } from 'inngest';
import { z } from 'zod';
import type { InngestEngineType, InngestWorkflowConfig } from './types';
import { InngestWorkflow } from './workflow';

export * from './workflow';
export * from './execution-engine';
export * from './pubsub';
export * from './run';
export * from './serve';
export * from './types';

// ============================================
// Type Guards
// ============================================

function isInngestWorkflow(input: unknown): input is InngestWorkflow<any, any, any, any, any, any, any> {
  return input instanceof InngestWorkflow;
}

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
    !(input instanceof Tool) &&
    !(input instanceof InngestWorkflow)
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
    !(obj instanceof InngestWorkflow) &&
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
  TStateSchema extends z.ZodTypeAny | undefined,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
  TResumeSchema extends z.ZodTypeAny | undefined = undefined,
  TSuspendSchema extends z.ZodTypeAny | undefined = undefined,
>(
  params: StepParams<TStepId, TStateSchema, TInputSchema, TOutputSchema, TResumeSchema, TSuspendSchema>,
): Step<
  TStepId,
  TStateSchema extends z.ZodTypeAny ? z.infer<TStateSchema> : unknown,
  z.infer<TInputSchema>,
  z.infer<TOutputSchema>,
  TResumeSchema extends z.ZodTypeAny ? z.infer<TResumeSchema> : unknown,
  TSuspendSchema extends z.ZodTypeAny ? z.infer<TSuspendSchema> : unknown,
  InngestEngineType
>;

/**
 * Creates a step from an agent with structured output
 */
export function createStep<TStepId extends string, TStepOutput>(
  agent: Agent<TStepId, any>,
  agentOptions: AgentStepOptions<TStepOutput> & {
    structuredOutput: { schema: OutputSchema<TStepOutput> };
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
    metadata?: StepMetadata;
  },
): Step<TStepId, unknown, { prompt: string }, TStepOutput, unknown, unknown, InngestEngineType>;

/**
 * Creates a step from an agent (defaults to { text: string } output)
 */
export function createStep<
  TStepId extends string,
  TStepInput extends { prompt: string },
  TStepOutput extends { text: string },
  TResume,
  TSuspend,
>(agent: Agent<TStepId, any>): Step<TStepId, unknown, TStepInput, TStepOutput, TResume, TSuspend, InngestEngineType>;

/**
 * Creates a step from a tool
 */
export function createStep<
  TSchemaIn,
  TSuspend,
  TResume,
  TSchemaOut,
  TContext extends ToolExecutionContext<TSuspend, TResume, any> = ToolExecutionContext<TSuspend, TResume>,
  TId extends string = string,
  TRequestContext extends Record<string, any> | unknown = unknown,
>(
  tool: Tool<TSchemaIn, TSchemaOut, TSuspend, TResume, TContext, TId, TRequestContext>,
  toolOptions?: { retries?: number; scorers?: DynamicArgument<MastraScorers>; metadata?: StepMetadata },
): Step<TId, unknown, TSchemaIn, TSchemaOut, TSuspend, TResume, InngestEngineType>;

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
  typeof ProcessorStepSchema,
  typeof ProcessorStepOutputSchema,
  unknown,
  unknown,
  InngestEngineType
>;

/**
 * IMPORTANT: Fallback overload - provides better error messages when StepParams doesn't match
 * This should be LAST and will show clearer errors about what's wrong
 * This is a copy of first one, KEEP THIS IN SYNC!
 */
export function createStep<
  TStepId extends string,
  TStateSchema extends z.ZodTypeAny | undefined,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
  TResumeSchema extends z.ZodTypeAny | undefined = undefined,
  TSuspendSchema extends z.ZodTypeAny | undefined = undefined,
>(
  params: StepParams<TStepId, TStateSchema, TInputSchema, TOutputSchema, TResumeSchema, TSuspendSchema>,
): Step<
  TStepId,
  TStateSchema extends z.ZodTypeAny ? z.infer<TStateSchema> : unknown,
  z.infer<TInputSchema>,
  z.infer<TOutputSchema>,
  TResumeSchema extends z.ZodTypeAny ? z.infer<TResumeSchema> : unknown,
  TSuspendSchema extends z.ZodTypeAny ? z.infer<TSuspendSchema> : unknown,
  InngestEngineType
>;

// ============================================
// Implementation (uses type guards for clean logic)
// ============================================

export function createStep(params: any, agentOrToolOptions?: any): Step<any, any, any, any, any, any, any> {
  // Type assertions are needed because each branch returns a different Step type,
  // but the overloads ensure type safety for consumers

  // Issue #9965: Preserve InngestWorkflow identity when passed to createStep
  // This ensures nested workflows in foreach are properly detected by isNestedWorkflowStep()
  if (isInngestWorkflow(params)) {
    return params;
  }

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
    return createStepFromProcessor(params);
  }

  throw new Error('Invalid input: expected StepParams, Agent, ToolStep, Processor, or InngestWorkflow');
}

// ============================================
// Internal Implementations
// ============================================

function createStepFromParams<
  TStepId extends string,
  TStateSchema extends z.ZodTypeAny | undefined,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
  TResumeSchema extends z.ZodTypeAny | undefined = undefined,
  TSuspendSchema extends z.ZodTypeAny | undefined = undefined,
>(
  params: StepParams<TStepId, TStateSchema, TInputSchema, TOutputSchema, TResumeSchema, TSuspendSchema>,
): Step<
  TStepId,
  TStateSchema extends z.ZodTypeAny ? z.infer<TStateSchema> : unknown,
  z.infer<TInputSchema>,
  z.infer<TOutputSchema>,
  TResumeSchema extends z.ZodTypeAny ? z.infer<TResumeSchema> : unknown,
  TSuspendSchema extends z.ZodTypeAny ? z.infer<TSuspendSchema> : unknown,
  InngestEngineType
> {
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
    metadata: params.metadata,
    execute: params.execute.bind(params),
  };
}

function createStepFromAgent<TStepId extends string, TStepOutput>(
  params: Agent<TStepId, any>,
  agentOrToolOptions?: Record<string, unknown>,
): Step<TStepId, any, any, TStepOutput, unknown, unknown, InngestEngineType> {
  const options = (agentOrToolOptions ?? {}) as
    | (AgentStepOptions<TStepOutput> & {
        retries?: number;
        scorers?: DynamicArgument<MastraScorers>;
        metadata?: StepMetadata;
      })
    | undefined;
  // Determine output schema based on structuredOutput option
  const outputSchema = (options?.structuredOutput?.schema ??
    z.object({ text: z.string() })) as unknown as SchemaWithValidation<TStepOutput>;
  const { retries, scorers, metadata, ...agentOptions } =
    options ??
    ({} as AgentStepOptions<TStepOutput> & {
      retries?: number;
      scorers?: DynamicArgument<MastraScorers>;
      metadata?: StepMetadata;
    });

  return {
    id: params.name as TStepId,
    description: params.getDescription(),
    inputSchema: z.object({
      prompt: z.string(),
    }),
    outputSchema,
    retries,
    scorers,
    metadata,
    execute: async ({
      inputData,
      runId,
      [PUBSUB_SYMBOL]: pubsub,
      [STREAM_FORMAT_SYMBOL]: streamFormat,
      requestContext,
      tracingContext,
      abortSignal,
      abort,
      writer,
    }) => {
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
          ...(agentOptions ?? {}),
          requestContext,
          tracingContext,
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
        const modelOutput = await params.stream((inputData as { prompt: string }).prompt, {
          ...(agentOptions ?? {}),
          requestContext,
          tracingContext,
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

      if (streamFormat === 'legacy') {
        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: { type: 'tool-call-streaming-start', ...(toolData ?? {}) },
        });
        for await (const chunk of stream) {
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
          await writer.write(chunk as any);
        }
      }

      if (abortSignal.aborted) {
        return abort() as TStepOutput;
      }

      // Return structured output if available, otherwise default text
      if (structuredResult !== null) {
        return structuredResult;
      }
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
): Step<string, any, TStepInput, TStepOutput, TResume, TSuspend, InngestEngineType> {
  const toolOpts = agentOrToolOptions as
    | { retries?: number; scorers?: DynamicArgument<MastraScorers>; metadata?: StepMetadata }
    | undefined;
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
      tracingContext,
      suspend,
      resumeData,
      runId,
      workflowId,
      state,
      setState,
    }) => {
      // BREAKING CHANGE v1.0: Pass raw input as first arg, context as second
      const toolContext = {
        mastra,
        requestContext,
        tracingContext,
        workflow: {
          runId,
          resumeData,
          suspend,
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
): Step<`processor:${TProcessorId}`, unknown, any, any, unknown, unknown, InngestEngineType> {
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
                state: {},
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
                state: {},
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
                state: {},
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
                state: {},
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

export function init(inngest: Inngest) {
  return {
    createTool,
    createWorkflow<
      TWorkflowId extends string = string,
      TState = any,
      TInput = any,
      TOutput = any,
      TSteps extends Step<string, any, any, any, any, any, InngestEngineType>[] = Step<
        string,
        any,
        any,
        any,
        any,
        any,
        InngestEngineType
      >[],
    >(params: InngestWorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
      return new InngestWorkflow<InngestEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TInput>(
        params,
        inngest,
      );
    },
    createStep,
    cloneStep<TStepId extends string>(
      step: Step<TStepId, any, any, any, any, any, InngestEngineType>,
      opts: { id: TStepId },
    ): Step<TStepId, any, any, any, any, any, InngestEngineType> {
      return {
        id: opts.id,
        description: step.description,
        inputSchema: step.inputSchema,
        outputSchema: step.outputSchema,
        resumeSchema: step.resumeSchema,
        suspendSchema: step.suspendSchema,
        stateSchema: step.stateSchema,
        metadata: step.metadata,
        execute: step.execute,
        retries: step.retries,
        scorers: step.scorers,
        component: step.component,
      };
    },
    cloneWorkflow<
      TWorkflowId extends string = string,
      TState = unknown,
      TInput = unknown,
      TOutput = unknown,
      TSteps extends Step<string, any, any, any, any, any, InngestEngineType>[] = Step<
        string,
        any,
        any,
        any,
        any,
        any,
        InngestEngineType
      >[],
      TPrev = TInput,
    >(
      workflow: Workflow<InngestEngineType, TSteps, string, TState, TInput, TOutput, TPrev>,
      opts: { id: TWorkflowId },
    ): Workflow<InngestEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrev> {
      const wf: Workflow<InngestEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrev> = new Workflow({
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
    },
  };
}
