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
    const { page, perPage, name, spanType, start, end } = c.req.query();

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

    const dateRange: { start?: Date; end?: Date } = {};
    if (start) {
      try {
        dateRange.start = new Date(start);
      } catch {
        return c.json({ error: 'Invalid start date' }, 400);
      }
    }

    if (end) {
      try {
        dateRange.end = new Date(end);
      } catch {
        return c.json({ error: 'Invalid end date' }, 400);
      }
    }

    if (Object.keys(dateRange).length > 0) {
      pagination.dateRange = dateRange;
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
