// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listContentTypesInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "contoso.sharepoint.com,12345678-1234-1234-1234-123456789012,12345678-1234-1234-1234-123456789012"',
    ),
});

const BaseTypeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  group: z.string().optional(),
});

const ProviderContentTypeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  group: z.string().optional(),
  base: BaseTypeSchema.nullish(),
});

const ProviderResponseSchema = z.object({
  value: z.array(z.unknown()),
  '@odata.nextLink': z.string().optional(),
});

export const listContentTypesOutputSchema = z.object({
  contentTypes: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      group: z.string().optional(),
      base: BaseTypeSchema.optional(),
    }),
  ),
  nextCursor: z.string().optional(),
});

export function listContentTypesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_list_content_types',
    description: 'List content types defined on a SharePoint site.',
    inputSchema: listContentTypesInputSchema,
    outputSchema: listContentTypesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listContentTypesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const siteId = encodeURIComponent(input.siteId);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/site-list-contenttypes
        endpoint: `/v1.0/sites/${siteId}/contentTypes`,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Microsoft Graph API',
        });
      }

      const parsed = ProviderResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response shape from Microsoft Graph API',
        });
      }

      const contentTypes = parsed.data.value
        .map(item => {
          const parseResult = ProviderContentTypeSchema.safeParse(item);
          if (!parseResult.success) {
            return null;
          }
          const ct = parseResult.data;
          return {
            id: ct.id,
            name: ct.name,
            description: ct.description,
            group: ct.group,
            ...(ct.base != null && { base: ct.base }),
          };
        })
        .filter((ct): ct is NonNullable<typeof ct> => ct !== null);

      let nextCursor: string | undefined;
      if (parsed.data['@odata.nextLink']) {
        const url = new URL(parsed.data['@odata.nextLink']);
        nextCursor = url.searchParams.get('$skiptoken') || undefined;
      }

      return {
        contentTypes,
        ...(nextCursor != null && { nextCursor }),
      };
    },
  });
}
