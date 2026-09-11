// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addIssueLabelInputSchema = z.object({
  id: z
    .string()
    .describe('The identifier of the issue to add the label to. Example: "123e4567-e89b-12d3-a456-426614174000"'),
  labelId: z.string().describe('The identifier of the label to add. Example: "123e4567-e89b-12d3-a456-426614174001"'),
});

const ProviderIssuePayloadSchema = z.object({
  success: z.boolean(),
  issue: z
    .object({
      id: z.string(),
      identifier: z.string().optional(),
      title: z.string().optional(),
      updatedAt: z.string().optional(),
      labelIds: z.array(z.string()).optional(),
    })
    .optional(),
});

const GraphQLErrorSchema = z.object({
  message: z.string(),
});

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      issueAddLabel: z.unknown().optional(),
    })
    .nullable()
    .optional(),
  errors: z.array(GraphQLErrorSchema).optional(),
});

export const addIssueLabelOutputSchema = z.object({
  success: z.boolean(),
  issueId: z.string().optional(),
  identifier: z.string().optional(),
  title: z.string().optional(),
  updatedAt: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
});

export function addIssueLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_add_issue_label',
    description: 'Attach a label to a Linear issue.',
    inputSchema: addIssueLabelInputSchema,
    outputSchema: addIssueLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addIssueLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    mutation IssueAddLabel($id: String!, $labelId: String!) {
                        issueAddLabel(id: $id, labelId: $labelId) {
                            success
                            issue {
                                id
                                identifier
                                title
                                updatedAt
                                labelIds
                            }
                        }
                    }
                `,
          variables: {
            id: input.id,
            labelId: input.labelId,
          },
        },
        retries: 10,
      });

      const rawBody = GraphQLResponseSchema.parse(response.data);

      if (rawBody.errors && rawBody.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: rawBody.errors.map(e => e.message).join(', '),
          issueId: input.id,
          labelId: input.labelId,
        });
      }

      const providerResponse = ProviderIssuePayloadSchema.parse(rawBody.data?.issueAddLabel);

      if (!providerResponse.success) {
        throw new platformProxy.ActionError({
          type: 'mutation_failed',
          message: 'issueAddLabel mutation did not succeed',
          issueId: input.id,
          labelId: input.labelId,
        });
      }

      const issue = providerResponse.issue;
      if (!issue) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Issue not found after label add operation',
          issueId: input.id,
          labelId: input.labelId,
        });
      }

      return {
        success: providerResponse.success,
        issueId: issue.id,
        ...(issue.identifier !== undefined && { identifier: issue.identifier }),
        ...(issue.title !== undefined && { title: issue.title }),
        ...(issue.updatedAt !== undefined && { updatedAt: issue.updatedAt }),
        ...(issue.labelIds !== undefined && { labelIds: issue.labelIds }),
      };
    },
  });
}
