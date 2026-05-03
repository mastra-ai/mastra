import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import type { StepResult } from '@internal/ai-sdk-v5';
import type { MastraDBMessage, MessageInput } from '../agent/message-list';
import { MessageList, messagesAreEqual } from '../agent/message-list';
import { TripWire } from '../agent/trip-wire';
import type { TripWireOptions } from '../agent/trip-wire';
import { MastraError } from '../error';
import type { IMastraLogger } from '../logger';
import { EntityType, SpanType, createObservabilityContext, resolveObservabilityContext } from '../observability';
import type { ObservabilityContext, Span } from '../observability';
import type { RequestContext } from '../request-context';
import type { ChunkType } from '../stream';
import type { MastraModelOutput } from '../stream/base/output';
import type { LanguageModelUsage } from '../stream/types';
import { normalizePromptOnlyMessages, snapshotMessageList } from './prompt-view';
import {
  summarizeActiveToolsForSpan,
  summarizeProcessorModelForSpan,
  summarizeProcessorResultForSpan,
  summarizeProcessorToolsForSpan,
  summarizeToolChoiceForSpan,
} from './span-payload';
import type { ProcessorStepOutput } from './step-schema';
import { isMaybeClaude46, TrailingAssistantGuard } from './trailing-assistant-guard';
import {
  validateAndFormatProcessInputResult,
  validateAndFormatProcessInputStepResult,
  validateProcessorResultExclusivity,
} from './validate-result';
import { isProcessorWorkflow } from './index';
import type {
  ErrorProcessorOrWorkflow,
  OutputResult,
  ProcessInputResult,
  ProcessInputStepResult,
  Processor,
  ProcessorMessageResult,
  ProcessorResultCallback,
  ProcessorStreamWriter,
  ProcessorWorkflow,
  RunProcessInputStepArgs,
  RunProcessInputStepResult,
  ToolCallInfo,
} from './index';

export type RunInputProcessorsResult = {
  messageList: MessageList;
  modelContextMessages?: MastraDBMessage[];
};

function didMessageListChange(messageList: MessageList, snapshotBefore: string): boolean {
  return snapshotMessageList(messageList) !== snapshotBefore;
}

function stripUndefinedMessageContextFields<T extends Record<string, unknown>>(result: T): T {
  if ('messages' in result && result.messages === undefined) {
    delete result.messages;
  }
  if ('modelContextMessages' in result && result.modelContextMessages === undefined) {
    delete result.modelContextMessages;
  }
  return result;
}

/**
 * Implementation of processor state management
 */
/**
 * Tracks state for stream processing across chunks.
 * Used by both legacy processors and workflow processors.
 */
export class ProcessorState<OUTPUT = undefined> {
  private inputAccumulatedText = '';
  private outputAccumulatedText = '';
  private outputChunkCount = 0;
  public customState: Record<string, unknown> = {};
  public streamParts: ChunkType<OUTPUT>[] = [];
  public span?: Span<SpanType.PROCESSOR_RUN>;

  constructor(
    options?: {
      processorName?: string;
      processorIndex?: number;
      createSpan?: boolean;
    } & Partial<ObservabilityContext>,
  ) {
    // Only create span if explicitly requested (legacy processors)
    // Workflow processors handle span creation in workflow.ts
    if (!options?.createSpan || !options.processorName) {
      return;
    }

    const currentSpan = options.tracingContext?.currentSpan;
    const parentSpan = currentSpan?.findParent(SpanType.AGENT_RUN) || currentSpan?.parent || currentSpan;
    this.span = parentSpan?.createChildSpan({
      type: SpanType.PROCESSOR_RUN,
      name: `output stream processor: ${options.processorName}`,
      entityType: EntityType.OUTPUT_PROCESSOR,
      entityName: options.processorName,
      attributes: {
        processorExecutor: 'legacy',
        processorIndex: options.processorIndex ?? 0,
      },
      input: {
        totalChunks: 0,
      },
    });
  }

  /** Track incoming chunk (before processor transformation) */
  addInputPart(part: ChunkType<OUTPUT>): void {
    // Extract text from text-delta chunks for accumulated text
    if (part.type === 'text-delta') {
      this.inputAccumulatedText += part.payload.text;
    }
    this.streamParts.push(part);

    if (this.span) {
      this.span.input = {
        totalChunks: this.streamParts.length,
        accumulatedText: this.inputAccumulatedText,
      };
    }
  }

  /** Track outgoing chunk (after processor transformation) */
  addOutputPart(part: ChunkType<OUTPUT> | null | undefined): void {
    if (!part) return;
    this.outputChunkCount++;
    // Extract text from text-delta chunks for accumulated text
    if (part.type === 'text-delta') {
      this.outputAccumulatedText += part.payload.text;
    }
  }

  /** Get final output for span */
  getFinalOutput(): { totalChunks: number; accumulatedText: string } {
    return {
      totalChunks: this.outputChunkCount,
      accumulatedText: this.outputAccumulatedText,
    };
  }
}

/**
 * Union type for processor or workflow that can be used as a processor
 */
type ProcessorOrWorkflow = Processor | ProcessorWorkflow;

type ProcessorWorkflowStepSnapshot = {
  processorId: string;
  processorName?: string;
  processorIndex: number;
  processorExecutor: 'workflow';
  processorWorkflowId: string;
  processorStepId: string;
  processorStepIndex: number;
  processorStepStatus: string;
  output: ProcessorStepOutput;
};

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

function buildProcessInputStepSpanInput(args: {
  messages: MastraDBMessage[];
  systemMessages: unknown[];
  stepNumber: number;
  messageId?: string;
  retryCount: number;
  model: unknown;
  tools?: unknown;
  toolChoice?: unknown;
  activeTools?: unknown;
}) {
  const summarizedModel = summarizeProcessorModelForSpan(args.model);
  const summarizedTools = summarizeProcessorToolsForSpan(args.tools);
  const summarizedToolChoice = summarizeToolChoiceForSpan(args.toolChoice, args.tools);
  const summarizedActiveTools = summarizeActiveToolsForSpan(args.activeTools, args.tools);

  return {
    messages: args.messages,
    systemMessages: args.systemMessages,
    stepNumber: args.stepNumber,
    ...(args.messageId ? { messageId: args.messageId } : {}),
    retryCount: args.retryCount,
    ...(summarizedModel ? { model: summarizedModel } : {}),
    ...(summarizedTools ? { tools: summarizedTools } : {}),
    ...(summarizedToolChoice ? { toolChoice: summarizedToolChoice } : {}),
    ...(summarizedActiveTools ? { activeTools: summarizedActiveTools } : {}),
  };
}

function buildProcessInputStepSpanOutput(args: {
  result: RunProcessInputStepResult;
  beforeStepInput: Pick<RunProcessInputStepResult, 'messageId' | 'model' | 'tools' | 'toolChoice' | 'activeTools'>;
  afterStepInput: RunProcessInputStepResult;
  beforeMessages: MastraDBMessage[];
  beforeSystemMessages: unknown[];
  messages: MastraDBMessage[];
  systemMessages: unknown[];
}) {
  const output: Record<string, unknown> = {};

  if (!areProcessorMessageArraysEqual(args.beforeMessages, args.messages)) {
    output.messages = args.messages;
  }

  if (!areProcessorMessageArraysEqual(args.beforeSystemMessages, args.systemMessages)) {
    output.systemMessages = args.systemMessages;
  }

  if (args.afterStepInput.messageId !== args.beforeStepInput.messageId) {
    output.messageId = args.afterStepInput.messageId;
  }

  if (args.result.model !== undefined || args.afterStepInput.model !== args.beforeStepInput.model) {
    const model = summarizeProcessorModelForSpan(args.afterStepInput.model);
    if (model) {
      output.model = model;
    }
  }

  if (args.result.tools !== undefined || args.afterStepInput.tools !== args.beforeStepInput.tools) {
    const tools = summarizeProcessorToolsForSpan(args.afterStepInput.tools);
    if (tools) {
      output.tools = tools;
    }
  }

  if (
    args.result.toolChoice !== undefined ||
    args.afterStepInput.toolChoice !== args.beforeStepInput.toolChoice ||
    args.afterStepInput.tools !== args.beforeStepInput.tools
  ) {
    const toolChoice = summarizeToolChoiceForSpan(args.afterStepInput.toolChoice, args.afterStepInput.tools);
    if (toolChoice) {
      output.toolChoice = toolChoice;
    }
  }

  if (
    args.result.activeTools !== undefined ||
    args.afterStepInput.activeTools !== args.beforeStepInput.activeTools ||
    args.afterStepInput.tools !== args.beforeStepInput.tools
  ) {
    const activeTools = summarizeActiveToolsForSpan(args.afterStepInput.activeTools, args.afterStepInput.tools);
    if (activeTools) {
      output.activeTools = activeTools;
    }
  }

  if (args.result.retryCount !== undefined) {
    output.retryCount = args.result.retryCount;
  }

  return output;
}

