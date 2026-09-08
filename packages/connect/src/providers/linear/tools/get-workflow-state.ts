// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getWorkflowStateInputSchema = z.object({
  stateId: z
    .string()
    .describe('The ID of the workflow state to retrieve. Example: "123e4567-e89b-12d3-a456-426614174000"'),
});

const ProviderTeamSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

const ProviderWorkflowStateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  team: ProviderTeamSchema.optional(),
  type: z.string().optional(),
  position: z.number().optional(),
  archivedAt: z.string().nullable().optional(),
});

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      workflowState: ProviderWorkflowStateSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        extensions: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

export const getWorkflowStateOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  team: z
    .object({
      id: z.string(),
      name: z.string().optional(),
    })
    .optional(),
  type: z.string().optional(),
  position: z.number().optional(),
  archived: z.boolean().optional(),
});

export function getWorkflowStateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_get_workflow_state',
    description: 'Retrieve a Linear workflow state by state ID.',
    inputSchema: getWorkflowStateInputSchema,
    outputSchema: getWorkflowStateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getWorkflowStateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    query GetWorkflowState($id: String!) {
                        workflowState(id: $id) {
                            id
                            name
                            team {
                                id
                                name
                            }
                            type
                            position
                            archivedAt
                        }
                    }
                `,
          variables: {
            id: input.stateId,
          },
        },
        retries: 3,
      });

      const body = GraphQLResponseSchema.parse(response.data);

      const firstError = body.errors?.[0];
      if (firstError) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: firstError.message,
          stateId: input.stateId,
        });
      }

      const workflowStateData = body.data?.workflowState;

      if (!workflowStateData) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Workflow state not found',
          stateId: input.stateId,
        });
      }

      return {
        id: workflowStateData.id,
        ...(workflowStateData.name !== undefined && { name: workflowStateData.name }),
        ...(workflowStateData.team !== undefined && {
          team: {
            id: workflowStateData.team.id,
            ...(workflowStateData.team.name !== undefined && { name: workflowStateData.team.name }),
          },
        }),
        ...(workflowStateData.type !== undefined && { type: workflowStateData.type }),
        ...(workflowStateData.position !== undefined && { position: workflowStateData.position }),
        ...(workflowStateData.archivedAt !== undefined && { archived: workflowStateData.archivedAt !== null }),
      };
    },
  });
}
