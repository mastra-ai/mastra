// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getIssueLabelInputSchema = z.object({
  id: z.string().describe('The unique identifier of the issue label. Example: "abc123-def456"'),
});

const ProviderTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const ProviderIssueLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  archivedAt: z.string().nullable().optional(),
  team: ProviderTeamSchema.nullable().optional(),
});

export const getIssueLabelOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  archived: z.boolean(),
  team: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function getIssueLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_get_issue_label',
    description: 'Retrieve a Linear issue label by label ID.',
    inputSchema: getIssueLabelInputSchema,
    outputSchema: getIssueLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getIssueLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = `
            query IssueLabel($id: String!) {
                issueLabel(id: $id) {
                    id
                    name
                    color
                    archivedAt
                    team {
                        id
                        name
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
            id: input.id,
          },
        },
        retries: 3,
      });

      const data = response.data;
      if (!isRecord(data)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Received an invalid response from Linear.',
        });
      }

      const issueLabel = data['data'];
      if (!isRecord(issueLabel)) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Issue label not found for id: ${input.id}`,
        });
      }

      const labelValue = issueLabel['issueLabel'];
      if (!isRecord(labelValue)) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Issue label not found for id: ${input.id}`,
        });
      }

      const label = ProviderIssueLabelSchema.parse(labelValue);

      return {
        id: label.id,
        name: label.name,
        color: label.color,
        archived: label.archivedAt != null,
        ...(label.team != null && {
          team: {
            id: label.team.id,
            name: label.team.name,
          },
        }),
      };
    },
  });
}
