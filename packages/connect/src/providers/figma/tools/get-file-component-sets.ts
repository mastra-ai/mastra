// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getFileComponentSetsInputSchema = z.object({
  file_key: z
    .string()
    .describe(
      'The unique identifier of the Figma file to retrieve component sets from. Example: "UzYlOaPNPL2c7zmHCEljOs"',
    ),
});

const UserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  img_url: z.string(),
});

const FrameInfoSchema = z.object({
  nodeId: z.string().optional(),
  name: z.string().optional(),
  backgroundColor: z.string().optional(),
  pageId: z.string().optional(),
  pageName: z.string().optional(),
  containingStateGroup: z.object({ nodeId: z.string().optional(), name: z.string().optional() }).nullish(),
  containingComponentSet: z.object({ nodeId: z.string().optional(), name: z.string().optional() }).nullish(),
});

const ComponentSetSchema = z.object({
  key: z.string(),
  file_key: z.string(),
  node_id: z.string(),
  thumbnail_url: z.string().optional(),
  name: z.string(),
  description: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  user: UserSchema,
  containing_frame: FrameInfoSchema.optional(),
});

export const getFileComponentSetsOutputSchema = z.object({
  status: z.number(),
  error: z.boolean(),
  meta: z.object({
    component_sets: z.array(ComponentSetSchema),
  }),
});

const ProviderResponseSchema = z.object({
  status: z.number().optional(),
  error: z.boolean().optional(),
  meta: z.object({
    component_sets: z.array(z.unknown()),
  }),
});

export function getFileComponentSetsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_get_file_component_sets',
    description: 'Retrieve all component sets defined within a Figma file.',
    inputSchema: getFileComponentSetsInputSchema,
    outputSchema: getFileComponentSetsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFileComponentSetsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.figma.com/developers/api#get-file-component-sets-endpoint
      const response = await platformProxy.get({
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/component_sets`,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);
      const parsedComponentSets = providerResponse.meta.component_sets.map((item: unknown) => {
        return ComponentSetSchema.parse(item);
      });

      return {
        status: providerResponse.status ?? 200,
        error: providerResponse.error ?? false,
        meta: {
          component_sets: parsedComponentSets,
        },
      };
    },
  });
}
