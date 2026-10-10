// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPresentationVersionsInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'The ID of the drive containing the presentation. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"',
    ),
  itemId: z.string().describe('The ID of the presentation item. Example: "01RFYLAYBX27CGEGAJH5HZMVYI6Y3NGGYJ"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderVersionSchema = z
  .object({
    id: z.string(),
    lastModifiedDateTime: z.string().optional(),
    lastModifiedBy: z
      .object({
        user: z
          .object({
            displayName: z.string().optional(),
            email: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    size: z.number().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({
  value: z.array(ProviderVersionSchema).optional(),
  '@odata.nextLink': z.string().optional(),
});

export const listPresentationVersionsOutputSchema = z.object({
  versions: z.array(
    z.object({
      id: z.string(),
      lastModifiedDateTime: z.string().optional(),
      lastModifiedBy: z
        .object({
          user: z
            .object({
              displayName: z.string().optional(),
              email: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      size: z.number().optional(),
    }),
  ),
  nextCursor: z.string().optional().describe('Pagination cursor to retrieve the next page of versions.'),
});

export function listPresentationVersionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_list_presentation_versions',
    description: 'List the version history of a presentation.',
    inputSchema: listPresentationVersionsInputSchema,
    outputSchema: listPresentationVersionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPresentationVersionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let endpoint: string;
      if (input.cursor) {
        const match = input.cursor.match(/^https:\/\/graph\.microsoft\.com\/v1\.0\/(.+)$/);
        if (!match || !match[1]) {
          throw new platformProxy.ActionError({
            type: 'invalid_cursor',
            message: 'Invalid pagination cursor. Expected a Microsoft Graph @odata.nextLink URL.',
          });
        }
        endpoint = match[1];
      } else {
        endpoint = `v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/versions`;
      }

      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-list-versions
        endpoint,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const versions = (providerResponse.value || []).map(version => ({
        id: version.id,
        ...(version.lastModifiedDateTime !== undefined && { lastModifiedDateTime: version.lastModifiedDateTime }),
        ...(version.lastModifiedBy !== undefined && { lastModifiedBy: version.lastModifiedBy }),
        ...(version.size !== undefined && { size: version.size }),
      }));

      return {
        versions,
        ...(providerResponse['@odata.nextLink'] != null && { nextCursor: providerResponse['@odata.nextLink'] }),
      };
    },
  });
}
