// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateIssueRelationInputSchema = z.object({
  id: z
    .string()
    .describe('The identifier of the issue relation to update. Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"'),
  issueId: z
    .string()
    .optional()
    .describe(
      "The identifier of the issue that is related to another issue. Can be a UUID or issue identifier (e.g., 'LIN-123').",
    ),
  relatedIssueId: z
    .string()
    .optional()
    .describe("The identifier of the related issue. Can be a UUID or issue identifier (e.g., 'LIN-123')."),
  type: z
    .enum(['blocks', 'duplicate', 'related', 'similar'])
    .optional()
    .describe('The type of relation of the issue to the related issue.'),
});

const ProviderIssueRelationSchema = z.object({
  id: z.string(),
  type: z.string(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
  issue: z
    .object({
      id: z.string(),
    })
    .optional(),
  relatedIssue: z
    .object({
      id: z.string(),
    })
    .optional(),
});

const ProviderPayloadSchema = z.object({
  data: z.object({
    issueRelationUpdate: z.object({
      success: z.boolean(),
      lastSyncId: z.number(),
      issueRelation: ProviderIssueRelationSchema,
    }),
  }),
});

export const updateIssueRelationOutputSchema = z.object({
  id: z.string(),
  type: z.string(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
  issueId: z.string().optional(),
  relatedIssueId: z.string().optional(),
});

export function updateIssueRelationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_update_issue_relation',
    description: 'Update fields on an existing Linear issue relation.',
    inputSchema: updateIssueRelationInputSchema,
    outputSchema: updateIssueRelationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateIssueRelationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const variables: {
        id: string;
        input: {
          issueId?: string;
          relatedIssueId?: string;
          type?: string;
        };
      } = {
        id: input.id,
        input: {},
      };

      if (input.issueId !== undefined) {
        variables.input.issueId = input.issueId;
      }
      if (input.relatedIssueId !== undefined) {
        variables.input.relatedIssueId = input.relatedIssueId;
      }
      if (input.type !== undefined) {
        variables.input.type = input.type;
      }

      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    mutation IssueRelationUpdate($id: String!, $input: IssueRelationUpdateInput!) {
                        issueRelationUpdate(id: $id, input: $input) {
                            success
                            lastSyncId
                            issueRelation {
                                id
                                type
                                createdAt
                                updatedAt
                                archivedAt
                                issue {
                                    id
                                }
                                relatedIssue {
                                    id
                                }
                            }
                        }
                    }
                `,
          variables,
        },
        retries: 10,
      });

      const payload = ProviderPayloadSchema.parse(response.data);
      const issueRelation = payload.data.issueRelationUpdate.issueRelation;

      return {
        id: issueRelation.id,
        type: issueRelation.type,
        ...(issueRelation.createdAt !== undefined && { createdAt: issueRelation.createdAt }),
        ...(issueRelation.updatedAt !== undefined && { updatedAt: issueRelation.updatedAt }),
        ...(issueRelation.archivedAt !== undefined && { archivedAt: issueRelation.archivedAt }),
        ...(issueRelation.issue !== undefined && { issueId: issueRelation.issue.id }),
        ...(issueRelation.relatedIssue !== undefined && { relatedIssueId: issueRelation.relatedIssue.id }),
      };
    },
  });
}
