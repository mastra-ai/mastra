// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const figmaNodeId = (id: string) => id.replace(/-/g, ':');

export const listDevResourcesInputSchema = z.object({
  file_key: z.string().describe('The file to get dev resources from. This must be a main file key, not a branch key.'),
  node_ids: z
    .array(z.string())
    .optional()
    .describe(
      'Optional node IDs to filter by, as in "91:1". The "91-1" form from a Figma URL works too. Only dev resources attached to these nodes are returned.',
    ),
});

const DevResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  file_key: z.string(),
  node_id: z.string(),
});

export const listDevResourcesOutputSchema = z.object({
  dev_resources: z.array(DevResourceSchema),
});

export function listDevResourcesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_list_dev_resources',
    description: 'List dev resources linked to nodes in a Figma file.',
    inputSchema: listDevResourcesInputSchema,
    outputSchema: listDevResourcesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDevResourcesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input.node_ids && input.node_ids.length > 0) {
        params['node_ids'] = input.node_ids.map(figmaNodeId).join(',');
      }

      const response = await platformProxy.get({
        // https://developers.figma.com/docs/rest-api/dev-resources-endpoints/
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/dev_resources`,
        params,
        retries: 3,
      });

      const providerResponse = z
        .object({
          dev_resources: z.array(DevResourceSchema).default([]),
        })
        .parse(response.data);

      return {
        dev_resources: providerResponse.dev_resources,
      };
    },
  });
}
