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
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    if (!body) {
      throw new HTTPException(400, { message: 'Body is required' });
    }

    const { name, scope, page, perPage, attribute } = body;

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

    return { traces };
  } catch (error) {
    return handleError(error, 'Error getting telemetry');
  }
}
