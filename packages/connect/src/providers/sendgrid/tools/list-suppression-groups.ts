// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSuppressionGroupsInputSchema = z.object({});

const GroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  last_email_sent_at: z.string().nullable().optional(),
  is_default: z.boolean().optional(),
  unsubscribes: z.number().optional(),
});

export const listSuppressionGroupsOutputSchema = z.object({
  items: z.array(GroupSchema),
});

export function listSuppressionGroupsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_suppression_groups',
    description: 'List unsubscribe groups.',
    inputSchema: listSuppressionGroupsInputSchema,
    outputSchema: listSuppressionGroupsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSuppressionGroupsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://www.twilio.com/docs/sendgrid/api-reference/suppressions-unsubscribe-groups
        endpoint: '/v3/asm/groups',
        retries: 3,
      });

      if (!Array.isArray(response.data)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Expected an array of suppression groups from the provider.',
        });
      }

      const items = response.data.map((group: unknown) => {
        const parsed = GroupSchema.parse(group);
        return {
          id: parsed.id,
          name: parsed.name,
          ...(parsed.description !== undefined && { description: parsed.description }),
          ...(parsed.last_email_sent_at !== undefined &&
            parsed.last_email_sent_at !== null && { last_email_sent_at: parsed.last_email_sent_at }),
          ...(parsed.is_default !== undefined && { is_default: parsed.is_default }),
          ...(parsed.unsubscribes !== undefined && { unsubscribes: parsed.unsubscribes }),
        };
      });

      return { items };
    },
  });
}
