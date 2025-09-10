import { AISpanType } from '@mastra/core/ai-tracing';
import type { Mastra } from '@mastra/core/mastra';
import type { AITracesPaginatedArg } from '@mastra/core/storage';
import {
  getAITraceHandler as getOriginalAITraceHandler,
  getAITracesPaginatedHandler as getOriginalAITracesPaginatedHandler,
} from '@mastra/server/handlers/observability';
import type { Context } from 'hono';
import { handleError } from '../../error';

export async function getAITraceHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const traceId = c.req.param('traceId');

    if (!traceId) {
      return c.json({ error: 'Trace ID is required' }, 400);
    }

    const trace = await getOriginalAITraceHandler({
      mastra,
      traceId,
    });

    return c.json(trace);
  } catch (error) {
    return handleError(error, 'Error getting AI trace');
  }
}

export async function getAITracesPaginatedHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const { page, perPage, name, spanType, dateRange, entityId, entityType } = c.req.query();

    const pagination: AITracesPaginatedArg['pagination'] = {
      page: parseInt(page || '0'),
      perPage: parseInt(perPage || '10'),
    };

    const filters: AITracesPaginatedArg['filters'] = {};
    if (name) filters.name = name;
    if (spanType) {
      if (Object.values(AISpanType).includes(spanType as AISpanType)) {
        filters.spanType = spanType as AISpanType;
      } else {
        return c.json({ error: 'Invalid spanType' }, 400);
      }
    }
    if (entityId && entityType && (entityType === 'agent' || entityType === 'workflow')) {
      filters.entityId = entityId;
      filters.entityType = entityType;
    }

    let start: Date | undefined;
    let end: Date | undefined;
    if (dateRange) {
      try {
        const parsedDateRange = JSON.parse(dateRange);
        start = parsedDateRange.start ? new Date(parsedDateRange.start) : undefined;
        end = parsedDateRange.end ? new Date(parsedDateRange.end) : undefined;
      } catch {
        return c.json({ error: 'Invalid start date' }, 400);
      }
    }

    if (start || end) {
      pagination.dateRange = { start, end };
    }

    const result = await getOriginalAITracesPaginatedHandler({
      mastra,
      body: {
        pagination,
        filters,
      },
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting AI traces paginated');
  }
}
