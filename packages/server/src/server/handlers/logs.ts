import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';
import type { Mastra } from '@mastra/core/mastra';
import { handleError } from './error';
import { validateBody } from './utils';

type LogsContext = {
  mastra: Mastra;
  transportId?: string;
  runId?: string;
  params?: {
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: string | string[];
    page?: number;
    perPage?: number;
  };
};

export async function getLogsHandler({
  mastra,
  transportId,
  params,
}: Pick<LogsContext, 'mastra' | 'transportId' | 'params'>): Promise<{
  logs: BaseLogMessage[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}> {
  try {
    validateBody({ transportId });

    const { fromDate, toDate, logLevel, filters: _filters, page, perPage } = params || {};

    // Parse filter query parameter if present
    const filters = _filters
      ? Object.fromEntries(
          (Array.isArray(_filters) ? _filters : [_filters]).map(attr => {
            const [key, value] = attr.split(':');
            return [key, value];
          }),
        )
      : undefined;

    const logs = await mastra.getLogs(transportId!, {
      fromDate,
      toDate,
      logLevel,
      filters,
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
    });
    return logs;
  } catch (error) {
    return handleError(error, 'Error getting logs');
  }
}

export async function getLogsByRunIdHandler({
  mastra,
  runId,
  transportId,
  params,
}: Pick<LogsContext, 'mastra' | 'runId' | 'transportId' | 'params'>) {
  try {
    validateBody({ runId, transportId });

    const { fromDate, toDate, logLevel, filters: _filters, page, perPage } = params || {};

    // Parse filter query parameter if present
    const filters = _filters
      ? Object.fromEntries(
          (Array.isArray(_filters) ? _filters : [_filters]).map(attr => {
            const [key, value] = attr.split(':');
            return [key, value];
          }),
        )
      : undefined;

    const logs = await mastra.getLogsByRunId({
      runId: runId!,
      transportId: transportId!,
      fromDate,
      toDate,
      logLevel,
      filters,
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
    });
    return logs;
  } catch (error) {
    return handleError(error, 'Error getting logs by run ID');
  }
}

export async function getLogTransports({ mastra }: Pick<LogsContext, 'mastra'>) {
  try {
    const logger = mastra.getLogger();
    const transports = logger.getTransports();

    return {
      transports: transports ? [...transports.keys()] : [],
    };
  } catch (error) {
    return handleError(error, 'Error getting log Transports');
  }
}
