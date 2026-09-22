// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getCycleInputSchema = z.object({
  id: z.string().describe('The unique identifier of the Linear cycle. Example: "cycle-id-123"'),
});

const ProviderTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const ProviderCycleSchema = z.object({
  id: z.string(),
  team: ProviderTeamSchema.nullable().optional(),
  progress: z.number().nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
});

export const getCycleOutputSchema = z.object({
  id: z.string(),
  team: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  progress: z.number().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export function getCycleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_get_cycle',
    description: 'Retrieve a Linear cycle by cycle ID.',
    inputSchema: getCycleInputSchema,
    outputSchema: getCycleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCycleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: 'query Cycle($id: String!) { cycle(id: $id) { id team { id name } progress startsAt endsAt } }',
          variables: {
            id: input.id,
          },
        },
        retries: 3,
      });

      const cycleData = response.data?.data?.cycle;

      if (!cycleData) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Cycle with id ${input.id} not found.`,
        });
      }

      const providerCycle = ProviderCycleSchema.parse(cycleData);

      return {
        id: providerCycle.id,
        ...(providerCycle.team != null && {
          team: {
            id: providerCycle.team.id,
            name: providerCycle.team.name,
          },
        }),
        ...(providerCycle.progress != null && { progress: providerCycle.progress }),
        ...(providerCycle.startsAt != null && { startsAt: providerCycle.startsAt }),
        ...(providerCycle.endsAt != null && { endsAt: providerCycle.endsAt }),
      };
    },
  });
}
