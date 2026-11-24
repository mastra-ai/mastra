// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listComponentsInputSchema = z.object({
  team_id: z.string().describe('Team ID. Example: "1639747348117609063"'),
  cursor: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe('Pagination cursor from the previous response (numeric). Omit for the first page.'),
  page_size: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe('Number of items to return per page. Defaults to 30. Maximum of 1000.'),
});

const UserSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  handle: z.string().optional(),
  img_url: z.string().optional(),
  name: z.string().optional(),
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
  description: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  user: UserSchema.optional(),
  containing_frame: FrameInfoSchema.optional(),
});

const ProviderResponseSchema = z.object({
  meta: z.object({
    components: z.array(ComponentSchema),
    cursor: z
      .object({
        before: z.number().optional(),
        after: z.number().optional(),
      })
      .optional(),
  }),
});

export const listComponentsOutputSchema = z.object({
  components: z.array(ComponentSchema),
  next_cursor: z.string().optional(),
});

export function listComponentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_list_components',
    description: 'List components from Figma.',
    inputSchema: listComponentsInputSchema,
    outputSchema: listComponentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listComponentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://www.figma.com/developers/api#get-team-components-endpoint
        endpoint: `/v1/teams/${encodeURIComponent(input.team_id)}/components`,
        params: {
          ...(input.page_size !== undefined && { page_size: input.page_size }),
          ...(input.cursor !== undefined && { after: input.cursor }),
        },
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        components: providerData.meta.components,
        ...(providerData.meta.cursor?.after !== undefined && {
          next_cursor: String(providerData.meta.cursor.after),
        }),
      };
    },
  });
}
