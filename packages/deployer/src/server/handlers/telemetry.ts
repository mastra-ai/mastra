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