function hasRegularMessageListMutations(mutations: ReturnType<MessageList['stopRecording']>): boolean {
  return mutations.some(mutation => mutation.type !== 'addSystem');
}

function isProcessorStepOutput(output: unknown): output is ProcessorStepOutput {
  return output !== null && typeof output === 'object' && 'phase' in output;
}

function processorIdFromWorkflowStepId(stepId: string, workflowId: string): string {
  const processorSegment = stepId
    .split('.')
    .reverse()
    .find(segment => segment.startsWith('processor:'));

  return processorSegment?.slice('processor:'.length) || stepId || workflowId;
}

function stringArraysEqual(before: unknown, after: unknown): boolean {
  if (before === after) {
    return true;
  }

  if (!Array.isArray(before) || !Array.isArray(after)) {
    return before === after;
  }

  return before.length === after.length && before.every((value, index) => value === after[index]);
}

function stableStringify(value: unknown, seen = new WeakSet<object>()): string {
  if (!value || typeof value !== 'object') {
    if (typeof value === 'bigint') {
      return `${value.toString()}n`;
    }

    return JSON.stringify(value) ?? String(value);
  }

  if (seen.has(value)) {
    return '"[Circular]"';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item, seen)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableStringify(record[key], seen)}`)
    .join(',')}}`;
}

function valuesEqual(before: unknown, after: unknown): boolean {
  return before === after || stableStringify(before) === stableStringify(after);
}

function clonePlainValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof MessageList) {
    return cloneMessageArray(value.get.all.db()) as T;
  }

  if (seen.has(value)) {
    return seen.get(value) as T;
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    clone.push(...value.map(item => clonePlainValue(item, seen)));
    return clone as T;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  const clone: Record<string, unknown> = {};
  seen.set(value, clone);
  for (const [key, entryValue] of Object.entries(value)) {
    clone[key] = clonePlainValue(entryValue, seen);
  }
  return clone as T;
}

function cloneMessageArray<T extends unknown[] | undefined>(messages: T): T {
  if (!Array.isArray(messages)) {
    return messages;
  }

  return clonePlainValue(messages);
}

function cloneRecord<T extends Record<string, unknown> | undefined>(record: T): T {
  return clonePlainValue(record);
}

function cloneProcessorStepOutput(output: ProcessorStepOutput): ProcessorStepOutput {
  return clonePlainValue(output);
}

function cloneRunProcessInputStepResult(result: RunProcessInputStepResult): RunProcessInputStepResult {
  return {
    ...result,
    ...(result.messages ? { messages: cloneMessageArray(result.messages) } : {}),
    ...(result.modelContextMessages ? { modelContextMessages: cloneMessageArray(result.modelContextMessages) } : {}),
    ...(result.systemMessages ? { systemMessages: cloneMessageArray(result.systemMessages) } : {}),
    ...(result.activeTools ? { activeTools: [...result.activeTools] } : {}),
    ...(result.tools ? { tools: cloneRecord(result.tools) } : {}),
    ...(result.providerOptions ? { providerOptions: cloneRecord(result.providerOptions) } : {}),
    ...(result.modelSettings ? { modelSettings: cloneRecord(result.modelSettings) } : {}),
    ...(result.structuredOutput ? { structuredOutput: cloneRecord(result.structuredOutput) } : {}),
  };
}

function processorStepOutputChanged(before: ProcessorStepOutput, after: ProcessorStepOutput): boolean {
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;

  return (
    !areProcessorMessageArraysEqual(
      Array.isArray(beforeRecord.messageList) ? beforeRecord.messageList : undefined,
      Array.isArray(afterRecord.messageList) ? afterRecord.messageList : undefined,
    ) ||
    (!Array.isArray(beforeRecord.messageList) &&
      !Array.isArray(afterRecord.messageList) &&
      beforeRecord.messageList !== afterRecord.messageList) ||
    !areProcessorMessageArraysEqual(
      beforeRecord.messages as unknown[] | undefined,
      afterRecord.messages as unknown[] | undefined,
    ) ||
    !areProcessorMessageArraysEqual(
      beforeRecord.systemMessages as unknown[] | undefined,
      afterRecord.systemMessages as unknown[] | undefined,
    ) ||
    !valuesEqual(beforeRecord.tools, afterRecord.tools) ||
    !valuesEqual(beforeRecord.toolChoice, afterRecord.toolChoice) ||
    !stringArraysEqual(beforeRecord.activeTools, afterRecord.activeTools) ||
    !valuesEqual(beforeRecord.model, afterRecord.model) ||
    beforeRecord.messageId !== afterRecord.messageId ||
    !valuesEqual(beforeRecord.providerOptions, afterRecord.providerOptions) ||
    !valuesEqual(beforeRecord.modelSettings, afterRecord.modelSettings) ||
    beforeRecord.retryCount !== afterRecord.retryCount ||
    !valuesEqual(beforeRecord.structuredOutput, afterRecord.structuredOutput) ||
    !areProcessorMessageArraysEqual(
      beforeRecord.modelContextMessages as unknown[] | undefined,
      afterRecord.modelContextMessages as unknown[] | undefined,
    )
  );
}

export class ProcessorRunner {
  public readonly inputProcessors: ProcessorOrWorkflow[];
  public readonly outputProcessors: ProcessorOrWorkflow[];
  public readonly errorProcessors: ErrorProcessorOrWorkflow[];
  private readonly logger: IMastraLogger;
  private readonly agentName: string;
  /**
   * Shared processor state that persists across loop iterations.
   * Used by all processor methods (input and output) to share state.
   * Keyed by processor ID.
   */
  private readonly processorStates: Map<string, ProcessorState>;

  constructor({
    inputProcessors,
    outputProcessors,
    errorProcessors,
    logger,
    agentName,
    processorStates,
  }: {
    inputProcessors?: ProcessorOrWorkflow[];
    outputProcessors?: ProcessorOrWorkflow[];
    errorProcessors?: ErrorProcessorOrWorkflow[];
    logger: IMastraLogger;
    agentName: string;
    processorStates?: Map<string, ProcessorState>;
  }) {
    this.inputProcessors = inputProcessors ?? [];
    this.outputProcessors = outputProcessors ?? [];
    this.errorProcessors = errorProcessors ?? [];
    this.logger = logger;
    this.agentName = agentName;
    this.processorStates = processorStates ?? new Map();
  }

  /**
   * Get or create ProcessorState for the given processor ID.
   * This state persists across loop iterations and is shared between
   * all processor methods (input and output).
   */
  private getProcessorState(processorId: string): ProcessorState {
    let state = this.processorStates.get(processorId);
    if (!state) {
      state = new ProcessorState();
      this.processorStates.set(processorId, state);
    }
    return state;
  }

