// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateIssueInputSchema = z.object({
  id: z.string().describe('The identifier of the issue to update. Example: "ISSUE-123" or UUID'),
  title: z.string().optional().describe('The title of the issue'),
  description: z
    .string()
    .nullable()
    .optional()
    .describe('The description of the issue in markdown format. Pass null to clear.'),
  priority: z
    .number()
    .nullable()
    .optional()
    .describe(
      'The priority of the issue. 0 = no priority, 1 = urgent, 2 = high, 3 = medium, 4 = low. Pass null to clear.',
    ),
  stateId: z
    .string()
    .nullable()
    .optional()
    .describe('The identifier of the workflow state to move the issue to. Pass null to clear.'),
  assigneeId: z
    .string()
    .nullable()
    .optional()
    .describe('The identifier of the user to assign the issue to. Pass null to clear.'),
  labelIds: z
    .array(z.string())
    .nullable()
    .optional()
    .describe('The identifiers of labels to attach to the issue. Pass null to clear.'),
  projectId: z
    .string()
    .nullable()
    .optional()
    .describe('The identifier of the project to add the issue to. Pass null to clear.'),
});

const ProviderIssueSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  priority: z.number().nullable().optional(),
  state: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  assignee: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  labels: z
    .object({
      nodes: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
        }),
      ),
    })
    .optional(),
  project: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  updatedAt: z.string().optional(),
  createdAt: z.string().optional(),
});

const ProviderPayloadSchema = z.object({
  data: z.object({
    issueUpdate: z.object({
      success: z.boolean(),
      issue: ProviderIssueSchema.nullable().optional(),
    }),
  }),
});

export const updateIssueOutputSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.number().optional(),
  stateId: z.string().optional(),
  stateName: z.string().optional(),
  assigneeId: z.string().optional(),
  assigneeName: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  updatedAt: z.string().optional(),
  createdAt: z.string().optional(),
});

export function updateIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_update_issue',
    description: 'Update fields on an existing Linear issue',
    inputSchema: updateIssueInputSchema,
    outputSchema: updateIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const updateInput: {
        title?: string;
        description?: string | null;
        priority?: number | null;
        stateId?: string | null;
        assigneeId?: string | null;
        labelIds?: string[] | null;
        projectId?: string | null;
      } = {};

      if (input.title !== undefined) {
        updateInput.title = input.title;
      }
      if (input.description !== undefined) {
        updateInput.description = input.description;
      }
      if (input.priority !== undefined) {
        updateInput.priority = input.priority;
      }
      if (input.stateId !== undefined) {
        updateInput.stateId = input.stateId;
      }
      if (input.assigneeId !== undefined) {
        updateInput.assigneeId = input.assigneeId;
      }
      if (input.labelIds !== undefined) {
        updateInput.labelIds = input.labelIds;
      }
      if (input.projectId !== undefined) {
        updateInput.projectId = input.projectId;
      }

      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
                        issueUpdate(id: $id, input: $input) {
                            success
                            issue {
                                id
                                title
                                description
                                priority
                                state {
                                    id
                                    name
                                }
                                assignee {
                                    id
                                    name
                                }
                                labels {
                                    nodes {
                                        id
                                        name
                                    }
                                }
                                project {
                                    id
                                    name
                                }
                                updatedAt
                                createdAt
                            }
                        }
                    }
                `,
          variables: {
            id: input.id,
            input: updateInput,
          },
        },
        retries: 3,
      });

      const rawBody = z.record(z.string(), z.unknown()).parse(response.data);
      const errors = rawBody['errors'];
      if (Array.isArray(errors) && errors.length > 0) {
        const firstError = errors[0];
        const errorMessage =
          typeof firstError === 'object' && firstError !== null && 'message' in firstError
            ? String(firstError['message'])
            : 'GraphQL error';
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: errorMessage,
        });
      }

      const payload = ProviderPayloadSchema.parse(response.data);
      const result = payload.data.issueUpdate;

      if (!result.success) {
        throw new platformProxy.ActionError({
          type: 'update_failed',
          message: 'Linear issueUpdate mutation reported failure.',
        });
      }

      if (!result.issue) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Issue not found or could not be updated for id: ${input.id}`,
        });
      }

      const issue = result.issue;

      return {
        id: issue.id,
        ...(issue.title !== undefined && { title: issue.title }),
        ...(issue.description != null && { description: issue.description }),
        ...(issue.priority != null && { priority: issue.priority }),
        ...(issue.state != null && { stateId: issue.state.id, stateName: issue.state.name }),
        ...(issue.assignee != null && { assigneeId: issue.assignee.id, assigneeName: issue.assignee.name }),
        ...(issue.labels !== undefined && {
          labelIds: issue.labels.nodes.map(label => label.id),
        }),
        ...(issue.project != null && { projectId: issue.project.id, projectName: issue.project.name }),
        ...(issue.updatedAt !== undefined && { updatedAt: issue.updatedAt }),
        ...(issue.createdAt !== undefined && { createdAt: issue.createdAt }),
      };
    },
  });
}
