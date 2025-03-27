import type { Mastra } from '@mastra/core/mastra';

import { handleError } from './error';
import { validateBody } from './utils';

type LogsContext = {
  mastra: Mastra;
  transportId?: string;
  runId?: string;
};

export async function getLogsHandler({ mastra, transportId }: Pick<LogsContext, 'mastra' | 'transportId'>) {
  try {
    validateBody({ transportId });

    const logs = await mastra.getLogs(transportId!);
    return logs;
  } catch (error) {
    return handleError(error, 'Error getting logs');
  }
}

export async function getLogsByRunIdHandler({
  mastra,
  runId,
  transportId,
}: Pick<LogsContext, 'mastra' | 'runId' | 'transportId'>) {
  try {
    validateBody({ runId, transportId });

    const logs = await mastra.getLogsByRunId({ runId: runId!, transportId: transportId! });
    return logs;
  } catch (error) {
    return handleError(error, 'Error getting logs by run ID');
  }
}

export async function getLogTransports({ mastra }: Pick<LogsContext, 'mastra'>) {
  try {
    const logger = mastra.getLogger();
    const transports = logger.transports;

    return {
      transports: Object.keys(transports),
    };
  } catch (error) {
    return handleError(error, 'Error getting log Transports');
  }
}
