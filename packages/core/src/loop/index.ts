import { ConsoleLogger } from '../logger';
import { getRootSpan } from './telemetry';
import type { LoopOptions, LoopRun } from './types';
import { workflowLoopStream } from './workflow/stream';

export async function loop({
  model,
  logger,
  runId,
  idGenerator,
  telemetry_settings,
  messageList,
  includeRawChunks,
  modelSettings,
}: LoopOptions) {
  let loggerToUse =
    logger ||
    new ConsoleLogger({
      level: 'debug',
    });

  let runIdToUse = runId;

  if (!runIdToUse) {
    runIdToUse = idGenerator?.() || crypto.randomUUID();
  }

  let startTimestamp = Date.now();

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
          'stream.prompt.messages': JSON.stringify(messageList.get.input.core()),
        }
      : {}),
  });

  const workflowLoopProps: LoopRun = {
    model,
    runId: runIdToUse,
    logger: loggerToUse,
    startTimestamp: startTimestamp!,
    messageList,
    includeRawChunks,
  };

  const streamFn = workflowLoopStream(workflowLoopProps);

  return {
    rootSpan,
    workflowLoopProps,
    streamFn,
  };
}
