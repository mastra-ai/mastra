// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createIssueRelationInputSchema = z.object({
  issueId: z.string().describe('ID of the primary issue. Example: "c5748ccf-c67f-4af4-bd74-fe513dc4c054"'),
  relatedIssueId: z.string().describe('ID of the related issue. Example: "71bc4480-3aa1-4c56-b657-827996658662"'),
  type: z
    .enum(['blocks', 'blocked_by', 'duplicate', 'duplicate_of', 'related'])
    .describe('Type of relationship between the issues.'),
});

const IssueRelationSchema = z.object({
  id: z.string(),
  type: z.string(),
  issue: z
    .object({
      id: z.string(),
      identifier: z.string(),
    })
    .optional(),
  relatedIssue: z
    .object({
      id: z.string(),
      identifier: z.string(),
    })
    .optional(),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    issueRelationCreate: z.object({
      success: z.boolean(),
      issueRelation: IssueRelationSchema.nullable().optional(),
    }),
  }),
});

export const createIssueRelationOutputSchema = z.object({
  id: z.string(),
  type: z.string(),
  issueId: z.string().optional(),
  issueIdentifier: z.string().optional(),
  relatedIssueId: z.string().optional(),
  relatedIssueIdentifier: z.string().optional(),
});

export function createIssueRelationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_create_issue_relation',
    description: 'Create a relationship between two Linear issues.',
    inputSchema: createIssueRelationInputSchema,
    outputSchema: createIssueRelationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createIssueRelationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query: `
                    mutation IssueRelationCreate($input: IssueRelationCreateInput!) {
                        issueRelationCreate(input: $input) {
                            success
                            issueRelation {
                                id
                                type
                                issue {
                                    id
                                    identifier
                                }
                                relatedIssue {
                                    id
                                    identifier
                                }
                            }
                        }
                    }
                `,
          variables: {
            input: {
              issueId: input.issueId,
              relatedIssueId: input.relatedIssueId,
              type: input.type,
            },
          },
        },
        retries: 1,
      });

      const parsed = ProviderResponseSchema.safeParse(response.data);

      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response from Linear API.',
          details: parsed.error.issues,
        });
      }

      const result = parsed.data.data.issueRelationCreate;

      if (!result.success) {
        throw new platformProxy.ActionError({
          type: 'creation_failed',
          message: 'Linear reported the issue relation creation was not successful.',
        });
      }

      if (!result.issueRelation) {
        throw new platformProxy.ActionError({
          type: 'missing_relation',
          message: 'Linear did not return the created issue relation.',
        });
      }

      return {
        id: result.issueRelation.id,
        type: result.issueRelation.type,
        ...(result.issueRelation.issue != null && {
          issueId: result.issueRelation.issue.id,
          issueIdentifier: result.issueRelation.issue.identifier,
        }),
        ...(result.issueRelation.relatedIssue != null && {
          relatedIssueId: result.issueRelation.relatedIssue.id,
          relatedIssueIdentifier: result.issueRelation.relatedIssue.identifier,
        }),
      };
    },
  });
}
