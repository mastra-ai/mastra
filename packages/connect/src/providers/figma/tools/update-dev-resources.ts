// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DevResourceUpdateSchema = z.object({
  id: z.string().describe('Unique identifier of the dev resource. Example: "devres_123"'),
  name: z.string().optional().describe('The name of the dev resource.'),
  url: z.string().optional().describe('The URL of the dev resource.'),
});

export const updateDevResourcesInputSchema = z.object({
  dev_resources: z.array(DevResourceUpdateSchema).describe('A list of dev resources that you want to update.'),
});

export const updateDevResourcesOutputSchema = z.object({
  links_updated: z.array(z.string()).describe('Ids for dev resources that were successfully updated.'),
  errors: z
    .array(
      z.object({
        id: z.string().optional(),
        error: z.string(),
      }),
    )
    .optional()
    .describe('Errors for dev resources that could not be updated.'),
});

const ProviderResponseSchema = z.object({
  links_updated: z.array(z.union([z.string(), z.object({ id: z.string() }).passthrough()])).optional(),
  errors: z
    .array(
      z.object({
        id: z.string().optional(),
        error: z.string(),
      }),
    )
    .optional(),
});

export function updateDevResourcesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_update_dev_resources',
    description: 'Update dev resources linked to Figma nodes.',
    inputSchema: updateDevResourcesInputSchema,
    outputSchema: updateDevResourcesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateDevResourcesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.figma.com/docs/rest-api/dev-resources-endpoints/
      const response = await platformProxy.put({
        endpoint: '/v1/dev_resources',
        data: {
          dev_resources: input.dev_resources.map(resource => ({
            id: resource.id,
            ...(resource.name !== undefined && { name: resource.name }),
            ...(resource.url !== undefined && { url: resource.url }),
          })),
        },
        retries: 1,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        links_updated: (providerResponse.links_updated ?? []).map(link => (typeof link === 'string' ? link : link.id)),
        ...(providerResponse.errors !== undefined && { errors: providerResponse.errors }),
      };
    },
  });
}
