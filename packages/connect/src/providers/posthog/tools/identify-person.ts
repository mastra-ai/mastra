// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const identifyPersonInputSchema = z.object({
  distinct_id: z.string().describe('The distinct ID of the person to identify. Example: "user@example.com"'),
  properties: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Properties to set on the person via $set. Example: {"email": "user@example.com"}'),
  project_id: z.number().describe('The PostHog project ID. Example: 309484'),
});

const ProjectSchema = z.object({
  api_token: z.string(),
});

const CaptureResponseSchema = z.object({
  status: z.string(),
});

export const identifyPersonOutputSchema = z.object({
  status: z.string(),
  distinct_id: z.string(),
});

export function identifyPersonTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_identify_person',
    description: 'Identify or update a PostHog person.',
    inputSchema: identifyPersonInputSchema,
    outputSchema: identifyPersonOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof identifyPersonOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://posthog.com/docs/api/projects
      const projectResponse = await platformProxy.get({
        endpoint: `/api/projects/${input.project_id}/`,
        retries: 3,
      });

      const project = ProjectSchema.parse(projectResponse.data);

      // https://posthog.com/docs/api/capture
      const captureResponse = await platformProxy.post({
        endpoint: '/i/v0/e/',
        data: {
          api_key: project.api_token,
          event: '$identify',
          distinct_id: input.distinct_id,
          properties: {
            ...(input.properties !== undefined && { $set: input.properties }),
          },
        },
        retries: 1,
      });

      const result = CaptureResponseSchema.parse(captureResponse.data);

      return {
        status: result.status,
        distinct_id: input.distinct_id,
      };
    },
  });
}
