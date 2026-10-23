// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPrioritiesInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderPrioritySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  iconUrl: z.string(),
  isDefault: z.boolean(),
  self: z.string(),
  statusColor: z.string(),
});

const PrioritySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon_url: z.string(),
  is_default: z.boolean(),
  self: z.string(),
  status_color: z.string(),
});

export const listPrioritiesOutputSchema = z.object({
  priorities: z.array(PrioritySchema),
  next_cursor: z.string().optional(),
});

export function listPrioritiesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_list_priorities',
    description: 'List Jira priorities available to the user.',
    inputSchema: listPrioritiesInputSchema,
    outputSchema: listPrioritiesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPrioritiesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get cloudId from connection config or metadata
      const connection = await platformProxy.getConnection();
      const ConnectionConfigSchema = z.object({
        cloudId: z.string().optional(),
        baseUrl: z.string().optional(),
      });
      const connectionConfig = ConnectionConfigSchema.parse(connection.connection_config || {});
      let cloudId: string | undefined = connectionConfig.cloudId;
      let baseUrl: string | undefined = connectionConfig.baseUrl;

      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata<{ cloudId?: string; baseUrl?: string }>();
        cloudId = cloudId || metadata?.cloudId;
        baseUrl = baseUrl || metadata?.baseUrl;
      }

      if (!cloudId || !baseUrl) {
        // Fetch accessible resources to get cloudId and baseUrl
        const response = await platformProxy.get({
          // https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#oauth-2-0-3lo--2
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const AccessibleResourceSchema = z.array(
          z.object({
            id: z.string(),
            url: z.string(),
          }),
        );
        const resources = AccessibleResourceSchema.parse(response.data);
        if (!resources || resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection.',
          });
        }

        const firstResource = resources[0];
        if (!firstResource) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection.',
          });
        }

        cloudId = firstResource.id;
        baseUrl = firstResource.url;

        // Cache for future use
        await platformProxy.updateMetadata({ cloudId, baseUrl });
      }

      // Parse cursor for pagination (contains startAt value)
      let startAt = 0;
      if (input.cursor) {
        const parsed = parseInt(input.cursor, 10);
        if (!isNaN(parsed)) {
          startAt = parsed;
        }
      }

      // Call Jira priority search endpoint
      const response = await platformProxy.get({
        // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-priorities/#api-rest-api-3-priority-search-get
        endpoint: `/ex/jira/${cloudId}/rest/api/3/priority/search`,
        params: {
          startAt: String(startAt),
          maxResults: '50',
        },
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      // Validate response structure
      const pageData = z
        .object({
          values: z.array(ProviderPrioritySchema),
          isLast: z.boolean(),
          maxResults: z.number(),
          startAt: z.number(),
          total: z.number(),
        })
        .parse(response.data);

      // Transform priorities to output format
      const priorities = pageData.values.map(priority => ({
        id: priority.id,
        name: priority.name,
        ...(priority.description !== undefined && { description: priority.description }),
        icon_url: priority.iconUrl,
        is_default: priority.isDefault,
        self: priority.self,
        status_color: priority.statusColor,
      }));

      // Calculate next cursor
      const nextStartAt = startAt + pageData.values.length;
      const hasMore = !pageData.isLast && nextStartAt < pageData.total;

      return {
        priorities,
        ...(hasMore && { next_cursor: String(nextStartAt) }),
      };
    },
  });
}
