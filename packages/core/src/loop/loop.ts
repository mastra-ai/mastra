import { generateId } from '@internal/ai-sdk-v5';
import type { ToolSet } from '@internal/ai-sdk-v5';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { ConsoleLogger } from '../logger';
import { createObservabilityContext } from '../observability';
import type { ProcessorState } from '../processors';
import { createDestructurableOutput, MastraModelOutput } from '../stream/base/output';
import type { LoopOptions, LoopRun, StreamInternal } from './types';
import { workflowLoopStream } from './workflows/stream';

export function loop<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  resumeContext,
  models,
  logger,
  runId,
  idGenerator,
  messageList,
  includeRawChunks,
  modelSettings,
  tools,
  _internal,
  outputProcessors,
  returnScorerData,
  requireToolApproval,
  agentId,
  toolCallConcurrency,
  ...rest
}: LoopOptions<Tools, OUTPUT>) {
  let loggerToUse =
    logger ||
    new ConsoleLogger({
      level: 'debug',
    });

  if (models.length === 0 || !models[0]) {
    const mastraError = new MastraError({
      id: 'LOOP_MODELS_EMPTY',
      domain: ErrorDomain.LLM,
      category: ErrorCategory.USER,
    });
    loggerToUse.trackException(mastraError);
    loggerToUse.error(mastraError.toString());
    throw mastraError;
  }

  const firstModel = models[0];

  let runIdToUse = runId;

  if (!runIdToUse) {
    runIdToUse =
      idGenerator?.({
        idType: 'run',
        source: 'agent',
        entityId: agentId,
        threadId: _internal?.threadId,
        resourceId: _internal?.resourceId,
      }) || crypto.randomUUID();
  }

  const internalToUse: StreamInternal = {
    now: _internal?.now || (() => Date.now()),
    generateId: _internal?.generateId || (() => generateId()),
    currentDate: _internal?.currentDate || (() => new Date()),
    saveQueueManager: _internal?.saveQueueManager,
    memoryConfig: _internal?.memoryConfig,
    threadId: _internal?.threadId,
    resourceId: _internal?.resourceId,
    memory: _internal?.memory,
    threadExists: _internal?.threadExists,
    transportRef: _internal?.transportRef ?? {},
  };

  let startTimestamp = internalToUse.now?.();

  const messageId = rest.experimental_generateMessageId?.() || internalToUse.generateId?.();

  let modelOutput: MastraModelOutput<OUTPUT> | undefined;
  const serializeStreamState = () => {
    return modelOutput?.serializeState();
  };
  const deserializeStreamState = (state: any) => {
    modelOutput?.deserializeState(state);
  };

  // Use the passed-in processorStates map if available, otherwise create a new one.
  // This map persists across loop iterations and is shared by all processor methods.
  const processorStates = rest.processorStates ?? new Map<string, ProcessorState>();

  const workflowLoopProps: LoopRun<Tools, OUTPUT> = {
    resumeContext,
    models,
    runId: runIdToUse,
    logger: loggerToUse,
    startTimestamp: startTimestamp!,
    messageList,
    includeRawChunks: !!includeRawChunks,
    _internal: internalToUse,
    tools,
    modelSettings,
    outputProcessors,
    messageId: messageId!,
    agentId,
    requireToolApproval,
    toolCallConcurrency,
    streamState: {
      serialize: serializeStreamState,
      deserialize: deserializeStreamState,
    },
    processorStates,
    ...rest,
  };

  const existingSnapshot = resumeContext?.snapshot;
  let initialStreamState: any;

  if (existingSnapshot) {
    for (const key in existingSnapshot?.context) {
      const step = existingSnapshot?.context[key];
      if (step && step.status === 'suspended' && step.suspendPayload?.__streamState) {
        initialStreamState = step.suspendPayload?.__streamState;
        break;
      }
    }
  }
  const baseStream = workflowLoopStream(workflowLoopProps);

  // Apply chunk tracing transform to track MODEL_STEP and MODEL_CHUNK spans
  const stream = rest.modelSpanTracker?.wrapStream(baseStream) ?? baseStream;

  // Build observability context from modelSpanTracker if tracing context is available
  const observabilityContext = createObservabilityContext(rest.modelSpanTracker?.getTracingContext());

  modelOutput = new MastraModelOutput({
    model: {
      modelId: firstModel.model.modelId,
      provider: firstModel.model.provider,
      version: firstModel.model.specificationVersion,
    },
    stream,
    messageList,
    messageId: messageId!,
    options: {
      runId: runIdToUse!,
      toolCallStreaming: rest.toolCallStreaming,
      onFinish: rest.options?.onFinish,
      onStepFinish: rest.options?.onStepFinish,
      includeRawChunks: !!includeRawChunks,
      structuredOutput: rest.structuredOutput,
      outputProcessors,
      returnScorerData,
      ...observabilityContext,
      requestContext: rest.requestContext,
      processorStates,
      transportRef: internalToUse.transportRef,
    },
    initialState: initialStreamState,
  });

  return createDestructurableOutput(modelOutput);
}
