// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createCycleInputSchema = z.object({
  teamId: z
    .string()
    .describe('The ID of the team this cycle belongs to. Example: "9cfb482a-81e3-4154-b5b9-2c805e70a02d"'),
  name: z.string().describe('The name of the cycle. Example: "Sprint 23"'),
  description: z.string().optional().describe('The description of the cycle.'),
  startsAt: z
    .string()
    .datetime()
    .describe('The start date of the cycle in ISO 8601 format. Example: "2024-01-15T00:00:00Z"'),
  endsAt: z
    .string()
    .datetime()
    .describe('The end date of the cycle in ISO 8601 format. Example: "2024-01-29T00:00:00Z"'),
  completedAt: z.string().datetime().optional().describe('The completion date of the cycle in ISO 8601 format.'),
});

const TeamSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

const CycleSchema = z.object({
  id: z.string(),
  name: z.string(),
  number: z.number(),
  description: z.string().nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  isNext: z.boolean().optional(),
  isPrevious: z.boolean().optional(),
  progress: z.number().optional(),
  team: TeamSchema.optional(),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    cycleCreate: z.object({
      success: z.boolean(),
      cycle: CycleSchema.nullable().optional(),
    }),
  }),
});

export const createCycleOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  number: z.number(),
  description: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  completedAt: z.string().optional(),
  isActive: z.boolean().optional(),
  isNext: z.boolean().optional(),
  isPrevious: z.boolean().optional(),
  progress: z.number().optional(),
  team: TeamSchema.optional(),
});

export function createCycleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_create_cycle',
    description: 'Create a cycle for a Linear team.',
    inputSchema: createCycleInputSchema,
    outputSchema: createCycleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCycleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const variables = {
        input: {
          teamId: input.teamId,
          name: input.name,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
        },
      };

      const query = `
            mutation CycleCreate($input: CycleCreateInput!) {
                cycleCreate(input: $input) {
                    success
                    cycle {
                        id
                        name
                        number
                        description
                        startsAt
                        endsAt
                        completedAt
                        isActive
                        isNext
                        isPrevious
                        progress
                        team {
                            id
                            name
                        }
                    }
                }
            }
        `;

      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query,
          variables,
        },
        retries: 10,
      });

      const parsed = ProviderResponseSchema.parse(response.data);
      const payload = parsed.data.cycleCreate;

      if (!payload.success || !payload.cycle) {
        throw new platformProxy.ActionError({
          type: 'creation_failed',
          message: 'Cycle creation failed or returned no cycle.',
          success: payload.success,
        });
      }

      const cycle = payload.cycle;

      return {
        id: cycle.id,
        name: cycle.name,
        number: cycle.number,
        ...(cycle.description != null && { description: cycle.description }),
        ...(cycle.startsAt !== undefined && { startsAt: cycle.startsAt }),
        ...(cycle.endsAt !== undefined && { endsAt: cycle.endsAt }),
        ...(cycle.completedAt != null && { completedAt: cycle.completedAt }),
        ...(cycle.isActive !== undefined && { isActive: cycle.isActive }),
        ...(cycle.isNext !== undefined && { isNext: cycle.isNext }),
        ...(cycle.isPrevious !== undefined && { isPrevious: cycle.isPrevious }),
        ...(cycle.progress !== undefined && { progress: cycle.progress }),
        ...(cycle.team !== undefined && { team: cycle.team }),
      };
    },
  });
}
