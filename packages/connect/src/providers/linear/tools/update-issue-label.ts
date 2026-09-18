// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateIssueLabelInputSchema = z.object({
  id: z.string().describe('The identifier of the label to update.'),
  name: z.string().optional().describe('The name of the label.'),
  color: z.string().optional().describe('The color of the label as a HEX string.'),
  description: z.string().optional().describe('The description of the label.'),
});

export const updateIssueLabelOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archivedAt: z.string().nullable().optional(),
});

const GraphQLErrorSchema = z.object({
  message: z.string(),
});

const IssueLabelUpdateResponseSchema = z.object({
  data: z
    .object({
      issueLabelUpdate: z.object({
        success: z.boolean(),
        issueLabel: z.object({
          id: z.string(),
          name: z.string(),
          color: z.string().nullable().optional(),
          description: z.string().nullable().optional(),
          createdAt: z.string().optional(),
          updatedAt: z.string().optional(),
          archivedAt: z.string().nullable().optional(),
        }),
      }),
    })
    .optional(),
  errors: z.array(GraphQLErrorSchema).optional(),
});

export function updateIssueLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_update_issue_label',
    description: 'Update an existing Linear issue label.',
    inputSchema: updateIssueLabelInputSchema,
    outputSchema: updateIssueLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateIssueLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const mutation = `
            mutation UpdateIssueLabel($id: String!, $input: IssueLabelUpdateInput!) {
                issueLabelUpdate(id: $id, input: $input) {
                    success
                    issueLabel {
                        id
                        name
                        color
                        description
                        createdAt
                        updatedAt
                        archivedAt
                    }
                }
            }
        `;

      const variables = {
        id: input.id,
        input: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.color !== undefined && { color: input.color }),
          ...(input.description !== undefined && { description: input.description }),
        },
      };

      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query: mutation,
          variables,
        },
        retries: 3,
      });

      const payload = IssueLabelUpdateResponseSchema.parse(response.data);

      if (payload.errors && payload.errors.length > 0) {
        const message = payload.errors.map(e => e.message).join(', ');
        throw new platformProxy.ActionError({ message: `Linear issueLabelUpdate failed: ${message}` });
      }

      const label = payload.data?.issueLabelUpdate?.issueLabel;
      if (!label) {
        throw new platformProxy.ActionError({ message: 'Linear issueLabelUpdate did not return a label.' });
      }

      return {
        id: label.id,
        name: label.name,
        color: label.color ?? undefined,
        description: label.description ?? undefined,
        createdAt: label.createdAt,
        updatedAt: label.updatedAt,
        archivedAt: label.archivedAt ?? undefined,
      };
    },
  });
}
