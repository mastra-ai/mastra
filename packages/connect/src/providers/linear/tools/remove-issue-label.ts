// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const removeIssueLabelInputSchema = z.object({
  issueId: z.string().describe('The identifier of the issue to remove the label from. Example: "ISS-123"'),
  labelId: z.string().describe('The identifier of the label to remove. Example: "label-uuid"'),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    issueRemoveLabel: z.object({
      success: z.boolean(),
      issue: z
        .object({
          id: z.string(),
          identifier: z.string().optional(),
          title: z.string().optional(),
          updatedAt: z.string().optional(),
        })
        .optional()
        .nullable(),
    }),
  }),
});

export const removeIssueLabelOutputSchema = z.object({
  success: z.boolean(),
  issueId: z.string(),
  labelId: z.string(),
  issue: z
    .object({
      id: z.string(),
      identifier: z.string().optional(),
      title: z.string().optional(),
      updatedAt: z.string().optional(),
    })
    .optional(),
});

export function removeIssueLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_remove_issue_label',
    description: 'Remove a label from a Linear issue.',
    inputSchema: removeIssueLabelInputSchema,
    outputSchema: removeIssueLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeIssueLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    mutation IssueRemoveLabel($id: String!, $labelId: String!) {
                        issueRemoveLabel(id: $id, labelId: $labelId) {
                            success
                            issue {
                                id
                                identifier
                                title
                                updatedAt
                            }
                        }
                    }
                `,
          variables: {
            id: input.issueId,
            labelId: input.labelId,
          },
        },
        retries: 3,
      });

      const payload = ProviderResponseSchema.parse(response.data);
      const result = payload.data.issueRemoveLabel;

      return {
        success: result.success,
        issueId: input.issueId,
        labelId: input.labelId,
        ...(result.issue && {
          issue: {
            id: result.issue.id,
            ...(result.issue.identifier !== undefined && { identifier: result.issue.identifier }),
            ...(result.issue.title !== undefined && { title: result.issue.title }),
            ...(result.issue.updatedAt !== undefined && { updatedAt: result.issue.updatedAt }),
          },
        }),
      };
    },
  });
}
