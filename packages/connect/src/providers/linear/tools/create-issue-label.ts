// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createIssueLabelInputSchema = z.object({
  name: z.string().min(1).describe('The name of the issue label. Example: "Bug"'),
  color: z.string().optional().describe('The color of the label as a HEX string. Example: "#EB5757"'),
  teamId: z
    .string()
    .optional()
    .describe('The identifier of the team to associate the label with. If omitted, the label will be workspace-level.'),
  description: z.string().optional().describe('The description of the label.'),
});

const IssueLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable().optional(),
  team: z
    .object({
      id: z.string(),
    })
    .nullable()
    .optional(),
});

const ResponseSchema = z.object({
  data: z.object({
    issueLabelCreate: z.object({
      success: z.boolean(),
      issueLabel: IssueLabelSchema,
    }),
  }),
});

const GraphQLErrorSchema = z.object({
  message: z.string(),
  path: z.array(z.string()).optional(),
});

export const createIssueLabelOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string().optional(),
  teamId: z.string().optional(),
});

export function createIssueLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_create_issue_label',
    description: 'Create a Linear issue label.',
    inputSchema: createIssueLabelInputSchema,
    outputSchema: createIssueLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createIssueLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = `
            mutation IssueLabelCreate($input: IssueLabelCreateInput!) {
                issueLabelCreate(input: $input) {
                    success
                    issueLabel {
                        id
                        name
                        color
                        description
                        team {
                            id
                        }
                    }
                }
            }
        `;

      const variables = {
        input: {
          name: input.name,
          ...(input.color !== undefined && { color: input.color }),
          ...(input.teamId !== undefined && { teamId: input.teamId }),
          ...(input.description !== undefined && { description: input.description }),
        },
      };

      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query,
          variables,
        },
        retries: 0,
      });

      const raw = z
        .object({
          data: z.unknown(),
          errors: z.array(GraphQLErrorSchema).optional(),
        })
        .parse(response.data);

      if (raw.errors && raw.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: raw.errors.map(e => e.message).join(', '),
        });
      }

      const parsed = ResponseSchema.parse(response.data);

      if (!parsed.data.issueLabelCreate.success) {
        throw new platformProxy.ActionError({
          type: 'mutation_failed',
          message: 'Linear issueLabelCreate mutation returned success: false.',
        });
      }

      const label = parsed.data.issueLabelCreate.issueLabel;

      return {
        id: label.id,
        name: label.name,
        color: label.color,
        ...(label.description != null && { description: label.description }),
        ...(label.team != null && { teamId: label.team.id }),
      };
    },
  });
}
