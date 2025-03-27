import type { Mastra } from '@mastra/core';
import { getTelemetryHandler as getOriginalTelemetryHandler } from '@mastra/server/handlers/telemetry';
import type { Context } from 'hono';

import { handleError } from './error';

export async function getTelemetryHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const { name, scope, page, perPage } = c.req.query();
    const attribute = c.req.queries('attribute');

    const traces = await getOriginalTelemetryHandler({
      mastra,
      body: { name, scope, page: Number(page ?? 0), perPage: Number(perPage ?? 100), attribute },
    });

    return c.json({ traces });
  } catch (error) {
    return handleError(error, 'Error getting telemetry traces');
  }
}

export async function storeTelemetryHandler(c: Context) {
  try {
    // Parse the incoming body as JSON
    const body = await c.req.json();

    const mastra: Mastra = c.get('mastra');
    const result = await storeTelemetryHandler({ mastra, body });

    if (result.status === 'error') {
      return c.json(result, 500);
    }

    return c.json(result, 200);
  } catch (error) {
    return handleError(error, 'Error storing telemetry traces');
  }
}
