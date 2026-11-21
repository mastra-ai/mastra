// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteInvalidEmailsInputSchema = z.object({
  emails: z
    .array(z.string().email())
    .optional()
    .describe('Email addresses to remove from invalid-email suppressions. Example: ["test@example.com"]'),
  delete_all: z.boolean().optional().describe('If true, remove all invalid-email suppressions.'),
});

export const deleteInvalidEmailsOutputSchema = z.object({
  deleted: z.boolean().optional(),
  emails_deleted: z.array(z.string()).optional(),
});

const ProviderResponseSchema = z
  .object({
    emails: z.array(z.string()).optional(),
  })
  .passthrough();

export function deleteInvalidEmailsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_invalid_emails',
    description: 'Clear invalid-email suppressions for one or more addresses, or all of them.',
    inputSchema: deleteInvalidEmailsInputSchema,
    outputSchema: deleteInvalidEmailsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteInvalidEmailsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (!input.delete_all && (!input.emails || input.emails.length === 0)) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Provide either emails or delete_all.',
        });
      }

      const response = await platformProxy.delete({
        // https://www.twilio.com/docs/sendgrid/api-reference/suppressions-invalid-emails
        endpoint: '/v3/suppression/invalid_emails',
        data: input.delete_all ? { delete_all: true } : { emails: input.emails },
        retries: 3,
      });

      const parsed = ProviderResponseSchema.safeParse(response.data);
      if (parsed.success && parsed.data.emails) {
        return {
          deleted: true,
          emails_deleted: parsed.data.emails,
        };
      }

      return { deleted: true };
    },
  });
}
