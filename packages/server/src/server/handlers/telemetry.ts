import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';

interface TelemetryContext extends Context {
  body?: {
    name?: string;
    scope?: string;
    page?: number;
    perPage?: number;
    attribute?: string | string[];
    fromDate?: Date;
    toDate?: Date;
  };
}

export async function getTelemetryHandler({ mastra, body }: TelemetryContext) {
  try {
    const telemetry = mastra.getTelemetry();
    const storage = mastra.getStorage();

    if (!telemetry) {
      throw new HTTPException(400, { message: 'Telemetry is not initialized' });
    }

    if (!storage) {
      return [];
    }

    if (!body) {
      throw new HTTPException(400, { message: 'Body is required' });
    }

    const { name, scope, page, perPage, attribute, fromDate, toDate } = body;

    // Parse attribute query parameter if present
    const attributes = attribute
      ? Object.fromEntries(
          (Array.isArray(attribute) ? attribute : [attribute]).map(attr => {
            const [key, value] = attr.split(':');
            return [key, value];
          }),
        )
      : undefined;

    const traces = await storage.getTraces({
      name,
      scope,
      page: Number(page ?? 0),
      perPage: Number(perPage ?? 100),
      attributes,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });

    return traces;
  } catch (error) {
    return handleError(error, 'Error getting telemetry');
  }
}

export async function storeTelemetryHandler({ mastra, body }: Context & { body: { resourceSpans: any[] } }) {
  try {
    const storage = mastra.getStorage();
    const logger = mastra.getLogger();

    if (!storage) {
      return {
        status: 'error',
        message: 'Storage is not initialized',
      };
    }

    const now = new Date();

    const items = body?.resourceSpans?.[0]?.scopeSpans;
    logger.debug('[Telemetry Handler] Received spans:', {
      totalSpans: items?.reduce((acc: number, scope: { spans: any[] }) => acc + scope.spans.length, 0) || 0,
      timestamp: now.toISOString(),
    });
    if (!items?.length) {
      return {
        status: 'success',
        message: 'No spans to process',
        traceCount: 0,
      };
    }

    const parentSpanIds = collectParentSpanIds(items);
    const allSpans: any[] = items.reduce((acc: any, scopedSpans: any) => {
      const { scope, spans } = scopedSpans;

      // HTTP instrumentation spans are root spans but are not useful.
      // Remove them entirely and promote their direct children to root spans.
      if (scope.name === '@opentelemetry/instrumentation-http') {
        return acc;
      }

      for (const span of spans) {
        const {
          spanId,
          parentSpanId,
          traceId,
          name,
          kind,
          attributes,
          status,
          events,
          links,
          startTimeUnixNano,
          endTimeUnixNano,
          ...rest
        } = span;

        const startTime = Number(BigInt(startTimeUnixNano) / 1000n);
        const endTime = Number(BigInt(endTimeUnixNano) / 1000n);

        acc.push({
          id: spanId,
          parentSpanId: parentSpanIds.has(parentSpanId) ? null : parentSpanId,
          traceId,
          name,
          scope: scope.name,
          kind,
          status: JSON.stringify(status),
          events: JSON.stringify(events),
          links: JSON.stringify(links),
          attributes: JSON.stringify(
            attributes.reduce((acc: Record<string, any>, attr: any) => {
              const valueKey = Object.keys(attr.value)[0];
              if (valueKey) {
                acc[attr.key] = attr.value[valueKey];
              }
              return acc;
            }, {}),
          ),
          startTime,
          endTime,
          other: JSON.stringify(rest),
          createdAt: now,
        });
      }
      return acc;
    }, []);

    return storage
      .batchTraceInsert({
        records: allSpans,
      })
      .then(() => {
        return {
          status: 'success',
          message: 'Traces received and processed successfully',
          traceCount: body.resourceSpans?.length || 0,
        };
      })
      .catch(() => {
        return {
          status: 'error',
          message: 'Failed to process traces',
          // @ts-ignore
          error: error.message,
        };
      });

    // Return a simple response
  } catch (error) {
    console.error('Error processing traces:', error);
    return {
      status: 'error',
      message: 'Failed to process traces',
      // @ts-ignore
      error: error.message,
    };
  }
}

export const collectParentSpanIds = (items: any[]) => {
  const result = new Set<string>();
  for (const { scope, spans } of items) {
    if (scope.name !== '@opentelemetry/instrumentation-http') {
      continue;
    }

    for (const span of spans) {
      result.add(span.spanId);
    }
  }

  return result;
};
