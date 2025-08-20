import type { StorageGetAiTracesPaginatedArg } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';

interface ObservabilityContext extends Context {
  traceId?: string;
  body?: StorageGetAiTracesPaginatedArg;
}

/**
 * Get a complete AI trace by trace ID
 * Returns all spans in the trace with their parent-child relationships
 */
export async function getAITraceHandler({ mastra, traceId }: ObservabilityContext & { traceId: string }) {
  try {
    if (!traceId) {
      throw new HTTPException(400, { message: 'Trace ID is required' });
    }

    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(500, { message: 'Storage is not available' });
    }

    const trace = await storage.getAITrace(traceId);

    if (!trace) {
      throw new HTTPException(404, { message: `Trace with ID '${traceId}' not found` });
    }

    return trace;
  } catch (error) {
    return handleError(error, 'Error getting AI trace');
  }
}

/**
 * Get paginated AI traces with filtering and pagination
 * Returns only root spans (parent spans) for pagination, not child spans
 */
export async function getAITracesPaginatedHandler({ mastra, body }: ObservabilityContext) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(500, { message: 'Storage is not available' });
    }

    if (!body) {
      throw new HTTPException(400, { message: 'Request body is required' });
    }

    const { page = 0, perPage = 10, filters } = body;

    // Validate pagination parameters
    if (page < 0) {
      throw new HTTPException(400, { message: 'Page must be a non-negative integer' });
    }

    if (perPage < 1 || perPage > 1000) {
      throw new HTTPException(400, { message: 'Per page must be between 1 and 1000' });
    }

    // Validate date range if provided
    if (filters?.dateRange) {
      const { start, end } = filters.dateRange;

      if (start && end) {
        const startDate = start instanceof Date ? start : new Date(start);
        const endDate = end instanceof Date ? end : new Date(end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new HTTPException(400, { message: 'Invalid date format in date range' });
        }

        if (startDate > endDate) {
          throw new HTTPException(400, { message: 'Start date must be before or equal to end date' });
        }
      }
    }

    return storage.getAITracesPaginated({
      page,
      perPage,
      filters,
    });
  } catch (error) {
    return handleError(error, 'Error getting AI traces paginated');
  }
}
