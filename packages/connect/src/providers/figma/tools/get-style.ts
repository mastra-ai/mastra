// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getStyleInputSchema = z.object({
  key: z.string().describe('The unique identifier of the style. Example: "0f6da13a103e47271a3c8c6d52187ca4587ae898"'),
});

const UserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  img_url: z.string(),
});

const StyleTypeSchema = z.enum(['FILL', 'TEXT', 'EFFECT', 'GRID']).or(z.string());

const ProviderStyleSchema = z.object({
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

export const getStyleOutputSchema = z.object({
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

export function getStyleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_get_style',
    description: 'Retrieve a single style from Figma.',
    inputSchema: getStyleInputSchema,
    outputSchema: getStyleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getStyleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.figma.com/docs/rest-api/styles-endpoints/#get-style
        endpoint: `/v1/styles/${encodeURIComponent(input.key)}`,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Style not found',
          key: input.key,
        });
      }

      const ResponseSchema = z.object({
        meta: z.unknown(),
      });
      const parsedResponse = ResponseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Style not found',
          key: input.key,
        });
      }

      const providerStyle = ProviderStyleSchema.parse(parsedResponse.data.meta);

      return {
        key: providerStyle.key,
        file_key: providerStyle.file_key,
        node_id: providerStyle.node_id,
        style_type: providerStyle.style_type,
        ...(providerStyle.thumbnail_url !== undefined && { thumbnail_url: providerStyle.thumbnail_url }),
        name: providerStyle.name,
        description: providerStyle.description,
        created_at: providerStyle.created_at,
        updated_at: providerStyle.updated_at,
        user: providerStyle.user,
        sort_position: providerStyle.sort_position,
      };
    },
  });
}
