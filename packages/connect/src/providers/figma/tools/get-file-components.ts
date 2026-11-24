// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getFileComponentsInputSchema = z.object({
  file_key: z
    .string()
    .describe('The key of the Figma file to retrieve components from. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
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

const ComponentSchema = z.object({
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

export const getFileComponentsOutputSchema = z.object({
  components: z.array(ComponentSchema),
});

const RawResponseSchema = z.object({
  meta: z.object({
    components: z.array(z.unknown()),
  }),
});

export function getFileComponentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_get_file_components',
    description: 'Retrieve all components defined within a Figma file.',
    inputSchema: getFileComponentsInputSchema,
    outputSchema: getFileComponentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFileComponentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.figma.com/docs/rest-api/component-endpoints/#get-file-components
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/components`,
        retries: 3,
      };
      const response = await platformProxy.get(config);

      const raw = RawResponseSchema.parse(response.data);

      return {
        components: raw.meta.components.map(component => ComponentSchema.parse(component)),
      };
    },
  });
}
