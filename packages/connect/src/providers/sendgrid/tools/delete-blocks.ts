// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteBlocksInputSchema = z
  .object({
    emails: z
      .array(z.string())
      .optional()
      .describe('Email addresses to remove from the block list. Example: ["user@example.com"]'),
    delete_all: z.boolean().optional().describe('If true, clear all block suppressions.'),
  })
  .refine(data => data.delete_all === true || (data.emails !== undefined && data.emails.length > 0), {
    message: 'Either delete_all must be true, or emails must contain at least one address.',
  });

export const deleteBlocksOutputSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful.'),
});

export function deleteBlocksTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_blocks',
    description: 'Clear block suppressions for one or more addresses, or all of them.',
    inputSchema: deleteBlocksInputSchema,
    outputSchema: deleteBlocksOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteBlocksOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body: Record<string, unknown> = {};
      if (input.delete_all === true) {
        body['delete_all'] = true;
      } else if (input.emails !== undefined) {
        body['emails'] = input.emails;
      }

      // https://www.twilio.com/docs/sendgrid/api-reference/blocks-api/delete-blocks
      await platformProxy.delete({
        endpoint: '/v3/suppression/blocks',
        data: body,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
