import { TABLE_TRACES, type MastraStorage } from '@mastra/core/storage';
import type { Telemetry } from '@mastra/core/telemetry';
import type { Context } from 'hono';

import { HTTPException } from 'hono/http-exception';

import { handleError } from './error';

export async function getTelemetryHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const telemetry: Telemetry = mastra.getTelemetry();
    const storage: MastraStorage = mastra.getStorage();

    const { name, scope, page, perPage } = c.req.query();
    const attribute = c.req.queries('attribute');

    if (!telemetry) {
      throw new HTTPException(400, { message: 'Telemetry is not initialized' });
    }

    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

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
    });

    return c.json({ traces });
  } catch (error) {
    return handleError(error, 'Error saving messages');
  }
}

export async function storeTelemetryHandler(c: Context) {
  try {
    // Parse the incoming body as JSON
    const body = await c.req.json();

    const mastra = c.get('mastra');
    const storage: MastraStorage = mastra.getStorage();

    const now = new Date();

    const items = body?.resourceSpans?.[0]?.scopeSpans;

    const allSpans: any[] = items.reduce((acc: any, scopedSpans: any) => {
      const { scope, spans } = scopedSpans;
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
          parentSpanId,
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
      .__batchInsert({
        tableName: TABLE_TRACES,
        records: allSpans,
      })
      .then(() => {
        return c.json(
          {
            status: 'success',
            message: 'Traces received and processed successfully',
            traceCount: body.resourceSpans?.length || 0,
          },
          200,
        );
      })
      .catch(e => {
        return c.json(
          {
            status: 'error',
            message: 'Failed to process traces',
            // @ts-ignore
            error: error.message,
          },
          500,
        );
      });

    // Return a simple response
  } catch (error) {
    console.error('Error processing traces:', error);
    return c.json(
      {
        status: 'error',
        message: 'Failed to process traces',
        // @ts-ignore
        error: error.message,
      },
      500,
    );
  }
}
