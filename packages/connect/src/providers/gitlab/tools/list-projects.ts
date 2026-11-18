// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

/** Fills x-next-page from the Link header when GitLab sends only Link (keyset pagination, large result sets). */
function fillGitLabNextPage(headers: Record<string, string>): void {
  if (headers['x-next-page']) return;
  const next = /<([^>]+)>;\s*rel="next"/.exec(headers['link'] ?? '')?.[1];
  const page = next ? new URL(next).searchParams.get('page') : null;
  if (page) headers['x-next-page'] = page;
}

export const listProjectsInputSchema = z.object({
  cursor: z
    .string()
    .regex(/^[1-9]\d*$/, 'cursor must be the page number from next_cursor')
    .optional()
    .describe('Pagination cursor (page number). Omit for the first page.'),
  per_page: z.number().int().min(1).max(100).optional().describe('Number of results per page (max 100).'),
  search: z.string().optional().describe('Filter projects by name.'),
  owned: z.boolean().optional().describe('Limit to projects owned by the current user.'),
  membership: z.boolean().optional().describe('Limit to projects where the current user is a member.'),
  visibility: z.enum(['private', 'internal', 'public']).optional().describe('Filter by visibility level.'),
  archived: z
    .boolean()
    .optional()
    .describe('true returns only archived projects, false only active ones. Omit to return both.'),
});

const ProviderProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  description: z.string().nullable().optional(),
  web_url: z.string(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  visibility: z.string().nullable().optional(),
  default_branch: z.string().nullable().optional(),
});

const ProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  description: z.string().optional(),
  web_url: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  visibility: z.string().optional(),
  default_branch: z.string().optional(),
});

export const listProjectsOutputSchema = z.object({
  items: z.array(ProjectSchema),
  next_cursor: z.string().optional(),
});

export function listProjectsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_list_projects',
    description: 'List projects from GitLab.',
    inputSchema: listProjectsInputSchema,
    outputSchema: listProjectsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listProjectsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const currentPage = input.cursor ? Number(input.cursor) : 1;
      if (Number.isNaN(currentPage) || currentPage < 1) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'cursor must be a valid positive page number',
        });
      }

      const perPage = input.per_page ?? 20;

      const response = await platformProxy.get({
        // https://docs.gitlab.com/api/projects/#list-all-projects
        endpoint: '/api/v4/projects',
        params: {
          page: currentPage,
          per_page: perPage,
          ...(input.search !== undefined && { search: input.search }),
          ...(input.owned !== undefined && { owned: String(input.owned) }),
          ...(input.membership !== undefined && { membership: String(input.membership) }),
          ...(input.visibility !== undefined && { visibility: input.visibility }),
          ...(input.archived !== undefined && { archived: String(input.archived) }),
        },
        retries: 3,
      });
      fillGitLabNextPage(response.headers);

      const projects = z.array(ProviderProjectSchema).parse(response.data);

      const nextPageHeader = response.headers['x-next-page'];
      const next_cursor = typeof nextPageHeader === 'string' && nextPageHeader.length > 0 ? nextPageHeader : undefined;

      return {
        items: projects.map(project => ({
          id: project.id,
          name: project.name,
          path: project.path,
          ...(project.description != null && { description: project.description }),
          web_url: project.web_url,
          ...(project.created_at != null && { created_at: project.created_at }),
          ...(project.updated_at != null && { updated_at: project.updated_at }),
          ...(project.visibility != null && { visibility: project.visibility }),
          ...(project.default_branch != null && { default_branch: project.default_branch }),
        })),
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
