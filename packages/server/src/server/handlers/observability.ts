import { scoreTraces } from '@mastra/core/evals/scoreTraces';
import type { TracesPaginatedArg, StoragePagination } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';
import { handleError } from './error';

interface ObservabilityContext extends Context {
  traceId?: string;
  body?: TracesPaginatedArg;
}

interface ScoreTracesContext extends Context {
  body?: {
    // scorer.id
    scorerName: string;
    targets: Array<{
      traceId: string;
      spanId?: string;
    }>;
  };
}

/**
 * Get a complete trace by trace ID
 * Returns all spans in the trace with their parent-child relationships
 */
export async function getTraceHandler({ mastra, traceId }: ObservabilityContext & { traceId: string }) {
  try {
    if (!traceId) {
      throw new HTTPException(400, { message: 'Trace ID is required' });
    }

    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(500, { message: 'Storage is not available' });
    }

    const trace = await storage.getTrace(traceId);

    if (!trace) {
      throw new HTTPException(404, { message: `Trace with ID '${traceId}' not found` });
    }

    return trace;
  } catch (error) {
    handleError(error, 'Error getting trace');
  }
}

/**
 * Get paginated traces with filtering and pagination
 * Returns only root spans (parent spans) for pagination, not child spans
 */
export async function getTracesPaginatedHandler({ mastra, body }: ObservabilityContext) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(500, { message: 'Storage is not available' });
    }

    if (!body) {
      throw new HTTPException(400, { message: 'Request body is required' });
    }

    const { filters, pagination } = body;

    if (pagination?.page && pagination.page < 0) {
      throw new HTTPException(400, { message: 'Page must be a non-negative integer' });
    }

    if (pagination?.perPage && pagination.perPage < 0) {
      throw new HTTPException(400, { message: 'Per page must be a non-negative integer' });
    }

    if (pagination?.dateRange) {
      const { start, end } = pagination.dateRange;

      if (start && !(start instanceof Date)) {
        throw new HTTPException(400, { message: 'Invalid date format in date range' });
      }

      if (end && !(end instanceof Date)) {
        throw new HTTPException(400, { message: 'Invalid date format in date range' });
      }
    }

    return storage.getTracesPaginated({
      pagination,
      filters,
    });
  } catch (error) {
    handleError(error, 'Error getting traces paginated');
  }
}

/**
 * Score traces using a specified scorer
 * Fire-and-forget approach - returns immediately while scoring runs in background
 */
export async function scoreTracesHandler({ mastra, body }: ScoreTracesContext) {
  try {
    if (!body) {
      throw new HTTPException(400, { message: 'Request body is required' });
    }

    const { scorerName, targets } = body;

    if (!scorerName) {
      throw new HTTPException(400, { message: 'Scorer ID is required' });
    }

    if (!targets || targets.length === 0) {
      throw new HTTPException(400, { message: 'At least one target is required' });
    }

    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(500, { message: 'Storage is not available' });
    }

    const scorer = mastra.getScorerById(scorerName);
    if (!scorer) {
      throw new HTTPException(404, { message: `Scorer '${scorerName}' not found` });
    }

    const logger = mastra.getLogger();

    scoreTraces({
      scorerId: scorer.config.id || scorer.config.name,
      targets,
      mastra,
    }).catch(error => {
      logger?.error(`Background trace scoring failed: ${error.message}`, error);
    });

    // Return immediate response
    return {
      status: 'success',
      message: `Scoring started for ${targets.length} ${targets.length === 1 ? 'trace' : 'traces'}`,
      traceCount: targets.length,
    };
  } catch (error) {
    handleError(error, 'Error processing trace scoring');
  }
}

export async function listScoresBySpan({
  mastra,
  traceId,
  spanId,
  pagination,
}: Context & { traceId: string; spanId: string; pagination: StoragePagination }) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(500, { message: 'Storage is not available' });
    }

    if (!traceId || !spanId) {
      throw new HTTPException(400, { message: 'Trace ID and span ID are required' });
    }

    return await storage.listScoresBySpan({ traceId, spanId, pagination });
  } catch (error) {
    return handleError(error, 'Error getting scores by span');
  }
}
