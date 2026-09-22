// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const AccessibleResourceSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string().optional(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
  baseUrl: z.string().optional(),
});

export const getStatusInputSchema = z.object({
  statusIdOrName: z.string().describe('Status ID or name. Example: "10001" or "To Do"'),
});

const ProviderStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  statusCategory: z
    .object({
      id: z.number(),
      key: z.string(),
      colorName: z.string(),
      name: z.string(),
    })
    .optional(),
});

export const getStatusOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  statusCategory: z
    .object({
      id: z.number(),
      key: z.string(),
      colorName: z.string(),
      name: z.string(),
    })
    .optional(),
});

export function getStatusTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_get_status',
    description: 'Retrieve a Jira status by status ID or name.',
    inputSchema: getStatusInputSchema,
    outputSchema: getStatusOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getStatusOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Resolve cloudId
      const connection = await platformProxy.getConnection();
      let cloudId: string | undefined = connection.connection_config?.['cloudId'];
      let baseUrl: string | undefined = connection.connection_config?.['baseUrl'];

      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata<{
          cloudId?: string;
          baseUrl?: string;
        }>();
        cloudId = cloudId || metadata?.cloudId;
        baseUrl = baseUrl || metadata?.baseUrl;
      }

      if (!cloudId || !baseUrl) {
        // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#get-an-access-token
        const response = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = z.array(AccessibleResourceSchema).parse(response.data);
        const firstResource = resources[0];
        if (!firstResource) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection',
          });
        }

        cloudId = firstResource.id;
        baseUrl = firstResource.url;

        const metadataToUpdate = {
          cloudId: firstResource.id,
          baseUrl: firstResource.url,
        };
        await platformProxy.updateMetadata(metadataToUpdate);
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'Could not resolve Jira cloud ID',
        });
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-status/#api-rest-api-3-status-idorname-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/status/${encodeURIComponent(input.statusIdOrName)}`,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Status not found: ${input.statusIdOrName}`,
        });
      }

      const status = ProviderStatusSchema.parse(response.data);

      return {
        id: status.id,
        name: status.name,
        ...(status.description !== undefined && { description: status.description }),
        ...(status.statusCategory !== undefined && { statusCategory: status.statusCategory }),
      };
    },
  });
}
