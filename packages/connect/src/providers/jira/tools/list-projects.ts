// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listProjectsInputSchema = z.object({
  query: z.string().optional().describe('Filter projects by name or key. Example: "PROJ"'),
  categoryId: z.number().optional().describe('Filter by project category ID. Example: 10000'),
  maxResults: z.number().optional().describe('Maximum results per page. Default: 50'),
  startAt: z.number().optional().describe('Pagination offset. Default: 0'),
});

const AvatarUrlsSchema = z.object({
  '16x16': z.string().optional(),
  '24x24': z.string().optional(),
  '32x32': z.string().optional(),
  '48x48': z.string().optional(),
});

const ProjectCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

const ProjectInsightSchema = z.object({
  totalIssueCount: z.number(),
  lastIssueUpdateTime: z.string().optional(),
});

const ProviderProjectSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  avatarUrls: AvatarUrlsSchema.optional(),
  projectCategory: ProjectCategorySchema.optional(),
  simplified: z.boolean().optional(),
  style: z.string().optional(),
  self: z.string(),
  insight: ProjectInsightSchema.optional(),
});

const ProjectOutputSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  avatarUrls: AvatarUrlsSchema.optional(),
  projectCategory: ProjectCategorySchema.optional(),
  simplified: z.boolean().optional(),
  style: z.string().optional(),
  self: z.string(),
  insight: ProjectInsightSchema.optional(),
});

export const listProjectsOutputSchema = z.object({
  projects: z.array(ProjectOutputSchema),
  total: z.number(),
  isLast: z.boolean(),
  nextStartAt: z.number().optional(),
});

export function listProjectsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_list_projects',
    description: 'List Jira projects accessible to the authenticated user.',
    inputSchema: listProjectsInputSchema,
    outputSchema: listProjectsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listProjectsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      let cloudId: string | undefined = connection.connection_config?.['cloudId'];

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata<{ cloudId?: string }>();
        cloudId = metadata?.cloudId;
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'Cloud ID is required but not found in connection configuration or metadata.',
        });
      }

      const maxResults = input.maxResults ?? 50;
      const startAt = input.startAt ?? 0;

      const params: Record<string, string | number> = {
        maxResults: maxResults,
        startAt: startAt,
      };

      if (input.query) {
        params['query'] = input.query;
      }

      if (input.categoryId !== undefined) {
        params['categoryId'] = input.categoryId;
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/#api-rest-api-3-project-search-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/project/search`,
        params: params,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      const pageSchema = z.object({
        values: z.array(ProviderProjectSchema),
        total: z.number(),
        isLast: z.boolean(),
        startAt: z.number(),
      });

      const page = pageSchema.parse(response.data);

      const projects = page.values.map(project => ({
        id: project.id,
        key: project.key,
        name: project.name,
        ...(project.avatarUrls !== undefined && { avatarUrls: project.avatarUrls }),
        ...(project.projectCategory !== undefined && { projectCategory: project.projectCategory }),
        ...(project.simplified !== undefined && { simplified: project.simplified }),
        ...(project.style !== undefined && { style: project.style }),
        self: project.self,
        ...(project.insight !== undefined && { insight: project.insight }),
      }));

      return {
        projects: projects,
        total: page.total,
        isLast: page.isLast,
        ...(!page.isLast && { nextStartAt: page.startAt + page.values.length }),
      };
    },
  });
}
