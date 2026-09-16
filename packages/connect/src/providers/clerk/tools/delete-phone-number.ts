// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deletePhoneNumberInputSchema = z.object({ phone_number_id: z.string() });

export const deletePhoneNumberOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deletePhoneNumberTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_delete_phone_number',
    description: 'Delete a Clerk phone number.',
    inputSchema: deletePhoneNumberInputSchema,
    outputSchema: deletePhoneNumberOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deletePhoneNumberOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://clerk.com/docs/reference/backend-api/tag/Phone-Numbers#operation/DeletePhoneNumber
        endpoint: `/v1/phone_numbers/${encodeURIComponent(input.phone_number_id)}`,
        retries: 3,
      });
      return { id: input.phone_number_id, success: true };
    },
  });
}
