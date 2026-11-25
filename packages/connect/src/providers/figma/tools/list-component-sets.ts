// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listComponentSetsInputSchema = z.object({
  team_id: z.string().describe('Figma team ID. Example: "1639747348117609063"'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Pagination cursor from the previous response. Maps to the after query parameter. Omit for the first page.',
    ),
  page_size: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe('Number of items per page. Default: 30. Maximum: 1000.'),
});

const UserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  img_url: z.string(),
  email: z.string().optional(),
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
  description: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  user: UserSchema.optional(),
  containing_frame: FrameInfoSchema.optional(),
});

const CursorSchema = z.object({
  before: z.number().optional(),
  after: z.number().optional(),
});

const ProviderResponseSchema = z.object({
  status: z.number(),
  error: z.boolean(),
  meta: z.object({
    component_sets: z.array(ComponentSetSchema),
    cursor: CursorSchema.optional(),
  }),
});

export const listComponentSetsOutputSchema = z.object({
  component_sets: z.array(ComponentSetSchema),
  next_cursor: z.string().optional(),
});

export function listComponentSetsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_list_component_sets',
    description: 'List component sets for a Figma team.',
    inputSchema: listComponentSetsInputSchema,
    outputSchema: listComponentSetsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listComponentSetsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://www.figma.com/developers/api#GET-team-component-sets-endpoint
        endpoint: `/v1/teams/${encodeURIComponent(input.team_id)}/component_sets`,
        params: {
          ...(input.page_size !== undefined && { page_size: String(input.page_size) }),
          ...(input.cursor !== undefined && { after: input.cursor }),
        },
        retries: 3,
      };

      const response = await platformProxy.get(config);

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        component_sets: providerResponse.meta.component_sets,
        ...(providerResponse.meta.cursor?.after !== undefined && {
          next_cursor: String(providerResponse.meta.cursor.after),
        }),
      };
    },
  });
}
