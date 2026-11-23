// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createSuppressionGroupInputSchema = z.object({
  name: z.string().describe('The name of the unsubscribe group. Example: "Newsletter Unsubscribes"'),
  description: z
    .string()
    .describe(
      'A description of the unsubscribe group. Example: "Recipients who no longer wish to receive our newsletter"',
    ),
  is_default: z
    .boolean()
    .optional()
    .describe('Whether this group should be the default for new suppressions. Defaults to false.'),
});

const ProviderOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  is_default: z.boolean(),
});

export const createSuppressionGroupOutputSchema = z.object({
  id: z.number().describe('The unique ID of the suppression group. Example: 12345'),
  name: z.string().describe('The name of the suppression group.'),
  description: z.string().describe('The description of the suppression group.'),
  is_default: z.boolean().describe('Whether this is the default suppression group.'),
});

export function createSuppressionGroupTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_create_suppression_group',
    description: 'Create an unsubscribe group.',
    inputSchema: createSuppressionGroupInputSchema,
    outputSchema: createSuppressionGroupOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSuppressionGroupOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://www.twilio.com/docs/sendgrid/api-reference/suppressions-groups/create-a-suppression-group
        endpoint: '/v3/asm/groups',
        data: {
          name: input.name,
          description: input.description,
          ...(input.is_default !== undefined && { is_default: input.is_default }),
        },
        retries: 10,
      });

      const group = ProviderOutputSchema.parse(response.data);

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        is_default: group.is_default,
      };
    },
  });
}
