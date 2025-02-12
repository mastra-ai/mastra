import type { MastraStorage } from '@mastra/core/storage';
import type { Telemetry } from '@mastra/core/telemetry';
import type { Context } from 'hono';

import { HTTPException } from 'hono/http-exception';

import { handleError } from './error';
import { validateBody } from './utils';

export async function getTelemetryHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const telemetry: Telemetry = mastra.telemetry;
    const storage: MastraStorage = mastra.storage;

    const { name, scope, page, perPage } = c.req.query();

    if (!telemetry) {
      throw new HTTPException(400, { message: 'Telemetry is not initialized' });
    }

    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    const traces = await storage.getTraces({ name, scope, page: Number(page ?? 0), perPage: Number(perPage ?? 100) });

    return c.json({ traces });
  } catch (error) {
    return handleError(error, 'Error saving messages');
  }
}
