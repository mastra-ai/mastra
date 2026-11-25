// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createSegmentInputSchema = z.object({
  name: z.string().describe('Segment name. Example: "Active Gmail Users"'),
  query_dsl: z
    .string()
    .describe(
      'SQL query selecting contact_id and updated_at. Example: "SELECT contact_id, updated_at FROM contact_data WHERE email LIKE \'%gmail.com\'"',
    ),
  parent_list_ids: z
    .array(z.string())
    .optional()
    .describe('Optional list IDs to scope the segment to. Example: ["fa1dbbb4-10af-42d7-b07e-d1ab501a805b"]'),
});

const ProviderStatusSchema = z.object({
  query_validation: z.string(),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  query_dsl: z.string(),
  status: ProviderStatusSchema,
  parent_list_ids: z.array(z.string()).nullable().optional(),
});

export const createSegmentOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  query_dsl: z.string(),
  query_validation: z.string(),
  parent_list_ids: z.array(z.string()).optional(),
});

export function createSegmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_create_segment',
    description: 'Create a segment from a SQL query over contacts.',
    inputSchema: createSegmentInputSchema,
    outputSchema: createSegmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSegmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://www.twilio.com/docs/sendgrid/api-reference/segments/create-segment
        endpoint: '/v3/marketing/segments/2.0',
        data: {
          name: input.name,
          query_dsl: input.query_dsl,
          ...(input.parent_list_ids !== undefined && { parent_list_ids: input.parent_list_ids }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        id: providerResponse.id,
        name: providerResponse.name,
        query_dsl: providerResponse.query_dsl,
        query_validation: providerResponse.status.query_validation,
        ...(Array.isArray(providerResponse.parent_list_ids) && { parent_list_ids: providerResponse.parent_list_ids }),
      };
    },
  });
}
