// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listStylesInputSchema = z.object({
  team_id: z.string().describe('Team ID. Example: "1639747348117609063"'),
  cursor: z
    .string()
    .regex(/^\d+$/, 'cursor must be a number')
    .optional()
    .describe('Pagination cursor from the previous response. Omit for the first page.'),
  page_size: z.number().optional().describe('Number of items to return in a paged list of results. Defaults to 30.'),
});

const UserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  img_url: z.string().optional(),
});

const StyleSchema = z.object({
  key: z.string(),
  file_key: z.string(),
  node_id: z.string(),
  style_type: z.string(),
  thumbnail_url: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  user: UserSchema,
  sort_position: z.string().optional(),
});

export const listStylesOutputSchema = z.object({
  styles: z.array(StyleSchema),
  next_cursor: z.string().optional(),
});

export function listStylesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_list_styles',
    description: 'List styles from Figma.',
    inputSchema: listStylesInputSchema,
    outputSchema: listStylesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listStylesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const teamId = input.team_id;

      const after = input.cursor !== undefined ? Number(input.cursor) : undefined;

      // https://www.figma.com/developers/api#get-team-styles-endpoint
      const response = await platformProxy.get({
        endpoint: `/v1/teams/${encodeURIComponent(teamId)}/styles`,
        params: {
          ...(after !== undefined && { after }),
          ...(input.page_size !== undefined && { page_size: input.page_size }),
        },
        retries: 3,
      });

      const responseSchema = z.object({
        status: z.number(),
        error: z.boolean(),
        meta: z.object({
          styles: z.array(z.unknown()),
          cursor: z
            .object({
              before: z.number().optional(),
              after: z.number().optional(),
            })
            .optional(),
        }),
      });

      const parsedResponse = responseSchema.parse(response.data);

      const styles = parsedResponse.meta.styles.map(item => {
        const parsed = StyleSchema.parse(item);
        return {
          key: parsed.key,
          file_key: parsed.file_key,
          node_id: parsed.node_id,
          style_type: parsed.style_type,
          ...(parsed.thumbnail_url !== undefined && { thumbnail_url: parsed.thumbnail_url }),
          name: parsed.name,
          ...(parsed.description !== undefined && { description: parsed.description }),
          created_at: parsed.created_at,
          updated_at: parsed.updated_at,
          user: parsed.user,
          ...(parsed.sort_position !== undefined && { sort_position: parsed.sort_position }),
        };
      });

      return {
        styles,
        ...(parsedResponse.meta.cursor?.after !== undefined && {
          next_cursor: String(parsedResponse.meta.cursor.after),
        }),
      };
    },
  });
}
