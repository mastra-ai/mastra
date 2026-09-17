// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
  baseUrl: z.string().optional(),
});

export const listStatusesInputSchema = z.object({
  projectId: z.string().optional().describe('Project ID to filter statuses. Example: "10000"'),
  statusCategory: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional().describe('Filter by status category'),
  searchString: z.string().optional().describe('Search string to filter statuses by name'),
  startAt: z.number().int().min(0).optional().describe('Pagination offset. Starts at 0.'),
  maxResults: z.number().int().min(1).max(100).optional().describe('Maximum results per page. Max 100.'),
});

const ScopeSchema = z.object({
  type: z.enum(['GLOBAL', 'PROJECT']).or(z.string()),
  project: z
    .object({
      id: z.string(),
    })
    .optional(),
});

const StatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  scope: ScopeSchema.optional(),
  statusCategory: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).or(z.string()),
});

export const listStatusesOutputSchema = z.object({
  statuses: z.array(StatusSchema),
  total: z.number().int(),
  startAt: z.number().int(),
  maxResults: z.number().int(),
  isLast: z.boolean(),
  nextPageStart: z.number().int().optional(),
});

export function listStatusesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_list_statuses',
    description: 'List Jira statuses available to the user',
    inputSchema: listStatusesInputSchema,
    outputSchema: listStatusesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listStatusesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();

      let cloudId = connection.connection_config?.['cloudId'];
      let baseUrl = connection.connection_config?.['baseUrl'];

      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata<{ cloudId?: string; baseUrl?: string }>();
        cloudId = metadata?.cloudId;
        baseUrl = metadata?.baseUrl;
      }

      if (!cloudId || !baseUrl) {
        const accessibleResourcesResponse = await platformProxy.get({
          // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#access-to-data
          endpoint: '/oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = z
          .array(
            z.object({
              id: z.string(),
              url: z.string(),
            }),
          )
          .parse(accessibleResourcesResponse.data);

        const firstResource = resources[0];
        if (!firstResource) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection',
          });
        }

        cloudId = firstResource.id;
        baseUrl = firstResource.url;

        await platformProxy.updateMetadata({
          cloudId: cloudId,
          baseUrl: baseUrl,
        });
      }

      const params: Record<string, string | number> = {};

      if (input.projectId !== undefined) {
        params['projectId'] = input.projectId;
      }

      if (input.statusCategory !== undefined) {
        params['statusCategory'] = input.statusCategory;
      }

      if (input.searchString !== undefined) {
        params['searchString'] = input.searchString;
      }

      if (input.startAt !== undefined) {
        params['startAt'] = input.startAt;
      }

      if (input.maxResults !== undefined) {
        params['maxResults'] = input.maxResults;
      }

      const response = await platformProxy.get({
        // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-status/#api-rest-api-3-statuses-search-get
        endpoint: `/ex/jira/${cloudId}/rest/api/3/statuses/search`,
        params,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      const PageOfStatusesSchema = z.object({
        isLast: z.boolean(),
        maxResults: z.number().int(),
        nextPage: z.string().optional(),
        self: z.string(),
        startAt: z.number().int(),
        total: z.number().int(),
        values: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().optional(),
            scope: ScopeSchema.optional(),
            statusCategory: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
          }),
        ),
      });

      const pageData = PageOfStatusesSchema.parse(response.data);

      const statuses = pageData.values.map(status => {
        const result: z.infer<typeof StatusSchema> = {
          id: status.id,
          name: status.name,
          statusCategory: status.statusCategory,
        };

        if (status.description !== undefined) {
          result.description = status.description;
        }

        if (status.scope !== undefined) {
          result.scope = status.scope;
        }

        return result;
      });

      const output: z.infer<typeof listStatusesOutputSchema> = {
        statuses,
        total: pageData.total,
        startAt: pageData.startAt,
        maxResults: pageData.maxResults,
        isLast: pageData.isLast,
      };

      if (!pageData.isLast) {
        output.nextPageStart = pageData.startAt + pageData.maxResults;
      }

      return output;
    },
  });
}