  /**
   * Execute a workflow as a processor and handle the result.
   * Returns the processed messages and any tripwire information.
   */
  private async executeWorkflowAsProcessor(
    workflow: ProcessorWorkflow,
    input: ProcessorStepOutput,
    observabilityContext?: ObservabilityContext,
    requestContext?: RequestContext,
    writer?: ProcessorStreamWriter,
    abortSignal?: AbortSignal,
    onWorkflowProcessorResult?: (snapshot: ProcessorWorkflowStepSnapshot) => void,
    workflowProcessorIndex: number = 0,
  ): Promise<ProcessorStepOutput> {
    // Create a run and start the workflow
    const run = await workflow.createRun();
    const shouldCaptureSnapshots = !!onWorkflowProcessorResult;
    const workflowStepSnapshots: ProcessorWorkflowStepSnapshot[] = [];
    let lastWorkflowStepOutput = shouldCaptureSnapshots ? cloneProcessorStepOutput(input) : undefined;
    const unwatch =
      shouldCaptureSnapshots && typeof run.watch === 'function'
        ? run.watch(event => {
            if (event.type !== 'workflow-step-result') {
              return;
            }

            const payload = event.payload as
              | { id?: unknown; status?: unknown; output?: unknown; metadata?: { processorIndex?: unknown } }
              | undefined;
            const stepId = typeof payload?.id === 'string' ? payload.id : undefined;
            if (!stepId || !isProcessorStepOutput(payload?.output)) {
              return;
            }

            const workflowStepOutput = cloneProcessorStepOutput(payload.output);
            if (lastWorkflowStepOutput && !processorStepOutputChanged(lastWorkflowStepOutput, workflowStepOutput)) {
              lastWorkflowStepOutput = workflowStepOutput;
              return;
            }

            const processorId = processorIdFromWorkflowStepId(stepId, workflow.id);
            workflowStepSnapshots.push({
              processorId,
              processorName: processorId,
              processorIndex:
                typeof payload?.metadata?.processorIndex === 'number'
                  ? payload.metadata.processorIndex
                  : workflowProcessorIndex,
              processorExecutor: 'workflow',
              processorWorkflowId: workflow.id,
              processorStepId: stepId,
              processorStepIndex: workflowStepSnapshots.length,
              processorStepStatus: typeof payload.status === 'string' ? payload.status : 'unknown',
              output: workflowStepOutput,
            });
            lastWorkflowStepOutput = workflowStepOutput;
          })
        : () => {};

    let result;
    try {
      result = await run.start({
        // Cast to allow processorStates/abortSignal - passed through to workflow processor steps
        // but not part of the official ProcessorStepOutput schema
        inputData: {
          ...input,
          // Pass the processorStates map so workflow processor steps can access their state
          processorStates: this.processorStates,
          // Pass abortSignal so processors can cancel in-flight work
          abortSignal,
        } as ProcessorStepOutput,
        ...observabilityContext,
        requestContext,
        outputWriter: writer ? chunk => writer.custom(chunk) : undefined,
      });
    } finally {
      unwatch();
    }

    if (shouldCaptureSnapshots) {
      for (const snapshot of workflowStepSnapshots) {
        onWorkflowProcessorResult?.(snapshot);
      }
    }

    // Check for tripwire status - this means a processor in the workflow called abort()
    if (result.status === 'tripwire') {
      const tripwireData = (
        result as { tripwire?: { reason?: string; retry?: boolean; metadata?: unknown; processorId?: string } }
      ).tripwire;
      if (
        tripwireData?.processorId &&
        !workflowStepSnapshots.some(snapshot => snapshot.processorId === tripwireData.processorId)
      ) {
        const lastWorkflowStepSnapshot = workflowStepSnapshots[workflowStepSnapshots.length - 1];
        onWorkflowProcessorResult?.({
          processorId: tripwireData.processorId,
          processorName: tripwireData.processorId,
          processorIndex: workflowProcessorIndex,
          processorExecutor: 'workflow',
          processorWorkflowId: workflow.id,
          processorStepId: `processor:${tripwireData.processorId}`,
          processorStepIndex: workflowStepSnapshots.length,
          processorStepStatus: 'tripwire',
          output: lastWorkflowStepSnapshot?.output ?? cloneProcessorStepOutput(input),
        });
      }
      // Re-throw as TripWire so the agent handles it properly
      throw new TripWire(
        tripwireData?.reason || `Tripwire triggered in workflow ${workflow.id}`,
        {
          retry: tripwireData?.retry,
          metadata: tripwireData?.metadata,
        },
        tripwireData?.processorId || workflow.id,
      );
    }

    // Check for execution failure
    if (result.status !== 'success') {
      // Collect error details from the workflow result and failed steps
      const details: string[] = [];
      if (result.status === 'failed') {
        if (result.error) {
          details.push(result.error.message || JSON.stringify(result.error));
        }
        for (const [stepId, step] of Object.entries(result.steps)) {
          if (step.status === 'failed' && step.error?.message) {
            details.push(`step ${stepId}: ${step.error.message}`);
          }
        }
      }
      const detailStr = details.length > 0 ? ` — ${details.join('; ')}` : '';
      throw new MastraError({
        category: 'USER',
        domain: 'AGENT',
        id: 'PROCESSOR_WORKFLOW_FAILED',
        text: `Processor workflow ${workflow.id} failed with status: ${result.status}${detailStr}`,
      });
    }

    // Extract and validate the output from the workflow result
    const output =
      result.result && typeof result.result === 'object'
        ? stripUndefinedMessageContextFields(result.result as ProcessorStepOutput)
        : result.result;

    if (!output || typeof output !== 'object') {
      // No output means no changes - return input unchanged
      return input;
    }

    if (!('phase' in output)) {
      throw new MastraError({
        category: 'USER',
        domain: 'AGENT',
        id: 'PROCESSOR_WORKFLOW_INVALID_OUTPUT',
        text: `Processor workflow ${workflow.id} returned invalid output format. Expected ProcessorStepOutput.`,
      });
    }

    validateProcessorResultExclusivity({ result: output, processorId: workflow.id });

    return output as ProcessorStepOutput;
  }

