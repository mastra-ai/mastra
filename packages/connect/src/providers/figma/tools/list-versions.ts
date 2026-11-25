// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listVersionsInputSchema = z.object({
  file_key: z.string().describe('File key or branch key. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  page_size: z.number().int().positive().max(50).optional().describe('Number of items per page. Max 50.'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (version ID) from the previous response. Omit for the first page.'),
});

const ProviderUserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  img_url: z.string(),
});

const ProviderVersionSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  label: z.string().nullable(),
  description: z.string().nullable(),
  user: ProviderUserSchema,
  thumbnail_url: z.string().nullable().optional(),
});

const ProviderResponseSchema = z.object({
  versions: z.array(ProviderVersionSchema),
  pagination: z
    .object({
      prev_page: z.string().optional(),
      next_page: z.string().optional(),
    })
    .optional(),
});

const OutputVersionSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  user: z.object({
    id: z.string(),
    handle: z.string(),
    img_url: z.string(),
  }),
  thumbnail_url: z.string().optional(),
});

export const listVersionsOutputSchema = z.object({
  versions: z.array(OutputVersionSchema),
  next_cursor: z.string().optional(),
});

export function listVersionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_list_versions',
    description: 'List versions from Figma.',
    inputSchema: listVersionsInputSchema,
    outputSchema: listVersionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listVersionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.figma.com/docs/rest-api/version-history-endpoints/
      const response = await platformProxy.get({
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/versions`,
        params: {
          ...(input.page_size !== undefined && { page_size: input.page_size }),
          ...(input.cursor !== undefined && { before: input.cursor }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const nextPageUrl = providerResponse.pagination?.next_page;
      let nextCursor: string | undefined;
      if (nextPageUrl) {
        const url = new URL(nextPageUrl, 'https://api.figma.com');
        const before = url.searchParams.get('before');
        if (before && before !== input.cursor && providerResponse.versions.length > 0) {
          nextCursor = before;
        }
      }

      return {
        versions: providerResponse.versions.map(version => ({
          id: version.id,
          created_at: version.created_at,
          ...(version.label != null && { label: version.label }),
          ...(version.description != null && { description: version.description }),
          user: version.user,
          ...(version.thumbnail_url != null && { thumbnail_url: version.thumbnail_url }),
        })),
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
