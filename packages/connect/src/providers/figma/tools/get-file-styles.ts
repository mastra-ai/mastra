// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const StyleTypeSchema = z.enum(['FILL', 'TEXT', 'EFFECT', 'GRID']).or(z.string());

const UserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  img_url: z.string(),
});

const PublishedStyleSchema = z.object({
  key: z.string(),
  file_key: z.string(),
  node_id: z.string(),
  style_type: StyleTypeSchema,
  thumbnail_url: z.string().optional(),
  name: z.string(),
  description: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  user: UserSchema,
  sort_position: z.string(),
});

export const getFileStylesInputSchema = z.object({
  file_key: z.string().describe('The unique identifier of the Figma file. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
});

export const getFileStylesOutputSchema = z.object({
  status: z.number(),
  error: z.boolean(),
  meta: z.object({
    styles: z.array(PublishedStyleSchema),
  }),
});

export function getFileStylesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_get_file_styles',
    description: 'Retrieve all styles defined within a Figma file.',
    inputSchema: getFileStylesInputSchema,
    outputSchema: getFileStylesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFileStylesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://www.figma.com/developers/api#get-file-styles-endpoint
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/styles`,
        retries: 3,
      });

      const parsed = getFileStylesOutputSchema.parse(response.data);
      return parsed;
    },
  });
}