  async runOutputProcessors(
    messageList: MessageList,
    observabilityContext?: ObservabilityContext,
    requestContext?: RequestContext,
    retryCount: number = 0,
    writer?: ProcessorStreamWriter,
    result?: OutputResult,
  ): Promise<MessageList> {
    for (const [index, processorOrWorkflow] of this.outputProcessors.entries()) {
      const allNewMessages = messageList.get.response.db();
      let processableMessages: MastraDBMessage[] = [...allNewMessages];
      const idsBeforeProcessing = processableMessages.map((m: MastraDBMessage) => m.id);
      const check = messageList.makeMessageSourceChecker();

      // Handle workflow as processor
      if (isProcessorWorkflow(processorOrWorkflow)) {
        await this.executeWorkflowAsProcessor(
          processorOrWorkflow,
          {
            phase: 'outputResult',
            messages: processableMessages,
            messageList,
            retryCount,
            result,
          },
          observabilityContext,
          requestContext,
          writer,
        );
        continue;
      }

      // Handle regular processor
      const processor = processorOrWorkflow;
      const abort = <TMetadata = unknown>(reason?: string, options?: TripWireOptions<TMetadata>): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.id}`, options, processor.id);
      };

      // Use the processOutputResult method if available
      const processMethod = processor.processOutputResult?.bind(processor);

      if (!processMethod) {
        // Skip processors that don't implement processOutputResult
        continue;
      }

      const outputMessagesBefore = processableMessages;
      const outputSystemMessagesBefore = messageList.getAllSystemMessages();
      const defaultResult: OutputResult = {
        text: '',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        finishReason: 'unknown',
        steps: [],
      };
      const summarizedResult = result ? summarizeProcessorResultForSpan(result) : undefined;
      const currentSpan = observabilityContext?.tracingContext?.currentSpan;
      const parentSpan = currentSpan?.findParent(SpanType.AGENT_RUN) || currentSpan?.parent || currentSpan;
      const processorSpan = parentSpan?.createChildSpan({
        type: SpanType.PROCESSOR_RUN,
        name: `output processor: ${processor.id}`,
        entityType: EntityType.OUTPUT_PROCESSOR,
        entityId: processor.id,
        entityName: processor.name,
        attributes: {
          processorExecutor: 'legacy',
          processorIndex: index,
        },
        input: {
          messages: processableMessages,
          ...(summarizedResult ? { result: summarizedResult } : {}),
          retryCount,
        },
      });

      // Start recording MessageList mutations for this processor
      messageList.startRecording();

      try {
        // Get per-processor state that persists across all method calls within this request
        const processorState = this.getProcessorState(processor.id);

        const processResult = await processMethod({
          messages: processableMessages,
          messageList,
          state: processorState.customState,
          result: result ?? defaultResult,
          abort,
          ...createObservabilityContext({ currentSpan: processorSpan }),
          requestContext,
          retryCount,
          writer,
        });

        // Stop recording and get mutations for this processor
        const mutations = messageList.stopRecording();

        // Handle the new return type - MessageList or MastraDBMessage[]
        if (processResult instanceof MessageList) {
          if (processResult !== messageList) {
            throw new MastraError({
              category: 'USER',
              domain: 'AGENT',
              id: 'PROCESSOR_RETURNED_EXTERNAL_MESSAGE_LIST',
              text: `Processor ${processor.id} returned a MessageList instance other than the one that was passed in as an argument. New external message list instances are not supported. Use the messageList argument instead.`,
            });
          }
          if (mutations.length > 0) {
            processableMessages = processResult.get.response.db();
          }
        } else {
          if (processResult) {
            const deletedIds = idsBeforeProcessing.filter(
              (i: string) => !processResult.some((m: MastraDBMessage) => m.id === i),
            );
            if (deletedIds.length) {
              messageList.removeByIds(deletedIds);
            }
            processableMessages = processResult || [];
            for (const message of processResult) {
              messageList.removeByIds([message.id]);
              messageList.add(message, check.getSource(message) || 'response');
            }
          }
        }

        processorSpan?.end({
          output: {
            ...(!areProcessorMessageArraysEqual(outputMessagesBefore, processableMessages)
              ? { messages: processableMessages }
              : {}),
            ...(!areProcessorMessageArraysEqual(outputSystemMessagesBefore, messageList.getAllSystemMessages())
              ? { systemMessages: messageList.getAllSystemMessages() }
              : {}),
          },
          attributes: mutations.length > 0 ? { messageListMutations: mutations } : undefined,
        });
      } catch (error) {
        // Stop recording on error
        messageList.stopRecording();

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
          throw error;
        }
        processorSpan?.error({ error: error as Error, endSpan: true });
        throw error;
      }
    }

    return messageList;
  }

  /**
   * Process a stream part through all output processors with state management
   */
  async processPart<OUTPUT>(
    part: ChunkType<OUTPUT>,
    processorStates: Map<string, ProcessorState<OUTPUT>>,
    observabilityContext?: ObservabilityContext,
    requestContext?: RequestContext,
    messageList?: MessageList,
    retryCount: number = 0,
    writer?: ProcessorStreamWriter,
  ): Promise<{
    part: ChunkType<OUTPUT> | null | undefined;
    blocked: boolean;
    reason?: string;
    tripwireOptions?: TripWireOptions<unknown>;
    processorId?: string;
  }> {
    if (!this.outputProcessors.length) {
      return { part, blocked: false };
    }

    try {
      let processedPart: ChunkType<OUTPUT> | null | undefined = part;
      const isFinishChunk = part.type === 'finish';

      for (const [index, processorOrWorkflow] of this.outputProcessors.entries()) {
        // Handle workflows for stream processing
        if (isProcessorWorkflow(processorOrWorkflow)) {
          if (!processedPart) continue;

          // Get or create state for this workflow
          const workflowId = processorOrWorkflow.id;
          let state = processorStates.get(workflowId);
          if (!state) {
            state = new ProcessorState<OUTPUT>();
            processorStates.set(workflowId, state);
          }

          // Track input chunk (before processor transformation)
          state.addInputPart(processedPart);

          try {
            const result = await this.executeWorkflowAsProcessor(
              processorOrWorkflow,
              {
                phase: 'outputStream',
                part: processedPart,
                streamParts: state.streamParts as ChunkType[],
                state: state.customState,
                messageList,
                retryCount,
              },
              observabilityContext,
              requestContext,
              writer,
            );

            // Extract the processed part from the result if it exists
            if ('part' in result) {
              processedPart = result.part as ChunkType<OUTPUT> | null | undefined;
            }
            // Track output chunk (after processor transformation or passthrough)
            state.addOutputPart(processedPart);
          } catch (error) {
            if (error instanceof TripWire) {
              return {
                part: null,
                blocked: true,
                reason: error.message,
                tripwireOptions: error.options,
                processorId: error.processorId || workflowId,
              };
            }
            this.logger.error('Output processor workflow failed', { agent: this.agentName, workflowId, error });
          }
          continue;
        }

        const processor = processorOrWorkflow;
        try {
          if (processor.processOutputStream && processedPart) {
            // Get or create state for this processor
            let state = processorStates.get(processor.id);
            if (!state) {
              state = new ProcessorState<OUTPUT>({
                processorName: processor.name ?? processor.id,
                ...observabilityContext,
                processorIndex: index,
                createSpan: true,
              });
              processorStates.set(processor.id, state);
            }

            // Track input chunk (before processor transformation)
            state.addInputPart(processedPart);

            const result = await processor.processOutputStream({
              part: processedPart as ChunkType,
              streamParts: state.streamParts as ChunkType[],
              state: state.customState,
              abort: <TMetadata = unknown>(reason?: string, options?: TripWireOptions<TMetadata>): never => {
                throw new TripWire(reason || `Stream part blocked by ${processor.id}`, options, processor.id);
              },
              ...createObservabilityContext({ currentSpan: state.span }),
              requestContext,
              messageList,
              retryCount,
              writer,
            });

            // Track output chunk and update processedPart
            processedPart = result as ChunkType<OUTPUT> | null | undefined;
            state.addOutputPart(processedPart);
          }
        } catch (error) {
          if (error instanceof TripWire) {
            // Error span for trip-wire abort so it shows as ERROR in traces
            const state = processorStates.get(processor.id);
            state?.span?.error({
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
            return {
              part: null,
              blocked: true,
              reason: error.message,
              tripwireOptions: error.options,
              processorId: processor.id,
            };
          }
          // End span with error
          const state = processorStates.get(processor.id);
          state?.span?.error({ error: error as Error, endSpan: true });
          // Log error but continue with original part
          this.logger.error('Output processor failed', { agent: this.agentName, processorId: processor.id, error });
        }
      }

      // If this was a finish chunk, end all processor spans AFTER processing
      if (isFinishChunk) {
        for (const state of processorStates.values()) {
          if (state.span) {
            // Set output with accumulated text and chunk count from processor's output
            state.span.end({ output: state.getFinalOutput() });
          }
        }
      }

      return { part: processedPart, blocked: false };
    } catch (error) {
      this.logger.error('Stream part processing failed', { agent: this.agentName, error });
      // End all spans on fatal error
      for (const state of processorStates.values()) {
        state.span?.error({ error: error as Error, endSpan: true });
      }
      return { part, blocked: false };
    }
  }

  async runOutputProcessorsForStream<OUTPUT = undefined>(
    streamResult: MastraModelOutput<OUTPUT>,
    observabilityContext?: ObservabilityContext,
    writer?: ProcessorStreamWriter,
  ): Promise<ReadableStream<any>> {
    return new ReadableStream({
      start: async controller => {
        const reader = streamResult.fullStream.getReader();
        const processorStates = new Map<string, ProcessorState<OUTPUT>>();

        // Use provided writer, or create one from the controller
        const streamWriter = writer ?? {
          custom: async (data: { type: string }) => controller.enqueue(data),
        };

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              break;
            }

            // Process all stream parts through output processors
            const {
              part: processedPart,
              blocked,
              reason,
              tripwireOptions,
              processorId,
            } = await this.processPart(
              value,
              processorStates,
              observabilityContext,
              undefined,
              undefined,
              0,
              streamWriter,
            );

            if (blocked) {
              // Log that part was blocked
              void this.logger.debug('Stream part blocked by output processor', {
                agent: this.agentName,
                reason,
                originalPart: value,
              });

              // Send tripwire part and close stream for abort
              controller.enqueue({
                type: 'tripwire',
                payload: {
                  reason: reason || 'Output processor blocked content',
                  retry: tripwireOptions?.retry,
                  metadata: tripwireOptions?.metadata,
                  processorId,
                },
              });
              controller.close();
              break;
            } else if (processedPart != null) {
              // Send processed part only if it's not null/undefined (which indicates don't emit)
              controller.enqueue(processedPart);
            }
            // If processedPart is null/undefined, don't emit anything for this part
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  async runInputProcessors(
    messageList: MessageList,
    observabilityContext?: ObservabilityContext,
    requestContext?: RequestContext,
    retryCount: number = 0,
    onProcessorResult?: ProcessorResultCallback,
  ): Promise<RunInputProcessorsResult> {
    let modelContextMessages: MastraDBMessage[] | undefined;

    for (const [index, processorOrWorkflow] of this.inputProcessors.entries()) {
      let processableMessages: MastraDBMessage[] = modelContextMessages ?? messageList.get.input.db();
      const inputIds = messageList.get.input.db().map((m: MastraDBMessage) => m.id);
      const check = messageList.makeMessageSourceChecker();

      // Handle workflow as processor
      if (isProcessorWorkflow(processorOrWorkflow)) {
        const currentSystemMessages = messageList.getAllSystemMessages();
        const messageListBeforeWorkflow = snapshotMessageList(messageList);
        const result = await this.executeWorkflowAsProcessor(
          processorOrWorkflow,
          {
            phase: 'input',
            messages: processableMessages,
            messageList,
            modelContextMessages,
            systemMessages: currentSystemMessages,
            retryCount,
          },
          observabilityContext,
          requestContext,
          undefined,
          undefined,
          onProcessorResult ? snapshot => onProcessorResult(snapshot) : undefined,
          index,
        );
        const workflowMutatedMessageList = didMessageListChange(messageList, messageListBeforeWorkflow);
        validateProcessorResultExclusivity({ result, processorId: processorOrWorkflow.id });
        if (modelContextMessages !== undefined && workflowMutatedMessageList && !result.messages) {
          throw new MastraError({
            category: 'USER',
            domain: 'AGENT',
            id: 'PROCESSOR_MUTATED_MESSAGE_LIST_AFTER_MODEL_CONTEXT',
            text: `Processor workflow ${processorOrWorkflow.id} mutated messageList after prompt-only model context was set. Mutate canonical messages before returning modelContextMessages, or return messages to update the prompt-only context.`,
          });
        }
        if (result.modelContextMessages !== undefined && workflowMutatedMessageList) {
          throw new MastraError({
            category: 'USER',
            domain: 'AGENT',
            id: 'PROCESSOR_MUTATED_MESSAGE_LIST_WITH_MODEL_CONTEXT_MESSAGES',
            text: `Processor workflow ${processorOrWorkflow.id} mutated messageList and returned modelContextMessages. Prompt-only model context cannot be combined with canonical messageList mutations.`,
          });
        }
        if (result.systemMessages) {
          messageList.replaceAllSystemMessages(result.systemMessages as CoreMessageV4[]);
        }
        if ('modelContextMessages' in result) {
          modelContextMessages = normalizePromptOnlyMessages((result.modelContextMessages ?? []) as MastraDBMessage[]);
        } else if (result.messages) {
          if (modelContextMessages !== undefined) {
            modelContextMessages = normalizePromptOnlyMessages(result.messages as MastraDBMessage[]);
          } else {
            ProcessorRunner.applyMessagesToMessageList(
              result.messages as MastraDBMessage[],
              messageList,
              inputIds,
              check,
            );
            processableMessages = messageList.get.input.db();
          }
        }
        continue;
      }

      // Handle regular processor
      const processor = processorOrWorkflow;
      const abort = <TMetadata = unknown>(reason?: string, options?: TripWireOptions<TMetadata>): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.id}`, options, processor.id);
      };

      // Use the processInput method if available
      const processMethod = processor.processInput?.bind(processor);

      if (!processMethod) {
        // Skip processors that don't implement processInput
        continue;
      }

      const currentSystemMessages = messageList.getAllSystemMessages();
      const inputMessagesBefore = processableMessages;
      const inputSystemMessagesBefore = currentSystemMessages;
      const currentSpan = observabilityContext?.tracingContext?.currentSpan;
      const parentSpan = currentSpan?.findParent(SpanType.AGENT_RUN) || currentSpan?.parent || currentSpan;
      const processorSpan = parentSpan?.createChildSpan({
        type: SpanType.PROCESSOR_RUN,
        name: `input processor: ${processor.id}`,
        entityType: EntityType.INPUT_PROCESSOR,
        entityId: processor.id,
        entityName: processor.name,
        attributes: {
          processorExecutor: 'legacy',
          processorIndex: index,
        },
        input: {
          messages: processableMessages,
          systemMessages: currentSystemMessages,
        },
      });

      // Start recording MessageList mutations for this processor
      messageList.startRecording();

      try {
        // Get per-processor state that persists across all method calls within this request
        const processorState = this.getProcessorState(processor.id);

        const result = await ProcessorRunner.validateAndFormatProcessInputResult(
          await processMethod({
            messages: processableMessages,
            systemMessages: currentSystemMessages,
            state: processorState.customState,
            abort,
            ...createObservabilityContext({ currentSpan: processorSpan }),
            messageList,
            requestContext,
            retryCount,
          }),
          {
            messageList,
            processor,
          },
        );

        // Stop recording and capture mutations before applying internal plumbing changes.
        const mutations = messageList.stopRecording();

        if (modelContextMessages !== undefined && mutations.length > 0 && !result.messages) {
          throw new MastraError({
            category: 'USER',
            domain: 'AGENT',
            id: 'PROCESSOR_MUTATED_MESSAGE_LIST_AFTER_MODEL_CONTEXT',
            text: `Processor ${processor.id} mutated messageList after prompt-only model context was set. Mutate canonical messages before returning modelContextMessages, or return messages to update the prompt-only context.`,
          });
        }

        if ('modelContextMessages' in result && mutations.length > 0) {
          throw new MastraError({
            category: 'USER',
            domain: 'AGENT',
            id: 'PROCESSOR_MUTATED_MESSAGE_LIST_WITH_MODEL_CONTEXT_MESSAGES',
            text: `Processor ${processor.id} mutated messageList and returned modelContextMessages. Prompt-only model context cannot be combined with canonical messageList mutations.`,
          });
        }

        if (result.systemMessages) {
          messageList.replaceAllSystemMessages(result.systemMessages);
        }

        if ('modelContextMessages' in result) {
          modelContextMessages = normalizePromptOnlyMessages(result.modelContextMessages ?? []);
          processableMessages = modelContextMessages;
        } else if (result.messages) {
          if (modelContextMessages !== undefined) {
            modelContextMessages = normalizePromptOnlyMessages(result.messages);
            processableMessages = modelContextMessages;
          } else {
            ProcessorRunner.applyMessagesToMessageList(result.messages, messageList, inputIds, check);
            processableMessages = messageList.get.input.db();
          }
        } else if (result.messageList) {
          if (modelContextMessages !== undefined) {
            throw new MastraError({
              category: 'USER',
              domain: 'AGENT',
              id: 'PROCESSOR_RETURNED_MESSAGE_LIST_AFTER_MODEL_CONTEXT',
              text: `Processor ${processor.id} returned messageList after prompt-only model context was set. Return messages to update the prompt-only context instead.`,
            });
          }
          if (mutations.length > 0) {
            processableMessages = messageList.get.input.db();
          }
        }

        processorSpan?.end({
          output: {
            ...(!areProcessorMessageArraysEqual(inputMessagesBefore, processableMessages)
              ? { messages: processableMessages }
              : {}),
            ...(modelContextMessages !== undefined ? { modelContextMessages } : {}),
            ...(!areProcessorMessageArraysEqual(inputSystemMessagesBefore, messageList.getAllSystemMessages())
              ? { systemMessages: messageList.getAllSystemMessages() }
              : {}),
          },
          attributes: mutations.length > 0 ? { messageListMutations: mutations } : undefined,
        });
        onProcessorResult?.({
          processorId: processor.id,
          processorName: processor.name,
          processorIndex: index,
          output: {
            ...result,
            phase: 'input',
            messages: processableMessages,
            systemMessages: messageList.getAllSystemMessages(),
            ...(modelContextMessages !== undefined ? { modelContextMessages } : {}),
          },
        });
      } catch (error) {
        // Stop recording on error
        messageList.stopRecording();

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
          throw error;
        }
        processorSpan?.error({ error: error as Error, endSpan: true });
        throw error;
      }
    }

    return { messageList, modelContextMessages };
  }

  /**
   * Run processInputStep for all processors that implement it.
   * Called at each step of the agentic loop, before the LLM is invoked.
   *
   * Unlike processInput which runs once at the start, this runs at every step
   * (including tool call continuations). This is useful for:
   * - Transforming message types between steps (e.g., AI SDK 'reasoning' -> Anthropic 'thinking')
   * - Modifying messages based on step context
   * - Implementing per-step message transformations
   *
   * @param args.messages - The current messages to be sent to the LLM (MastraDBMessage format)
   * @param args.messageList - MessageList instance for managing message sources
   * @param args.stepNumber - The current step number (0-indexed)
   * @param args.tracingContext - Optional tracing context for observability
   * @param args.requestContext - Optional runtime context with execution metadata
   *
   * @returns The processed MessageList
   */
  async runProcessInputStep(args: RunProcessInputStepArgs): Promise<RunProcessInputStepResult> {
    const { messageList, stepNumber, steps, requestContext, writer } = args;
    const observabilityContext = resolveObservabilityContext(args);

    // Initialize with all provided values - processors will modify this object in order
    const stepInput: RunProcessInputStepResult = {
      messageId: args.messageId,
      tools: args.tools,
      toolChoice: args.toolChoice,
      model: args.model,
      activeTools: args.activeTools,
      providerOptions: args.providerOptions,
      modelSettings: args.modelSettings,
      structuredOutput: args.structuredOutput,
      modelContextMessages: args.modelContextMessages,
      retryCount: args.retryCount ?? 0,
    };

    // Append the trailing assistant guard when the resolved model is Claude 4.6
    const processors =
      stepInput.model && isMaybeClaude46(stepInput.model)
        ? [...this.inputProcessors, new TrailingAssistantGuard()]
        : this.inputProcessors;

    // Run through all input processors that have processInputStep
    for (const [index, processorOrWorkflow] of processors.entries()) {
      const processableMessages: MastraDBMessage[] = stepInput.modelContextMessages ?? messageList.get.all.db();
      const idsBeforeProcessing = processableMessages.map((m: MastraDBMessage) => m.id);
      const check = messageList.makeMessageSourceChecker();

      // Handle workflow as processor with inputStep phase
      if (isProcessorWorkflow(processorOrWorkflow)) {
        const currentSystemMessages = messageList.getAllSystemMessages();
        const hadModelContextMessages = stepInput.modelContextMessages !== undefined;
        messageList.startRecording();
        let recordingStopped = false;
        try {
          let workflowSnapshotResult = cloneRunProcessInputStepResult(stepInput);
          const result = await this.executeWorkflowAsProcessor(
            processorOrWorkflow,
            {
              phase: 'inputStep',
              messages: processableMessages,
              messageList,
              stepNumber,
              steps,
              systemMessages: currentSystemMessages,
              rotateResponseMessageId: args.rotateResponseMessageId
                ? () => {
                    const nextMessageId = args.rotateResponseMessageId!();
                    stepInput.messageId = nextMessageId;
                    return nextMessageId;
                  }
                : undefined,
              ...stepInput,
            },
            observabilityContext,
            requestContext,
            writer,
            args.abortSignal,
            args.onProcessorResult
              ? snapshot => {
                  workflowSnapshotResult = cloneRunProcessInputStepResult({
                    ...workflowSnapshotResult,
                    ...(snapshot.output as Partial<RunProcessInputStepResult>),
                  });
                  args.onProcessorResult?.({
                    ...snapshot,
                    output: { ...snapshot.output },
                    result: cloneRunProcessInputStepResult(workflowSnapshotResult),
                  });
                }
              : undefined,
            index,
          );
          const mutations = messageList.stopRecording();
          recordingStopped = true;
          const rawResult = result as RunProcessInputStepResult & { phase?: string };
          const {
            phase: _phase,
            messages: rawMessages,
            modelContextMessages: rawModelContextMessages,
            messageList: _rawMessageList,
            ...rawRest
          } = rawResult;
          const normalizedMessages =
            rawMessages &&
            (rawModelContextMessages === undefined ||
              !areProcessorMessageArraysEqual(rawMessages, rawModelContextMessages)) &&
            !areProcessorMessageArraysEqual(processableMessages, rawMessages)
              ? rawMessages
              : undefined;
          const workflowProcessInputStepResult: ProcessInputStepResult =
            'modelContextMessages' in rawResult
              ? {
                  ...rawRest,
                  modelContextMessages: rawModelContextMessages,
                }
              : normalizedMessages
                ? {
                    ...rawRest,
                    messages: normalizedMessages,
                  }
                : {
                    ...rawRest,
                  };
          const {
            messages,
            systemMessages,
            modelContextMessages,
            messageList: _messageList,
            ...rest
          } = await ProcessorRunner.validateAndFormatProcessInputStepResult(workflowProcessInputStepResult, {
            messageList,
            processor: { id: processorOrWorkflow.id },
            stepNumber,
          });

          if (
            hadModelContextMessages &&
            mutations.length > 0 &&
            hasRegularMessageListMutations(mutations) &&
            messages === undefined &&
            modelContextMessages === undefined
          ) {
            throw new MastraError({
              category: 'USER',
              domain: 'AGENT',
              id: 'PROCESSOR_MUTATED_MESSAGE_LIST_AFTER_MODEL_CONTEXT',
              text: `Processor workflow ${processorOrWorkflow.id} mutated messageList after prompt-only model context was set. Mutate canonical messages before returning modelContextMessages, or return messages to update the prompt-only context.`,
            });
          }
          if (modelContextMessages !== undefined && mutations.length > 0 && hasRegularMessageListMutations(mutations)) {
            throw new MastraError({
              category: 'USER',
              domain: 'AGENT',
              id: 'PROCESSOR_MUTATED_MESSAGE_LIST_WITH_MODEL_CONTEXT_MESSAGES',
              text: `Processor workflow ${processorOrWorkflow.id} mutated messageList and returned modelContextMessages. Prompt-only model context cannot be combined with canonical messageList mutations.`,
            });
          }
          if (systemMessages) {
            messageList.replaceAllSystemMessages(systemMessages as CoreMessageV4[]);
          }
          if ('modelContextMessages' in workflowProcessInputStepResult) {
            stepInput.modelContextMessages = normalizePromptOnlyMessages(
              (modelContextMessages ?? []) as MastraDBMessage[],
            );
          } else if (messages) {
            if (stepInput.modelContextMessages !== undefined) {
              stepInput.modelContextMessages = normalizePromptOnlyMessages(messages as MastraDBMessage[]);
            } else {
              ProcessorRunner.applyMessagesToMessageList(
                messages as MastraDBMessage[],
                messageList,
                idsBeforeProcessing,
                check,
              );
            }
          }
          Object.assign(stepInput, rest);
        } catch (error) {
          if (!recordingStopped) {
            messageList.stopRecording();
          }
          throw error;
        }
        continue;
      }

      // Handle regular processor
      const processor = processorOrWorkflow;
      const processMethod = processor.processInputStep?.bind(processor);
      if (!processMethod) {
        // Skip processors that don't implement processInputStep
        continue;
      }

      const abort = <TMetadata = unknown>(reason?: string, options?: TripWireOptions<TMetadata>): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.id}`, options, processor.id);
      };

      // Get all system messages to pass to the processor
      const currentSystemMessages = messageList.getAllSystemMessages();

      const inputData = {
        messages: processableMessages,
        stepNumber,
        steps,
        messageId: stepInput.messageId,
        systemMessages: currentSystemMessages,
        tools: stepInput.tools,
        toolChoice: stepInput.toolChoice,
        model: stepInput.model!,
        activeTools: stepInput.activeTools,
        providerOptions: stepInput.providerOptions,
        modelSettings: stepInput.modelSettings,
        structuredOutput: stepInput.structuredOutput,
        requestContext,
      };

      // Use the current span (the step span) as the parent for processor spans
      const currentSpan = observabilityContext.tracingContext?.currentSpan;
      const processorSpan = currentSpan?.createChildSpan({
        type: SpanType.PROCESSOR_RUN,
        name: `input step processor: ${processor.id}`,
        entityType: EntityType.INPUT_STEP_PROCESSOR,
        entityId: processor.id,
        entityName: processor.name,
        attributes: {
          processorExecutor: 'legacy',
          processorIndex: index,
        },
        input: buildProcessInputStepSpanInput({
          messages: inputData.messages,
          systemMessages: inputData.systemMessages,
          stepNumber: inputData.stepNumber,
          messageId: inputData.messageId,
          retryCount: args.retryCount ?? 0,
          model: inputData.model,
          tools: inputData.tools,
          toolChoice: inputData.toolChoice,
          activeTools: inputData.activeTools,
        }),
      });

      // Start recording MessageList mutations for this processor
      messageList.startRecording();

      try {
        // Get per-processor state that persists across all method calls within this request
        const processorState = this.getProcessorState(processor.id);
        const beforeStepInput = {
          messageId: inputData.messageId,
          model: inputData.model,
          tools: inputData.tools,
          toolChoice: inputData.toolChoice,
          activeTools: inputData.activeTools,
        };

        const processMethodArgs = {
          messages: processableMessages,
          messageList,
          stepNumber,
          steps,
          messageId: stepInput.messageId,
          systemMessages: currentSystemMessages,
          tools: stepInput.tools,
          toolChoice: stepInput.toolChoice,
          model: stepInput.model!,
          activeTools: stepInput.activeTools,
          providerOptions: stepInput.providerOptions,
          modelSettings: stepInput.modelSettings,
          structuredOutput: stepInput.structuredOutput,
          requestContext,
          state: processorState.customState,
          abort,
          ...(args.rotateResponseMessageId
            ? {
                rotateResponseMessageId: () => {
                  const nextMessageId = args.rotateResponseMessageId!();
                  stepInput.messageId = nextMessageId;
                  return nextMessageId;
                },
              }
            : {}),
          ...createObservabilityContext({ currentSpan: processorSpan }),
          retryCount: args.retryCount ?? 0,
          writer,
          abortSignal: args.abortSignal,
        };

        const hadModelContextMessages = stepInput.modelContextMessages !== undefined;
        const result = await ProcessorRunner.validateAndFormatProcessInputStepResult(
          await processMethod(processMethodArgs),
          {
            messageList,
            processor,
            stepNumber,
          },
        );
        const returnedModelContextMessages = 'modelContextMessages' in result;
        const { messages, systemMessages, modelContextMessages, ...rest } = result;

        // Stop recording and get mutations for this processor
        const mutations = messageList.stopRecording();

        if (
          hadModelContextMessages &&
          mutations.length > 0 &&
          hasRegularMessageListMutations(mutations) &&
          !messages &&
          !modelContextMessages
        ) {
          throw new MastraError({
            category: 'USER',
            domain: 'AGENT',
            id: 'PROCESSOR_MUTATED_MESSAGE_LIST_AFTER_MODEL_CONTEXT_MESSAGES',
            text: `Processor ${processor.id} mutated messageList after prompt-only model context was set by a previous processor. Return messages or modelContextMessages from this processor so the next model prompt stays in sync with the mutation.`,
          });
        }

        if (
          stepInput.modelContextMessages !== undefined &&
          mutations.length > 0 &&
          hasRegularMessageListMutations(mutations) &&
          messages === undefined &&
          modelContextMessages === undefined
        ) {
          throw new MastraError({
            category: 'USER',
            domain: 'AGENT',
            id: 'PROCESSOR_MUTATED_MESSAGE_LIST_AFTER_MODEL_CONTEXT',
            text: `Processor ${processor.id} mutated messageList after prompt-only model context was set. Mutate canonical messages before returning modelContextMessages, or return messages to update the prompt-only context.`,
          });
        }

        if (returnedModelContextMessages && mutations.length > 0) {
          throw new MastraError({
            category: 'USER',
            domain: 'AGENT',
            id: 'PROCESSOR_MUTATED_MESSAGE_LIST_WITH_MODEL_CONTEXT_MESSAGES',
            text: `Processor ${processor.id} mutated messageList and returned modelContextMessages. Prompt-only model context cannot be combined with canonical messageList mutations.`,
          });
        }

        if (messages) {
          if (stepInput.modelContextMessages !== undefined) {
            stepInput.modelContextMessages = normalizePromptOnlyMessages(messages);
          } else {
            ProcessorRunner.applyMessagesToMessageList(messages, messageList, idsBeforeProcessing, check);
          }
        }
        if (returnedModelContextMessages) {
          stepInput.modelContextMessages = normalizePromptOnlyMessages(modelContextMessages ?? []);
        }
        if (systemMessages) {
          messageList.replaceAllSystemMessages(systemMessages);
        }
        Object.assign(stepInput, rest);
        args.onProcessorResult?.({
          processorId: processor.id,
          processorName: processor.name,
          processorIndex: index,
          result: cloneRunProcessInputStepResult(stepInput),
        });

        processorSpan?.end({
          output: buildProcessInputStepSpanOutput({
            result,
            beforeStepInput,
            afterStepInput: stepInput,
            beforeMessages: inputData.messages,
            beforeSystemMessages: inputData.systemMessages,
            messages: stepInput.modelContextMessages ?? messageList.get.all.db(),
            systemMessages: messageList.getAllSystemMessages(),
          }),
          attributes: mutations.length > 0 ? { messageListMutations: mutations } : undefined,
        });
      } catch (error) {
        // Stop recording on error
        messageList.stopRecording();

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
          throw error;
        }
        processorSpan?.error({ error: error as Error, endSpan: true });
        throw error;
      }
    }

    return stepInput;
  }

  /**
   * Run processOutputStep for all processors that implement it.
   * Called after each LLM response in the agentic loop, before tool execution.
   *
   * Unlike processOutputResult which runs once at the end, this runs at every step.
   * This is the ideal place to implement guardrails that can trigger retries.
   *
   * @param args.messages - The current messages including the LLM response
   * @param args.messageList - MessageList instance for managing message sources
   * @param args.stepNumber - The current step number (0-indexed)
   * @param args.finishReason - The finish reason from the LLM
   * @param args.toolCalls - Tool calls made in this step (if any)
   * @param args.text - Generated text from this step
   * @param args.tracingContext - Optional tracing context for observability
   * @param args.requestContext - Optional runtime context with execution metadata
   * @param args.retryCount - Number of times processors have triggered retry
   *
   * @returns The processed MessageList
   */
  async runProcessOutputStep(
    args: {
      steps: Array<StepResult<any>>;
      messages: MastraDBMessage[];
      messageList: MessageList;
      stepNumber: number;
      finishReason?: string;
      toolCalls?: ToolCallInfo[];
      text?: string;
      usage?: LanguageModelUsage;
      requestContext?: RequestContext;
      retryCount?: number;
      writer?: ProcessorStreamWriter;
    } & Partial<ObservabilityContext>,
  ): Promise<MessageList> {
    const {
      steps,
      messageList,
      stepNumber,
      finishReason,
      toolCalls,
      text,
      usage,
      requestContext,
      retryCount = 0,
      writer,
    } = args;
    const observabilityContext = resolveObservabilityContext(args);

    // Run through all output processors that have processOutputStep
    for (const [index, processorOrWorkflow] of this.outputProcessors.entries()) {
      const processableMessages: MastraDBMessage[] = messageList.get.all.db();
      const idsBeforeProcessing = processableMessages.map((m: MastraDBMessage) => m.id);
      const check = messageList.makeMessageSourceChecker();

      // Handle workflow as processor with outputStep phase
      if (isProcessorWorkflow(processorOrWorkflow)) {
        const currentSystemMessages = messageList.getAllSystemMessages();
        await this.executeWorkflowAsProcessor(
          processorOrWorkflow,
          {
            phase: 'outputStep',
            messages: processableMessages,
            messageList,
            stepNumber,
            finishReason,
            toolCalls,
            text,
            usage,
            systemMessages: currentSystemMessages,
            steps,
            retryCount,
          },
          observabilityContext,
          requestContext,
          writer,
        );
        continue;
      }

      // Handle regular processor
      const processor = processorOrWorkflow;
      const processMethod = processor.processOutputStep?.bind(processor);

      if (!processMethod) {
        // Skip processors that don't implement processOutputStep
        continue;
      }

      const abort = <TMetadata = unknown>(reason?: string, options?: TripWireOptions<TMetadata>): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.id}`, options, processor.id);
      };

      const currentSystemMessages = messageList.getAllSystemMessages();
      const defaultUsage: LanguageModelUsage = {
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      };
      const currentSpan = observabilityContext.tracingContext?.currentSpan;
      const parentSpan = currentSpan?.findParent(SpanType.AGENT_RUN) || currentSpan?.parent || currentSpan;
      const processorSpan = parentSpan?.createChildSpan({
        type: SpanType.PROCESSOR_RUN,
        name: `output step processor: ${processor.id}`,
        entityType: EntityType.OUTPUT_STEP_PROCESSOR,
        entityId: processor.id,
        entityName: processor.name,
        attributes: {
          processorExecutor: 'legacy',
          processorIndex: index,
        },
        input: {
          messages: processableMessages,
          systemMessages: currentSystemMessages,
          stepNumber,
          ...(finishReason !== undefined ? { finishReason } : {}),
          ...(toolCalls !== undefined ? { toolCalls } : {}),
          ...(text !== undefined ? { text } : {}),
        },
      });

      // Start recording MessageList mutations for this processor
      messageList.startRecording();

      // Get or create processor state (persists across steps within a request)
      const processorState = this.getProcessorState(processor.id);

      try {
        const result = await processMethod({
          messages: processableMessages,
          messageList,
          stepNumber,
          finishReason,
          toolCalls,
          text,
          usage: usage ?? defaultUsage,
          systemMessages: currentSystemMessages,
          steps,
          state: processorState.customState,
          abort,
          ...createObservabilityContext({ currentSpan: processorSpan }),
          requestContext,
          retryCount,
          writer,
        });

        // Stop recording and get mutations for this processor
        const mutations = messageList.stopRecording();

        // Handle the return type - MessageList or MastraDBMessage[]
        if (result instanceof MessageList) {
          if (result !== messageList) {
            throw new MastraError({
              category: 'USER',
              domain: 'AGENT',
              id: 'PROCESSOR_RETURNED_EXTERNAL_MESSAGE_LIST',
              text: `Processor ${processor.id} returned a MessageList instance other than the one that was passed in as an argument. New external message list instances are not supported. Use the messageList argument instead.`,
            });
          }
          // Processor returned the same messageList - mutations have been applied
        } else if (result) {
          // Processor returned an array - apply changes to messageList
          const deletedIds = idsBeforeProcessing.filter(
            (i: string) => !result.some((m: MastraDBMessage) => m.id === i),
          );
          if (deletedIds.length) {
            messageList.removeByIds(deletedIds);
          }

          // Re-add messages with correct sources
          for (const message of result) {
            messageList.removeByIds([message.id]);
            if (message.role === 'system') {
              const systemText =
                (message.content.content as string | undefined) ??
                message.content.parts?.map((p: any) => (p.type === 'text' ? p.text : '')).join('\n') ??
                '';
              messageList.addSystem(systemText);
            } else {
              messageList.add(message, check.getSource(message) || 'response');
            }
          }
        }

        processorSpan?.end({
          output: {
            ...(!areProcessorMessageArraysEqual(processableMessages, messageList.get.all.db())
              ? { messages: messageList.get.all.db() }
              : {}),
            ...(!areProcessorMessageArraysEqual(currentSystemMessages, messageList.getAllSystemMessages())
              ? { systemMessages: messageList.getAllSystemMessages() }
              : {}),
          },
          attributes: mutations.length > 0 ? { messageListMutations: mutations } : undefined,
        });
      } catch (error) {
        // Stop recording on error
        messageList.stopRecording();

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
          throw error;
        }
        processorSpan?.error({ error: error as Error, endSpan: true });
        throw error;
      }
    }

    return messageList;
  }

  /**
   * Run processAPIError on all processors that implement it.
   * Called when an LLM API call fails with a non-retryable error.
   * Iterates through both input and output processors.
   *
   * @returns { retry: boolean } indicating whether to retry the LLM call
   */
  async runProcessAPIError(
    args: {
      error: unknown;
      messages: MastraDBMessage[];
      modelContextMessages?: MastraDBMessage[];
      messageList: MessageList;
      stepNumber: number;
      steps: Array<StepResult<any>>;
      messageId?: string;
      requestContext?: RequestContext;
      retryCount?: number;
      writer?: ProcessorStreamWriter;
      abortSignal?: AbortSignal;
      rotateResponseMessageId?: () => string;
    } & Partial<ObservabilityContext>,
  ): Promise<{ retry: boolean; modelContextMessages?: MastraDBMessage[] }> {
    const { error, messageList, stepNumber, steps, requestContext, retryCount = 0, writer, abortSignal } = args;
    const observabilityContext = resolveObservabilityContext(args);

    const allProcessors: ProcessorOrWorkflow[] = [
      ...this.inputProcessors,
      ...this.outputProcessors,
      ...this.errorProcessors,
    ];

    for (const [index, processorOrWorkflow] of allProcessors.entries()) {
      // Skip workflows — processAPIError is only available on Processor instances
      if (isProcessorWorkflow(processorOrWorkflow)) {
        continue;
      }

      const processor = processorOrWorkflow;
      const processMethod = processor.processAPIError?.bind(processor);

      if (!processMethod) {
        continue;
      }

      const abort = <TMetadata = unknown>(reason?: string, options?: TripWireOptions<TMetadata>): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.id}`, options, processor.id);
      };

      const processableMessages: MastraDBMessage[] = args.modelContextMessages ?? messageList.get.all.db();
      const systemMessagesBefore = messageList.getAllSystemMessages();
      const messageIdBefore = args.messageId;
      let messageIdAfter = args.messageId;
      const currentSpan = observabilityContext.tracingContext?.currentSpan;
      const parentSpan = currentSpan?.findParent(SpanType.AGENT_RUN) || currentSpan?.parent || currentSpan;
      const processorSpan = parentSpan?.createChildSpan({
        type: SpanType.PROCESSOR_RUN,
        name: `request error processor: ${processor.id}`,
        entityType: EntityType.OUTPUT_STEP_PROCESSOR,
        entityId: processor.id,
        entityName: processor.name,
        attributes: {
          processorExecutor: 'legacy',
          processorIndex: index,
        },
        input: {
          messages: processableMessages,
          error: error instanceof Error ? error.message : String(error),
          stepNumber,
          ...(args.messageId ? { messageId: args.messageId } : {}),
          retryCount,
        },
      });

      // Start recording MessageList mutations for this processor
      messageList.startRecording();

      // Get or create processor state (persists across steps within a request)
      const processorState = this.getProcessorState(processor.id);

      try {
        const result = await processMethod({
          messages: processableMessages,
          ...(args.modelContextMessages !== undefined ? { modelContextMessages: processableMessages } : {}),
          messageList,
          stepNumber,
          steps,
          state: processorState.customState,
          error,
          abort,
          ...createObservabilityContext({ currentSpan: processorSpan }),
          requestContext,
          retryCount,
          writer,
          abortSignal,
          messageId: args.messageId,
          ...(args.rotateResponseMessageId
            ? {
                rotateResponseMessageId: () => {
                  const nextMessageId = args.rotateResponseMessageId!();
                  messageIdAfter = nextMessageId;
                  return nextMessageId;
                },
              }
            : {}),
        });

        // Stop recording and get mutations for this processor
        const mutations = messageList.stopRecording();
        const messagesAfter = messageList.get.all.db();
        const systemMessagesAfter = messageList.getAllSystemMessages();
        const output: Record<string, unknown> = {
          retry: result?.retry ?? false,
        };

        if (!areProcessorMessageArraysEqual(processableMessages, messagesAfter)) {
          output.messages = messagesAfter;
        }

        if (!areProcessorMessageArraysEqual(systemMessagesBefore, systemMessagesAfter)) {
          output.systemMessages = systemMessagesAfter;
        }

        if (messageIdAfter !== messageIdBefore) {
          output.messageId = messageIdAfter;
        }

        processorSpan?.end({
          output,
          attributes: mutations.length > 0 ? { messageListMutations: mutations } : undefined,
        });

        if (result?.retry) {
          return {
            retry: true,
            ...(result.modelContextMessages !== undefined
              ? { modelContextMessages: normalizePromptOnlyMessages(result.modelContextMessages) }
              : args.modelContextMessages !== undefined
                ? { modelContextMessages: args.modelContextMessages }
                : {}),
          };
        }
      } catch (processorError) {
        // Stop recording on error
        messageList.stopRecording();

        if (processorError instanceof TripWire) {
          processorSpan?.error({
            error: processorError,
            endSpan: true,
            attributes: {
              tripwireAbort: {
                reason: processorError.message,
                retry: processorError.options?.retry,
                metadata: processorError.options?.metadata,
              },
            },
          });
          throw processorError;
        }

        processorSpan?.error({ error: processorError as Error, endSpan: true });
        this.logger.error(
          `[Agent:${this.agentName}] - Request error processor ${processor.id} failed:`,
          processorError,
        );
        // Don't re-throw — if the error processor itself fails, fall through to original error handling
      }
    }

    return { retry: false };
  }

  static applyMessagesToMessageList(
    messages: MastraDBMessage[],
    messageList: MessageList,
    idsBeforeProcessing: string[],
    check: ReturnType<MessageList['makeMessageSourceChecker']>,
    defaultSource: 'input' | 'response' = 'input',
  ) {
    const deletedIds = idsBeforeProcessing.filter(i => !messages.some(m => m.id === i));
    if (deletedIds.length) {
      messageList.removeByIds(deletedIds);
    }

    // Re-add messages with correct sources
    for (const message of messages) {
      messageList.removeByIds([message.id]);
      if (message.role === 'system') {
        const systemText =
          (message.content.content as string | undefined) ??
          message.content.parts?.map(p => (p.type === 'text' ? p.text : '')).join('\n') ??
          '';
        messageList.addSystem(systemText);
      } else {
        messageList.add(message, check.getSource(message) || defaultSource);
      }
    }
  }

  static validateAndFormatProcessInputResult(
    result: ProcessInputResult | undefined | void,
    {
      messageList,
      processor,
    }: {
      messageList: MessageList;
      processor: Processor;
    },
  ): {
    messages?: MastraDBMessage[];
    messageList?: MessageList;
    modelContextMessages?: MastraDBMessage[];
    systemMessages?: CoreMessageV4[];
  } {
    return validateAndFormatProcessInputResult(result, { messageList, processor });
  }

  static async validateAndFormatProcessInputStepResult(
    result: ProcessInputStepResult | Awaited<ProcessorMessageResult> | undefined | void,
    {
      messageList,
      processor,
      stepNumber,
    }: {
      messageList: MessageList;
      processor: Processor;
      stepNumber: number;
    },
  ): Promise<RunProcessInputStepResult> {
    return validateAndFormatProcessInputStepResult(result, { messageList, processor, stepNumber });
  }
}
