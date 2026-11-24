// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const captureEventInputSchema = z.object({
  api_key: z.string().describe('PostHog project API key (token) for the Capture API.'),
  event: z.string().describe('Name of the event to capture.'),
  distinct_id: z.string().describe('Unique identifier for the user or entity.'),
  properties: z.record(z.string(), z.unknown()).optional().describe('Additional event properties.'),
  timestamp: z.string().optional().describe('ISO 8601 timestamp for the event. Defaults to now if omitted.'),
});

export const captureEventOutputSchema = z.object({
  status: z.union([z.string(), z.number()]).optional(),
});

export function captureEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_capture_event',
    description: 'Capture a PostHog event.',
    inputSchema: captureEventInputSchema,
    outputSchema: captureEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof captureEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://posthog.com/docs/api/capture
        endpoint: '/capture/',
        data: {
          api_key: input.api_key,
          event: input.event,
          distinct_id: input.distinct_id,
          ...(input.properties !== undefined && { properties: input.properties }),
          ...(input.timestamp !== undefined && { timestamp: input.timestamp }),
        },
        retries: 3,
      });

      if (response.data && typeof response.data === 'object') {
        const parsed = captureEventOutputSchema.parse(response.data);
        return parsed;
      }

      if (typeof response.data === 'string' || typeof response.data === 'number') {
        return { status: response.data };
      }

      return {};
    },
  });
}
