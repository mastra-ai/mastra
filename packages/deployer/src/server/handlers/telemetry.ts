import type { MastraStorage } from '@mastra/core/storage';
import type { Telemetry } from '@mastra/core/telemetry';
import type { Context } from 'hono';

import { HTTPException } from 'hono/http-exception';

import { handleError } from './error';

export async function getTelemetryHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const telemetry: Telemetry = mastra.telemetry;
    const storage: MastraStorage = mastra.storage;

    const { name, scope, page, perPage, attribute } = c.req.query();

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
