// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listProjectVersionsInputSchema = z.object({
  projectIdOrKey: z.string().describe('The ID or key of the project. Example: "PROJ" or "10000"'),
  startAt: z.number().optional().describe('The index of the first item to return. Default: 0'),
  maxResults: z.number().optional().describe('The maximum number of items to return. Default: 50'),
  orderBy: z
    .enum([
      'description',
      'description,ASC',
      'description,DESC',
      'name',
      'name,ASC',
      'name,DESC',
      'releaseDate',
      'releaseDate,ASC',
      'releaseDate,DESC',
      'sequence',
      'sequence,ASC',
      'sequence,DESC',
      'startDate',
      'startDate,ASC',
      'startDate,DESC',
    ])
    .optional()
    .describe('Order the results by a field. Default: name'),
  query: z
    .string()
    .optional()
    .describe('Filter the results using a literal string. Versions with matching names or descriptions are returned'),
  status: z.enum(['released', 'unreleased', 'archived']).optional().describe('Filter by version status'),
});

const IssuesStatusForFixVersionSchema = z.object({
  done: z.number().optional(),
  inProgress: z.number().optional(),
  toDo: z.number().optional(),
  unmapped: z.number().optional(),
});

const ProviderVersionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  archived: z.boolean().optional(),
  released: z.boolean().optional(),
  overdue: z.boolean().optional(),
  projectId: z.number().optional(),
  releaseDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  userReleaseDate: z.string().optional().nullable(),
  userStartDate: z.string().optional().nullable(),
  self: z.string().optional(),
  issuesStatusForFixVersion: IssuesStatusForFixVersionSchema.optional().nullable(),
});

const PageBeanVersionSchema = z.object({
  self: z.string().optional(),
  nextPage: z.string().optional().nullable(),
  maxResults: z.number().optional(),
  startAt: z.number().optional(),
  total: z.number().optional(),
  isLast: z.boolean().optional(),
  values: z.array(ProviderVersionSchema),
});

const VersionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  archived: z.boolean().optional(),
  released: z.boolean().optional(),
  overdue: z.boolean().optional(),
  projectId: z.number().optional(),
  releaseDate: z.string().optional(),
  startDate: z.string().optional(),
  userReleaseDate: z.string().optional(),
  userStartDate: z.string().optional(),
  self: z.string().optional(),
  issuesStatusForFixVersion: IssuesStatusForFixVersionSchema.optional(),
});

export const listProjectVersionsOutputSchema = z.object({
  versions: z.array(VersionSchema),
  isLast: z.boolean().optional(),
  nextPage: z.string().optional(),
});

export function listProjectVersionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_list_project_versions',
    description: 'List versions for a Jira project',
    inputSchema: listProjectVersionsInputSchema,
    outputSchema: listProjectVersionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listProjectVersionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      let cloudId: string | undefined;

      // Try to get cloudId from connection_config first
      if (connection.connection_config && typeof connection.connection_config === 'object') {
        const id = connection.connection_config['cloudId'];
        if (typeof id === 'string') {
          cloudId = id;
        }
      }

      // Fallback to metadata if not found in connection_config
      if (!cloudId) {
        const metadata = await platformProxy.getMetadata<{ cloudId?: string }>();
        if (metadata?.cloudId) {
          cloudId = metadata.cloudId;
        }
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'cloudId is required in connection configuration or metadata',
        });
      }

      type QueryParams = {
        startAt?: number;
        maxResults?: number;
        orderBy?: string;
        query?: string;
        status?: string;
      };

      const params: QueryParams = {};
      if (input.startAt !== undefined) {
        params.startAt = input.startAt;
      }
      if (input.maxResults !== undefined) {
        params.maxResults = input.maxResults;
      }
      if (input.orderBy !== undefined) {
        params.orderBy = input.orderBy;
      }
      if (input.query !== undefined) {
        params.query = input.query;
      }
      if (input.status !== undefined) {
        params.status = input.status;
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-project-versions/#api-rest-api-3-project-projectidorkey-version-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/project/${input.projectIdOrKey}/version`,
        params: params,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      const pageBean = PageBeanVersionSchema.parse(response.data);

      return {
        versions: pageBean.values.map(version => ({
          id: version.id,
          name: version.name,
          ...(version.description != null && { description: version.description }),
          ...(version.archived !== undefined && { archived: version.archived }),
          ...(version.released !== undefined && { released: version.released }),
          ...(version.overdue !== undefined && { overdue: version.overdue }),
          ...(version.projectId !== undefined && { projectId: version.projectId }),
          ...(version.releaseDate != null && { releaseDate: version.releaseDate }),
          ...(version.startDate != null && { startDate: version.startDate }),
          ...(version.userReleaseDate != null && { userReleaseDate: version.userReleaseDate }),
          ...(version.userStartDate != null && { userStartDate: version.userStartDate }),
          ...(version.self !== undefined && { self: version.self }),
          ...(version.issuesStatusForFixVersion != null && {
            issuesStatusForFixVersion: version.issuesStatusForFixVersion,
          }),
        })),
        isLast: pageBean.isLast,
        ...(pageBean.nextPage != null && { nextPage: pageBean.nextPage }),
      };
    },
  });
}
