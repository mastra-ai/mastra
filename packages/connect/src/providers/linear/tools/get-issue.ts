// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getIssueInputSchema = z.object({
  id: z.string().describe('Issue ID or identifier. Example: "c7a3b3c0-0000-0000-0000-000000000000" or "TEAM-123"'),
});

const IssueStateSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  color: z.string().nullish(),
});

const IssueAssigneeSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  email: z.string().nullish(),
});

const IssueTeamSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  key: z.string().nullish(),
});

const IssueLabelSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  color: z.string().nullish(),
});

const IssueProjectSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  url: z.string().nullish(),
});

const ProviderIssueSchema = z.object({
  id: z.string(),
  identifier: z.string().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  url: z.string().nullish(),
  number: z.number().nullish(),
  priority: z.number().nullish(),
  estimate: z.number().nullish(),
  dueDate: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  archivedAt: z.string().nullish(),
  state: IssueStateSchema.nullable().optional(),
  assignee: IssueAssigneeSchema.nullable().optional(),
  team: IssueTeamSchema.nullable().optional(),
  labels: z
    .object({
      nodes: z.array(IssueLabelSchema).optional(),
    })
    .optional(),
  project: IssueProjectSchema.nullable().optional(),
});

export const getIssueOutputSchema = z.object({
  id: z.string(),
  identifier: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  number: z.number().optional(),
  priority: z.number().optional(),
  estimate: z.number().optional(),
  dueDate: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archivedAt: z.string().optional(),
  state: IssueStateSchema.optional(),
  assignee: IssueAssigneeSchema.optional(),
  team: IssueTeamSchema.optional(),
  labels: z.array(IssueLabelSchema).optional(),
  project: IssueProjectSchema.optional(),
});

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      issue: ProviderIssueSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string().optional(),
      }),
    )
    .nullable()
    .optional(),
});

export function getIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_get_issue',
    description: 'Retrieve a Linear issue by issue ID.',
    inputSchema: getIssueInputSchema,
    outputSchema: getIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    query GetIssue($id: String!) {
                        issue(id: $id) {
                            id
                            identifier
                            title
                            description
                            url
                            number
                            priority
                            estimate
                            dueDate
                            createdAt
                            updatedAt
                            archivedAt
                            state {
                                id
                                name
                                color
                            }
                            assignee {
                                id
                                name
                                email
                            }
                            team {
                                id
                                name
                                key
                            }
                            labels {
                                nodes {
                                    id
                                    name
                                    color
                                }
                            }
                            project {
                                id
                                name
                                url
                            }
                        }
                    }
                `,
          variables: {
            id: input.id,
          },
        },
        retries: 3,
      });

      const parsed = GraphQLResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Linear API',
        });
      }

      if (parsed.data.errors && parsed.data.errors.length > 0) {
        const firstErrorMessage = parsed.data.errors[0]?.message;
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: firstErrorMessage || 'GraphQL error',
          errors: parsed.data.errors,
        });
      }

      const providerIssue = parsed.data.data?.issue;
      if (!providerIssue) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Issue not found for id: ${input.id}`,
        });
      }

      return {
        id: providerIssue.id,
        ...(providerIssue.identifier != null && { identifier: providerIssue.identifier }),
        ...(providerIssue.title != null && { title: providerIssue.title }),
        ...(providerIssue.description != null && { description: providerIssue.description }),
        ...(providerIssue.url != null && { url: providerIssue.url }),
        ...(providerIssue.number != null && { number: providerIssue.number }),
        ...(providerIssue.priority != null && { priority: providerIssue.priority }),
        ...(providerIssue.estimate != null && { estimate: providerIssue.estimate }),
        ...(providerIssue.dueDate != null && { dueDate: providerIssue.dueDate }),
        ...(providerIssue.createdAt != null && { createdAt: providerIssue.createdAt }),
        ...(providerIssue.updatedAt != null && { updatedAt: providerIssue.updatedAt }),
        ...(providerIssue.archivedAt != null && { archivedAt: providerIssue.archivedAt }),
        ...(providerIssue.state != null && { state: providerIssue.state }),
        ...(providerIssue.assignee != null && { assignee: providerIssue.assignee }),
        ...(providerIssue.team != null && { team: providerIssue.team }),
        ...(providerIssue.labels?.nodes !== undefined && { labels: providerIssue.labels.nodes }),
        ...(providerIssue.project != null && { project: providerIssue.project }),
      };
    },
  });
}
