// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deletePageInputSchema = z.object({
  id: z.string().describe('Page ID. Example: "123456"'),
  draft: z.boolean().optional().describe('Delete the draft if present.'),
  purge: z
    .boolean()
    .optional()
    .describe(
      'Permanently delete a page that is already in the trash. Delete it without purge first to move it to the trash.',
    ),
});

export const deletePageOutputSchema = z.object({
  success: z.boolean(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const ConnectionConfigSchema = z.object({
  cloudId: z.string().optional(),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
});

const AccessibleResourcesSchema = z.array(AccessibleResourceSchema);

export function deletePageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_delete_page',
    description: 'Delete a Confluence page by id.',
    inputSchema: deletePageInputSchema,
    outputSchema: deletePageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deletePageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const configParse = ConnectionConfigSchema.safeParse(connection.connection_config);
      let cloudId = configParse.success ? configParse.data.cloudId : undefined;

      if (!cloudId) {
        const metadata = MetadataSchema.parse((await platformProxy.getMetadata()) ?? {});
        cloudId = metadata.cloudId;
      }

      if (!cloudId) {
        const resourcesConfig: PlatformProxyRequest = {
          // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        };
        const response = await platformProxy.get(resourcesConfig);
        const resources = AccessibleResourcesSchema.parse(response.data);
        if (resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Confluence resources found for this connection.',
          });
        }
        if (resources.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }

        cloudId = resources[0]!.id;
        await platformProxy.updateMetadata({ cloudId });
      }

      const queryParams: Record<string, string> = {};
      if (input.draft !== undefined) {
        queryParams['draft'] = String(input.draft);
      }
      if (input.purge !== undefined) {
        queryParams['purge'] = String(input.purge);
      }

      const deleteConfig: PlatformProxyRequest = {
        // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(input.id)}`,
        params: queryParams,
        retries: 10,
      };
      await platformProxy.delete(deleteConfig);

      return { success: true };
    },
  });
}
