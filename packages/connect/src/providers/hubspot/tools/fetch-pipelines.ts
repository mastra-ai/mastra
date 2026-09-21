// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const fetchPipelinesInputSchema = z.object({
  objectType: z
    .string()
    .optional()
    .describe('The object type for which to fetch pipelines (e.g., "deals", "tickets"). Defaults to "deals".'),
});

const StageSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  displayOrder: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const PipelineSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  displayOrder: z.number().optional(),
  active: z.boolean().optional(),
  stages: z.array(StageSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const fetchPipelinesOutputSchema = z.object({
  pipelines: z.array(PipelineSchema),
});

export function fetchPipelinesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_fetch_pipelines',
    description: 'List pipelines and stages for an object type, defaulting to deals',
    inputSchema: fetchPipelinesInputSchema,
    outputSchema: fetchPipelinesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof fetchPipelinesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const objectType = input.objectType || 'deals';

      // https://developers.hubspot.com/docs/api/crm/pipelines
      const response = await platformProxy.get({
        endpoint: `/crm/v3/pipelines/${objectType}`,
        retries: 3,
      });

      const pipelines = response.data.results || [];

      return {
        pipelines: pipelines.map((pipeline: any) => ({
          id: pipeline.id,
          label: pipeline.label ?? undefined,
          displayOrder: pipeline.displayOrder ?? undefined,
          active: pipeline.active ?? undefined,
          stages: (pipeline.stages || []).map((stage: any) => ({
            id: stage.id,
            label: stage.label ?? undefined,
            displayOrder: stage.displayOrder ?? undefined,
            metadata: stage.metadata || {},
          })),
          createdAt: pipeline.createdAt ?? undefined,
          updatedAt: pipeline.updatedAt ?? undefined,
        })),
      };
    },
  });
}
