import { ConsoleLogger } from '../logger';
import { getRootSpan } from './telemetry';
import type { LoopOptions, LoopRun } from './types';

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
    operationId: runIdToUse,
    model: {
      modelId: model.modelId,
      provider: model.provider,
    },
    modelSettings,
    telemetry_settings,
    messageList,
  });

  const workflowLoopProps: LoopRun = {
    model,
    runId: runIdToUse,
    logger: loggerToUse,
    startTimestamp: startTimestamp!,
    messageList,
    includeRawChunks,
  };

  return {
    rootSpan,
    workflowLoopProps,
  };
}
