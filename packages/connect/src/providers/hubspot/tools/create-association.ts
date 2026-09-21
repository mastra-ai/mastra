// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createAssociationInputSchema = z.object({
  fromObjectType: z
    .string()
    .describe('The type of the object to associate from. Example: "contacts", "companies", "deals", "tickets"'),
  fromObjectId: z.string().describe('The ID of the object to associate from. Example: "12345"'),
  toObjectType: z
    .string()
    .describe('The type of the object to associate to. Example: "contacts", "companies", "deals", "tickets"'),
  toObjectId: z.string().describe('The ID of the object to associate to. Example: "67890"'),
  associationType: z
    .string()
    .optional()
    .describe('The association type identifier. If not provided, a default association will be created.'),
  associationCategory: z
    .enum(['HUBSPOT_DEFINED', 'USER_DEFINED', 'INTEGRATOR_DEFINED'])
    .optional()
    .describe('The category of the association type. Required if association_type is provided.'),
});

export const createAssociationOutputSchema = z.object({
  status: z.string(),
  results: z.array(
    z.object({
      fromId: z.string(),
      toId: z.string(),
      associationType: z.string().optional(),
      associationCategory: z.string().optional(),
    }),
  ),
  startedAt: z.string(),
  completedAt: z.string(),
});

export function createAssociationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_create_association',
    description: 'Associate two records together',
    inputSchema: createAssociationInputSchema,
    outputSchema: createAssociationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createAssociationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const inputs: Record<string, any>[] = [
        {
          from: {
            id: input.fromObjectId,
          },
          to: {
            id: input.toObjectId,
          },
        },
      ];

      const inputEntry = inputs[0]!;

      // Add association type if provided
      if (input.associationType) {
        inputEntry['type'] = input.associationType;

        if (input.associationCategory) {
          inputEntry['associationCategory'] = input.associationCategory;
        }
      }

      // https://developers.hubspot.com/docs/api-reference/crm-associations-v3/batch/create
      const response = await platformProxy.post({
        endpoint: `/crm/v3/associations/${input.fromObjectType}/${input.toObjectType}/batch/create`,
        data: { inputs },
        retries: 3,
      });

      const data = response.data;

      return {
        status: data.status,
        results: (data.results || []).map((result: any) => ({
          fromId: result.from?.id ?? input.fromObjectId,
          toId: result.to?.id ?? input.toObjectId,
          associationType: result.type ?? undefined,
          associationCategory: result.associationCategory ?? undefined,
        })),
        startedAt: data.startedAt,
        completedAt: data.completedAt,
      };
    },
  });
}
