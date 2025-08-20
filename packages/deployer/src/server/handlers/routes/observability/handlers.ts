import type { Mastra, StorageGetAiTracesPaginatedArg } from '@mastra/core';
import { AISpanType } from '@mastra/core/ai-tracing';
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
    const { page, perPage, name, spanType, dateRange, attributes } = c.req.query();

    const filters: StorageGetAiTracesPaginatedArg['filters'] = {};
    if (name) filters.name = name;
    if (spanType) {
      if (Object.values(AISpanType).includes(spanType as AISpanType)) {
        filters.spanType = spanType as AISpanType;
      } else {
        return c.json({ error: 'Invalid spanType' }, 400);
      }
    }
    if (attributes) {
      try {
        filters.attributes = JSON.parse(attributes);
      } catch {
        return c.json({ error: 'Invalid attributes JSON' }, 400);
      }
    }
    if (dateRange) {
      try {
        const parsedDateRange = JSON.parse(dateRange);
        filters.dateRange = parsedDateRange;
      } catch {
        return c.json({ error: 'Invalid dateRange JSON' }, 400);
      }
    }

    const result = await getOriginalAITracesPaginatedHandler({
      mastra,
      body: {
        page: parseInt(page || '0'),
        perPage: parseInt(perPage || '10'),
        filters,
      },
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting AI traces paginated');
  }
}
