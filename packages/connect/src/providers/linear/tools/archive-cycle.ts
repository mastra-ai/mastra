// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const archiveCycleInputSchema = z.object({
  id: z.string().describe('The identifier of the cycle to archive. Example: "cycle-uuid"'),
});

const ProviderCycleSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  number: z.number(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const ProviderPayloadSchema = z.object({
  success: z.boolean(),
  entity: ProviderCycleSchema.nullable().optional(),
  lastSyncId: z.number().optional(),
});

const GraphQlResponseSchema = z.object({
  data: z
    .object({
      cycleArchive: ProviderPayloadSchema,
    })
    .optional(),
  errors: z.array(z.unknown()).optional(),
});

export const archiveCycleOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  number: z.number(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  completedAt: z.string().optional(),
  success: z.boolean(),
});

export function archiveCycleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_archive_cycle',
    description: 'Archive a Linear cycle.',
    inputSchema: archiveCycleInputSchema,
    outputSchema: archiveCycleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof archiveCycleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    mutation CycleArchive($id: String!) {
                        cycleArchive(id: $id) {
                            success
                            entity {
                                id
                                name
                                number
                                startsAt
                                endsAt
                                completedAt
                                createdAt
                                updatedAt
                            }
                            lastSyncId
                        }
                    }
                `,
          variables: {
            id: input.id,
          },
        },
        retries: 10,
      });

      const parsed = GraphQlResponseSchema.parse(response.data);

      if (parsed.errors && parsed.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: 'Linear GraphQL returned errors',
          errors: parsed.errors,
        });
      }

      const payload = parsed.data?.cycleArchive;
      if (!payload) {
        throw new platformProxy.ActionError({
          type: 'archive_failed',
          message: 'Failed to archive cycle: no payload returned',
        });
      }

      if (!payload.success) {
        throw new platformProxy.ActionError({
          type: 'archive_failed',
          message: 'Cycle archive mutation returned success: false',
        });
      }

      const entity = payload.entity;
      if (!entity) {
        throw new platformProxy.ActionError({
          type: 'archive_failed',
          message: 'Cycle archive mutation returned no entity',
        });
      }

      return {
        id: entity.id,
        ...(entity.name != null && { name: entity.name }),
        number: entity.number,
        ...(entity.startsAt !== undefined && { startsAt: entity.startsAt }),
        ...(entity.endsAt !== undefined && { endsAt: entity.endsAt }),
        ...(entity.completedAt != null && { completedAt: entity.completedAt }),
        success: payload.success,
      };
    },
  });
}
