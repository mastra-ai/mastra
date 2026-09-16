// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listProjectsInputSchema = z.object({
  first: z.number().int().min(1).max(100).optional().describe('Number of projects to return. Maximum: 100.'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Project filter object. Example: { state: { eq: "started" } }'),
  orderBy: z.string().optional().describe('Order by field. Example: "updatedAt"'),
});

const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
});

const LeadSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
});

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  state: z.string(),
  progress: z.number().optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  url: z.string().optional(),
  lead: LeadSchema.optional(),
  teams: z
    .object({
      nodes: z.array(TeamSchema),
    })
    .optional(),
});

export const listProjectsOutputSchema = z.object({
  projects: z.array(ProjectSchema),
  nextCursor: z.string().optional(),
});

const RawLeadSchema = LeadSchema.nullable();

const RawProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  state: z.string(),
  progress: z.number().nullable(),
  startDate: z.string().nullable(),
  targetDate: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  url: z.string().nullable(),
  lead: RawLeadSchema,
  teams: z
    .object({
      nodes: z.array(TeamSchema),
    })
    .nullable(),
});

export function listProjectsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_list_projects',
    description: 'List Linear projects with filtering and pagination.',
    inputSchema: listProjectsInputSchema,
    outputSchema: listProjectsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listProjectsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = `
            query Projects($filter: ProjectFilter, $orderBy: PaginationOrderBy, $first: Int, $after: String) {
                projects(filter: $filter, orderBy: $orderBy, first: $first, after: $after) {
                    nodes {
                        id
                        name
                        description
                        state
                        progress
                        startDate
                        targetDate
                        createdAt
                        updatedAt
                        url
                        lead {
                            id
                            name
                            email
                        }
                        teams {
                            nodes {
                                id
                                name
                                key
                            }
                        }
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        `;

      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query,
          variables: {
            ...(input.first !== undefined && { first: input.first }),
            ...(input.cursor !== undefined && { after: input.cursor }),
            ...(input.filter !== undefined && { filter: input.filter }),
            ...(input.orderBy !== undefined && { orderBy: input.orderBy }),
          },
        },
        retries: 3,
      });

      const responseData = z
        .object({
          data: z.object({
            projects: z.object({
              nodes: z.array(z.unknown()),
              pageInfo: z.object({
                hasNextPage: z.boolean(),
                endCursor: z.string().nullable(),
              }),
            }),
          }),
        })
        .parse(response.data);

      const nodes = responseData.data.projects.nodes;
      const pageInfo = responseData.data.projects.pageInfo;

      const projects: z.infer<typeof ProjectSchema>[] = [];

      for (const node of nodes) {
        const raw = RawProjectSchema.parse(node);
        const project: z.infer<typeof ProjectSchema> = {
          id: raw.id,
          name: raw.name,
          state: raw.state,
          ...(raw.description !== null && { description: raw.description }),
          ...(raw.progress !== null && { progress: raw.progress }),
          ...(raw.startDate !== null && { startDate: raw.startDate }),
          ...(raw.targetDate !== null && { targetDate: raw.targetDate }),
          ...(raw.createdAt !== null && { createdAt: raw.createdAt }),
          ...(raw.updatedAt !== null && { updatedAt: raw.updatedAt }),
          ...(raw.url !== null && { url: raw.url }),
          ...(raw.lead !== null && { lead: raw.lead }),
          ...(raw.teams !== null && { teams: raw.teams }),
        };
        projects.push(project);
      }

      return {
        projects,
        ...(pageInfo.endCursor !== null && pageInfo.hasNextPage && { nextCursor: pageInfo.endCursor }),
      };
    },
  });
}
