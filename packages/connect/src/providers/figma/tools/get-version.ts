// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const FIGMA_VERSION_PAGES = 20;

export const getVersionInputSchema = z.object({
  file_key: z.string().describe('The file key for the Figma file. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  version_id: z.string().describe('The unique identifier for the version. Example: "2356506860085774014"'),
});

const ProviderUserSchema = z
  .object({
    id: z.string(),
    handle: z.string(),
    img_url: z.string().nullish(),
    email: z.string().nullish(),
  })
  .passthrough();

const ProviderVersionSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  label: z.string().nullish(),
  description: z.string().nullish(),
  user: ProviderUserSchema.nullish(),
});

const ProviderVersionsResponseSchema = z.object({
  versions: z.array(ProviderVersionSchema),
  pagination: z
    .object({
      prev_page: z.string().optional(),
      next_page: z.string().optional(),
    })
    .optional(),
});

export const getVersionOutputSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  user: z
    .object({
      id: z.string(),
      handle: z.string(),
      img_url: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
});

export function getVersionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_get_version',
    description:
      'Retrieve a single version from Figma by id. Searches the newest 1,000 versions; for an older version, page through figma_list_versions instead.',
    inputSchema: getVersionInputSchema,
    outputSchema: getVersionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getVersionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let params: Record<string, string> = { page_size: '50' };
      let pages = 0;

      do {
        // https://www.figma.com/developers/api#get-versions-endpoint
        const response = await platformProxy.get({
          endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/versions`,
          params,
          retries: 3,
        });

        const parsed = ProviderVersionsResponseSchema.parse(response.data);
        const version = parsed.versions.find(v => v.id === input.version_id);

        if (version) {
          return {
            id: version.id,
            created_at: version.created_at,
            ...(version.label != null && { label: version.label }),
            ...(version.description != null && { description: version.description }),
            ...(version.user != null && {
              user: {
                id: version.user.id,
                handle: version.user.handle,
                ...(version.user.img_url != null && { img_url: version.user.img_url }),
                ...(version.user.email != null && { email: version.user.email }),
              },
            }),
          };
        }

        const nextPageUrl = parsed.pagination?.next_page;
        const before = nextPageUrl ? new URL(nextPageUrl, 'https://api.figma.com').searchParams.get('before') : null;
        // Figma repeats the last page instead of ending, so stop when the cursor stops moving.
        if (!before || before === params['before'] || parsed.versions.length === 0) break;
        if (++pages >= FIGMA_VERSION_PAGES) {
          throw new platformProxy.ActionError({
            type: 'search_limit',
            message: `Version ${input.version_id} is not among the newest ${FIGMA_VERSION_PAGES * 50} versions of file ${input.file_key}. Page further back with figma_list_versions, passing its cursor.`,
          });
        }
        params = { page_size: '50', before };
      } while (true);

      throw new platformProxy.ActionError({
        type: 'not_found',
        message: `Version ${input.version_id} not found for file ${input.file_key}.`,
      });
    },
  });
}
