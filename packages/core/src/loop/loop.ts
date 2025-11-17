import { generateId } from 'ai-v5';
import type { ToolSet } from 'ai-v5';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { ConsoleLogger } from '../logger';
import type { ProcessorState } from '../processors';
import { createDestructurableOutput, MastraModelOutput } from '../stream/base/output';
import type { OutputSchema } from '../stream/base/schema';
import type { LoopOptions, LoopRun, StreamInternal } from './types';
import { workflowLoopStream } from './workflows/stream';

export function loop<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema | undefined = undefined>({
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
    runIdToUse = idGenerator?.() || crypto.randomUUID();
  }

  const internalToUse: StreamInternal = {
    now: _internal?.now || (() => Date.now()),
    generateId: _internal?.generateId || (() => generateId()),
    currentDate: _internal?.currentDate || (() => new Date()),
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

  // Create processor states map that will be shared across all LLM execution steps
  const processorStates =
    outputProcessors && outputProcessors.length > 0 ? new Map<string, ProcessorState<OUTPUT>>() : undefined;

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
      tracingContext: rest.modelSpanTracker?.getTracingContext(),
    },
    initialState: initialStreamState,
  });

  return createDestructurableOutput(modelOutput);
}
