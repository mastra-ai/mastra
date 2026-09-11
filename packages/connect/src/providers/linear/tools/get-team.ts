// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTeamInputSchema = z.object({
  id: z.string().describe('Team ID. Example: "team-id-123"'),
});

const TeamStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  type: z.string().optional(),
});

export const getTeamOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  description: z.string().optional(),
  states: z.array(TeamStateSchema).optional(),
});

const GraphQLResponseSchema = z.object({
  data: z
    .union([
      z.null(),
      z.object({
        team: z
          .union([
            z.null(),
            z.object({
              id: z.string(),
              name: z.string(),
              key: z.string(),
              description: z.string().nullable().optional(),
              states: z
                .object({
                  nodes: z
                    .array(
                      z.object({
                        id: z.string(),
                        name: z.string(),
                        color: z.string().nullable().optional(),
                        type: z.string().nullable().optional(),
                      }),
                    )
                    .optional(),
                })
                .optional(),
            }),
          ])
          .optional(),
      }),
    ])
    .optional(),
});

export function getTeamTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_get_team',
    description: 'Retrieve a Linear team by team ID.',
    inputSchema: getTeamInputSchema,
    outputSchema: getTeamOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTeamOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query: `
                    query Team($id: String!) {
                        team(id: $id) {
                            id
                            name
                            key
                            description
                            states {
                                nodes {
                                    id
                                    name
                                    color
                                    type
                                }
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
          message: 'Unexpected response structure from Linear API',
        });
      }

      const team = parsed.data.data?.team;
      if (!team) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Team not found: ${input.id}`,
        });
      }

      const output: z.infer<typeof getTeamOutputSchema> = {
        id: team.id,
        name: team.name,
        key: team.key,
      };

      if (team.description != null) {
        output.description = team.description;
      }

      if (team.states?.nodes != null) {
        output.states = team.states.nodes.map(state => {
          const stateOutput: z.infer<typeof TeamStateSchema> = {
            id: state.id,
            name: state.name,
          };

          if (state.color != null) {
            stateOutput.color = state.color;
          }

          if (state.type != null) {
            stateOutput.type = state.type;
          }

          return stateOutput;
        });
      }

      return output;
    },
  });
}
