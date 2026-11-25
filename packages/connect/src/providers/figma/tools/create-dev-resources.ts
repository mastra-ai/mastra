// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const figmaNodeId = (id: string) => id.replace(/-/g, ':');

const DevResourceCreateSchema = z.object({
  name: z.string(),
  url: z.string(),
  file_key: z.string(),
  node_id: z.string().describe('The node to link, as in "91:1". The "91-1" form from a Figma URL works too.'),
});

export const createDevResourcesInputSchema = z.object({
  dev_resources: z.array(DevResourceCreateSchema),
});

const DevResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  file_key: z.string(),
  node_id: z.string(),
});

const DevResourceErrorSchema = z.object({
  file_key: z.string().nullish(),
  node_id: z.string().nullish(),
  error: z.string(),
});

export const createDevResourcesOutputSchema = z.object({
  links_created: z.array(DevResourceSchema),
  errors: z.array(DevResourceErrorSchema).optional(),
});

export function createDevResourcesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_create_dev_resources',
    description: 'Create dev resources linked to Figma nodes',
    inputSchema: createDevResourcesInputSchema,
    outputSchema: createDevResourcesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createDevResourcesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.figma.com/docs/rest-api/dev-resources-endpoints/
      const response = await platformProxy.post({
        endpoint: '/v1/dev_resources',
        data: {
          dev_resources: input.dev_resources.map(resource => ({
            name: resource.name,
            url: resource.url,
            file_key: resource.file_key,
            node_id: figmaNodeId(resource.node_id),
          })),
        },
        retries: 1,
      });

      const raw = response.data;
      if (typeof raw !== 'object' || raw === null) {
        throw new platformProxy.ActionError({
          message: 'Unexpected response from Figma API',
        });
      }

      const parsed = createDevResourcesOutputSchema.safeParse(raw);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          message: 'Invalid response from Figma API',
          details: parsed.error.issues,
        });
      }

      return parsed.data;
    },
  });
}
