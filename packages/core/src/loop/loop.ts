import { generateId } from 'ai-v5';
import type { ToolSet } from 'ai-v5';
import { ConsoleLogger } from '../logger';
import { MastraModelOutput } from '../stream/base/output';
import { getRootSpan } from './telemetry';
import type { LoopOptions, LoopRun, StreamInternal } from './types';
import { workflowLoopStream } from './workflow/stream';

export async function loop<Tools extends ToolSet = ToolSet>({
  model,
  logger,
  runId,
  idGenerator,
  telemetry_settings,
  messageList,
  includeRawChunks,
  modelSettings,
  tools,
  _internal,
  ...rest
}: LoopOptions<Tools>) {
  let loggerToUse =
    logger ||
    new ConsoleLogger({
      level: 'debug',
    });

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

  const { rootSpan } = getRootSpan({
    operationId: `mastra.stream`,
    model: {
      modelId: model.modelId,
      provider: model.provider,
    },
    modelSettings,
    telemetry_settings,
  });

  rootSpan.setAttributes({
    ...(telemetry_settings?.recordOutputs !== false
      ? {
          'stream.prompt.messages': JSON.stringify(messageList.get.input.aiV5.model()),
        }
      : {}),
  });

  const workflowLoopProps: LoopRun<Tools> = {
    model,
    runId: runIdToUse,
    logger: loggerToUse,
    startTimestamp: startTimestamp!,
    messageList,
    includeRawChunks: !!includeRawChunks,
    _internal: internalToUse,
    tools,
    modelStreamSpan: rootSpan,
    ...rest,
  };

  const streamFn = workflowLoopStream(workflowLoopProps);

  return new MastraModelOutput({
    model: {
      modelId: model.modelId,
      provider: model.provider,
      version: model.specificationVersion,
    },
    stream: streamFn,
    messageList,
    options: {
      runId: runIdToUse!,
      telemetry_settings,
      rootSpan,
      toolCallStreaming: rest.toolCallStreaming,
      onFinish: rest.options?.onFinish,
      onStepFinish: rest.options?.onStepFinish,
      includeRawChunks: !!includeRawChunks,
      objectOptions: rest.objectOptions,
    },
  });
}
